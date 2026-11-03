// The script `pnpm cam` runs inside the cloud Fusion session, through the Fusion Compute MCP server's TypeScript
// executor (`MCP.ExecuteTypeScript`, per Autodesk's docs). It is sent as text, preceded by `const JOB = {...};`.
// It is plain JavaScript (valid TypeScript), not type-checked here: there is no `adsk` typing in this repository.
//
// UNVERIFIED, all of it: it follows the Fusion API reference (adsk.cam: SetupInput, CAMTemplateLibrary,
// generateToolpath, NCProgramInput, PostConfigurationQuery, NCProgramPostProcessOptions) and its Manufacturing
// Workflow sample, but it has never run in a Fusion Compute session. What is least sure is marked "GUESS".
//
// JOB.op:
//   "open":  open the Fusion Team file JOB.document (its id/URN), return its bodies' names and boxes
//   "setup": for body JOB.body, make setup JOB.setup (rotated by JOB.rotate, degrees), apply template JOB.template,
//            generate its toolpaths, post them with the post matching JOB.post; return the NC code.
//
// The result goes back twice: as the script's return value and as one line `INTEGRAL_RESULT <json>` on the log,
// since how the executor hands back a result is not documented (GUESS).

/* global adsk, JOB */

const log = (...args) => {
  try {
    console.log(...args)
  } catch {}
}
const done = (result) => {
  log(`INTEGRAL_RESULT ${JSON.stringify(result)}`)
  return result
}
const wait = (ms) => (typeof setTimeout === 'function' ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(adsk.doEvents()))

const app = adsk.core.Application.get()

function design() {
  const product = app.activeDocument && app.activeDocument.products.itemByProductType('DesignProductType')
  if (!product) throw new Error('no design open')
  return adsk.fusion.Design.cast(product)
}

/** Every body of the design, its own and its occurrences'. */
function allBodies() {
  const root = design().rootComponent
  const found = []
  for (let i = 0; i < root.bRepBodies.count; i++) found.push(root.bRepBodies.item(i))
  for (let o = 0; o < root.allOccurrences.count; o++) {
    const occurrence = root.allOccurrences.item(o)
    for (let i = 0; i < occurrence.bRepBodies.count; i++) found.push(occurrence.bRepBodies.item(i))
  }
  return found
}

function box(body) {
  const b = body.boundingBox
  return { min: [b.minPoint.x * 10, b.minPoint.y * 10, b.minPoint.z * 10], max: [b.maxPoint.x * 10, b.maxPoint.y * 10, b.maxPoint.z * 10] } // cm → mm
}

function open() {
  const file = app.data.findFileById(JOB.document)
  if (!file) throw new Error(`no Fusion Team file ${JOB.document}`)
  app.documents.open(file, true)
  return done({ bodies: allBodies().map((b) => ({ name: b.name, box: box(b) })) })
}

/** The body, or a copy of it turned by JOB.rotate about its box centre (the board on its wedge). */
function target(body) {
  const [rx, ry, rz] = JOB.rotate || [0, 0, 0]
  if (!rx && !ry && !rz) return body
  const b = body.boundingBox
  const centre = adsk.core.Point3D.create((b.minPoint.x + b.maxPoint.x) / 2, (b.minPoint.y + b.maxPoint.y) / 2, (b.minPoint.z + b.maxPoint.z) / 2)
  const m = adsk.core.Matrix3D.create()
  const axes = [adsk.core.Vector3D.create(1, 0, 0), adsk.core.Vector3D.create(0, 1, 0), adsk.core.Vector3D.create(0, 0, 1)]
  ;[rx, ry, rz].forEach((deg, i) => {
    if (!deg) return
    const r = adsk.core.Matrix3D.create()
    r.setToRotation((deg * Math.PI) / 180, axes[i], centre)
    m.transformBy(r)
  })
  const temp = adsk.fusion.TemporaryBRepManager.get()
  const copy = temp.copy(body)
  temp.transform(copy, m)
  const root = design().rootComponent
  // a parametric design takes a free body only inside a base feature
  const base = root.features.baseFeatures.add()
  base.startEdit()
  const added = root.bRepBodies.add(copy, base)
  base.finishEdit()
  added.name = `${body.name}_${JOB.setup}`
  return added
}

function camProduct() {
  let product = app.activeDocument.products.itemByProductType('CAMProductType')
  if (!product) {
    // GUESS: the CAM product appears once the Manufacture workspace has been opened
    try {
      app.userInterface.workspaces.itemById('CAMEnvironment').activate()
    } catch {}
    product = app.activeDocument.products.itemByProductType('CAMProductType')
  }
  if (!product) throw new Error('no CAM product in this document')
  return adsk.cam.CAM.cast(product)
}

function param(owner, name, set) {
  const p = owner.parameters.itemByName(name)
  if (!p) throw new Error(`no CAM parameter ${name}`)
  set(p)
}

/** The template named JOB.template, in the cloud library, then the local one (searched through their folders). */
function findTemplate(manager) {
  const library = manager.libraryManager.templateLibrary
  const locations = [adsk.cam.LibraryLocations.CloudLibraryLocation, adsk.cam.LibraryLocations.LocalLibraryLocation]
  const seen = []
  for (const location of locations) {
    let folders = []
    try {
      folders = [library.urlByLocation(location)]
    } catch {}
    while (folders.length) {
      const url = folders.shift()
      for (const t of library.childTemplates(url) || []) {
        seen.push(t.name)
        if (t.name === JOB.template) return t
      }
      folders.push(...(library.childFolderURLs(url) || []))
    }
  }
  throw new Error(`no CAM template "${JOB.template}" in the cloud or local library (found: ${seen.join(', ') || 'none'})`)
}

/** The library post whose vendor, description or URL contains JOB.post, e.g. "shopbot" for ShopBot OpenSBP. */
function findPost(manager) {
  const library = manager.libraryManager.postLibrary
  const query = library.createQuery(adsk.cam.LibraryLocations.Fusion360LibraryLocation)
  const posts = query.execute()
  const want = JOB.post.toLowerCase()
  const list = []
  for (let i = 0; i < (posts.length ?? posts.count ?? 0); i++) list.push(posts[i] ?? posts.item(i))
  const hit = list.find((p) => [p.vendor, p.description, p.url && p.url.toString()].some((s) => s && s.toLowerCase().includes(want)))
  if (!hit) throw new Error(`no post matching "${JOB.post}" among ${list.length} Fusion library posts`)
  return hit
}

async function setup() {
  const body = allBodies().find((b) => b.name === JOB.body)
  if (!body) throw new Error(`no body "${JOB.body}" (found: ${allBodies().map((b) => b.name).join(', ')})`)
  const model = target(body)
  const cam = camProduct()
  const manager = adsk.cam.CAMManager.get()

  const input = cam.setups.createInput(adsk.cam.OperationTypes.MillingOperation)
  input.models = [model]
  const s = cam.setups.add(input)
  s.name = `${JOB.body}_${JOB.setup}`
  // the stock: the board's box, JOB.margin mm more around, nothing above (its top face is the tool's zero)
  s.stockMode = adsk.cam.SetupStockModes.RelativeBoxStock
  param(s, 'job_stockOffsetMode', (p) => (p.expression = "'simple'"))
  param(s, 'job_stockOffsetSides', (p) => (p.expression = `${JOB.margin} mm`))
  param(s, 'job_stockOffsetTop', (p) => (p.expression = '0 mm'))
  // the WCS: Z up, origin at the stock's top, x-min y-min corner (GUESS: the sample's "top 1" box point)
  param(s, 'wcs_origin_mode', (p) => (p.expression = "'stockPoint'"))
  param(s, 'wcs_stock_point', (p) => (p.expression = "'top 1'"))

  const template = findTemplate(manager)
  if (typeof s.createFromCAMTemplate2 === 'function') {
    const from = adsk.cam.CreateFromCAMTemplateInput.create()
    from.camTemplate = template
    s.createFromCAMTemplate2(from)
  } else {
    s.createFromCAMTemplate(template)
  }

  const future = cam.generateToolpath(s)
  const started = Date.now()
  while (!future.isGenerationCompleted) {
    if (Date.now() - started > JOB.generateTimeout) throw new Error(`toolpaths not generated in ${JOB.generateTimeout / 1000} s`)
    await wait(500)
  }
  const failed = []
  for (let i = 0; i < s.allOperations.count; i++) {
    const op = s.allOperations.item(i)
    if (op.hasError || !op.hasToolpath) failed.push(`${op.name}: ${op.error || 'no toolpath'}`)
  }
  if (failed.length) throw new Error(`toolpaths failed: ${failed.join('; ')}`)

  const program = cam.ncPrograms.createInput()
  program.displayName = s.name
  const folder = cam.temporaryFolder // GUESS: a folder the session may write to
  param(program, 'nc_program_filename', (p) => (p.value.value = s.name))
  param(program, 'nc_program_output_folder', (p) => (p.value.value = folder))
  try {
    param(program, 'nc_program_openInEditor', (p) => (p.value.value = false))
  } catch {}
  program.operations = [s]
  const nc = cam.ncPrograms.add(program)
  nc.postConfiguration = findPost(manager)
  nc.postProcess(adsk.cam.NCProgramPostProcessOptions.create())

  // GUESS: reading the posted file back. The executor's runtime is not documented; try what a JS runtime may have.
  const path = `${folder}/${s.name}.sbp`
  let content = null
  try {
    if (typeof require === 'function') content = require('fs').readFileSync(path, 'utf8')
  } catch {}
  try {
    if (content === null && typeof Deno !== 'undefined') content = Deno.readTextFileSync(path)
  } catch {}
  return done({ setup: s.name, post: nc.postConfiguration.description, operations: s.allOperations.count, path, content })
}

return JOB.op === 'open' ? open() : await setup()
