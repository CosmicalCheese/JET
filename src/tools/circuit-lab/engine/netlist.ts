/* ─── Netlist: de cables a nodos eléctricos ───
 *
 * Cada terminal y cada unión libre es un "vértice". Los cables ideales (y los
 * switches cerrados, y los símbolos GND) unen vértices; cada grupo resultante
 * es un nodo eléctrico (net) con un solo voltaje.
 */

import { TERMINAL_COUNT, type Circuit, type Endpoint } from './types.ts'

export class UnionFind {
  private parent: number[] = []

  add(): number {
    this.parent.push(this.parent.length)
    return this.parent.length - 1
  }

  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]]
      i = this.parent[i]
    }
    return i
  }

  /** Une dos grupos. Devuelve false si ya estaban unidos. */
  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    this.parent[rb] = ra
    return true
  }
}

const GROUND_KEY = 'gnd'

export function terminalKey(component: string, terminal: number): string {
  return `c:${component}:${terminal}`
}

export function endpointKey(e: Endpoint): string {
  return 'junction' in e ? `j:${e.junction}` : terminalKey(e.component, e.terminal)
}

/** Arista ideal (0 Ω) del grafo de vértices; su corriente se calcula al final. */
export interface IdealEdge {
  /** Cable, switch cerrado o GND al que pertenece la arista. */
  owner: string
  a: number
  b: number
}

export interface Netlist {
  vertexCount: number
  vertexOf: Map<string, number>
  netOfVertex: number[]
  netCount: number
  /** Net de GND, o null si el circuito no tiene ningún GND. */
  groundNet: number | null
  idealEdges: IdealEdge[]
}

/** Asume que el circuito ya fue validado (ids y extremos existen). */
export function buildNetlist(circuit: Circuit): Netlist {
  const uf = new UnionFind()
  const vertexOf = new Map<string, number>()
  const vertex = (key: string) => {
    let v = vertexOf.get(key)
    if (v === undefined) {
      v = uf.add()
      vertexOf.set(key, v)
    }
    return v
  }

  const hasGround = circuit.components.some((c) => c.kind === 'ground')
  if (hasGround) vertex(GROUND_KEY)

  for (const c of circuit.components) {
    for (let t = 0; t < TERMINAL_COUNT[c.kind]; t++) vertex(terminalKey(c.id, t))
  }

  const idealEdges: IdealEdge[] = []
  for (const w of circuit.wires) {
    idealEdges.push({ owner: w.id, a: vertex(endpointKey(w.a)), b: vertex(endpointKey(w.b)) })
  }
  for (const c of circuit.components) {
    if (c.kind === 'switch' && c.closed) {
      idealEdges.push({ owner: c.id, a: vertex(terminalKey(c.id, 0)), b: vertex(terminalKey(c.id, 1)) })
    } else if (c.kind === 'ground') {
      idealEdges.push({ owner: c.id, a: vertex(terminalKey(c.id, 0)), b: vertex(GROUND_KEY) })
    }
  }
  for (const e of idealEdges) uf.union(e.a, e.b)

  // Numeración estable: el net de GND (si existe) es el 0.
  const vertexCount = vertexOf.size
  const netOfRoot = new Map<number, number>()
  const netOfVertex: number[] = new Array(vertexCount)
  for (let v = 0; v < vertexCount; v++) {
    const root = uf.find(v)
    let net = netOfRoot.get(root)
    if (net === undefined) {
      net = netOfRoot.size
      netOfRoot.set(root, net)
    }
    netOfVertex[v] = net
  }

  return {
    vertexCount,
    vertexOf,
    netOfVertex,
    netCount: netOfRoot.size,
    groundNet: hasGround ? 0 : null,
    idealEdges,
  }
}
