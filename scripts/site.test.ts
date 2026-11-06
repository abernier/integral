// A README's image lines before its Intro become the renders' strip on a part's page; a README without them, or a
// page of no part, keeps its lines as they are. A part's render becomes its tabs, the configurator's only for a part
// the configurator has.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { PAGES_URL, parts } from './paths.ts'
import { page } from './site.ts'

const urls = { site: '', files: '', shared: PAGES_URL }
const part = parts()[0]
const views = ['three-quarter', 'front', 'side', 'back']
const images = views.map((view) => `![${part}, ${view}](${PAGES_URL}/${part}/renders/${part}.${view}.webp)`).join('\n')
const intro = '<Intro>\n\nA part.\n\n</Intro>\n'

/** The page `page` makes of a README with this source, in a folder of its own. */
function pageOf(source: string, forPart?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'integral-site-'))
  try {
    const readme = join(dir, 'README.md')
    writeFileSync(readme, source)
    return page(readme, 1, urls, forPart)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const count = (text: string, marker: string) => text.split(marker).length - 1

test('page: the image lines before the Intro become the strip, the Intro after it', () => {
  const mdx = pageOf(`# Part\n\nA part.\n\n${images}\n\n${intro}`, part)
  assert.equal(count(mdx, '{/* The renders:'), 1)
  assert.equal(count(mdx, '<img src='), 4)
  assert.equal(count(mdx, '!['), 0)
  assert.ok(mdx.indexOf('data-renders') < mdx.indexOf('<Intro>'))
  // The style element sits inside the strip: a direct child of the article is made a block by the theme, and shows.
  assert.ok(mdx.indexOf('data-renders') < mdx.indexOf('<style>'))
})

test('page: a README without the block has no strip', () => {
  const mdx = pageOf(`# Part\n\nA part.\n\n${intro}`, part)
  assert.equal(count(mdx, 'data-renders'), 0)
  assert.ok(mdx.endsWith(`\n${intro}`))
})

test('page: no part, the image lines stay markdown', () => {
  const mdx = pageOf(`# Part\n\nA part.\n\n${images}\n\n${intro}`)
  assert.equal(count(mdx, 'data-renders'), 0)
  assert.equal(count(mdx, '!['), 4)
})

test('page: two blank lines before the Intro still yield the strip', () => {
  const mdx = pageOf(`# Part\n\nA part.\n\n${images}\n\n\n${intro}`, part)
  assert.equal(count(mdx, '{/* The renders:'), 1)
  assert.equal(count(mdx, '<img src='), 4)
  assert.ok(mdx.indexOf('data-renders') < mdx.indexOf('<Intro>'))
})

/** A part's README whose render line `page` turns into the tabs. */
const withRender = (name: string) => `# Part\n\nA part.\n\n${intro}\n![${name}, from behind](${PAGES_URL}/${name}/${name}.png)\n`

test('page: the render of a part the configurator has opens on its configurator', () => {
  const mdx = pageOf(withRender('zigzag-chair'), 'zigzag-chair')
  assert.ok(mdx.includes('<Tabs defaultValue="configurator"'))
  assert.equal(count(mdx, '<TabsTrigger value="configurator">'), 1)
  assert.equal(count(mdx, 'configurator/?part=zigzag-chair'), 1)
})

// The desk is imported from Rhino's STEP: no parameters, no desk.model.ts.
test('page: the render of a part without a configurator opens on its image, with no configurator tab', () => {
  const mdx = pageOf(withRender('desk'), 'desk')
  assert.ok(mdx.includes('<Tabs defaultValue="image"'))
  assert.equal(count(mdx, 'value="configurator"'), 0)
  assert.equal(count(mdx, '/configurator/'), 0)
  assert.equal(count(mdx, '<TabsTrigger value="image">'), 1)
  assert.equal(count(mdx, '<TabsTrigger value="buerligons">'), 1)
})
