// A headless ClassCAD engine: the WASM build the ClassCAD MCP hosts, run here in this process, without the MCP's
// daemon or a browser. It reuses @classcad/mcp's own client and engine modules, which that package does not export
// as a public API (they ship types, but may change in any release): keep its version pinned exactly.
//
// The engine needs a key. Locally it comes from the machine's ClassCAD sign-in (~/.classcad-mcp/auth.json, made by
// the MCP's `login`); in CI from a CLASSCAD_TOKEN secret access token (ccsk_..., made at classcad.ch/account).

import { createRequire } from 'node:module'
import { writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { connect } from '@classcad/mcp/dist/client.js'
import { wasmOptionsFromEnv } from '@classcad/mcp/dist/engine/wasm.js'
import { buildScene, sceneToGlb } from '@classcad/mcp/dist/viewer/scene.js'
import { buildScriptApi } from '@classcad/script'
import { renderSession } from '@classcad/renderer/node'
import type { Api } from './part.ts'
import { stepAssembly } from './step-assembly.ts'

const registry = createRequire(import.meta.url)('@classcad/skill/method-registry.json')

export type Engine = Awaited<ReturnType<typeof openEngine>>

export async function openEngine() {
  const client = await connect(undefined, { engine: 'wasm', wasm: wasmOptionsFromEnv(), log: () => {} })
  await client.open()
  // The session shape @classcad/script expects, as the MCP's own run_script builds it.
  const session = {
    executionKey: client,
    env: 'node',
    execute: (task: Parameters<typeof client.execute>[0]) => client.execute(task),
    getTree: (options: Parameters<typeof client.getTree>[0]) => client.getTree(options),
    getGraphic: (options: Parameters<typeof client.getGraphic>[0]) => client.getGraphic(options),
    getEmissionConfig: () => client.getEmissionConfig(),
    setEmissionConfig: (params: Parameters<typeof client.setEmissionConfig>[0]) => client.setEmissionConfig(params),
  }
  return { client, session }
}

/**
 * Empty the drawing, then build on it: `build` gets the script API the ClassCAD MCP's run_script gives a script,
 * strict (a call that fails throws) and checked against the method registry (a misspelt method throws).
 */
export async function run<T>(engine: Engine, build: (api: Api) => Promise<T>) {
  await engine.client.execute({ 'v1.common.clear': [{}] })
  return build(buildScriptApi(engine.session as never, { registry, strict: true }) as Api)
}

/**
 * Write the drawing as OFB (with its history) or STP; returns the size in bytes. The STP is an assembly, one
 * component per named solid, so that other CAD systems keep the solids' names (`stepAssembly`).
 */
export async function save(engine: Engine, format: 'OFB' | 'STP', path: string) {
  const args: Record<string, unknown> = { format, encoding: 'base64' }
  // Planes, cylinders and the like as such, not as B-spline surfaces: smaller, and other CAD systems recognise them.
  if (format === 'STP') args.stp = { version: 2, analytic: 1 }
  const response = await engine.client.execute({ 'v1.common.save': [args] })
  const content = (response.result as { content?: string } | null)?.content
  if (!content) {
    throw new Error(`saving ${format} failed (maxLevel ${response.maxLevel}): ${JSON.stringify(response.messages)}`)
  }
  const saved = Buffer.from(content, 'base64')
  const data = format === 'STP' ? Buffer.from(stepAssembly(saved.toString('utf8'))) : saved
  writeFileSync(path, data)
  return data.length
}

/** Write the drawing as GLB (triangles with colours, for web viewers); the engine has none, the MCP packs it. */
export async function glb(engine: Engine, path: string) {
  const scene = buildScene(await engine.client.getTree(), await engine.client.getGraphic())
  const data = sceneToGlb(scene)
  writeFileSync(path, data)
  return data.length
}

/**
 * Render the drawing to `path` as a PNG, one color per body, seen from behind and above; `keep`, when given, picks
 * the bodies shown by their solid's name (the others are left out of the image, not of the drawing).
 */
export async function render(engine: Engine, path: string, keep?: (name: string) => boolean) {
  const dir = join(path, '..')
  mkdirSync(dir, { recursive: true })
  const tree = (await engine.client.getTree()) as Record<string, { class?: string; name?: string }>
  const graphic = (await engine.client.getGraphic()) as { containers?: { owner?: number }[] }
  // A container is drawn for its owner, a solid: the renderer takes a fetched graphic, so the others are dropped here.
  const kept = (owner?: number) => {
    const solid = owner === undefined ? undefined : tree[owner]
    return !keep || solid?.class !== 'CC_Solid' || keep(solid.name ?? '')
  }
  const [first] = await renderSession(engine.client, 'render', dir, {
    width: 1200,
    height: 1200,
    supersample: 2,
    layers: ['solid'],
    colors: 'distinct',
    view: { azimuth: 215, elevation: 22 },
    tree,
    graphic: { ...graphic, containers: graphic.containers?.filter(({ owner }) => kept(owner)) },
  })
  renameSync(join(dir, first.file), path)
}
