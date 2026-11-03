// Signing in to Autodesk for the Fusion Compute MCP server: OAuth 2.1, authorization code with PKCE, the browser
// sent back to a server on localhost. The MCP SDK does the protocol (it finds the authorization server from the MCP
// server's protected-resource metadata, registers this client, swaps the code for tokens, refreshes them); this file
// only keeps what it is given and opens the browser.
//
// Kept in ~/.config/integral/autodesk.json (mode 600): the registered client, the tokens, the PKCE verifier.
// AUTODESK_TOKEN, when set, is used as the bearer token as it is (for CI): no sign-in, no refresh, nothing kept.
//
// Autodesk's authorization server refuses dynamic client registration and takes a client ID metadata document
// instead: the client id is the document's URL. Ours is autodesk-client.json, published with the site;
// AUTODESK_CLIENT_METADATA_URL points to another one (its redirect URI must match AUTODESK_CALLBACK_PORT).

import { execFile } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

export const TOKEN_FILE = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'integral', 'autodesk.json')
const PORT = Number(process.env.AUTODESK_CALLBACK_PORT ?? 8976)
const REDIRECT = `http://localhost:${PORT}/callback`
export const SCOPES = 'mcp:read mcp:write offline_access'
const CLIENT_METADATA_URL =
  process.env.AUTODESK_CLIENT_METADATA_URL ?? 'https://abernier.github.io/integral/autodesk-client.json'

type Stored = { client?: OAuthClientInformationMixed; tokens?: OAuthTokens; verifier?: string }

function read(): Stored {
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function write(update: Partial<Stored>) {
  mkdirSync(dirname(TOKEN_FILE), { recursive: true })
  writeFileSync(TOKEN_FILE, `${JSON.stringify({ ...read(), ...update }, null, 2)}\n`)
  chmodSync(TOKEN_FILE, 0o600)
}

function openBrowser(url: string) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  execFile(command, [url], () => {})
}

/** The provider the MCP transport signs in with; `waitForCode` resolves once the browser comes back. */
export function autodeskAuth() {
  const fixed = process.env.AUTODESK_TOKEN
  let code: Promise<string> | undefined

  const provider: OAuthClientProvider = {
    get redirectUrl() {
      return REDIRECT
    },
    get clientMetadata(): OAuthClientMetadata {
      return {
        client_name: 'integral cam (abernier/integral)',
        redirect_uris: [REDIRECT],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: SCOPES,
      }
    },
    clientMetadataUrl: CLIENT_METADATA_URL,
    clientInformation: () => read().client,
    saveClientInformation: (client) => write({ client }),
    tokens: () => (fixed ? { access_token: fixed, token_type: 'Bearer' } : read().tokens),
    saveTokens: (tokens) => {
      if (!fixed) write({ tokens })
    },
    saveCodeVerifier: (verifier) => write({ verifier }),
    codeVerifier: () => {
      const { verifier } = read()
      if (!verifier) throw new Error(`no PKCE verifier in ${TOKEN_FILE}`)
      return verifier
    },
    redirectToAuthorization: (url) => {
      if (fixed) throw new Error('AUTODESK_TOKEN was refused by the server: get a fresh token')
      code = listen()
      console.log(`sign in to Autodesk in your browser (opening it), or open:\n  ${url.href}`)
      openBrowser(url.href)
    },
    invalidateCredentials: (scope) => {
      if (scope === 'all') write({ client: undefined, tokens: undefined, verifier: undefined })
      if (scope === 'tokens') write({ tokens: undefined })
      if (scope === 'verifier') write({ verifier: undefined })
      if (scope === 'client') write({ client: undefined })
    },
  }

  return {
    provider,
    waitForCode: () => code ?? Promise.reject(new Error('no sign-in under way')),
  }
}

/** One request to the callback, carrying `?code=` (or `?error=`); five minutes at most. */
function listen() {
  return new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', REDIRECT)
      if (url.pathname !== '/callback') return void response.writeHead(404).end()
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error_description') ?? url.searchParams.get('error')
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(code ? 'Signed in to Autodesk. You can close this tab.' : `Sign-in failed: ${error}`)
      clearTimeout(timer)
      server.close()
      code ? resolve(code) : reject(new Error(`Autodesk sign-in failed: ${error}`))
    })
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Autodesk sign-in: no answer in 5 minutes'))
    }, 5 * 60_000)
    server.on('error', reject)
    server.listen(PORT, '127.0.0.1')
  })
}
