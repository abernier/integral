// The address bar as the state: what it is written as, and the state read back from it.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedParams, withQueryValues } from './App.query.ts'
import { syncedUrl } from './App.url.ts'

const schema = {
  T: { value: 19, min: 12, max: 30, step: 0.5, hint: 'board thickness' },
  TAILS: { value: 6, min: 2, max: 8, step: 1, hint: 'dovetail count' },
}

/** The values the sliders start at, for a given address bar. */
function valuesFrom(url: string) {
  const schemaFromUrl = withQueryValues(schema, new URL(url, 'https://example.test').searchParams)
  return Object.fromEntries(Object.entries(schemaFromUrl).map(([name, control]) => [name, control.value]))
}

test('syncedUrl: the query replaced, the path and the hash kept', () => {
  const current = { pathname: '/integral/configurator/', hash: '#top' }
  assert.equal(syncedUrl(current, new URLSearchParams({ part: 'zigzag-chair', T: '25' })), '/integral/configurator/?part=zigzag-chair&T=25#top')
  assert.equal(syncedUrl({ pathname: '/', hash: '' }, new URLSearchParams()), '/')
})

test('round trip: the address written for some values gives those values back', () => {
  for (const values of [
    { T: 19, TAILS: 6 },
    { T: 19, TAILS: 4 },
    { T: 25.5, TAILS: 2 },
  ]) {
    const url = syncedUrl({ pathname: '/', hash: '' }, changedParams(schema, values, 'zigzag-chair'))
    assert.deepEqual(valuesFrom(url), values)
  }
})

test('round trip: the defaults stay out of the address', () => {
  assert.equal(syncedUrl({ pathname: '/', hash: '' }, changedParams(schema, { T: 19, TAILS: 6 }, 'zigzag-chair')), '/?part=zigzag-chair')
})
