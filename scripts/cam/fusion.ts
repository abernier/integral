// A session of the Fusion Compute MCP server (Autodesk, public beta): a headless Fusion in Autodesk's cloud, driven
// over MCP (Streamable HTTP, OAuth). One session per run: started, used for every board, stopped.
//
// What is documented (Autodesk help, "Fusion Compute MCP"; a third-party listing of 2026-10-17 for the names): the
// server's tools are start_fusion (with a `toolMode`, `Execute` by default: TypeScript through
// `MCP.ExecuteTypeScript`), fusion_status, invoke_fusion (lists, describes or runs the session's worker tools),
// stop_fusion, and a few that need no session. Beta limits: 2 sessions per user, 1 h per session, stopped after
// 15 min idle, queued when capacity is full.
//
// UNVERIFIED: none of these names or argument shapes was seen answering. So nothing here is hardcoded blindly: the
// tools are listed first and mapped by intent (the documented name if present, else a name that says it), and
// each tool's arguments are filled from its own input schema. A missing capability is an error that lists what the
// server does offer (`pnpm cam --list-tools` prints it all).

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { autodeskAuth } from './auth.ts'

export const ENDPOINT = process.env.FUSION_MCP_URL ?? 'https://developer.api.autodesk.com/da/v3/mcp/fusion'

/** The server tools a run needs: the documented name first, else the first tool whose name matches. */
const INTENTS = {
  start: { name: 'start_fusion', match: /start/i },
  status: { name: 'fusion_status', match: /status/i },
  invoke: { name: 'invoke_fusion', match: /invoke|worker/i },
  stop: { name: 'stop_fusion', match: /stop|shutdown|close/i },
} as const
type Intent = keyof typeof INTENTS

/** Beta: a session lasts one hour at most; stop starting boards a little before. */
export const SESSION_BUDGET_MS = 50 * 60_000
const CALL_TIMEOUT_MS = 10 * 60_000

export async function connect() {
  const auth = autodeskAuth()
  for (let attempt = 0; ; attempt++) {
    const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), { authProvider: auth.provider })
    const client = new Client({ name: 'integral-cam', version: '0.1.0' })
    try {
      await client.connect(transport)
      return client
    } catch (error) {
      if (!(error instanceof UnauthorizedError) || attempt > 0) throw explain(error)
      await transport.finishAuth(await auth.waitForCode())
    }
  }
}

function explain(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/403|forbidden|entitlement|license/i.test(message)) {
    return new Error(`${message}\n(is there an active Fusion license and a Fusion Team hub on this Autodesk account?)`)
  }
  return error instanceof Error ? error : new Error(message)
}

type Schema = { properties?: Record<string, { type?: string; enum?: string[] }>; required?: string[] }

/** What a tool call answered: its structured content, else its text content parsed as JSON, else the text. */
export function payload(result: unknown): unknown {
  const r = result as { structuredContent?: unknown; content?: { type: string; text?: string }[]; isError?: boolean }
  if (r.isError) throw new Error(`tool error: ${(r.content ?? []).map((c) => c.text).join('\n')}`)
  if (r.structuredContent !== undefined) return r.structuredContent
  const text = (r.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n')
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** The first value under a key matching `key`, anywhere in `value`. */
function find(value: unknown, key: RegExp): unknown {
  if (!value || typeof value !== 'object') return undefined
  for (const [k, v] of Object.entries(value)) if (key.test(k) && v !== null && typeof v !== 'object') return v
  for (const v of Object.values(value)) {
    const hit = find(v, key)
    if (hit !== undefined) return hit
  }
  return undefined
}

/** A schema's property whose name matches, for filling arguments by meaning. */
function prop(schema: Schema | undefined, match: RegExp) {
  return Object.keys(schema?.properties ?? {}).find((name) => match.test(name))
}

/** The schema's enum value matching `match` for the property, or `fallback`. */
function choice(schema: Schema | undefined, name: string, match: RegExp, fallback: string) {
  return schema?.properties?.[name]?.enum?.find((v) => match.test(v)) ?? fallback
}

export function mapTools(tools: Tool[]) {
  const byIntent = {} as Record<Intent, Tool>
  const missing: string[] = []
  for (const [intent, { name, match }] of Object.entries(INTENTS) as [Intent, (typeof INTENTS)[Intent]][]) {
    const tool = tools.find((t) => t.name === name) ?? tools.find((t) => match.test(t.name))
    if (tool) byIntent[intent] = tool
    else missing.push(`${intent} (looked for ${name} or ${match})`)
  }
  if (missing.length) {
    throw new Error(`the Fusion Compute MCP server offers no tool to ${missing.join(', ')}; it offers: ${tools.map((t) => t.name).join(', ')}`)
  }
  return byIntent
}

export class FusionSession {
  readonly started = Date.now()
  private worker?: { tool: string; schema?: Schema }

  readonly client: Client
  readonly tools: Record<Intent, Tool>
  readonly id: string

  constructor(client: Client, tools: Record<Intent, Tool>, id: string) {
    this.client = client
    this.tools = tools
    this.id = id
  }

  /** Start a session (`toolMode: Execute`), waiting while it is queued, `queueTimeout` ms at most. */
  static async start(client: Client, tools: Record<Intent, Tool>, queueTimeout: number) {
    const schema = tools.start.inputSchema as Schema
    const args: Record<string, unknown> = {}
    const mode = prop(schema, /tool_?mode/i)
    if (mode) args[mode] = choice(schema, mode, /execute/i, 'Execute')
    const answer = payload(await client.callTool({ name: tools.start.name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS }))
    const id = find(answer, /session_?id/i)
    if (typeof id !== 'string') throw new Error(`${tools.start.name} gave no session id: ${JSON.stringify(answer)}`)
    const session = new FusionSession(client, tools, id)
    console.log(`fusion: session ${id}`)
    await session.ready(queueTimeout)
    return session
  }

  private sessionArgs(schema: Schema | undefined) {
    const key = prop(schema, /session/i) ?? 'engine_session_id'
    return { [key]: this.id }
  }

  async call(intent: Intent, args: Record<string, unknown> = {}) {
    const tool = this.tools[intent]
    const result = await this.client.callTool(
      { name: tool.name, arguments: { ...this.sessionArgs(tool.inputSchema as Schema), ...args } },
      undefined,
      { timeout: CALL_TIMEOUT_MS, resetTimeoutOnProgress: true },
    )
    return payload(result)
  }

  /** Poll the status until the session runs; a queued one says its place. */
  async ready(timeout: number) {
    const until = Date.now() + timeout
    for (;;) {
      const status = await this.call('status')
      const state = String(find(status, /^(state|status)$/i) ?? JSON.stringify(status))
      if (/ready|running|active|idle|started/i.test(state) && !/not.?ready/i.test(state)) return
      if (/fail|error|stopped|expired|denied/i.test(state)) throw new Error(`fusion session ${this.id}: ${state}`)
      const place = find(status, /queue/i)
      console.log(`fusion: ${state}${place !== undefined ? `, queue position ${place}` : ''}`)
      if (Date.now() > until) throw new Error(`fusion session still ${state} after ${timeout / 1000} s (queued: capacity is full; try later)`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  /** invoke_fusion with an action (list, describe, run), a worker tool, its arguments, as the schema names them. */
  async invoke(action: 'list' | 'describe' | 'run', tool?: string, args?: Record<string, unknown>) {
    const schema = this.tools.invoke.inputSchema as Schema
    const out: Record<string, unknown> = {}
    const actionKey = prop(schema, /^(action|operation|command|mode)$/i)
    if (actionKey) out[actionKey] = choice(schema, actionKey, action === 'run' ? /run|call|invoke|exec/i : new RegExp(action, 'i'), action)
    const toolKey = prop(schema, /tool/i)
    if (tool && toolKey) out[toolKey] = tool
    const argsKey = prop(schema, /arg|input|param/i)
    if (args && argsKey) out[argsKey] = schema.properties?.[argsKey]?.type === 'string' ? JSON.stringify(args) : args
    return this.call('invoke', out)
  }

  /** The session's worker tools, by name. */
  async workerTools() {
    const listed = await this.invoke('list')
    const array = Array.isArray(listed) ? listed : (Object.values((listed as object) ?? {}).find(Array.isArray) ?? [])
    return (array as unknown[]).map((t) => (typeof t === 'string' ? t : String((t as { name?: string }).name)))
  }

  /** Run a TypeScript script in the session; returns what it gave back (see fusion-job.js). */
  async runScript(source: string) {
    if (!this.worker) {
      const names = await this.workerTools()
      const tool = names.find((n) => /ExecuteTypeScript/i.test(n)) ?? names.find((n) => /script|typescript/i.test(n))
      if (!tool) throw new Error(`no TypeScript executor among the session's worker tools: ${names.join(', ')}`)
      const described = await this.invoke('describe', tool)
      this.worker = { tool, schema: findSchema(described) }
      console.log(`fusion: scripts run by ${tool}`)
    }
    const key = prop(this.worker.schema, /script|code|source|typescript/i) ?? 'script'
    const answer = await this.invoke('run', this.worker.tool, { [key]: source })
    return scriptResult(answer)
  }

  /** Whether another board fits in the session's hour. */
  get hasTime() {
    return Date.now() - this.started < SESSION_BUDGET_MS
  }

  async stop() {
    try {
      await this.call('stop')
      console.log(`fusion: session ${this.id} stopped`)
    } catch (error) {
      console.error(`fusion: stopping session ${this.id} failed (it ends by itself after 15 min idle): ${error}`)
    }
  }
}

/** The input schema in a worker tool's description, wherever it is. */
function findSchema(value: unknown): Schema | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  if (v.properties && typeof v.properties === 'object') return v as Schema
  for (const child of Object.values(v)) {
    const hit = findSchema(child)
    if (hit) return hit
  }
  return undefined
}

/** Every string in a value: the texts a script's log may have come back in. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(strings)
}

/** A script's result: the `INTEGRAL_RESULT <json>` line it logged, else the structured answer itself. */
function scriptResult(answer: unknown): unknown {
  for (const text of strings(answer)) {
    for (const line of text.split('\n')) {
      const hit = /INTEGRAL_RESULT (\{.*\})\s*$/.exec(line)
      if (hit) return JSON.parse(hit[1])
    }
  }
  const error = find(answer, /^(error|exception)$/i)
  if (error) throw new Error(`fusion script: ${error}`)
  return answer
}
