// The camera's framing: the picture's shift left of the panel, and the distance at which the first shape fits beside it.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fitDistance, focalShift, pictureShift } from './App.camera.ts'

const degrees = (radians: number) => (radians * 180) / Math.PI

test('pictureShift: none on a portrait canvas, half the panel on a landscape one', () => {
  assert.equal(pictureShift(145, 400, 800), 0)
  assert.equal(pictureShift(145, 1000, 900), 145)
  // A square canvas is not a portrait one.
  assert.equal(pictureShift(145, 900, 900), 145)
})

test('focalShift: proportional to the distance, so that a dolly does not move the shape on screen', () => {
  const near = focalShift(145, 100, 15, 900)
  assert.ok(Math.abs(focalShift(145, 300, 15, 900) - 3 * near) < 1e-9)
  assert.equal(focalShift(0, 100, 15, 900), 0)
})

test('focalShift: at fov 90, half the height is the distance', () => {
  // The view is `2 * distance` world units tall: half of its pixels slide the picture by `distance`.
  assert.ok(Math.abs(focalShift(450, 100, 90, 900) - 100) < 1e-9)
})

test('fitDistance: the vertical fov only when the free width is at least the height', () => {
  const vertical = 10 / Math.sin((15 * Math.PI) / 180 / 2)
  assert.ok(Math.abs(fitDistance(10, 15, 1600, 900, 145) - vertical) < 1e-9)
  // Free width equal to the height: the same.
  assert.ok(Math.abs(fitDistance(10, 15, 1190, 900, 145) - vertical) < 1e-9)
})

test('fitDistance: farther when the free width is narrower than the height, and the sphere fits in it', () => {
  const [radius, fov, width, height, pixels] = [10, 15, 1000, 900, 145]
  const distance = fitDistance(radius, fov, width, height, pixels)
  assert.ok(distance > radius / Math.sin((fov * Math.PI) / 180 / 2))
  // On screen, the sphere's silhouette (its half-angle `asin(radius / distance)`) spans exactly the free width.
  const pixelsPerTan = height / 2 / Math.tan((fov * Math.PI) / 180 / 2)
  const halfWidth = pixelsPerTan * Math.tan(Math.asin(radius / distance))
  assert.ok(Math.abs(halfWidth - (width - 2 * pixels) / 2) < 1e-6)
  // And within the height.
  assert.ok(degrees(Math.asin(radius / distance)) < fov / 2)
})
