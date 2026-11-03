// The query string in, the link out: what the sliders start at, and what a shared link carries.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedParams, parseValuesFile, valuesFile, withQueryValues } from './App.query.ts'

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

test('valuesFile: every value, in the schema order, with the part and its schema, pretty-printed', () => {
  const file = { schema, values: { TAILS: 4, T: 19, part: 1 }, part: 'zigzag-chair', schemaUrl: 'https://x/s.json' }
  assert.equal(valuesFile(file), '{\n  "$schema": "https://x/s.json",\n  "model": "zigzag-chair",\n  "values": {\n    "T": 19,\n    "TAILS": 4\n  }\n}\n')
})

test('parseValuesFile: a valid file gives every value, in the schema order', () => {
  const text = JSON.stringify({ $schema: 'https://x/s.json', model: 'zigzag-chair', values: { TAILS: 4, T: 25.5 } })
  assert.deepEqual(parseValuesFile(schema, 'zigzag-chair', text), { values: { T: 25.5, TAILS: 4 } })
  // The range's ends are in it.
  assert.deepEqual(parseValuesFile(schema, 'zigzag-chair', JSON.stringify({ model: 'zigzag-chair', values: { T: 12, TAILS: 8 } })), { values: { T: 12, TAILS: 8 } })
})

test('parseValuesFile: another model, a missing or unknown key, a value out of range or not JSON gives the problems', () => {
  const problems = (file: unknown) => {
    const parsed = parseValuesFile(schema, 'zigzag-chair', typeof file === 'string' ? file : JSON.stringify(file))
    return 'problems' in parsed ? parsed.problems : []
  }
  assert.deepEqual(problems({ model: 'compass-armchair', values: { T: 19, TAILS: 6 } }), ['the values of compass-armchair, not zigzag-chair'])
  assert.deepEqual(problems({ model: 'zigzag-chair', values: { T: 19 } }), ['values.TAILS: missing'])
  assert.deepEqual(problems({ model: 'zigzag-chair', values: { T: 19, TAILS: 6, GRIP: 140 } }), ['values.GRIP: unknown key'])
  assert.deepEqual(problems({ model: 'zigzag-chair', commit: 'abc1234', values: { T: 19, TAILS: 6 } }), ['unknown key "commit"'])
  assert.deepEqual(problems({ model: 'zigzag-chair', values: { T: 31, TAILS: '6' } }), ['values.T: 31 is out of [12, 30]', 'values.TAILS: "6" is not a number'])
  assert.match(problems('{ model')[0], /^not JSON: /)
  assert.deepEqual(problems([1]), ['not a values file: { "model", "values" }'])
})
