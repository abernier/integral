// The Fusion desktop app's own MCP server, on this machine: Fusion must be running, with "Fusion MCP Server" on in
// Preferences > General > API. Streamable HTTP, no sign-in. `FUSION_MCP_URL` points elsewhere.
//
// Of its tools, `pnpm cam` uses one: `fusion_mcp_execute` with featureType "script", which runs a Python script with
// the Fusion API in the running Fusion. The script defines `run(_context)`; what it prints comes back as the
// answer's `message`, an exception it raises as the answer's `error` (after what it printed).

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export const ENDPOINT = process.env.FUSION_MCP_URL ?? 'http://127.0.0.1:27182/mcp'

/** Long enough for a STEP import or a post: the toolpaths themselves are generated between calls. */
const CALL_TIMEOUT_MS = 10 * 60_000

export async function connect() {
  const client = new Client({ name: 'integral-cam', version: '0.2.0' })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(ENDPOINT)))
  } catch (error) {
    throw new Error(
      `no Fusion MCP server at ${ENDPOINT} (${error instanceof Error ? error.message : error}): is Fusion running, ` +
        'with "Fusion MCP Server" on in Preferences > General > API?',
    )
  }
  return client
}

/**
 * Run a Python script in Fusion; returns what it printed on its `INTEGRAL_RESULT <json>` line, parsed. A script that
 * raised, or printed no such line, is an error carrying what it printed.
 */
export async function runScript(client: Client, script: string, { readOnly = false } = {}) {
  const result = await client.callTool(
    { name: 'fusion_mcp_execute', arguments: { featureType: 'script', object: { script, readOnly } } },
    undefined,
    { timeout: CALL_TIMEOUT_MS },
  )
  const content = (result.content ?? []) as { type: string; text?: string }[]
  const text = content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
  let answer: { success?: boolean; message?: string; error?: string }
  try {
    answer = JSON.parse(text)
  } catch {
    answer = { success: !result.isError, message: text }
  }
  if (result.isError || answer.success === false) throw new Error(`fusion script: ${answer.error ?? answer.message ?? text}`)
  for (const line of (answer.message ?? '').split('\n')) {
    const hit = /^INTEGRAL_RESULT (\{.*\})\s*$/.exec(line)
    if (hit) return JSON.parse(hit[1]) as unknown
  }
  throw new Error(`fusion script: no INTEGRAL_RESULT line in what it printed: ${answer.message ?? text}`)
}
