/**
 * The part, built off the page's thread: a `Model` whose masters and variants come from the build worker
 * (App.worker.build.ts), and whose `build` runs there, the latest request only (App.latest.ts), so that the sliders,
 * the orbit and the panel stay responsive while the kernel works. A worker that dies (the kernel out of memory, a
 * crash) fails its request and is made again for the next one.
 * @module
 */
import { useSyncExternalStore } from 'react'
import type { Model, Variants, Control } from './models.ts'
import { latestWins } from './App.latest.ts'
import { fromShapeData, type ShapeData } from './App.worker.mesh.ts'

/** What the page asks the worker about a part: its masters and variants, or a build. */
type Ask = { part: string } & ({ type: 'load' } | { type: 'build'; values: Record<string, number>; variant: string })

/** A request to the worker: what is asked, and an id its reply carries back. */
export type WorkerRequest = Ask & { id: number }

/** What the worker answers, by the request's id: the masters and variants, the built shape, or an error. */
export type WorkerReply = { id: number } & (
  | { schema: Record<string, Control>; variants?: Variants }
  | { shape: ShapeData }
  | { error: string }
)

let worker: Worker | undefined
let lastId = 0
const replies = new Map<number, { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void }>()

/** The worker, made on first use and again after it died. */
function connection() {
  if (worker) return worker
  const made = new Worker(new URL('./App.worker.build.ts', import.meta.url), { type: 'module', name: 'configurator-build' })
  made.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
    replies.get(data.id)?.resolve(data)
    replies.delete(data.id)
  }
  // An error the worker did not catch (it failed to load, or crashed): every open request fails, the next makes a new one.
  made.onerror = (event) => {
    event.preventDefault()
    const error = new Error(`The build worker failed: ${event.message || 'it crashed'}`)
    console.error(error)
    made.terminate()
    if (worker === made) worker = undefined
    for (const { reject } of replies.values()) reject(error)
    replies.clear()
  }
  worker = made
  return made
}

/** Sends a request to the worker; resolves to its reply, rejects with the error it reports. */
function ask(request: Ask) {
  const id = ++lastId
  return new Promise<WorkerReply>((resolve, reject) => {
    replies.set(id, { resolve, reject })
    connection().postMessage({ ...request, id } satisfies WorkerRequest)
  }).then((reply) => {
    if ('error' in reply) throw new Error(reply.error)
    return reply
  })
}

/** The builds, one at a time, the latest waiting. */
const builds = latestWins(async ({ part, values, variant }: { part: string; values: Record<string, number>; variant: string }) => {
  const reply = await ask({ type: 'build', part, values, variant })
  if (!('shape' in reply)) throw new Error('The build worker sent no shape')
  return fromShapeData(reply.shape)
})

/**
 * The part named `part`, as the worker loads it: its masters and variants, and a `build` that runs in the worker.
 * A build a newer one replaced before it ran rejects with `Superseded` (App.latest.ts).
 */
export async function loadModel(part: string): Promise<Model> {
  const reply = await ask({ type: 'load', part })
  if (!('schema' in reply)) throw new Error('The build worker sent no masters')
  return {
    schema: reply.schema,
    variants: reply.variants,
    build: (values, variant) => builds.submit({ part, values, variant }),
  }
}

/** Whether a build runs or waits in the worker. */
export function useBuilding() {
  return useSyncExternalStore(builds.subscribe, builds.busy)
}
