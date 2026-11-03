// What every part's build shares: the script API it is given, and how a part ends.

import type { V1T } from '@classcad/api-js'

/** The ClassCAD script API a part's build is given: its methods, and the structure tree. */
export type Api = {
  v1: V1T
  tree: (options?: { refresh?: boolean }) => Promise<Record<string, { class: string; children?: number[] }>>
}

/** The id a call created; the engine answers null when it created nothing. */
export async function created(call: Promise<{ result: number | null }>) {
  const { result } = await call
  if (result === null) throw new Error('ClassCAD created nothing')
  return result
}

/**
 * Name each board's last feature and its solid after the board, so the model tree, Buerligons and the STEP show
 * the boards by name; returns each board's volume.
 */
export async function nameSolids(api: Api, boards: Record<string, number>) {
  const tree = await api.tree({ refresh: true })
  const volumes: Record<string, number | undefined> = {}
  for (const [name, feature] of Object.entries(boards)) {
    const solid = tree[feature].children?.find((child) => tree[child]?.class === 'CC_Solid')
    if (solid === undefined) throw new Error(`${name}: no solid`)
    await api.v1.common.setObjectName({ id: feature, name })
    await api.v1.common.setObjectName({ id: solid, name })
    volumes[name] = (await api.v1.part.calculateMassProperties({ id: solid })).result?.volume
  }
  return volumes
}
