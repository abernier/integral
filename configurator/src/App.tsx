// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { type ComponentRef, type ReactNode, Suspense, use, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { button, folder, Leva, useControls } from 'leva'
import { Mtb, useMtb } from 'material-theme-builder/react'
import { MathUtils, Mesh, type Object3D, Sphere, Spherical, Vector3 } from 'three'
import { useDebounceValue, useResizeObserver } from 'usehooks-ts'
import { type Control, type Model, models } from './models.ts'
import { changedParams, withQueryValues } from './App.query.ts'
import { levaTheme, type Role, useDocsTheme } from './App.theme.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

/** The camera's vertical field of view, in degrees: narrow, close to a drawing's parallel projection. */
const FOV = 15

/**
 * How long camera-controls takes to settle, in seconds, whether the user drives it or not: one pace, so that the focal
 * offset and the dolly, damped side by side, keep in step. camera-controls' own `draggingSmoothTime`.
 */
const SMOOTH_TIME = 0.125

const { ACTION } = CameraControlsImpl

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
  // The leva panel's box, at the right edge, its margin included: measured, since leva shows the panel only once its
  // inputs are registered. The canvas shifts its picture by half of it. (`null!`: usehooks-ts types the ref as never null.)
  const panel = useRef<HTMLDivElement>(null!)
  const { width: panelWidth = 0 } = useResizeObserver({ ref: panel, box: 'border-box' })
  // Collapsed, the panel covers next to nothing: no shift.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // hasOwn: a plain lookup would also find inherited members such as `constructor`.
    if (!Object.hasOwn(models, part)) return setError(`Unknown part: ${JSON.stringify(part)}`)
    models[part]().then(setModel, (e) => setError(String(e)))
  }, [])

  return (
    <>
      {/* zIndex: the canvas, fixed too and later in the DOM, would cover the panel. */}
      <div ref={panel} style={{ position: 'fixed', top: 10, right: 0, zIndex: 1, width: 290, paddingRight: 10, boxSizing: 'border-box' }}>
        <Leva fill collapsed={{ collapsed, onChange: setCollapsed }} titleBar={{ title: part, drag: false }} theme={levaTheme(color)} />
      </div>
      {model && <Configurator model={model} shift={collapsed ? 0 : panelWidth / 2} />}
      <Messages>
        {error && !model && <Message>{error}</Message>}
        {!error && !model && <Message color="var(--md-sys-color-on-surface-variant)">Loading…</Message>}
      </Messages>
    </>
  )
}

/** The messages, stacked at the bottom left. */
function Messages({ children }: { children: ReactNode }) {
  return <div style={{ position: 'fixed', left: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
}

function Message({ children, color = 'var(--md-sys-color-error)' }: { children: string; color?: string }) {
  const background = 'var(--md-sys-color-surface-container-high)'
  return <div style={{ padding: '8px 12px', background, borderRadius: 6, color }}>{children}</div>
}

/** A build's outcome. A build that throws keeps the last good shape on screen, with its error. */
type Built = { shape?: Object3D; error?: string }

/**
 * The last few builds, by their values, for `use()`: the build on screen and the one rendering in its place may
 * differ. A build pushed out is disposed, `<primitive>` frees nothing it did not create; three uploads it again
 * should it still be drawn.
 */
const KEPT = 3
const builds = new Map<string, Promise<Built>>()
let lastGood: Object3D | undefined

function build(model: Model, key: string) {
  const kept = builds.get(key)
  if (kept) return kept
  // `Promise.resolve().then`: a `build` that throws at once rejects like one that rejects later.
  const built: Promise<Built> = Promise.resolve()
    .then(() => model.build(JSON.parse(key)))
    .then(
      (shape) => ({ shape: (lastGood = shape) }),
      (e) => ({ shape: lastGood, error: e instanceof Error ? e.message : String(e) }),
    )
  builds.set(key, built)
  for (const [oldKey, old] of builds) {
    if (builds.size <= KEPT) break
    builds.delete(oldKey)
    // A failed build only borrows the last good shape: nothing of its own to free.
    old.then(({ shape, error }) => shape && !error && dispose(shape))
  }
  return built
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

function Configurator({ model, shift }: { model: Model; shift: number }) {
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

  // Built once the sliders have stayed still; the last build stays on screen until the next one is done.
  const [key] = useDebounceValue(JSON.stringify(numbers), DEBOUNCE_MS)
  const shown = useDeferredValue(key)
  const built = build(model, shown)

  return (
    <>
      <Canvas camera={{ position: [600, 500, 700], fov: FOV, near: 1, far: 100000 }} style={{ position: 'fixed', inset: 0, background: 'var(--md-sys-color-surface)' }}>
        {/* Nothing until the first shape: the scene mounts already fitted to it, so that nothing is drawn, then moved. */}
        <Suspense fallback={null}>
          <Scene built={built} color={color} shift={shift} />
        </Suspense>
      </Canvas>
      <Messages>
        {/* The first build also loads the kernel (about 3 MB of WebAssembly): a few seconds with nothing to see. */}
        <Suspense fallback={<Message color="var(--md-sys-color-on-surface-variant)">Building the model…</Message>}>
          <BuildError built={built} />
        </Suspense>
        {toast && <Message color="var(--md-sys-color-on-surface)">{toast}</Message>}
      </Messages>
    </>
  )
}

/**
 * The scene, once the build is done: the shape, lit, on a grid, fitted at first, the orbit around that fit; its
 * picture shifted left by `shift` pixels.
 */
function Scene({ built, color, shift }: { built: Promise<Built>; color: (role: Role) => string; shift: number }) {
  const { shape } = use(built)
  const controls = useRef<ComponentRef<typeof CameraControls>>(null)
  // Frames the first shape, before it is drawn: the orbit around its center, pulled back to its bounding sphere with some
  // margin, the camera's direction kept. Later shapes keep the camera where the user left it: the deps are left out on purpose.
  useLayoutEffect(() => {
    if (!shape) return
    const sphere = CameraControlsImpl.createBoundingSphere(shape, new Sphere())
    sphere.radius *= 1.1
    controls.current?.fitToSphere(sphere, false)
  }, [])
  // The leva panel covers the right of the canvas: the orbit's center sits in the middle of the pixels left of it,
  // through camera-controls' focal offset, so that a change (the panel collapsed, a phone turned) is smoothed. The offset
  // is in world units at the orbit's center, so it is proportional to the distance: taken from the distance the
  // controls head for, and damped at the same pace as a dolly (`SMOOTH_TIME` for both), it stays proportional all the
  // way, frame by frame, and a dolly does not move the shape. Only our part of it is applied, as a delta: the pan, which
  // shares the focal offset, keeps its own. On a portrait canvas (a phone), no shift: the panel overlaps the picture
  // instead. Priority -2: before drei's own update of the controls (-1), so that the first frame is shifted already.
  const applied = useRef<number>(undefined)
  useFrame(({ size }) => {
    const current = controls.current
    if (!current) return
    const pixels = size.width < size.height ? 0 : shift
    const distance = current.getSpherical(new Spherical(), true).radius
    // The view is `2 * distance * tan(fov / 2)` world units tall at the orbit's center.
    const wanted = (pixels * 2 * distance * Math.tan(MathUtils.degToRad(FOV) / 2)) / size.height
    if (wanted === applied.current) return
    const offset = current.getFocalOffset(new Vector3(), true)
    offset.x += wanted - (applied.current ?? 0)
    // The first one at once: the first frame is drawn in place.
    current.setFocalOffset(offset.x, offset.y, offset.z, applied.current !== undefined)
    applied.current = wanted
  }, -2)
  if (!shape) return null
  return (
    <>
      <hemisphereLight args={['#ffffff', '#8d96a3', 2.2]} />
      <directionalLight position={[300, 600, 400]} intensity={2.4} />
      <gridHelper args={[2000, 40, color('outline'), color('outlineVariant')]} />
      <primitive object={shape} />
      {/* A pan slides the picture (the focal offset), not the orbit's center: that stays on the shape. */}
      <CameraControls
        ref={controls}
        makeDefault
        smoothTime={SMOOTH_TIME}
        draggingSmoothTime={SMOOTH_TIME}
        mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.OFFSET, wheel: ACTION.DOLLY }}
        touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY_OFFSET, three: ACTION.TOUCH_OFFSET }}
      />
    </>
  )
}

/** The build's error, once it is done; nothing when it went well. */
function BuildError({ built }: { built: Promise<Built> }) {
  const { error } = use(built)
  return error ? <Message>{error}</Message> : null
}
