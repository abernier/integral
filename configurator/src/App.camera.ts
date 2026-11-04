/**
 * The camera's framing beside the leva panel: how far the picture slides left of it, and how far back the first shape
 * is fitted so that it stays clear of it. Pure (Math only, angles in degrees), so that it is testable under node.
 * @module
 */

/**
 * The picture's shift, in pixels: half the panel's width, none on a portrait canvas.
 * @param pixels Half the panel's width.
 * @param width The canvas' width, in pixels.
 * @param height The canvas' height, in pixels.
 */
export function pictureShift(pixels: number, width: number, height: number): number {
  // On a portrait canvas (a phone) the panel overlaps the picture instead.
  return width < height ? 0 : pixels
}

/**
 * The focal offset, in world units at the orbit's center, that slides the picture by `pixels`: the view is
 * `2 * distance * tan(fov / 2)` world units tall there. Proportional to the distance, so that a dolly does not move the
 * shape on screen.
 * @param pixels The picture's shift.
 * @param distance The camera's distance to the orbit's center.
 * @param fov The camera's vertical field of view, in degrees.
 * @param height The canvas' height, in pixels.
 */
export function focalShift(pixels: number, distance: number, fov: number, height: number): number {
  return (pixels * 2 * distance * Math.tan(radians(fov) / 2)) / height
}

/**
 * The distance at which a sphere of `radius` fits both the canvas height and the free width left of the panel
 * (`width - 2 * pixels`). camera-controls' `fitToSphere` uses the vertical fov only on a landscape canvas, so when the
 * free width is narrower than the height the shape runs under the panel: the narrower of the two half-angles wins here.
 * @param radius The sphere's radius.
 * @param fov The camera's vertical field of view, in degrees.
 * @param width The canvas' width, in pixels.
 * @param height The canvas' height, in pixels.
 * @param pixels The picture's shift: half the panel's width, or none.
 */
export function fitDistance(radius: number, fov: number, width: number, height: number, pixels: number): number {
  const vertical = radians(fov) / 2
  // The same screen plane, `height` pixels for `2 * tan(vertical)`: the free width's half-angle.
  const horizontal = Math.atan((Math.tan(vertical) * (width - 2 * pixels)) / height)
  // A sphere seen under a half-angle `a` is `radius / sin(a)` away: the narrower angle, the larger distance.
  return radius / Math.sin(Math.min(vertical, horizontal))
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180
}
