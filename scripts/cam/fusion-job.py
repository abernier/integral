# The script `pnpm cam` runs inside the Fusion desktop app, through its local MCP server (`fusion_mcp_execute`,
# featureType "script"). It is sent as text, preceded by one line `JOB = json.loads("...")` (see cam.ts), and run by
# Fusion's Python with the Fusion API. Fusion calls `run`; a raised exception comes back as the tool's error.
#
# Each call does one small step, so that no call holds Fusion long; toolpaths are generated between calls. Fusion
# decides what it can: how the parts lie and where on the sheet (Arrange), the pockets (recognition), the toolpaths.
# The values (sheet, tool, feeds, tabs, ...) all come from `pnpm cam`, in JOB: this script only applies them.
#
# JOB["op"]:
#   "import":   import the STEP JOB["step"] (an assembly, one component per part) into a new design document, tag
#               it with JOB["tag"]; return each part's thickness and Fusion's version
#   "arrange":  lay the parts JOB["parts"] flat on one sheet (an Arrange feature named JOB["sheet"]); return the
#               parts it placed (those that do not fit go on the next sheet)
#   "sheet":    a milling setup JOB["setup"] on that sheet: the sheet as stock, a 2D pocket and a 2D contour with
#               tabs; start generating the toolpaths
#   "measure":  how high part JOB["part"] stands turned by JOB["rotate"], and how deep its squared faces go
#   "part":     a milling setup JOB["setup"] on part JOB["part"] alone, turned by JOB["rotate"] (a wedge under it):
#               with JOB["cut"] == "squared", only a contour on the faces the turn squares; else pockets and outline
#   "status":   how far the toolpaths of setup JOB["setup"] are (read-only)
#   "post":     post setup JOB["setup"] with the library post matching JOB["post"] to JOB["folder"]/JOB["file"]
#   "close":    close the tagged document, without saving
#
# Every op prints its result as one line `INTEGRAL_RESULT <json>`.

import math
import sys

import adsk.cam
import adsk.core
import adsk.fusion

app = adsk.core.Application.get()

# Fusion 2706's MCP server wraps sys.stdout anew on each call and never unwraps it: after about 1000 calls, a print
# recurses too deep and every script fails until Fusion restarts. Keep only this call's wrapper.
if type(sys.stdout).__name__ == "_NsSanitizedWriter":
    inner = sys.stdout._original
    while type(inner).__name__ == "_NsSanitizedWriter":
        inner = inner._original
    sys.stdout._original = inner


def done(result):
    print("INTEGRAL_RESULT " + json.dumps(result))


def mm(value):
    return adsk.core.ValueInput.createByString(f"{value} mm")


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


def parts_of(design):
    """The STEP's parts: the occurrences that hold bodies, as imported (not Arrange's copies)."""
    return [occurrence for occurrence in design.rootComponent.allOccurrences if occurrence.bRepBodies.count and "+" not in occurrence.fullPathName]


def find_part(design, name):
    for occurrence in parts_of(design):
        if occurrence.component.name == name:
            return occurrence
    raise RuntimeError(f"no part {name} in the design")


def plane_normal(face):
    """The normal of a planar face, or None for a curved one."""
    if not isinstance(face.geometry, adsk.core.Plane):
        return None
    _found, normal = face.evaluator.getNormalAtPoint(face.pointOnFace)
    return normal


def thickness_mm(occurrence):
    """The part's size across its largest planar face, mm, to 0.1; None without a planar face."""
    faces = [face for body in occurrence.bRepBodies for face in body.faces if plane_normal(face) is not None]
    if not faces:
        return None
    normal = plane_normal(max(faces, key=lambda face: face.area))
    along = [v.geometry.asVector().dotProduct(normal) for body in occurrence.bRepBodies for v in body.vertices]
    return round((max(along) - min(along)) * 10, 1)


def import_step():
    options = app.importManager.createSTEPImportOptions(JOB["step"])
    document = app.importManager.importToNewDocument(options)
    if not document:
        raise RuntimeError(f"Fusion could not import {JOB['step']}")
    design = design_of(document)
    design.attributes.add("integral", "cam", JOB["tag"])
    parts = parts_of(design)
    if not parts:
        raise RuntimeError(f"{JOB['step']} has no components: the STEP must be an assembly, one component per part")
    cam_of(document)
    done({"document": document.name, "fusion": app.version, "parts": [{"name": p.component.name, "thickness": thickness_mm(p)} for p in parts]})


def find_sheet(design):
    features = design.rootComponent.features.arrangeFeatures
    for i in range(features.count):
        if features.item(i).name == JOB["sheet"]:
            return features.item(i)
    raise RuntimeError(f"no sheet {JOB['sheet']} in the design")


def arrange():
    """
    One Arrange feature: the parts laid flat (Fusion picks the face), turned and packed on a sheet JOB["size"] mm, at
    the origin (the sheets of a run lie on one another: each setup sees only its own). Fusion places what fits; the
    rest is for the next sheet. Part-in-part is off: a part inside another's hole would be cut by that hole's pocket.
    """
    design = design_of(tagged_document())
    # Arrange is a Design feature: it fails while the Manufacture workspace is active.
    app.userInterface.workspaces.itemById("FusionSolidEnvironment").activate()
    root = design.rootComponent
    features = root.features.arrangeFeatures
    feature_input = features.createInput(adsk.fusion.ArrangeSolverTypes.Arrange2DTrueShapeSolverType)
    for name in JOB["parts"]:
        component = feature_input.arrangeComponents.add(find_part(design, name))
        # Arrange lays a part largest planar face up; flipped, that face lies on the sheet and the tool comes from the
        # other, where pockets open (their openings make it the smaller). A part in JOB["flip"] (manifest `flip`) is
        # left largest face up.
        component.isDirectionFlipped = name not in JOB["flip"]
    definition = adsk.fusion.ArrangeDefinition2DInput.cast(feature_input.definition)
    definition.globalRotation = adsk.fusion.ArrangeRotationTypes.AllRotationsArrangeRotationType
    definition.isPartInPartAllowed = False
    length, width = JOB["size"]
    envelope = feature_input.setPlaneEnvelope(root.xYConstructionPlane, mm(length), mm(width))
    envelope.objectSpacing = mm(JOB["spacing"])
    envelope.frameWidth = mm(JOB["frame"])
    envelope.isPartialArrangeAllowed = True
    feature = features.add(feature_input)
    feature.name = JOB["sheet"]
    placed = []
    for i in range(feature.resultEnvelopes.count):
        result = feature.resultEnvelopes.item(i)
        placed += [result.occurrences.item(k).occurrence.component.name for k in range(result.occurrences.count)]
    done({"sheet": feature.name, "placed": placed})


def set_parameter(owner, name, expression):
    parameter = owner.parameters.itemByName(name)
    if not parameter:
        raise RuntimeError(f"no CAM parameter {name}")
    parameter.expression = expression


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


def make_sheet():
    """
    The setup of one sheet: its parts as the model; the sheet as the stock (the envelope's box, JOB["thickness"] mm
    thick, its bottom on the parts'); the WCS at the sheet's top, x-min y-min corner; pockets, then the outline.
    """
    document = tagged_document()
    design = design_of(document)
    cam = cam_of(document)
    tool = adsk.cam.Tool.createFromJson(JOB["machining"]["tool"])  # first: a bad tool fails before any change
    envelope = adsk.fusion.ArrangePlaneResultEnvelope.cast(find_sheet(design).resultEnvelopes.item(0))
    parts = [envelope.occurrences.item(k).occurrence for k in range(envelope.occurrences.count)]
    # A proxy body's boundingBox is loose once turned: its vertices are where it is.
    points = [vertex.geometry for part in parts for body in part.bRepBodies for vertex in body.vertices]
    sheet = envelope.boundingBox

    setup_input = cam.setups.createInput(adsk.cam.OperationTypes.MillingOperation)
    setup_input.models = parts
    setup = cam.setups.add(setup_input)
    setup.name = JOB["setup"]
    set_parameter(setup, "job_stockMode", "'fixedbox'")
    set_parameter(setup, "job_stockFixedX", f"{(sheet.maxPoint.x - sheet.minPoint.x) * 10:.3f} mm")
    set_parameter(setup, "job_stockFixedY", f"{(sheet.maxPoint.y - sheet.minPoint.y) * 10:.3f} mm")
    set_parameter(setup, "job_stockFixedZ", f"{JOB['thickness']} mm")
    # The fixed box is placed against the model's box: its left and front edges this far out from the parts'.
    set_parameter(setup, "job_stockFixedXMode", "'left'")
    set_parameter(setup, "job_stockFixedXOffset", f"{(min(p.x for p in points) - sheet.minPoint.x) * 10:.3f} mm")
    set_parameter(setup, "job_stockFixedYMode", "'front'")
    set_parameter(setup, "job_stockFixedYOffset", f"{(min(p.y for p in points) - sheet.minPoint.y) * 10:.3f} mm")
    set_parameter(setup, "job_stockFixedZMode", "'bottom'")
    set_parameter(setup, "job_stockFixedZOffset", "0 mm")
    set_parameter(setup, "wcs_origin_mode", "'stockPoint'")
    set_parameter(setup, "wcs_origin_boxPoint", "'top 1'")
    add_pockets(setup, tool)
    add_outline(setup, tool)
    # Started here, generated while Fusion is idle between calls: "status" says when it is done.
    cam.generateToolpath(setup)
    # Where the parts are on the sheet, mm from its x-min y-min corner: [x-min, y-min, x-max, y-max].
    x0, y0 = sheet.minPoint.x, sheet.minPoint.y
    parts_box = [min(p.x for p in points) - x0, min(p.y for p in points) - y0, max(p.x for p in points) - x0, max(p.y for p in points) - y0]
    done({
        "setup": setup.name,
        "operations": [operation.name for operation in setup.allOperations],
        "size": [round((sheet.maxPoint.x - x0) * 10, 3), round((sheet.maxPoint.y - y0) * 10, 3)],
        "partsBox": [round(v * 10, 1) for v in parts_box],
    })


# The separate setup of one part on a wedge (manifest `setups`): what Arrange cannot do.

# A face stands upright when its normal is level within 0.05 degrees.
UPRIGHT = math.sin(math.radians(0.05))


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


def turned_copy(body):
    """A free copy of the body (not in the document) turned by JOB["rotate"] about its box centre."""
    temporary = adsk.fusion.TemporaryBRepManager.get()
    copy = temporary.copy(body)
    b = body.boundingBox
    centre = adsk.core.Point3D.create((b.minPoint.x + b.maxPoint.x) / 2, (b.minPoint.y + b.maxPoint.y) / 2, (b.minPoint.z + b.maxPoint.z) / 2)
    temporary.transform(copy, rotation(JOB["rotate"], centre))
    return copy


def squared_faces(body):
    """
    The planar faces the turn squares: upright on the body turned by JOB["rotate"], but not as modelled (the part is
    modelled flat, as it lies on its sheet), e.g. the walls of the zigzag seat's dovetails, which lean 8 degrees.
    """
    back = rotation(JOB["rotate"], adsk.core.Point3D.create(0, 0, 0))
    back.invert()
    faces = []
    for face in body.faces:
        normal = plane_normal(face)
        if normal is None or abs(normal.z) >= UPRIGHT:
            continue
        modelled = normal.copy()
        modelled.transformBy(back)
        if abs(modelled.z) >= UPRIGHT:
            faces.append(face)
    return faces


def part_body(design):
    """The part's body, in the design's frame."""
    return find_part(design, JOB["part"]).bRepBodies.item(0)


def measure():
    copy = turned_copy(part_body(design_of(tagged_document())))
    top = max(v.geometry.z for v in copy.vertices)
    result = {"height": round((top - min(v.geometry.z for v in copy.vertices)) * 10, 3), "squaredDepth": None}
    if JOB["cut"] == "squared":
        faces = squared_faces(copy)
        if faces:
            result["squaredDepth"] = round((top - min(v.geometry.z for f in faces for v in f.vertices)) * 10, 3)
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


def cut_squared_only(setup, body, tool):
    """
    Make the setup cut only the faces it squares: a 2D contour along their bottom edges, on the waste side, from the
    stock top to JOB["machining"]["overcut"] below their lowest point, in stepdowns, without tabs. The rest of the part
    is cut on its sheet.
    """
    faces = squared_faces(body)
    if not faces:
        raise RuntimeError(f"{JOB['setup']}: no face of {JOB['part']} stands upright turned by {JOB['rotate']} that did not already as modelled")
    chains = bottom_chains(faces)
    # The stock has nothing above the part: its top is the part's highest point.
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


def make_part_setup():
    document = tagged_document()
    design = design_of(document)
    cam = cam_of(document)
    tool = adsk.cam.Tool.createFromJson(JOB["machining"]["tool"])  # first: a bad tool fails before any change
    # The turned part, as a body of the design: a parametric design takes a free body only inside a base feature.
    root = design.rootComponent
    base = root.features.baseFeatures.add()
    base.startEdit()
    model = root.bRepBodies.add(turned_copy(part_body(design)), base)
    base.finishEdit()
    model.name = JOB["setup"]

    setup_input = cam.setups.createInput(adsk.cam.OperationTypes.MillingOperation)
    setup_input.models = [model]
    setup = cam.setups.add(setup_input)
    setup.name = JOB["setup"]
    # The stock: the part's box, JOB["margin"] mm more on its sides, nothing above; the WCS at its top, x-min y-min.
    set_parameter(setup, "job_stockMode", "'default'")
    set_parameter(setup, "job_stockOffsetMode", "'simple'")
    set_parameter(setup, "job_stockOffsetSides", f"{JOB['margin']} mm")
    set_parameter(setup, "job_stockOffsetTop", "0 mm")
    set_parameter(setup, "wcs_origin_mode", "'stockPoint'")
    set_parameter(setup, "wcs_origin_boxPoint", "'top 1'")
    squared = None
    if JOB["cut"] == "squared":
        squared = cut_squared_only(setup, model, tool)
    else:
        add_pockets(setup, tool)
        add_outline(setup, tool)
    cam.generateToolpath(setup)
    done({"setup": setup.name, "operations": [operation.name for operation in setup.allOperations], "squared": squared})


def find_setup(cam):
    setup = cam.setups.itemByName(JOB["setup"])
    if not setup:
        raise RuntimeError(f"no setup {JOB['setup']} in the document")
    return setup


def status():
    setup = find_setup(cam_of(tagged_document()))
    operations = [setup.allOperations.item(i) for i in range(setup.allOperations.count)]
    generating = [operation.name for operation in operations if operation.isGenerating]
    # An operation that finds nothing to cut (e.g. pockets on a sheet without any) ends with no toolpath and a
    # warning ("Generated toolpath is empty"), not an error: it is left out, not failed.
    failed = [f"{operation.name}: {operation.error or 'no toolpath'}" for operation in operations if not operation.isGenerating and (operation.hasError or (not operation.hasToolpath and not operation.hasWarning))]
    empty = [operation.name for operation in operations if not operation.isGenerating and not operation.hasError and not operation.hasToolpath and operation.hasWarning]
    done({"generating": generating, "failed": failed, "empty": empty})


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
    # The operations with a toolpath only: those that found nothing to cut are left out.
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
    tagged_document().close(False)
    done({"closed": True})


def run(_context: str):
    ops = {"import": import_step, "arrange": arrange, "sheet": make_sheet, "measure": measure, "part": make_part_setup, "status": status, "post": post, "close": close}
    ops[JOB["op"]]()
