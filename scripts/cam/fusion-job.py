# The script `pnpm cam` runs inside the Fusion desktop app, through its local MCP server (`fusion_mcp_execute`,
# featureType "script"). It is sent as text, preceded by one line `JOB = json.loads("...")` (see cam/fusion.ts), and
# run by Fusion's Python with the Fusion API. Fusion calls `run`; a raised exception comes back as the tool's error,
# so nothing here catches one unless it means to go on.
#
# Each call does one small step, so that no call holds Fusion long; the toolpaths are generated between calls. The
# machining values (tool, feeds, stepdowns, tabs, ...) all come from `pnpm cam`, in JOB["machining"]: this script
# only applies them.
#
# JOB["op"]:
#   "import":   import the STEP JOB["step"] into a new design document, name its bodies after the STEP's solids
#               (matched by their boxes, JOB["solids"]), tag the document with JOB["tag"]; return the bodies and
#               Fusion's version
#   "orient":   how body JOB["body"] lies in setup JOB["setup"] (turned by JOB["rotate"], degrees; null: laid flat on
#               its largest face), how high it stands, the faces a tool from the top cannot reach (read-only)
#   "setup":    for body JOB["body"], make setup JOB["setup"] ("<Body>_<setup>"; the board turned by JOB["rotate"]),
#               with the stock and the WCS, its operations (a 2D pocket on the recognised pockets, a 2D contour
#               around the outside, through), and start generating their toolpaths; with JOB["cut"] == "squared",
#               only a contour on the faces the turn squares (JOB["reference"]: the first setup's turn)
#   "status":   how far the toolpaths of setup JOB["setup"] are (read-only)
#   "post":     post setup JOB["setup"] with the library post matching JOB["post"] to JOB["folder"]/JOB["file"]
#   "close":    close the tagged document, without saving
#
# Every op prints its result as one line `INTEGRAL_RESULT <json>`.

import adsk.fusion

app = adsk.core.Application.get()


def done(result):
    print("INTEGRAL_RESULT " + json.dumps(result))


def tagged_document():
    """The document this run imported, found by its tag; made active, since scripts act on the active one."""
    for i in range(app.documents.count):
        document = app.documents.item(i)
        design = design_of(document)
        tag = design.attributes.itemByName("integral", "cam") if design else None
        if tag and tag.value == JOB["tag"]:
            if app.activeDocument != document:
                document.activate()
            return document
    raise RuntimeError(f"the document of this run ({JOB['tag']}) is not open in Fusion any more")


def product_of(document, product_type):
    """The document's product of that type, or None (itemByProductType raises when there is none)."""
    for i in range(document.products.count):
        product = document.products.item(i)
        if product.productType == product_type:
            return product
    return None


def design_of(document):
    return adsk.fusion.Design.cast(product_of(document, "DesignProductType"))


def cam_of(document):
    product = product_of(document, "CAMProductType")
    if not product:
        # A design gets its CAM product when the Manufacture workspace is first opened on it.
        app.userInterface.workspaces.itemById("CAMEnvironment").activate()
        product = product_of(document, "CAMProductType")
    if not product:
        raise RuntimeError("no CAM product in the document, even in the Manufacture workspace")
    return adsk.cam.CAM.cast(product)


def box_mm(body):
    b = body.boundingBox
    return [b.minPoint.x * 10, b.minPoint.y * 10, b.minPoint.z * 10, b.maxPoint.x * 10, b.maxPoint.y * 10, b.maxPoint.z * 10]


def import_step():
    options = app.importManager.createSTEPImportOptions(JOB["step"])
    document = app.importManager.importToNewDocument(options)
    if not document:
        raise RuntimeError(f"Fusion could not import {JOB['step']}")
    design = design_of(document)
    design.attributes.add("integral", "cam", JOB["tag"])
    # Fusion names the bodies Body1, Body2, …: give each the name of a STEP solid whose box (mm) fits it. A solid's box
    # is the box of its vertices, inside the body's true box: equal for a board of flat faces, smaller where a curve
    # bulges past its end points. So: the solids whose box is inside the body's, the closest of them, each one once.
    bodies = [design.rootComponent.bRepBodies.item(i) for i in range(design.rootComponent.bRepBodies.count)]
    named = []
    for body in bodies:
        box = box_mm(body)
        fits = [
            (sum(abs(a - b) for a, b in zip(box, s["box"])), s["name"])
            for s in JOB["solids"]
            if s["name"] not in named
            and all(s["box"][i] >= box[i] - 0.1 for i in range(3))
            and all(s["box"][i] <= box[i] + 0.1 for i in range(3, 6))
        ]
        if not fits:
            raise RuntimeError(f"no STEP solid fits the box of Fusion's {body.name}: {[round(v, 2) for v in box]}")
        gap, name = min(fits)
        body.name = name
        named.append(name)
    cam_of(document)
    done({"document": document.name, "bodies": named, "fusion": app.version})


def find_body(design, name):
    root = design.rootComponent
    for i in range(root.bRepBodies.count):
        if root.bRepBodies.item(i).name == name:
            return root.bRepBodies.item(i)
    raise RuntimeError(f"no body {name} in the design")


def rotation(angles, centre):
    """The matrix turning by angles = [x, y, z] degrees about centre, x first, then y, then z."""
    matrix = adsk.core.Matrix3D.create()
    axes = [adsk.core.Vector3D.create(1, 0, 0), adsk.core.Vector3D.create(0, 1, 0), adsk.core.Vector3D.create(0, 0, 1)]
    for degrees, axis in zip(angles, axes):
        if degrees:
            step = adsk.core.Matrix3D.create()
            step.setToRotation(math.radians(degrees), axis, centre)
            matrix.transformBy(step)
    return matrix


def box_centre(body):
    b = body.boundingBox
    return adsk.core.Point3D.create((b.minPoint.x + b.maxPoint.x) / 2, (b.minPoint.y + b.maxPoint.y) / 2, (b.minPoint.z + b.maxPoint.z) / 2)


def laid(body, angles):
    """A free copy of the body (not in the document) turned by angles about its box centre: to measure, not to cut."""
    temporary = adsk.fusion.TemporaryBRepManager.get()
    copy = temporary.copy(body)
    if any(angles):
        temporary.transform(copy, rotation(angles, box_centre(body)))
    return copy


def turned(design, body):
    """The body, or a copy of it turned by JOB["rotate"] (x, then y, then z, degrees) about its box centre."""
    if not any(JOB["rotate"]):
        return body
    copy = laid(body, JOB["rotate"])
    root = design.rootComponent
    # A parametric design takes a free body only inside a base feature.
    base = root.features.baseFeatures.add()
    base.startEdit()
    added = root.bRepBodies.add(copy, base)
    base.finishEdit()
    added.name = JOB["setup"]
    return added


def set_parameter(owner, name, expression):
    parameter = owner.parameters.itemByName(name)
    if not parameter:
        raise RuntimeError(f"no CAM parameter {name}")
    parameter.expression = expression


# A face stands upright when its normal is level within 0.05 degrees; it faces up (or down) when its normal is
# vertical within as much.
UPRIGHT = math.sin(math.radians(0.05))
LEVEL = math.cos(math.radians(0.05))


def plane_normal(face):
    """The normal of a planar face, or None for a curved one."""
    if not isinstance(face.geometry, adsk.core.Plane):
        return None
    _found, normal = face.evaluator.getNormalAtPoint(face.pointOnFace)
    return normal


def moved(normal, turned_by, to):
    """A normal of the body turned by turned_by, as it is when the body is turned by to instead."""
    origin = adsk.core.Point3D.create(0, 0, 0)
    back = rotation(turned_by, origin)
    back.invert()
    back.transformBy(rotation(to, origin))
    other = normal.copy()
    other.transformBy(back)
    return other


def squared_faces(body):
    """
    The planar faces this setup squares: upright on the body turned by JOB["rotate"], but not in the board's first setup
    (turned by JOB["reference"]), e.g. the walls of the zigzag seat's dovetails, which lean 8 degrees as it lies flat.
    """
    faces = []
    for face in body.faces:
        normal = plane_normal(face)
        if normal is None or abs(normal.z) >= UPRIGHT:
            continue
        if abs(moved(normal, JOB["rotate"], JOB["reference"]).z) >= UPRIGHT:
            faces.append(face)
    return faces


def lay_flat_angles(normal):
    """
    The turn [x, y, 0] (degrees) that points normal straight down: about x, it comes into the xz plane, pointing
    down; about y, onto -z.
    """
    about_x = math.atan2(-normal.y, -normal.z)
    in_plane = math.hypot(normal.y, normal.z)
    about_y = math.atan2(normal.x, in_plane)
    # Whole numbers stay whole (0, 90, 180): a board already flat is not turned by a rounding error.
    return [round(math.degrees(about_x), 9) + 0.0, round(math.degrees(about_y), 9) + 0.0, 0.0]


def height_mm(body):
    b = body.boundingBox
    return (b.maxPoint.z - b.minPoint.z) * 10


def face_normals(face):
    """The face's normals: one for a plane; for a curved face, at a 5 x 5 grid over its parameters (those on the face)."""
    normal = plane_normal(face)
    if normal is not None:
        return [normal]
    evaluator = face.evaluator
    extent = evaluator.parametricRange()
    low, high = extent.minPoint, extent.maxPoint
    grid = [adsk.core.Point2D.create(low.x + (high.x - low.x) * i / 4, low.y + (high.y - low.y) * j / 4) for i in range(5) for j in range(5)]
    on_face = [point for point in grid if evaluator.isParameterOnFace(point)]
    normals = []
    for point in on_face:
        _found, normal = evaluator.getNormalAtParameter(point)
        normals.append(normal)
    if not normals:
        _found, normal = evaluator.getNormalAtPoint(face.pointOnFace)
        normals.append(normal)
    return normals


def unreachable(body):
    """
    The faces of the body, as it lies, that a tool coming down along z cannot cut as a 2.5D shape: not upright (a
    wall), not facing up (a floor, the top), not the face it lies on. As [(face, kind)], kind "facing down", "sloped
    <degrees from upright>" or "curved".
    """
    bottom = body.boundingBox.minPoint.z
    faces = []
    for face in body.faces:
        normals = face_normals(face)
        if all(abs(n.z) < UPRIGHT for n in normals) or all(n.z > LEVEL for n in normals):
            continue
        if all(n.z < -LEVEL for n in normals) and face.boundingBox.maxPoint.z - bottom < 1e-4:
            continue
        if plane_normal(face) is None:
            kind = "curved"
        elif normals[0].z < -LEVEL:
            kind = "facing down"
        else:
            kind = f"sloped {round(math.degrees(math.asin(min(1, abs(normals[0].z)))))} deg"
        faces.append((face, kind))
    return faces


def where(face, body):
    """Where a face is along the length of the body as it lies: "at an end" or "in the middle"."""
    b = body.boundingBox
    f = face.boundingBox
    axis = "x" if b.maxPoint.x - b.minPoint.x >= b.maxPoint.y - b.minPoint.y else "y"
    low, high = getattr(b.minPoint, axis), getattr(b.maxPoint, axis)
    at = ((getattr(f.minPoint, axis) + getattr(f.maxPoint, axis)) / 2 - low) / (high - low)
    return "at an end" if at < 0.2 or at > 0.8 else "in the middle"


def lay_flat(body):
    """
    The turn laying the body on its largest planar face, that face down: the tool comes from the opposite face. Of
    faces as large (a plain board's two sides), the turn leaving the body lowest, then with the fewest faces out of
    reach, then the face already looking down.
    """
    planar = [(face.area, face) for face in body.faces if plane_normal(face) is not None]
    if not planar:
        raise RuntimeError(f"{JOB['body']} has no planar face to lie on")
    largest = max(area for area, _face in planar)
    candidates = []
    for area, face in planar:
        if area < largest * 0.999:
            continue
        normal = plane_normal(face)
        angles = lay_flat_angles(normal)
        copy = laid(body, angles)
        candidates.append((round(height_mm(copy), 3), len(unreachable(copy)), normal.z, angles))
    return min(candidates)[3]


def orient():
    """
    How the body lies in this setup (JOB["rotate"], else laid flat), how high it stands, and what a setup from the top
    cannot cut: the faces out of reach (less those squared by the board's other setups, JOB["others"]), or for a
    setup that cuts its squared faces only, how deep they go.
    """
    design = design_of(tagged_document())
    body = find_body(design, JOB["body"])
    angles = JOB["rotate"] if JOB["rotate"] is not None else lay_flat(body)
    copy = laid(body, angles)
    result = {"rotate": angles, "height": round(height_mm(copy), 3)}
    if JOB["cut"] == "squared":
        faces = squared_faces(copy)
        top = copy.boundingBox.maxPoint.z
        result["squaredDepth"] = round((top - min(v.geometry.z for f in faces for v in f.vertices)) * 10, 3) if faces else None
    else:
        out = []
        for face, kind in unreachable(copy):
            normal = plane_normal(face)
            squared = normal is not None and any(abs(moved(normal, angles, other).z) < UPRIGHT for other in JOB["others"])
            if not squared:
                out.append(f"{kind} {where(face, copy)}")
        result["unreachable"] = {kind: out.count(kind) for kind in sorted(set(out))}
    done(result)


def bottom_chains(faces):
    """
    The faces' bottom edges, where they meet a face looking down (the board's underside), as chains: [(edges end to
    end, closed)]. In order, since Fusion, given the edges unordered, chains its own way between them (over the faces'
    tops).
    """
    edges = []
    for face in faces:
        for edge in face.edges:
            for other in edge.faces:
                normal = plane_normal(other) if other != face else None
                if normal is not None and normal.z < -UPRIGHT and edge not in edges:
                    edges.append(edge)

    def key(vertex):
        point = vertex.geometry
        return (round(point.x, 5), round(point.y, 5), round(point.z, 5))

    around = {}
    for edge in edges:
        for vertex in [edge.startVertex, edge.endVertex]:
            around.setdefault(key(vertex), []).append(edge)
    chains = []
    left = list(edges)
    while left:
        # From a chain's end (a vertex with one of these edges), else anywhere on a closed loop.
        ends = [at for at, touching in around.items() if len(touching) == 1 and touching[0] in left]
        start = ends[0] if ends else key(left[0].startVertex)
        at = start
        chain = []
        while True:
            following = [edge for edge in around[at] if edge in left]
            if not following:
                break
            edge = following[0]
            left.remove(edge)
            chain.append(edge)
            at = key(edge.endVertex) if key(edge.startVertex) == at else key(edge.startVertex)
        chains.append((chain, at == start))
    return chains


def add_operation(setup, strategy, name, tool):
    """An operation with the tool and its preset, the feeds and the stepdowns of JOB["machining"]."""
    machining = JOB["machining"]
    operation_input = setup.operations.createInput(strategy)
    operation_input.tool = tool
    operation_input.toolPreset = tool.presets.item(0)
    operation_input.displayName = name
    operation = setup.operations.add(operation_input)
    set_parameter(operation, "tool_spindleSpeed", f"{machining['spindleSpeed']} rpm")
    set_parameter(operation, "tool_feedCutting", f"{machining['feedCutting']} mm/min")
    set_parameter(operation, "tool_feedPlunge", f"{machining['feedPlunge']} mm/min")
    set_parameter(operation, "tool_feedRamp", f"{machining['feedRamp']} mm/min")
    set_parameter(operation, "tool_coolant", "'disabled'")  # a router has none
    set_parameter(operation, "doMultipleDepths", "true")
    set_parameter(operation, "maximumStepdown", f"{machining['stepdown']} mm")
    set_parameter(operation, "useEvenStepdowns", "true")
    return operation


def add_pockets(setup, tool):
    """A 2D pocket on the pockets Fusion recognises in the setup's model, holes the tool fits in included."""
    machining = JOB["machining"]
    operation = add_operation(setup, "pocket2d", "Pockets", tool)
    set_parameter(operation, "maximumStepover", f"{machining['stepover']} mm")
    # Wood left on the walls and the floor, for a finishing pass; none: cut to size.
    set_parameter(operation, "useStockToLeave", "true" if machining["pocketStockToLeave"] else "false")
    if machining["pocketStockToLeave"]:
        set_parameter(operation, "stockToLeave", f"{machining['pocketStockToLeave']} mm")
    value = adsk.cam.CadContours2dParameterValue.cast(operation.parameters.itemByName("pockets").value)
    selections = value.getCurveSelections()
    selections.clear()
    recognised = selections.createNewPocketRecognitionSelection()
    recognised.isSetupModelSelected = True
    recognised.areHolesIncluded = True
    # The API's lengths are in cm.
    recognised.minimumHoleDiameter = machining["minimumHoleDiameter"] / 10
    recognised.minimumCornerRadius = machining["cornerRadius"][0] / 10
    recognised.maximumCornerRadius = machining["cornerRadius"][1] / 10
    value.applyCurveSelections(selections)


def add_outline(setup, tool):
    """A 2D contour around the outside of the setup's model, through: JOB["machining"]["overcut"] below the stock
    bottom, with its tabs (none when "tabs" is null)."""
    machining = JOB["machining"]
    operation = add_operation(setup, "contour2d", "Outline", tool)
    value = adsk.cam.CadContours2dParameterValue.cast(operation.parameters.itemByName("contours").value)
    selections = value.getCurveSelections()
    selections.clear()
    silhouette = selections.createNewSilhouetteSelection()
    silhouette.isSetupModelSelected = True
    silhouette.loopType = adsk.cam.LoopTypes.OnlyOutsideLoops
    silhouette.sideType = adsk.cam.SideTypes.AlwaysOutsideSideType
    value.applyCurveSelections(selections)
    set_parameter(operation, "bottomHeight_mode", "'from stock bottom'")
    set_parameter(operation, "bottomHeight_offset", f"{-machining['overcut']} mm")
    set_parameter(operation, "compensation", "'left'")
    set_parameter(operation, "useStockToLeave", "false")  # through, to size
    tabs = machining["tabs"]
    set_parameter(operation, "group_tabs", "true" if tabs else "false")  # the Tabs checkbox
    if tabs:
        set_parameter(operation, "tabShape", "'rectangular'")
        set_parameter(operation, "tabPositioning", "'tabCount'")
        set_parameter(operation, "tabsPerContour", f"{tabs['count']}")
        set_parameter(operation, "tabWidth", f"{tabs['width']} mm")
        set_parameter(operation, "tabHeight", f"{tabs['height']} mm")


def cut_squared_only(setup, body, tool):
    """
    Make the setup cut only the faces it squares (JOB["cut"] == "squared"): a 2D contour along their bottom edges, on
    the waste side, from the stock top to JOB["machining"]["overcut"] below their lowest point, in stepdowns, without
    tabs. The rest of the board is cut in its first setup.
    """
    faces = squared_faces(body)
    if not faces:
        raise RuntimeError(
            f"{JOB['setup']}: no face of {JOB['body']} stands upright turned by {JOB['rotate']} that did not already "
            f"in its first setup (turned by {JOB['reference']}): nothing for this setup to square"
        )
    chains = bottom_chains(faces)
    # The stock has nothing above the board: its top is the board's highest point.
    top = max(vertex.geometry.z for vertex in body.vertices)
    bottom = min(vertex.geometry.z for face in faces for vertex in face.vertices)
    depth = (top - bottom) * 10 + JOB["machining"]["overcut"]  # mm

    operation = add_operation(setup, "contour2d", "Outline", tool)
    value = adsk.cam.CadContours2dParameterValue.cast(operation.parameters.itemByName("contours").value)
    selections = value.getCurveSelections()
    selections.clear()
    for edges, closed in chains:
        # Fusion puts the tool outside the higher of the faces along the first edge: on the waste side, off the
        # squared face. isOpen keeps an open chain open (false closes it with more edges).
        selection = selections.createNewChainSelection()
        selection.inputGeometry = edges
        selection.isOpen = not closed
    value.applyCurveSelections(selections)
    set_parameter(operation, "compensation", "'left'")
    set_parameter(operation, "useStockToLeave", "false")  # to size
    set_parameter(operation, "topHeight_mode", "'from stock top'")
    set_parameter(operation, "topHeight_offset", "0 mm")
    set_parameter(operation, "bottomHeight_mode", "'from stock top'")
    set_parameter(operation, "bottomHeight_offset", f"{-depth:.3f} mm")
    set_parameter(operation, "group_tabs", "false")  # the Tabs checkbox
    return {"faces": len(faces), "chains": [len(edges) for edges, _closed in chains], "depth": round(depth, 2)}


def find_setup(cam):
    setup = cam.setups.itemByName(JOB["setup"])
    if not setup:
        raise RuntimeError(f"no setup {JOB['setup']} in the document")
    return setup


def make_setup():
    document = tagged_document()
    design = design_of(document)
    cam = cam_of(document)
    # First: a tool Fusion cannot read should fail before the document changes.
    tool = adsk.cam.Tool.createFromJson(JOB["machining"]["tool"])
    model = turned(design, find_body(design, JOB["body"]))

    setup_input = cam.setups.createInput(adsk.cam.OperationTypes.MillingOperation)
    setup_input.models = [model]
    setup = cam.setups.add(setup_input)
    setup.name = JOB["setup"]
    # The stock: the board's box, JOB["margin"] mm more on its sides, nothing above.
    set_parameter(setup, "job_stockMode", "'default'")
    set_parameter(setup, "job_stockOffsetMode", "'simple'")
    set_parameter(setup, "job_stockOffsetSides", f"{JOB['margin']} mm")
    set_parameter(setup, "job_stockOffsetTop", "0 mm")
    # The WCS: the model's axes (Z up), origin at the stock's top, x-min y-min corner ("Top corner 1").
    set_parameter(setup, "wcs_origin_mode", "'stockPoint'")
    set_parameter(setup, "wcs_origin_boxPoint", "'top 1'")

    squared = None
    if JOB["cut"] == "squared":
        squared = cut_squared_only(setup, model, tool)
    else:
        add_pockets(setup, tool)
        add_outline(setup, tool)
    # Started here, generated while Fusion is idle between calls: "status" says when it is done.
    cam.generateToolpath(setup)
    done({"setup": setup.name, "operations": [operation.name for operation in setup.allOperations], "squared": squared})


def status():
    setup = find_setup(cam_of(tagged_document()))
    operations = [setup.allOperations.item(i) for i in range(setup.allOperations.count)]
    generating = [operation.name for operation in operations if operation.isGenerating]
    # An operation that finds nothing to cut on this board (e.g. pockets on a board without any)
    # ends with no toolpath and a warning ("Generated toolpath is empty"), not an error: it is skipped, not failed.
    failed = [f"{operation.name}: {operation.error or 'no toolpath'}" for operation in operations if not operation.isGenerating and (operation.hasError or (not operation.hasToolpath and not operation.hasWarning))]
    empty = [operation.name for operation in operations if not operation.isGenerating and not operation.hasError and not operation.hasToolpath and operation.hasWarning]
    done({"generating": generating, "failed": failed, "empty": empty, "operations": len(operations)})


def find_post():
    """The Fusion library post whose vendor or description contains JOB["post"], e.g. "shopbot": ShopBot OpenSBP."""
    library = adsk.cam.CAMManager.get().libraryManager.postLibrary
    posts = library.createQuery(adsk.cam.LibraryLocations.Fusion360LibraryLocation).execute()
    want = JOB["post"].lower()
    hits = [post for post in posts if want in f"{post.vendor} {post.description}".lower()]
    if not hits:
        raise RuntimeError(f'no post matching "{JOB["post"]}" among the {len(posts)} Fusion library posts')
    # The most generic match: "shopbot" finds "ShopBot OpenSBP" and "ShopBot Tools Handibot OpenSBP"; take the former.
    return min(hits, key=lambda post: len(post.description))


def post():
    cam = cam_of(tagged_document())
    setup = find_setup(cam)
    configuration = find_post()
    program_input = cam.ncPrograms.createInput()
    program_input.displayName = setup.name
    program_input.parameters.itemByName("nc_program_filename").value.value = JOB["file"]
    program_input.parameters.itemByName("nc_program_output_folder").value.value = JOB["folder"]
    open_in_editor = program_input.parameters.itemByName("nc_program_openInEditor")
    if open_in_editor:
        open_in_editor.value.value = False
    # The operations with a toolpath only: those that found nothing to cut on this board are left out.
    operations = [setup.allOperations.item(i) for i in range(setup.allOperations.count)]
    with_toolpath = [operation for operation in operations if operation.hasToolpath]
    if not with_toolpath:
        raise RuntimeError(f"no operation of {setup.name} has a toolpath")
    program_input.operations = with_toolpath
    program = cam.ncPrograms.add(program_input)
    program.postConfiguration = configuration
    if not program.postProcess(adsk.cam.NCProgramPostProcessOptions.create()):
        raise RuntimeError(f"posting {setup.name} with {configuration.description} failed")
    done({"setup": setup.name, "post": f"{configuration.vendor} {configuration.description}", "postVersion": configuration.version})


def close():
    document = tagged_document()
    document.close(False)
    done({"closed": True})


def run(_context: str):
    ops = {"import": import_step, "orient": orient, "setup": make_setup, "status": status, "post": post, "close": close}
    ops[JOB["op"]]()
