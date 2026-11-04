// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { button, folder, Leva, useControls } from 'leva'
import { Mtb, useMtb } from 'material-theme-builder/react'
import { Box3, Mesh, type Object3D, OrthographicCamera, Vector3 } from 'three'
import { type Control, type Model, models } from './models.ts'
import { changedParams, withQueryValues } from './App.query.ts'
import { levaTheme, type Role, useDocsTheme } from './App.theme.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

const query = new URLSearchParams(location.search)
const part = query.get('part') ?? ''

/** Copies text to the clipboard; the textarea route is for iframes and non-secure contexts. Never throws. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      return copied
    } catch {
      return false
    }
  }
}

/** The schema as leva takes it, `main` left out: the main masters at the top level, every other one in a collapsed Details folder. */
function panelSchema(schema: Model['schema']) {
  const main: Record<string, Omit<Control, 'main'>> = {}
  const details: Record<string, Omit<Control, 'main'>> = {}
  for (const [name, { main: isMain, ...control }] of Object.entries(schema)) {
    if (isMain) main[name] = control
    else details[name] = control
  }
  // A model that marks no master main keeps one flat list: no empty top level, no folder holding everything.
  if (Object.keys(main).length === 0) return details
  return { ...main, Details: folder(details, { collapsed: true }) }
}

/** The configurator page, in the docs' theme: the part named by `?part=`, rebuilt as its sliders move. */
export function App() {
  const { dark, mtb } = useDocsTheme()
  // `<Mtb>` keys its dark values on a `dark` class, as next-themes sets it on the docs' `<html>`.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <Mtb {...mtb}>
      <Page />
    </Mtb>
  )
}

/** A role's hex in the current mode, for what CSS variables cannot reach: three.js colors, leva's theme. */
function useRoleColor() {
  const { dark } = useDocsTheme()
  const { getMtbColor } = useMtb()
  return (role: Role) => getMtbColor(role, dark ? 'dark' : 'light')
}

function Page() {
  const color = useRoleColor()
  const [model, setModel] = useState<Model>()
  const [error, setError] = useState<string>()
  // Holds the leva panel (a fixed box, the wrapper has no size of its own): the canvas measures it.
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // hasOwn: a plain lookup would also find inherited members such as `constructor`.
    if (!Object.hasOwn(models, part)) return setError(`Unknown part: ${JSON.stringify(part)}`)
    models[part]().then(setModel, (e) => setError(String(e)))
  }, [])

  return (
    <>
      <div ref={panel} style={{ display: 'contents' }}>
        <Leva titleBar={{ title: part }} theme={levaTheme(color)} />
      </div>
      {model && <Configurator model={model} panel={panel} />}
      {error && !model && <Message>{error}</Message>}
      {!error && !model && <Message color="var(--md-sys-color-on-surface-variant)">Loading…</Message>}
    </>
  )
}

function Message({ children, color = 'var(--md-sys-color-error)', bottom = 16 }: { children: string; color?: string; bottom?: number }) {
  const background = 'var(--md-sys-color-surface-container-high)'
  return <div style={{ position: 'fixed', left: 16, bottom, padding: '8px 12px', background, borderRadius: 6, color }}>{children}</div>
}

/**
 * The leva panel covers the right of the canvas: the camera frames the pixels left of it, so that the model sits
 * centered there, orbits there, and `Bounds` fits it there. The frame's width is the camera's, and the canvas
 * renders it from the left edge (three's `setViewOffset`, in pixels) at the same scale on both axes: zooming and
 * rotating keep the model in place, and nothing stretches. On a page so narrow that the panel covers over half of
 * it, the frame is the whole canvas. The camera is `manual`: its frame is set here, not by R3F on resize. A layout
 * effect, so that the frame is set before anything is fitted into it or drawn.
 */
function ViewOffset({ panel }: { panel: RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    const box = panel.current?.firstElementChild
    const left = box ? box.getBoundingClientRect().left : size.width
    const free = left < size.width / 2 ? size.width : left
    camera.left = -free / 2
    camera.right = free / 2
    camera.top = size.height / 2
    camera.bottom = -size.height / 2
    camera.setViewOffset(free, size.height, 0, 0, size.width, size.height)
    return () => camera.clearViewOffset()
  }, [camera, size, panel])
  return null
}

/**
 * Frames the first shape, at once: the camera keeps its direction, looks at the shape's center from there, and zooms
 * so that the shape fills the frame with a margin; `onFit` gets the center, for the orbit to turn around. Synchronous,
 * in a layout effect, so that no frame shows the shape before it is framed (drei's Bounds fits over an animation,
 * one unfitted frame even at duration 0). Later shapes keep the camera where the user left it.
 */
function FitOnce({ object, onFit, margin = 1.2 }: { object: Object3D; onFit: (center: Vector3) => void; margin?: number }) {
  const { camera, invalidate } = useThree()
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    object.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(object)
    const center = box.getCenter(new Vector3())
    const extent = box.getSize(new Vector3())
    const direction = camera.position.clone().sub(center).normalize()
    // Far enough from the center that the whole shape lies between near and far, whichever way it is turned.
    camera.position.copy(center).addScaledVector(direction, 4 * Math.max(extent.x, extent.y, extent.z))
    camera.lookAt(center)
    camera.updateMatrixWorld()
    // The shape's extent as the camera sees it: the furthest corner of its box, in camera space.
    let halfWidth = 0
    let halfHeight = 0
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const corner = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
          halfWidth = Math.max(halfWidth, Math.abs(corner.x))
          halfHeight = Math.max(halfHeight, Math.abs(corner.y))
        }
    const zoomForWidth = (camera.right - camera.left) / (2 * halfWidth)
    const zoomForHeight = (camera.top - camera.bottom) / (2 * halfHeight)
    camera.zoom = Math.min(zoomForWidth, zoomForHeight) / margin
    camera.updateProjectionMatrix()
    onFit(center)
    invalidate()
    // Once, for the first shape: the deps are left out on purpose.
  }, [])
  return null
}

function Configurator({ model, panel }: { model: Model; panel: RefObject<HTMLDivElement | null> }) {
  const color = useRoleColor()
  const [toast, setToast] = useState<string>()
  // leva's `get`, `set` and `values` address an input by its own key, in a folder too (`W`, not `Details.W`).
  const [values, set, get] = useControls(() => ({
    'Copy link': button(async () => {
      const current = get as unknown as (name: string) => number
      const values = Object.fromEntries(Object.keys(model.schema).map((name) => [name, current(name)]))
      const params = changedParams(model.schema, values, part)
      const copied = await copyText(`${location.origin}${location.pathname}?${params}`)
      setToast(copied ? 'Link copied' : 'Could not copy the link')
    }),
    Reset: button(() => set(Object.fromEntries(Object.entries(model.schema).map(([name, control]) => [name, control.value])))),
    // leva shows each control's `hint` on hover.
    ...panelSchema(withQueryValues(model.schema, query)),
  }))
  const numbers = values as unknown as Record<string, number>
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 1500)
    return () => clearTimeout(timer)
  }, [toast])
  const [shape, setShape] = useState<Object3D>()
  const [error, setError] = useState<string>()
  // Where the orbit turns: the first shape's center, as a prop so that it holds whenever the controls mount.
  const [target, setTarget] = useState<Vector3>()

  // Build once the values have stopped changing; a build that throws leaves the last good shape on screen.
  const key = JSON.stringify(numbers)
  useEffect(() => {
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const built = await model.build(JSON.parse(key))
        if (stale) return
        setShape(built)
        setError(undefined)
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : String(e))
      }
    }, DEBOUNCE_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [model, key])

  // <primitive> does not dispose objects it did not create: free the replaced (or unmounted) shape ourselves.
  useEffect(() => {
    if (!shape) return
    return () => {
      const disposed = new Set<{ dispose(): void }>()
      shape.traverse((object) => {
        if (!(object instanceof Mesh)) return
        disposed.add(object.geometry)
        for (const material of [object.material].flat()) disposed.add(material)
      })
      disposed.forEach((resource) => resource.dispose())
    }
  }, [shape])

  return (
    <>
      <Canvas orthographic camera={{ position: [600, 500, 700], zoom: 1, near: 1, far: 20000, manual: true }} style={{ position: 'fixed', inset: 0, background: 'var(--md-sys-color-surface)' }}>
        <hemisphereLight args={['#ffffff', '#8d96a3', 2.2]} />
        <directionalLight position={[300, 600, 400]} intensity={2.4} />
        <gridHelper args={[2000, 40, color('outline'), color('outlineVariant')]} />
        <ViewOffset panel={panel} />
        {shape && <FitOnce object={shape} onFit={setTarget} />}
        {shape && <primitive object={shape} />}
        <OrbitControls makeDefault target={target} />
      </Canvas>
      {/* The first build also loads the kernel (about 3 MB of WebAssembly): a few seconds with nothing to see. */}
      {!shape && !error && <Message color="var(--md-sys-color-on-surface-variant)">Building the model…</Message>}
      {error && <Message>{error}</Message>}
      {toast && <Message color="var(--md-sys-color-on-surface)" bottom={error ? 64 : 16}>{toast}</Message>}
    </>
  )
}
