// ClassCAD writes a drawing's STEP as one product holding all its solids: the solids keep their names, but other
// CAD systems (Fusion among them) drop those on import and number the bodies instead. A product's name, though,
// they keep: this rewrites such a STEP as an assembly, one product per named solid, each placed where it was.
//
// Everything already in the file stays as it is; only the root's B-rep representation loses its named solids, which
// move to their own products. Entities are appended after the last one, numbered on from it.

/** A named solid of the STEP: its entity id and its name, still escaped as STEP writes it (`''` for a quote). */
type Solid = { id: number; name: string }

/** Every `#<id> = <TYPE>(` entity of the file whose type is `type`, as the regex match of its first line. */
function entities(text: string, type: string) {
  return [...text.matchAll(new RegExp(`^#(\\d+) = ${type}\\((.*)$`, 'gm'))]
}

/** The only entity of `type`: the file was not one product with its solids (or was rewritten already) otherwise. */
function single(text: string, type: string) {
  const found = entities(text, type)
  if (found.length !== 1) throw new Error(`STEP assembly: expected one ${type}, found ${found.length}`)
  return found[0]
}

/** The `#<id>` references of a parenthesised list, `(#1, #2)`. */
function references(list: string) {
  return [...list.matchAll(/#(\d+)/g)].map((match) => Number(match[1]))
}

/**
 * Rewrite a one-product STEP (as ClassCAD writes it) as an assembly: the root product gets one component per named
 * solid (`MANIFOLD_SOLID_BREP` or `BREP_WITH_VOIDS`), named after it and holding it alone, at the identity
 * transform. CAD systems then import each solid as an occurrence of a component of that name. Unnamed solids stay in
 * the root. A STEP without named solids is returned unchanged.
 */
export function stepAssembly(text: string) {
  const solids: Solid[] = [...text.matchAll(/^#(\d+) = (?:MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS)\('((?:[^']|'')+)'/gm)].map(
    (match) => ({ id: Number(match[1]), name: match[2] }),
  )
  if (!solids.length) return text

  const rootDefinition = single(text, 'PRODUCT_DEFINITION')[1]
  const productContext = single(text, 'PRODUCT_CONTEXT')[1]
  const definitionContext = single(text, 'PRODUCT_DEFINITION_CONTEXT')[1]
  // The root's shape: its placement (the origin every component is placed at) and, related to it, the B-rep
  // representation that lists the solids.
  const rootShape = single(text, 'SHAPE_REPRESENTATION')
  const origin = references(rootShape[2])[0]
  if (!new RegExp(`^#${origin} = AXIS2_PLACEMENT_3D\\(`, 'm').test(text)) {
    throw new Error(`STEP assembly: the root shape's first item #${origin} is not a placement`)
  }
  const brep = single(text, 'ADVANCED_BREP_SHAPE_REPRESENTATION')
  const brepMatch = brep[2].match(/^'', \(([^)]*)\), #(\d+)\);$/)
  if (!brepMatch) throw new Error(`STEP assembly: unexpected root B-rep representation: ${brep[0]}`)
  const geometricContext = Number(brepMatch[2])

  // The root keeps its unnamed solids, if any, and the origin (a representation needs one item at least).
  const named = new Set(solids.map((solid) => solid.id))
  const kept = references(brepMatch[1]).filter((id) => !named.has(id))
  const rootItems = [origin, ...kept].map((id) => `#${id}`).join(', ')
  const rewritten = text.replace(
    brep[0],
    `#${brep[1]} = ADVANCED_BREP_SHAPE_REPRESENTATION('', (${rootItems}), #${geometricContext});`,
  )

  let next = Math.max(...[...text.matchAll(/^#(\d+) =/gm)].map((match) => Number(match[1]))) + 1
  const lines: string[] = []
  /** Append an entity; returns its `#<id>`. */
  const add = (entity: string) => {
    const id = `#${next++}`
    lines.push(`${id} = ${entity};`)
    return id
  }

  for (const { id, name } of solids) {
    // The component: a product, its version and definition, and its shape, the solid alone.
    const product = add(`PRODUCT('${name}', '${name}', '', (#${productContext}))`)
    add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part', '', (${product}))`)
    const formation = add(`PRODUCT_DEFINITION_FORMATION('', '', ${product})`)
    const definition = add(`PRODUCT_DEFINITION('design', '', ${formation}, #${definitionContext})`)
    const shape = add(`PRODUCT_DEFINITION_SHAPE('', '', ${definition})`)
    const representation = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${name}', (#${origin}, #${id}), #${geometricContext})`)
    add(`SHAPE_DEFINITION_REPRESENTATION(${shape}, ${representation})`)
    // Its occurrence in the root, placed by the identity: the origin onto itself.
    const usage = add(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('${name}', '${name}', '', #${rootDefinition}, ${definition}, $)`)
    const usageShape = add(`PRODUCT_DEFINITION_SHAPE('', '', ${usage})`)
    const transformation = add(`ITEM_DEFINED_TRANSFORMATION('', '', #${origin}, #${origin})`)
    const relationship = add(
      `(REPRESENTATION_RELATIONSHIP('', '', ${representation}, #${rootShape[1]}) ` +
        `REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(${transformation}) SHAPE_REPRESENTATION_RELATIONSHIP())`,
    )
    add(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(${relationship}, ${usageShape})`)
  }

  const end = /^ENDSEC;\s*END-ISO-10303-21;/m
  if (!end.test(rewritten)) throw new Error('STEP assembly: no end of the DATA section')
  return rewritten.replace(end, () => `${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;`)
}
