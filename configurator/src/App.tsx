// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { Component, type ComponentRef, type ReactNode, Suspense, use, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, ContactShadows, Environment, Stage } from '@react-three/drei'
import { button, folder, Leva, useControls } from 'leva'
import { Mtb, useMtb } from 'material-theme-builder/react'
import { Box3, Sphere, Spherical, Vector3 } from 'three'
import { useDebounceValue } from 'usehooks-ts'
import { type Control, type Model, models } from './models.ts'
import { useQuery, queryUrl, type Values } from './App.url.ts'
import { levaTheme, type Role, useDocsTheme } from './App.theme.ts'
import { type Built, createBuilds } from './App.build.ts'
import { fitDistance, focalShift, pictureShift } from './App.camera.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

/** The camera's vertical field of view, in degrees: narrow, close to a drawing's parallel projection. */
const FOV = 15

/**
 * How long camera-controls takes to settle, in seconds, whether the user drives it or not: one pace, so that the focal
 * offset and the dolly, damped side by side, keep in step. camera-controls' own `draggingSmoothTime`.
 */
const SMOOTH_TIME = 0.125

/** The leva panel's width, in pixels: leva's own default, passed to leva as its theme's `sizes.rootWidth`. */
const LEVA_ROOT_WIDTH = 280

/** Leva's fixed root offset from the right edge of the window, in pixels: leva's own, not configurable. */
const LEVA_ROOT_OFFSET = 10

/** The width the leva panel takes at the right edge of the window, its offset from that edge included. */
const PANEL_WIDTH = LEVA_ROOT_WIDTH + LEVA_ROOT_OFFSET

/**
 * The environment that lights the shape: drei's `apartment` preset (Poly Haven's "Lebombo", CC0, at 1k), the same file,
 * served from the configurator's own `public/` folder rather than drei's CDN. Through Vite's base URL, so that it
 * resolves beside the page wherever that is served (dev, the built site, the docs' iframe under `/integral/`).
 */
const ENVIRONMENT_URL = `${import.meta.env.BASE_URL}lebombo_1k.hdr`

const { ACTION } = CameraControlsImpl

/** The last few builds, by their values: the build on screen and the one rendering in its place may differ. */
const build = createBuilds(3)

/** Scratch objects for the frame loop: nothing allocated per frame. */
const spherical = new Spherical()
const focalOffset = new Vector3()
const box = new Box3()
const boxSize = new Vector3()
const boxCenter = new Vector3()

/** The shape's footprint, in world space, as the contact shadow needs it. */
type Bounds = { floor: number; x: number; z: number; height: number; radius: number }

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
function panelSchema<C extends Control>(schema: Record<string, C>) {
  const main: Record<string, Omit<C, 'main'>> = {}
  const details: Record<string, Omit<C, 'main'>> = {}
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
  const { part } = useQuery()
  const [model, setModel] = useState<Model>()
  const [error, setError] = useState<string>()
  // Leva's panel sits at the right edge, PANEL_WIDTH wide: the canvas shifts its picture by half of it. Collapsed, the panel covers next to nothing: no shift.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // hasOwn: a plain lookup would also find inherited members such as `constructor`.
    if (!Object.hasOwn(models, part)) return setError(`Unknown part: ${JSON.stringify(part)}`)
    models[part]().then(setModel, (e) => setError(String(e)))
  }, [])

  return (
    <>
      {/* Not `fill`: leva then places the panel itself (fixed, 10px from the top right, above the canvas). No drag:
          leva would move the panel by a CSS transform, away from the space the shift leaves free. The `leva-panel` box
          (`display: contents`) is only a hook for index.html's rules, which cap the panel to the viewport. */}
      <div className="leva-panel">
        <Leva
          collapsed={{ collapsed, onChange: setCollapsed }}
          titleBar={{ title: part, drag: false }}
          theme={{ ...levaTheme(color), sizes: { rootWidth: `${LEVA_ROOT_WIDTH}px` } }}
        />
      </div>
      {model && <Configurator model={model} shift={collapsed ? 0 : PANEL_WIDTH / 2} />}
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

/**
 * The schema with the URL's values as the sliders' initial values, each slider writing its changes back to the URL
 * (App.url.ts): the URL holds the state, leva shows it.
 */
function boundToUrl(schema: Model['schema'], values: Values, setValues: (values: Values) => unknown) {
  return Object.fromEntries(
    Object.entries(schema).map(([name, control]) => {
      // leva calls it at once with the initial value, then on each change: only a change is written.
      const onChange = (value: number, _path: string, { initial }: { initial: boolean }) => {
        if (!initial) setValues({ [name]: value })
      }
      return [name, { ...control, value: values[name], onChange }]
    }),
  )
}

function Configurator({ model, shift }: { model: Model; shift: number }) {
  const [toast, setToast] = useState<string>()
  // The state: the part and the sliders' values, in the URL.
  const { part, values: numbers, setValues } = useQuery(model.schema)
  // leva's `get` and `set` address an input by its own key, in a folder too (`W`, not `Details.W`).
  const [, set, get] = useControls(() => ({
    'Copy link': button(async () => {
      const current = get as unknown as (name: string) => number
      const values = Object.fromEntries(Object.keys(model.schema).map((name) => [name, current(name)]))
      // The address bar's own URL, as it is about to be once the sliders stay still.
      const copied = await copyText(queryUrl(model.schema, { part, values }, location.href))
      setToast(copied ? 'Link copied' : 'Could not copy the link')
    }),
    Reset: button(() => set(Object.fromEntries(Object.entries(model.schema).map(([name, control]) => [name, control.value])))),
    // leva shows each control's `hint` on hover.
    ...panelSchema(boundToUrl(model.schema, numbers, setValues)),
  }))
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
        {/* The R3F root renders outside any transition: the scene does not blank on each rebuild only because BuildError,
            under the deferred value, holds the main commit until the same promise settles, so that Scene's `use()` finds it
            fulfilled. Keep them on the same promise. */}
        <Suspense fallback={null}>
          <Scene built={built} shift={shift} />
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
 * The scene, once the build is done: the shape on drei's `<Stage>` (centered at the origin, lit by an environment, a
 * contact shadow under it), on a grid, fitted at first, the orbit around that fit; its picture shifted left by `shift`
 * pixels.
 */
function Scene({ built, shift }: { built: Promise<Built>; shift: number }) {
  // R3F bridges the Mtb context into the Canvas.
  const color = useRoleColor()
  const { shape } = use(built)
  const size = useThree((state) => state.size)
  const controls = useRef<ComponentRef<typeof CameraControls>>(null)
  // The current shape's bounds, where Stage's `<Center>` has put it: the floor, the grid and the contact shadow under it.
  const [bounds, setBounds] = useState<Bounds>()
  // Our part of the focal offset, as last applied: see the frame loop below.
  const applied = useRef<number>(undefined)
  // Frames the first shape, before it is drawn, into the space the panel leaves free: the orbit around the center of its
  // bounding sphere, pulled back to fit that sphere, with some margin, the camera's direction kept. The first shape, not
  // the mount: a first build that fails and a later good one still gets framed. Later shapes keep the camera where the
  // user left it.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (!shape) return
    // Stage's `<Center>` has just moved the shape, in its own layout effect: its world matrices are not updated yet.
    shape.updateWorldMatrix(true, true)
    // Every shape, not only the first: a part grown with a slider keeps its whole shadow.
    box.setFromObject(shape, true)
    box.getSize(boxSize)
    box.getCenter(boxCenter)
    const radius = boxSize.length() / 2
    setBounds({ floor: box.min.y, x: boxCenter.x, z: boxCenter.z, height: boxSize.y, radius })
    const current = controls.current
    if (!current || fitted.current) return
    fitted.current = true
    const sphere = CameraControlsImpl.createBoundingSphere(shape, new Sphere())
    sphere.radius *= 1.1
    const pixels = pictureShift(shift, size.width, size.height)
    current.moveTo(sphere.center.x, sphere.center.y, sphere.center.z, false)
    current.dollyTo(fitDistance(sphere.radius, FOV, size.width, size.height, pixels), false)
    // As camera-controls' fitToSphere: no focal offset left over; the frame loop applies our shift from zero.
    current.setFocalOffset(0, 0, 0, false)
    applied.current = undefined
  }, [shape])
  // The leva panel covers the right of the canvas: the orbit's center sits in the middle of the pixels left of it,
  // through camera-controls' focal offset, so that a change (the panel collapsed, a phone turned) is smoothed. Taken from
  // the distance the controls head for, and damped at the same pace as a dolly (`SMOOTH_TIME` for both), it stays
  // proportional to the distance all the way, and a dolly does not move the shape. Only our part of it is applied, as a
  // delta: the pan, which shares the focal offset, keeps its own. Priority -2: before drei's own update of the controls
  // (-1), so that the first frame is shifted already.
  useFrame(({ size }) => {
    const current = controls.current
    if (!current) return
    const pixels = pictureShift(shift, size.width, size.height)
    const distance = current.getSpherical(spherical, true).radius
    const wanted = focalShift(pixels, distance, FOV, size.height)
    if (wanted === applied.current) return
    const offset = current.getFocalOffset(focalOffset, true)
    offset.x += wanted - (applied.current ?? 0)
    // The first one at once: the first frame is drawn in place.
    current.setFocalOffset(offset.x, offset.y, offset.z, applied.current !== undefined)
    applied.current = wanted
  }, -2)
  if (!shape) return null
  return (
    <>
      {/* The framing above is ours (beside the panel, an orbit that stays on the shape): Stage does not touch the camera.
          Its spot and fill lights decay over the part's millimetres to nearly nothing: the environment lights it. Stage
          centers the first shape only (Center's `cacheKey`): later ones keep its offset, so the floor stays put.
          `apartment`: a soft light from all around, that keeps the woods' colors where `city` and `studio` wash out the
          faces turned up. The environment is loaded beside Stage, in its own boundary, the plain lights standing in while
          it loads or if it cannot. The contact shadow is ours, not Stage's: Stage sizes its own from the first shape only. */}
      <Stage adjustCamera={false} environment={null} shadows={false}>
        <primitive object={shape} />
      </Stage>
      <Lighting />
      {bounds && (
        <>
          {/* Contact shadows: no shadow maps to set up. Sized from the current shape, as Stage would (four times its bounding
              radius, wide enough for the blur), its camera reaching the shape's top. Drawn once per shape (`frames`,
              remounted by the key): the part does not move between builds, so the shadow is not redrawn every frame. */}
          <ContactShadows
            key={shape.uuid}
            frames={1}
            position={[bounds.x, bounds.floor, bounds.z]}
            scale={bounds.radius * 4}
            far={bounds.height}
            blur={2}
          />
          {/* A millimetre under the floor: out of reach of the contact shadow's camera, which would darken the plane with its lines. */}
          <gridHelper args={[2000, 40, color('outline'), color('outlineVariant')]} position-y={bounds.floor - 1} />
        </>
      )}
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

/**
 * The environment that lights the shape (`ENVIRONMENT_URL`). Until it is loaded, and for good if it cannot be fetched,
 * plain lights stand in, so that the shape is never left unlit and a failed fetch does not unmount the page.
 */
function Lighting() {
  const fallback = (
    <>
      <hemisphereLight args={['#ffffff', '#8d96a3', 2.2]} />
      <directionalLight position={[300, 600, 400]} intensity={2.4} />
    </>
  )
  return (
    <LoadError fallback={fallback}>
      <Suspense fallback={fallback}>
        <Environment files={ENVIRONMENT_URL} />
      </Suspense>
    </LoadError>
  )
}

/** Renders `fallback` instead of its children once they have thrown. */
class LoadError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The build's error, once it is done; nothing when it went well. */
function BuildError({ built }: { built: Promise<Built> }) {
  const { error } = use(built)
  return error ? <Message>{error}</Message> : null
}
