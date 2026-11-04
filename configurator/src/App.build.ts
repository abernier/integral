/**
 * The configurator's build cache: a part built once per set of values, the last few kept for `use()`, the rest freed.
 * Pure of React, so that it is testable under node.
 * @module
 */
import { Mesh, type Object3D } from 'three'
import type { Model } from './models.ts'

/** A build's outcome. A build that throws keeps the last good shape on screen, with its error. */
export type Built = { shape?: Object3D; error?: string }

/**
 * A builder that keeps the last few builds, by their values, for `use()`: the build on screen and the one rendering in
 * its place may differ, and the same key gives the same promise. Least recently used first out: the component asks
 * for the shown key on every render, so the build on screen is always the latest hit and never the one pushed out. A
 * build pushed out is disposed, since `<primitive>` frees nothing it did not create; three uploads it again should it
 * still be drawn. All state lives in the builder, none in the module.
 * @param kept How many builds to keep.
 * @example
 * const build = createBuilds(3)
 * const { shape, error } = use(build(model, JSON.stringify(values)))
 */
export function createBuilds(kept: number) {
  const builds = new Map<string, Promise<Built>>()
  // The shape a failed build borrows. Kept while it is, even once its own build is pushed out (`orphan`): freed only
  // when a newer good shape takes its place.
  let lastGood: Object3D | undefined
  let orphan = false

  function setLastGood(shape: Object3D) {
    if (orphan && lastGood) dispose(lastGood)
    lastGood = shape
    orphan = false
  }

  return function build(model: Pick<Model, 'build'>, key: string) {
    const hit = builds.get(key)
    if (hit) {
      // Delete then set: the hit becomes the newest.
      builds.delete(key)
      builds.set(key, hit)
      return hit
    }
    // `Promise.resolve().then`: a `build` that throws at once rejects like one that rejects later.
    const built: Promise<Built> = Promise.resolve()
      .then(() => model.build(JSON.parse(key)))
      .then(
        (shape) => {
          // A build pushed out before it resolved is freed by its eviction: it must not become the last good shape.
          if (builds.get(key) === built) setLastGood(shape)
          return { shape }
        },
        (e) => ({ shape: lastGood, error: e instanceof Error ? e.message : String(e) }),
      )
    builds.set(key, built)
    for (const [oldKey, old] of builds) {
      if (builds.size <= kept) break
      builds.delete(oldKey)
      old.then(({ shape, error }) => {
        // A failed build only borrows the last good shape: nothing of its own to free.
        if (!shape || error) return
        if (shape === lastGood) orphan = true
        else dispose(shape)
      })
    }
    return built
  }
}

/** Frees a shape's geometries and materials. */
function dispose(shape: Object3D) {
  const disposed = new Set<{ dispose(): void }>()
  shape.traverse((object) => {
    if (!(object instanceof Mesh)) return
    disposed.add(object.geometry)
    for (const material of [object.material].flat()) disposed.add(material)
  })
  disposed.forEach((resource) => resource.dispose())
}
