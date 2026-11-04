// The query string in, the link out: what the sliders start at, and what a shared link carries.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedParams, withQueryValues } from './App.query.ts'

const schema = {
  T: { value: 19, min: 12, max: 30, step: 0.5, hint: 'board thickness' },
  TAILS: { value: 6, min: 2, max: 8, step: 1, hint: 'dovetail count' },
}

test('withQueryValues: a key that is missing, empty or not a number keeps its default', () => {
  const params = new URLSearchParams({ T: 'thick', TAILS: ' ' })
  assert.deepEqual(withQueryValues(schema, params), schema)
  assert.deepEqual(withQueryValues(schema, new URLSearchParams()), schema)
})

test('withQueryValues: a numeric key sets the default, clamped to the range', () => {
  const params = new URLSearchParams({ T: '25', TAILS: '99' })
  const values = withQueryValues(schema, params)
  assert.equal(values.T.value, 25)
  assert.equal(values.TAILS.value, 8)
  assert.equal(withQueryValues(schema, new URLSearchParams({ TAILS: '-3' })).TAILS.value, 2)
  // Everything else about the control stays.
  assert.deepEqual(values.T, { ...schema.T, value: 25 })
})

test('withQueryValues: an unknown key is dropped', () => {
  const values = withQueryValues(schema, new URLSearchParams({ part: 'zigzag-chair', GRIP: '140' }))
  assert.deepEqual(Object.keys(values), ['T', 'TAILS'])
})

test('changedParams: the part first, then only the values that differ from the defaults', () => {
  assert.equal(String(changedParams(schema, { T: 19, TAILS: 6 }, 'zigzag-chair')), 'part=zigzag-chair')
  assert.equal(String(changedParams(schema, { T: 19, TAILS: 4 }, 'zigzag-chair')), 'part=zigzag-chair&TAILS=4')
  assert.equal(String(changedParams(schema, { T: 25.5, TAILS: 4 }, 'zigzag-chair')), 'part=zigzag-chair&T=25.5&TAILS=4')
})
