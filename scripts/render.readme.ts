// The views `pnpm render` makes of a part, and the README's image lines for them: one line per view, right before the
// part's Intro, which the site makes the renders' strip from (site.ts). Pure: render.ts hands the views to Blender and
// prints the lines a README lacks; render.readme.test.ts checks it.

import { PAGES_URL } from './paths.ts'

/**
 * The views, by name (the renders are named `<model>.<view>.webp`): each its azimuth, degrees around the part from
 * its front (the GLB's -Y), clockwise seen from above (render.blender.py reads them, and gives every view the same
 * elevation), and how it is said in the README's image alt.
 */
export const VIEWS = {
  'three-quarter': { azimuth: 40, said: 'three-quarter front' },
  front: { azimuth: 0, said: 'front' },
  side: { azimuth: 90, said: 'side' },
  back: { azimuth: 140, said: 'three-quarter back' },
}

/**
 * A model's README image lines for its renders: `images`, one markdown image per view, its alt the README's title
 * (its `# ` heading, else the model's name) and how the view is said, its src the render on GitHub Pages; and
 * `missing`, those whose src the README lacks. Only the src is looked for: an alt edited by hand still counts.
 * @param readme The README's text.
 * @param model The model's name (its folder).
 */
export function readmeLines(readme: string, model: string): { images: string[]; missing: string[] } {
  const title = readme.match(/^# (.+)$/m)?.[1] ?? model
  const images: string[] = []
  const missing: string[] = []
  for (const [view, { said }] of Object.entries(VIEWS)) {
    const src = `${PAGES_URL}/${model}/renders/${model}.${view}.webp`
    const image = `![${title}, ${said}](${src})`
    images.push(image)
    if (!readme.includes(src)) missing.push(image)
  }
  return { images, missing }
}
