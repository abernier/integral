/**
 * The build worker: it loads the part's model file (and with it smlibwasm, the kernel) off the page's thread, hands
 * back its masters and variants, and builds the part on request, its meshes transferred as plain data
 * (App.worker.mesh.ts). One request at a time is enough: the page asks for the latest only (App.latest.ts).
 * @module
 */
import { models } from './models.ts'
import { toShapeData } from './App.worker.mesh.ts'
import type { WorkerReply, WorkerRequest } from './App.worker.ts'

self.onmessage = async ({ data: request }: MessageEvent<WorkerRequest>) => {
  const reply = (message: WorkerReply, transfer: Transferable[] = []) => self.postMessage(message, { transfer })
  try {
    if (!Object.hasOwn(models, request.part)) throw new Error(`Unknown part: ${JSON.stringify(request.part)}`)
    const model = await models[request.part]()
    if (request.type === 'load') return reply({ id: request.id, schema: model.schema, variants: model.variants })
    const { data, transfer } = toShapeData(await model.build(request.values, request.variant))
    reply({ id: request.id, shape: data }, transfer)
  } catch (e) {
    // The stack, in the worker's console; the message, on the page.
    console.error(e)
    reply({ id: request.id, error: e instanceof Error ? e.message : String(e) })
  }
}
