// The URL as the configurator's state: what a link reads as, and what the state is written as.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadQuery, queryUrl } from './App.url.ts'

const schema = {
  T: { value: 19, min: 12, max: 30, step: 0.5, hint: 'board thickness' },
  TAILS: { value: 6, min: 2, max: 8, step: 1, hint: 'dovetail count' },
}
const defaults = { T: 19, TAILS: 6 }

test('loadQuery: the part, and the masters at their defaults when the link has none', () => {
  assert.deepEqual(loadQuery(schema, '?part=zigzag-chair'), { part: 'zigzag-chair', values: defaults })
  assert.deepEqual(loadQuery(schema, ''), { part: '', values: defaults })
})

test('loadQuery: a value that is empty or not a number keeps its default', () => {
  assert.deepEqual(loadQuery(schema, '?T=thick&TAILS=%20').values, defaults)
  assert.deepEqual(loadQuery(schema, '?T=&TAILS=Infinity').values, defaults)
})

test('loadQuery: a value is clamped to its range', () => {
  assert.deepEqual(loadQuery(schema, '?T=25&TAILS=99').values, { T: 25, TAILS: 8 })
  assert.equal(loadQuery(schema, '?TAILS=-3').values.TAILS, 2)
})

test('loadQuery: a value is snapped to its step, counted from the default', () => {
  assert.equal(loadQuery(schema, '?T=25.3').values.T, 25.5)
  assert.equal(loadQuery(schema, '?TAILS=4.4').values.TAILS, 4)
  const fine = { X: { value: 0, min: 0, max: 1, step: 0.1, hint: '' } }
  assert.equal(loadQuery(fine, '?X=0.3').values.X, 0.3)
})

test('loadQuery: an unknown key is dropped', () => {
  assert.deepEqual(Object.keys(loadQuery(schema, '?part=zigzag-chair&GRIP=140').values), ['T', 'TAILS'])
})

test('queryUrl: the part first, then only the values that differ from the defaults', () => {
  assert.equal(queryUrl(schema, { part: 'zigzag-chair', values: defaults }), '?part=zigzag-chair')
  assert.equal(queryUrl(schema, { part: 'zigzag-chair', values: { T: 19, TAILS: 4 } }), '?part=zigzag-chair&TAILS=4')
  assert.equal(queryUrl(schema, { part: 'zigzag-chair', values: { T: 25.5, TAILS: 4 } }), '?part=zigzag-chair&T=25.5&TAILS=4')
})

test('queryUrl: on a base, its query updated, a value back at its default removed, the hash kept', () => {
  const base = 'https://example.test/configurator/?part=zigzag-chair&TAILS=4#top'
  assert.equal(queryUrl(schema, { part: 'zigzag-chair', values: { T: 25, TAILS: 6 } }, base), 'https://example.test/configurator/?part=zigzag-chair&T=25#top')
})

test('round trip: the URL written for some values reads back as those values', () => {
  for (const values of [defaults, { T: 19, TAILS: 4 }, { T: 25.5, TAILS: 2 }, { T: 30, TAILS: 8 }]) {
    const state = { part: 'zigzag-chair', values }
    assert.deepEqual(loadQuery(schema, queryUrl(schema, state)), state)
  }
})
