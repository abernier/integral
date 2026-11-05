/**
 * Latest wins: a queue of one for slow jobs (the part's builds, in the worker). At most one job runs; the latest
 * request waits behind it, and a newer request takes its place, the one it replaces rejected with `Superseded`. A
 * drag that asks for many builds runs two at most: the one under way, then the last one asked for.
 * Pure of React and of the worker, so that it is testable under node.
 * @module
 */

/** The rejection of a request a newer one replaced before it ran. */
export class Superseded extends Error {
  constructor() {
    super('Superseded by a newer request')
    this.name = 'Superseded'
  }
}

/**
 * A runner that keeps one job running and the latest request waiting.
 * @param run The job: one at a time, never two at once.
 * @example
 * const builds = latestWins((values) => buildInWorker(values))
 * builds.submit(values).then(show, (e) => e instanceof Superseded || report(e))
 */
export function latestWins<Request, Result>(run: (request: Request) => Promise<Result>) {
  type Waiting = { request: Request; resolve: (result: Result) => void; reject: (error: unknown) => void }
  let running = false
  let waiting: Waiting | undefined
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  async function next() {
    if (running || !waiting) return
    const { request, resolve, reject } = waiting
    waiting = undefined
    running = true
    try {
      resolve(await run(request))
    } catch (e) {
      reject(e)
    } finally {
      running = false
      void next()
      notify()
    }
  }

  return {
    /** Asks for a job: it runs once the one under way is done, unless a newer request comes first. */
    submit(request: Request) {
      return new Promise<Result>((resolve, reject) => {
        waiting?.reject(new Superseded())
        waiting = { request, resolve, reject }
        void next()
        notify()
      })
    },
    /** Whether a job runs or waits. */
    busy: () => running || waiting !== undefined,
    /** Calls `listener` whenever `busy` may have changed; returns the unsubscribe, as `useSyncExternalStore` takes it. */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
