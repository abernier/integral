// Latest wins: one job at a time, the latest request waiting, the ones in between superseded.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { latestWins, Superseded } from './App.latest.ts'

/** Jobs the test settles by hand, by their request; `runs` lists the requests run, in order. */
function manualJobs() {
  const runs: string[] = []
  const settle = new Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }>()
  const run = (request: string) =>
    new Promise<string>((resolve, reject) => {
      runs.push(request)
      settle.set(request, { resolve, reject })
    })
  return { runs, settle, run }
}

/** Lets the runner's promise callbacks run. */
const tick = () => new Promise((resolve) => setTimeout(resolve))

/** How a promise settled: its value, or the name of its error. */
const outcome = (promise: Promise<string>) =>
  promise.then(
    (value) => value,
    (e: Error) => e.name,
  )

test('runs the first request at once, and a second only once the first is done', async () => {
  const { runs, settle, run } = manualJobs()
  const jobs = latestWins(run)
  const a = jobs.submit('A')
  const b = jobs.submit('B')
  await tick()
  assert.deepEqual(runs, ['A'])
  settle.get('A')!.resolve('a')
  assert.equal(await a, 'a')
  await tick()
  assert.deepEqual(runs, ['A', 'B'])
  settle.get('B')!.resolve('b')
  assert.equal(await b, 'b')
})

test('a newer request supersedes the waiting one, never the running one', async () => {
  const { runs, settle, run } = manualJobs()
  const jobs = latestWins(run)
  const a = outcome(jobs.submit('A'))
  const b = outcome(jobs.submit('B'))
  const c = outcome(jobs.submit('C'))
  const d = outcome(jobs.submit('D'))
  await tick()
  settle.get('A')!.resolve('a')
  await tick()
  settle.get('D')!.resolve('d')
  assert.deepEqual(await Promise.all([a, b, c, d]), ['a', 'Superseded', 'Superseded', 'd'])
  assert.deepEqual(runs, ['A', 'D'])
})

test('a failed job rejects its request, and the next one still runs', async () => {
  const { runs, settle, run } = manualJobs()
  const jobs = latestWins(run)
  const a = outcome(jobs.submit('A'))
  const b = outcome(jobs.submit('B'))
  await tick()
  settle.get('A')!.reject(new RangeError('kernel'))
  await tick()
  settle.get('B')!.resolve('b')
  assert.deepEqual(await Promise.all([a, b]), ['RangeError', 'b'])
  assert.deepEqual(runs, ['A', 'B'])
})

test('busy while a job runs or waits, and the listeners hear each change', async () => {
  const { settle, run } = manualJobs()
  const jobs = latestWins(run)
  let heard = 0
  const unsubscribe = jobs.subscribe(() => heard++)
  assert.equal(jobs.busy(), false)
  const a = jobs.submit('A')
  assert.equal(jobs.busy(), true)
  await tick()
  settle.get('A')!.resolve('a')
  await a
  await tick()
  assert.equal(jobs.busy(), false)
  assert.ok(heard >= 2)
  unsubscribe()
  const before = heard
  void jobs.submit('B')
  assert.equal(heard, before)
})

test('a superseded request rejects with a Superseded error', async () => {
  const { run } = manualJobs()
  const jobs = latestWins(run)
  void jobs.submit('A')
  const b = jobs.submit('B')
  void jobs.submit('C')
  await assert.rejects(b, Superseded)
})
