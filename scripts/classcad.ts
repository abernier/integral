// A headless ClassCAD engine: the WASM build the ClassCAD MCP hosts, run here in this process, without the MCP's
// daemon or a browser. It reuses @classcad/mcp's own client and engine modules, which that package does not export
// as a public API: keep its version pinned exactly in package.json.
//
// The engine needs a key. Locally it comes from the machine's ClassCAD sign-in (~/.classcad-mcp/auth.json, made by
// the MCP's `login`); in CI from a CLASSCAD_TOKEN secret access token (ccsk_..., made at classcad.ch/account).

import { createRequire } from 'node:module'
import { writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error untyped internal module of @classcad/mcp
import { connect } from '@classcad/mcp/dist/client.js'
// @ts-expect-error untyped internal module of @classcad/mcp
import { wasmOptionsFromEnv } from '@classcad/mcp/dist/engine/wasm.js'
import { runScript } from '@classcad/script'
import { renderSession } from '@classcad/renderer/node'

const registry = createRequire(import.meta.url)('@classcad/skill/method-registry.json')

export type Engine = Awaited<ReturnType<typeof openEngine>>

export async function openEngine() {
  const client = await connect(undefined, { engine: 'wasm', wasm: wasmOptionsFromEnv(), log: () => {} })
  await client.open()
  // The session shape @classcad/script expects, as the MCP's own run_script builds it.
  const session = {
    executionKey: client,
    env: 'node',
    execute: (task: unknown) => client.execute(task),
    getTree: (options: unknown) => client.getTree(options),
    getGraphic: (options: unknown) => client.getGraphic(options),
    getEmissionConfig: () => client.getEmissionConfig(),
    setEmissionConfig: (params: unknown) => client.setEmissionConfig(params),
  }
  return { client, session }
}

/** Empty the drawing, then run a script body (the same text the MCP's run_script takes) on it. */
export async function run(engine: Engine, code: string) {
  await engine.client.execute({ 'v1.common.clear': [{}] })
  const result = await runScript(code, engine.session as never, { registry, strict: true, timeoutMs: 300_000 })
  if (!result.ok) throw new Error(`script failed: ${result.error}\n${(result.logs ?? []).join('\n')}`)
  return result.returned
}

/** Write the drawing as OFB (with its history) or STP; returns the size in bytes. */
export async function save(engine: Engine, format: 'OFB' | 'STP', path: string) {
  const args: Record<string, unknown> = { format, encoding: 'base64' }
  // Planes, cylinders and the like as such, not as B-spline surfaces: smaller, and other CAD systems recognise them.
  if (format === 'STP') args.stp = { version: 2, analytic: 1 }
  const response = await engine.client.execute({ 'v1.common.save': [args] })
  if (!response.result?.content) {
    throw new Error(`saving ${format} failed (maxLevel ${response.maxLevel}): ${JSON.stringify(response.messages)}`)
  }
  const data = Buffer.from(response.result.content, 'base64')
  writeFileSync(path, data)
  return data.length
}

/** Render the drawing to `path` as a PNG, one color per body, seen from behind and above. */
export async function render(engine: Engine, path: string) {
  const dir = join(path, '..')
  mkdirSync(dir, { recursive: true })
  const [first] = await renderSession(engine.client, 'render', dir, {
    width: 1200,
    height: 1200,
    supersample: 2,
    layers: ['solid'],
    colors: 'distinct',
    view: { azimuth: 215, elevation: 22 },
  })
  renameSync(join(dir, first.file), path)
}
