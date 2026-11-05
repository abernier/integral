// `?part=<folder>&variant=<id>`: that part's model in that variant, a slider per parameter, and the part itself, rebuilt
// as a slider moves.
import { Component, type ComponentRef, type ReactNode, Suspense, use, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, ContactShadows, Environment, Stage } from '@react-three/drei'
import { button, folder, Leva, useControls } from 'leva'
import { Mtb, useMtb } from 'material-theme-builder/react'
import { Box3, Mesh, type Object3D, Sphere, Spherical, Vector3 } from 'three'
import { useDebounceValue } from 'usehooks-ts'
import { type Control, type Model, models } from './models.ts'
import { usedIn, variantSchema, variantsOf } from './models.variants.ts'
import { camValues, hasCamValues } from './models.cam.ts'
import { useQuery, queryUrl, type Values } from './App.url.ts'
import { type ColorRole, levaTheme, useDocsTheme } from './App.theme.ts'
import { type Built, buildKey, createBuilds } from './App.build.ts'
import { switchedValues } from './App.variant.ts'
import { rolesOf, showRoles } from './App.show.ts'
import type { Role } from './models.roles.ts'
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

/**
 * Where leva puts the panel's entries, by its `order` (lowest first, 0 by default, ties in the order they came): the
 * actions and the Variant select, then the Show folder, then the sliders and their Details folder. Two hooks make them
 * (the Show folder is a third, in the canvas): the order holds whichever registers first.
 */
const ORDER = { actions: -2, show: -1 }

const { ACTION } = CameraControlsImpl

/** The last few builds, by their variant and values: the build on screen and the one rendering in its place may differ. */
const build = createBuilds(3)

/** Scratch objects for the frame loop: nothing allocated per frame. */
const spherical = new Spherical()
const focalOffset = new Vector3()
const box = new Box3()
const boxSize = new Vector3()
const boxCenter = new Vector3()

/**
 * Where the shape stands, in world space: the floor under the whole shape, and the footprint of its shown meshes, as the
 * contact shadow needs it (none when every role is hidden).
 */
type Bounds = { floor: number; shadow?: { x: number; z: number; height: number; radius: number } }

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

/** A slider as leva takes it: the master without what only the configurator reads, a `render` that may hide it. */
type PanelControl<C extends Control> = Omit<C, 'main' | 'variants'> & { render?: (get: (path: string) => string) => boolean }

/**
 * The schema as leva takes it, `main` and `variants` left out: the main masters at the top level, every other one in a
 * collapsed Details folder.
 * @param selected Whether the panel has a Variant select (a part of several variants): a master of no use in the
 * variant it shows is then hidden, its value kept.
 */
function panelSchema<C extends Control>(schema: Record<string, C>, selected: boolean) {
  const main: Record<string, PanelControl<C>> = {}
  const details: Record<string, PanelControl<C>> = {}
  for (const [name, control] of Object.entries(schema)) {
    const { main: isMain, variants, ...input } = control
    // leva's `render` gets the store's `get`, which addresses an input by its path: the select's is `Variant`.
    const panelControl: PanelControl<C> = selected && variants ? { ...input, render: (get) => usedIn(control, get('Variant')) } : input
    if (isMain) main[name] = panelControl
    else details[name] = panelControl
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
  return (role: ColorRole) => getMtbColor(role, dark ? 'dark' : 'light')
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

/** The schema's defaults, by name. */
function defaults(schema: Model['schema']) {
  return Object.fromEntries(Object.entries(schema).map(([name, control]) => [name, control.value]))
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
  const variants = variantsOf(model.variants)
  const selected = Object.keys(variants).length > 1
  // The state: the part, its variant and the sliders' values (relative to that variant's defaults), in the URL.
  const { part, variant, values: numbers, setValues, setVariant } = useQuery(model)
  // A switch of variant under way: the variant left and the sliders' values then, until the sliders follow (below).
  const [switching, setSwitching] = useState<{ from: string; values: Values }>()
  const schemaOf = (id: string) => variantSchema(model.schema, model.variants, id)
  const current = () => {
    const value = get as unknown as (name: string) => number
    return Object.fromEntries(Object.keys(model.schema).map((name) => [name, value(name)]))
  }

  // The actions and the Variant select, made again as the variant changes, so that they act on the current one and the
  // select's hint (shown on hover) is its own. Registered before the sliders, whose `render` reads the select.
  useControls(
    () => ({
      'Copy link': {
        ...button(async () => {
          // The address bar's own URL, as it is about to be once the sliders stay still.
          const copied = await copyText(queryUrl(model, { part, variant, values: current() }, location.href))
          setToast(copied ? 'Link copied' : 'Could not copy the link')
        }),
        order: ORDER.actions,
      },
      ...(selected && {
        Variant: {
          value: variant,
          options: Object.fromEntries(Object.entries(variants).map(([id, { label }]) => [label, id])),
          hint: variants[variant].hint,
          order: ORDER.actions,
          // Called at once with the select's value (`initial`), then on each change: only a change switches. The
          // variant alone goes to the URL; the sliders follow once its parsers are in place.
          onChange: (id: string, _path: string, { initial }: { initial: boolean }) => {
            if (initial || id === variant) return
            setSwitching({ from: variant, values: current() })
            setVariant(id)
          },
        },
      }),
      Reset: { ...button(() => set(defaults(schemaOf(variant)))), order: ORDER.actions },
    }),
    [variant],
  )
  // leva's `get` and `set` address an input by its own key, in a folder too (`W`, not `Details.W`). Made once: the
  // sliders start at the URL's values; a later variant only sets their values. leva shows each control's `hint` on hover.
  const [, set, get] = useControls(() => panelSchema(boundToUrl(model.schema, numbers, setValues), selected))
  // The variant switched, its parsers in place: the sliders take the new variant's defaults, the user's tweaks kept, and
  // each writes its value back to the URL against that variant's defaults. leva does not follow the URL: it is set here.
  useEffect(() => {
    if (!switching) return
    set(switchedValues(model, switching.from, variant, switching.values))
    setSwitching(undefined)
  }, [switching, variant, model, set])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 1500)
    return () => clearTimeout(timer)
  }, [toast])

  // The Show folder's first checkbox, Handwork, for a part with hand finishing (masters with a `cam` value): off, the
  // part as the ShopBot cuts it, the masters' `cam` values on top of the sliders' (models.cam.ts). A view, not the
  // object: not in the link.
  const finishing = useControls(
    'Show',
    hasCamValues(model.schema) ? { Handwork: { value: true, hint: 'Off: the part as the ShopBot cuts it, without what is made by hand' } } : {},
    { order: ORDER.show },
  ) as { Handwork?: boolean }
  const shownValues = finishing.Handwork === false ? camValues(model.schema, numbers) : numbers

  // Built once the sliders have stayed still; the last build stays on screen until the next one is done.
  const [key] = useDebounceValue(buildKey(variant, shownValues), DEBOUNCE_MS)
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

/** The box of the meshes on screen, in world space: a role hidden in the Show folder takes no room. */
function visibleBox(shape: Object3D, target: Box3) {
  target.makeEmpty()
  shape.traverseVisible((object) => {
    if (object instanceof Mesh) target.expandByObject(object, true)
  })
  return target
}

/**
 * The scene, once the build is done: the shape on drei's `<Stage>` (centered at the origin, lit by an environment, a
 * contact shadow under its shown meshes), on a grid, fitted at first, the orbit around that fit; its picture shifted
 * left by `shift` pixels.
 */
function Scene({ built, shift }: { built: Promise<Built>; shift: number }) {
  // R3F bridges the Mtb context into the Canvas.
  const color = useRoleColor()
  const { shape } = use(built)
  const size = useThree((state) => state.size)
  const controls = useRef<ComponentRef<typeof CameraControls>>(null)
  // The roles on screen (the panel's Show folder), as a key: the shadow is drawn again when one is hidden or shown.
  const shown = useShow(shape)
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
    const current = controls.current
    if (!shape || !current || fitted.current) return
    // Stage's `<Center>` has just moved the shape, in its own layout effect: its world matrices are not updated yet.
    shape.updateWorldMatrix(true, true)
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
  // Every shape, not only the first, and every change of the roles shown: a part grown with a slider keeps its whole
  // shadow, and a hidden role casts none. After useShow's own layout effect, which has just shown or hidden the meshes.
  useLayoutEffect(() => {
    if (!shape) return
    shape.updateWorldMatrix(true, true)
    // The floor is the whole shape's: hiding the legs leaves the seat above it, not on it.
    const floor = box.setFromObject(shape, true).min.y
    visibleBox(shape, box)
    if (box.isEmpty()) return setBounds({ floor })
    box.getSize(boxSize)
    box.getCenter(boxCenter)
    setBounds({ floor, shadow: { x: boxCenter.x, z: boxCenter.z, height: box.max.y - floor, radius: boxSize.length() / 2 } })
  }, [shape, shown])
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
          {/* Contact shadows: no shadow maps to set up. Sized from the shown meshes, as Stage would (four times their
              bounding radius, wide enough for the blur), its camera reaching their top. Drawn once per shape and per set of
              roles shown (`frames`, remounted by the key): the part does not move between builds, so the shadow is not
              redrawn every frame. */}
          {bounds.shadow && (
            <ContactShadows
              key={`${shape.uuid} ${shown}`}
              frames={1}
              position={[bounds.shadow.x, bounds.floor, bounds.shadow.z]}
              scale={bounds.shadow.radius * 4}
              far={bounds.shadow.height}
              blur={2}
            />
          )}
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
 * The panel's Show folder, for a shape whose meshes play at least two roles (`userData.role`, models.ts): a checkbox
 * per role, all on at first, that shows or hides its meshes. Applied to each shape put on screen, a cached one too.
 * A view, not the object: not in the link. A role gone with a variant leaves the folder; seen again, it is as it was
 * left (leva keeps an input's value while it is out of the panel). A hook, not a component: the scene's contact shadow
 * follows the roles shown.
 * @returns The roles shown, as a key that changes with them.
 */
function useShow(shape: Object3D | undefined) {
  const roles = shape ? rolesOf(shape) : []
  const schema = roles.length < 2 ? {} : Object.fromEntries(roles.map((role) => [role, { value: true, label: role[0].toUpperCase() + role.slice(1) }]))
  const shown = useControls('Show', schema, { order: ORDER.show }, [roles.join()]) as Partial<Record<Role, boolean>>
  const key = JSON.stringify(shown)
  // Before the frame is drawn: the shape never shows a hidden role.
  useLayoutEffect(() => {
    if (shape) showRoles(shape, JSON.parse(key) as Partial<Record<Role, boolean>>)
  }, [shape, key])
  return key
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
