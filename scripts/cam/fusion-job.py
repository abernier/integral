# The script `pnpm cam` runs inside the Fusion desktop app, through its local MCP server (`fusion_mcp_execute`,
# featureType "script"). It is sent as text, preceded by one line `JOB = json.loads("...")` (see cam/fusion.ts), and
# run by Fusion's Python with the Fusion API. Fusion calls `run`; a raised exception comes back as the tool's error,
# so nothing here catches one unless it means to go on.
#
# Each call does one small step, so that no call holds Fusion long; the toolpaths are generated between calls.
#
# JOB["op"]:
#   "import":   import the STEP JOB["step"] into a new design document, name its bodies after the STEP's solids
#               (matched by their boxes, JOB["solids"]), tag the document with JOB["tag"]; return the bodies
#   "setup":    for body JOB["body"], make setup JOB["setup"] ("<Body>_<setup>"; the board turned by JOB["rotate"], degrees), with the
#               stock and the WCS, apply the template JOB["template"] and start generating its toolpaths
#   "status":   how far the toolpaths of setup JOB["setup"] are (read-only)
#   "post":     post setup JOB["setup"] with the library post matching JOB["post"] to JOB["folder"]/JOB["file"]
#   "close":    close the tagged document, without saving
#
# Every op prints its result as one line `INTEGRAL_RESULT <json>`.

import json
import math

import adsk.cam
import adsk.core
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
    # Fusion names the bodies Body1, Body2, …: give each the name of the STEP solid with the same box (mm).
    bodies = [design.rootComponent.bRepBodies.item(i) for i in range(design.rootComponent.bRepBodies.count)]
    named = []
    for body in bodies:
        box = box_mm(body)
        name, gap = min(((s["name"], max(abs(a - b) for a, b in zip(box, s["box"]))) for s in JOB["solids"]), key=lambda hit: hit[1])
        if gap > 0.1:
            raise RuntimeError(f"no STEP solid has the box of Fusion's {body.name} (closest: {name}, {gap:.2f} mm off)")
        body.name = name
        named.append(name)
    cam_of(document)
    done({"document": document.name, "bodies": named})


def find_body(design, name):
    root = design.rootComponent
    for i in range(root.bRepBodies.count):
        if root.bRepBodies.item(i).name == name:
            return root.bRepBodies.item(i)
    raise RuntimeError(f"no body {name} in the design")


def turned(design, body):
    """The body, or a copy of it turned by JOB["rotate"] (x, then y, then z, degrees) about its box centre."""
    rx, ry, rz = JOB["rotate"]
    if not rx and not ry and not rz:
        return body
    b = body.boundingBox
    centre = adsk.core.Point3D.create((b.minPoint.x + b.maxPoint.x) / 2, (b.minPoint.y + b.maxPoint.y) / 2, (b.minPoint.z + b.maxPoint.z) / 2)
    matrix = adsk.core.Matrix3D.create()
    axes = [adsk.core.Vector3D.create(1, 0, 0), adsk.core.Vector3D.create(0, 1, 0), adsk.core.Vector3D.create(0, 0, 1)]
    for degrees, axis in zip([rx, ry, rz], axes):
        if degrees:
            rotation = adsk.core.Matrix3D.create()
            rotation.setToRotation(math.radians(degrees), axis, centre)
            matrix.transformBy(rotation)
    temporary = adsk.fusion.TemporaryBRepManager.get()
    copy = temporary.copy(body)
    temporary.transform(copy, matrix)
    root = design.rootComponent
    # A parametric design takes a free body only inside a base feature.
    base = root.features.baseFeatures.add()
    base.startEdit()
    added = root.bRepBodies.add(copy, base)
    base.finishEdit()
    added.name = JOB["setup"]
    return added


def find_template():
    """The template named JOB["template"], searched through the local, cloud and hub template libraries."""
    library = adsk.cam.CAMManager.get().libraryManager.templateLibrary
    seen = []
    for location in [adsk.cam.LibraryLocations.LocalLibraryLocation, adsk.cam.LibraryLocations.CloudLibraryLocation, adsk.cam.LibraryLocations.HubLibraryLocation]:
        folders = [library.urlByLocation(location)]
        while folders:
            folder = folders.pop()
            try:
                templates = library.childTemplates(folder) or []
                folders.extend(library.childFolderURLs(folder) or [])
            except RuntimeError:
                # A location this account does not have ("Given URL does not point to an existing folder").
                continue
            for template in templates:
                seen.append(template.name)
                if template.name == JOB["template"]:
                    return template
    raise RuntimeError(
        f'no CAM template "{JOB["template"]}" in the local, cloud or hub template library (found: {", ".join(seen) or "none"}); '
        "make it in Fusion's Manufacture workspace, see scripts/cam/README.md"
    )


def set_parameter(owner, name, expression):
    parameter = owner.parameters.itemByName(name)
    if not parameter:
        raise RuntimeError(f"no CAM parameter {name}")
    parameter.expression = expression


def find_setup(cam):
    setup = cam.setups.itemByName(JOB["setup"])
    if not setup:
        raise RuntimeError(f"no setup {JOB['setup']} in the document")
    return setup


def make_setup():
    document = tagged_document()
    design = design_of(document)
    cam = cam_of(document)
    template = find_template()  # first: a missing template should fail before the document changes
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

    from_template = adsk.cam.CreateFromCAMTemplateInput.create()
    from_template.camTemplate = template
    operations = setup.createFromCAMTemplate2(from_template)
    if not operations:
        raise RuntimeError(f'the template "{JOB["template"]}" made no operations')
    # Started here, generated while Fusion is idle between calls: "status" says when it is done.
    cam.generateToolpath(setup)
    done({"setup": setup.name, "operations": [operation.name for operation in setup.allOperations]})


def status():
    setup = find_setup(cam_of(tagged_document()))
    operations = [setup.allOperations.item(i) for i in range(setup.allOperations.count)]
    generating = [operation.name for operation in operations if operation.isGenerating]
    # An operation whose geometry the template finds nothing for on this board (e.g. pockets on a board without any)
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
    # The operations with a toolpath only: those the template found nothing for on this board are left out.
    operations = [setup.allOperations.item(i) for i in range(setup.allOperations.count)]
    with_toolpath = [operation for operation in operations if operation.hasToolpath]
    if not with_toolpath:
        raise RuntimeError(f"no operation of {setup.name} has a toolpath")
    program_input.operations = with_toolpath
    program = cam.ncPrograms.add(program_input)
    program.postConfiguration = configuration
    if not program.postProcess(adsk.cam.NCProgramPostProcessOptions.create()):
        raise RuntimeError(f"posting {setup.name} with {configuration.description} failed")
    done({"setup": setup.name, "post": f"{configuration.vendor} {configuration.description}"})


def close():
    document = tagged_document()
    document.close(False)
    done({"closed": True})


def run(_context: str):
    ops = {"import": import_step, "setup": make_setup, "status": status, "post": post, "close": close}
    ops[JOB["op"]]()
