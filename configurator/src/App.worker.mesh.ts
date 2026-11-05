/**
 * A built part across the worker's boundary: the model's three.js object flattened into plain data (typed arrays per
 * mesh, its name, role (models.roles.ts) and material), which `postMessage` transfers rather than copies, and made again on the page.
 * Generic over the models: whatever meshes a `build` returns cross it, each in its world placement.
 * Pure of the worker, so that it is testable under node.
 * @module
 */
import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, Mesh, MeshStandardMaterial, type Object3D, type Side } from 'three'
import { type Role, roleOf } from './models.roles.ts'

/** One mesh as plain data: its geometry's arrays, in the part's frame, and what its material needs. */
export type MeshData = {
  name: string
  role: Role
  position: Float32Array
  normal?: Float32Array
  index?: Uint16Array | Uint32Array
  color: number
  roughness: number
  metalness: number
  side: Side
}

/** A built part as plain data: its name and its meshes. */
export type ShapeData = { name: string; meshes: MeshData[] }

/**
 * A part's meshes as plain data, each placed by its world matrix (the arrays copied when it is not the identity).
 * `transfer` lists the buffers to hand to `postMessage`: after that, the shape is not to be used again.
 */
export function toShapeData(shape: Object3D) {
  shape.updateMatrixWorld(true)
  const meshes: MeshData[] = []
  shape.traverse((object) => {
    if (!(object instanceof Mesh)) return
    let geometry: BufferGeometry = object.geometry
    if (!object.matrixWorld.equals(IDENTITY)) geometry = geometry.clone().applyMatrix4(object.matrixWorld)
    const material = [object.material].flat()[0] as Partial<MeshStandardMaterial> | undefined
    meshes.push({
      name: object.name,
      role: roleOf(object.userData.role),
      position: geometry.getAttribute('position').array as Float32Array,
      normal: geometry.getAttribute('normal')?.array as Float32Array | undefined,
      index: geometry.index?.array as Uint16Array | Uint32Array | undefined,
      color: material?.color instanceof Color ? material.color.getHex() : 0xffffff,
      roughness: material?.roughness ?? 1,
      metalness: material?.metalness ?? 0,
      side: material?.side ?? 0,
    })
  })
  const data: ShapeData = { name: shape.name, meshes }
  // A buffer shared between two meshes is listed once: `postMessage` refuses a duplicate.
  const transfer = new Set<ArrayBuffer>()
  for (const { position, normal, index } of meshes) {
    for (const array of [position, normal, index]) if (array) transfer.add(array.buffer as ArrayBuffer)
  }
  return { data, transfer: [...transfer] }
}

/** The part again, from its plain data: a group of meshes, each with its own geometry and material, its role kept. */
export function fromShapeData({ name, meshes }: ShapeData): Object3D {
  const shape = new Group()
  shape.name = name
  for (const data of meshes) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.position, 3))
    if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1))
    if (data.normal) geometry.setAttribute('normal', new BufferAttribute(data.normal, 3))
    else geometry.computeVertexNormals()
    const { color, roughness, metalness, side } = data
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness, metalness, side }))
    mesh.name = data.name
    mesh.userData.role = data.role
    shape.add(mesh)
  }
  return shape
}

const IDENTITY = new Matrix4()
