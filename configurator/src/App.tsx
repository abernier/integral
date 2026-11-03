// `?part=<folder>`: that part's model, a slider per parameter, and the part itself, rebuilt as a slider moves.
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import type { Object3D } from 'three'
import { type Model, models } from './models.ts'

/** How long the sliders stay still before the part is rebuilt. */
const DEBOUNCE_MS = 200

const part = new URLSearchParams(location.search).get('part') ?? ''

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

function Message({ children }: { children: string }) {
  return <div style={{ position: 'fixed', left: 16, bottom: 16, padding: '8px 12px', background: '#fff', borderRadius: 6, color: '#b00020' }}>{children}</div>
}

function Configurator({ model }: { model: Model }) {
  const values = useControls(model.schema) as Record<string, number>
  const [shape, setShape] = useState<Object3D>()
  const [error, setError] = useState<string>()

  // Build once the values have stopped changing; a build that throws leaves the last good shape on screen.
  const key = JSON.stringify(values)
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
    </>
  )
}
