// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { button, Leva, useControls } from 'leva'
import type { Object3D } from 'three'
import { type Model, models } from './models.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

const query = new URLSearchParams(location.search)
const part = query.get('part') ?? ''

/** The schema with the query string's values as initial values: known keys only, numeric, clamped to min/max. */
function withQueryValues(schema: Model['schema']) {
  return Object.fromEntries(
    Object.entries(schema).map(([name, control]) => {
      const raw = query.get(name)
      const fromQuery = raw === null || raw.trim() === '' ? NaN : Number(raw)
      if (!Number.isFinite(fromQuery)) return [name, control]
      return [name, { ...control, value: Math.min(control.max, Math.max(control.min, fromQuery)) }]
    }),
  )
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

export function App() {
  const [model, setModel] = useState<Model>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const load = models[part]
    if (!load) return setError(`Unknown part: ${JSON.stringify(part)}`)
    load().then(setModel, (e) => setError(String(e)))
  }, [])

  return (
    <>
      <Leva titleBar={{ title: part }} />
      {model && <Configurator model={model} />}
      {error && !model && <Message>{error}</Message>}
    </>
  )
}

function Message({ children, color = '#b00020' }: { children: string; color?: string }) {
  return <div style={{ position: 'fixed', left: 16, bottom: 16, padding: '8px 12px', background: '#fff', borderRadius: 6, color }}>{children}</div>
}

function Configurator({ model }: { model: Model }) {
  const [toast, setToast] = useState<string>()
  const [values, set, get] = useControls(() => ({
    'Copy link': button(async () => {
      // Only the values that differ from the schema defaults, to keep the link short.
      const params = new URLSearchParams({ part })
      const current = get as unknown as (name: string) => number
      for (const [name, control] of Object.entries(model.schema)) {
        if (current(name) !== control.value) params.set(name, String(current(name)))
      }
      const copied = await copyText(`${location.origin}${location.pathname}?${params}`)
      setToast(copied ? 'Link copied' : 'Could not copy the link')
    }),
    Reset: button(() => set(Object.fromEntries(Object.entries(model.schema).map(([name, control]) => [name, control.value])))),
    ...withQueryValues(model.schema),
  }))
  const numbers = values as unknown as Record<string, number>
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 1500)
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
      {error && <Message>{error}</Message>}
      {toast && <Message color="#111">{toast}</Message>}
    </>
  )
}
