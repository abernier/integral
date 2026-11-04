// The docs' stored picks in, the configurator's theme out: light or dark, and the seed of its palette.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isDark, levaTheme, mtbConfig, type Picks, SEED } from './App.theme.ts'

const nothingStored: Picks = { theme: null, primaryColor: null, contrast: null, scheme: null, colorMatch: null, prefersDark: false }

test('isDark: a stored light or dark wins over the system', () => {
  assert.equal(isDark({ theme: 'dark', prefersDark: false }), true)
  assert.equal(isDark({ theme: 'light', prefersDark: true }), false)
})

test('isDark: system, nothing stored or an unknown value follow the system', () => {
  for (const theme of ['system', null, 'sepia']) {
    assert.equal(isDark({ theme, prefersDark: true }), true)
    assert.equal(isDark({ theme, prefersDark: false }), false)
  }
})

test('mtbConfig: nothing stored is the pmndrs seed', () => {
  assert.deepEqual(mtbConfig(nothingStored), SEED)
})

test('mtbConfig: each pick the docs accept reseeds the palette', () => {
  const config = mtbConfig({ ...nothingStored, primaryColor: '#1f6feb', contrast: '0.5', scheme: 'vibrant', colorMatch: 'false' })
  assert.deepEqual(config, { ...SEED, source: '#1f6feb', contrast: 0.5, scheme: 'vibrant', colorMatch: false })
})

test('mtbConfig: a pick the docs would not accept is the default', () => {
  const config = mtbConfig({ ...nothingStored, primaryColor: 'red', contrast: '0.3', scheme: 'rainbow', colorMatch: 'yes' })
  assert.deepEqual(config, SEED)
})

test('levaTheme: every color token is a role of the theme', () => {
  const colors = levaTheme((role) => `<${role}>`).colors ?? {}
  assert.equal(colors.elevation2, '<surfaceContainer>')
  assert.equal(colors.accent2, '<primaryContainer>')
  assert.equal(colors.highlight3, '<onSurface>')
  for (const value of Object.values(colors)) assert.match(String(value), /^<\w+>$/)
})
