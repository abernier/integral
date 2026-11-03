// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { button, Leva, useControls } from 'leva'
import { Mesh, type Object3D } from 'three'
import { type Model, models } from './models.ts'
import { changedParams, parseValuesFile, valuesFile, withQueryValues } from './App.query.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

const query = new URLSearchParams(location.search)
const part = query.get('part') ?? ''

/** Asks the user for a JSON file and reads it; undefined when none is picked. */
function pickJsonFile() {
  return new Promise<string | undefined>((done) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) file.text().then(done, () => done(undefined))
      else done(undefined)
    })
    input.addEventListener('cancel', () => done(undefined))
    input.click()
  })
}

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

/** The configurator page: the part named by `?part=`, rebuilt as its sliders move. */
export function App() {
  const [model, setModel] = useState<Model>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    // hasOwn: a plain lookup would also find inherited members such as `constructor`.
    if (!Object.hasOwn(models, part)) return setError(`Unknown part: ${JSON.stringify(part)}`)
    models[part]().then(setModel, (e) => setError(String(e)))
  }, [])

  return (
    <>
      <Leva titleBar={{ title: part }} />
      {model && <Configurator model={model} />}
      {error && !model && <Message>{error}</Message>}
      {!error && !model && <Message color="#555">Loading…</Message>}
    </>
  )
}

function Message({ children, color = '#b00020', bottom = 16 }: { children: string; color?: string; bottom?: number }) {
  return <div style={{ position: 'fixed', left: 16, bottom, padding: '8px 12px', background: '#fff', borderRadius: 6, color }}>{children}</div>
}

function Configurator({ model }: { model: Model }) {
  // A problem stays longer than a confirmation, in red.
  const [toast, setToast] = useState<{ text: string; problem?: boolean }>()
  const [values, set, get] = useControls(() => ({
    'Copy link': button(async () => {
      const params = changedParams(model.schema, current(), part)
      const copied = await copyText(`${location.origin}${location.pathname}?${params}`)
      setToast(copied ? { text: 'Link copied' } : { text: 'Could not copy the link', problem: true })
    }),
    // A values file for `pnpm cam <part> --values <file.json>`: the CNC files of this very part. Its schema is among
    // the part's built files, a folder up from this app's on every host (the site, `nr dev`'s file server).
    'Copy values': button(async () => {
      const schemaUrl = new URL(`../${part}/${part}.values.schema.json`, location.href).href
      const copied = await copyText(valuesFile({ schema: model.schema, values: current(), part, schemaUrl }))
      setToast(copied ? { text: 'Values copied' } : { text: 'Could not copy the values', problem: true })
    }),
    // A values file back into the sliders, checked as `pnpm cam --values` checks it: all of it, or nothing.
    'Import values': button(async () => {
      const text = await pickJsonFile()
      if (text === undefined) return
      const parsed = parseValuesFile(model.schema, part, text)
      if ('problems' in parsed) {
        const shown = parsed.problems.slice(0, 3).join('; ')
        const more = parsed.problems.length > 3 ? ` (and ${parsed.problems.length - 3} more)` : ''
        setToast({ text: `Not imported: ${shown}${more}`, problem: true })
        return
      }
      set(parsed.values)
      setToast({ text: 'Values imported' })
    }),
    Reset: button(() => set(Object.fromEntries(Object.entries(model.schema).map(([name, control]) => [name, control.value])))),
    // The schema entries go through as they are: leva shows each control's `hint` on hover.
    ...withQueryValues(model.schema, query),
  }))
  /** The sliders' values now, read when a button is clicked. */
  function current() {
    const value = get as unknown as (name: string) => number
    return Object.fromEntries(Object.keys(model.schema).map((name) => [name, value(name)]))
  }
  const numbers = values as unknown as Record<string, number>
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), toast.problem ? 6000 : 1500)
    return () => clearTimeout(timer)
  }, [toast])
  const [shape, setShape] = useState<Object3D>()
  const [error, setError] = useState<string>()

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
      <Canvas camera={{ position: [600, 500, 700], near: 1, far: 20000 }} style={{ position: 'fixed', inset: 0 }}>
        <hemisphereLight args={['#ffffff', '#8d96a3', 2.2]} />
        <directionalLight position={[300, 600, 400]} intensity={2.4} />
        <Grid args={[4000, 4000]} cellSize={50} sectionSize={250} fadeDistance={5000} infiniteGrid />
        {/* Fitted to the first shape only, so that the camera stays where the user left it. */}
        <Bounds key={shape ? 'shape' : 'none'} fit observe={false}>
          {shape && <primitive object={shape} />}
        </Bounds>
        <OrbitControls makeDefault />
      </Canvas>
      {/* The first build also loads the kernel (about 3 MB of WebAssembly): a few seconds with nothing to see. */}
      {!shape && !error && <Message color="#555">Building the model…</Message>}
      {error && <Message>{error}</Message>}
      {toast && (
        <Message color={toast.problem ? '#b00020' : '#111'} bottom={error ? 64 : 16}>
          {toast.text}
        </Message>
      )}
    </>
  )
}
