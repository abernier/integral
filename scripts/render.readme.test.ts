// The README's image lines for a model's renders: found by their src, so that an alt edited by hand still counts.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { VIEWS, readmeLines } from './render.readme.ts'

const first = '![Title, three-quarter front](https://abernier.github.io/integral/m/renders/m.three-quarter.webp)'

test('readmeLines: a README with only its title lacks every view, named after the title', () => {
  const { images, missing } = readmeLines('# Title\n', 'm')
  assert.equal(images.length, Object.keys(VIEWS).length)
  assert.equal(images[0], first)
  assert.deepEqual(missing, images)
})

test('readmeLines: a README holding the four lines lacks none', () => {
  const { images } = readmeLines('# Title\n', 'm')
  const readme = `# Title\n\n${images.join('\n')}\n\n<Intro />\n`
  assert.deepEqual(readmeLines(readme, 'm'), { images, missing: [] })
})

test('readmeLines: an image whose alt was edited still counts as present', () => {
  const { images } = readmeLines('# Title\n', 'm')
  const edited = images.map((image) => image.replace(/^!\[[^\]]*\]/, '![Something else]'))
  assert.notDeepEqual(edited, images)
  assert.deepEqual(readmeLines(`# Title\n\n${edited.join('\n')}\n`, 'm').missing, [])
})

test('readmeLines: without a title, the alt names the model', () => {
  const { images } = readmeLines('no heading here\n', 'm')
  assert.equal(images[1], '![m, front](https://abernier.github.io/integral/m/renders/m.front.webp)')
})
