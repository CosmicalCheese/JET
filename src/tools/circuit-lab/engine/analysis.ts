/* ─── Análisis didáctico ───
 *
 * El solver ya resolvió el circuito con MNA. Aquí sólo reconocemos patrones
 * que se enseñan en clase (serie, paralelo, nodos) para explicar el resultado
 * con la fórmula que el estudiante conoce.
 */

import { isGroundReferenced, solveDC } from './dc.ts'
import { UnionFind } from './netlist.ts'
import type { Circuit, CircuitComponent, DCSolution } from './types.ts'

/** Terminal por el que puede pasar corriente de un net a otro. */
interface Tap {
  component: CircuitComponent
  terminal: number
  /** Net del otro terminal (solo componentes de 2 terminales; −1 si tiene más). */
  other: number
}

/**
 * Terminales que llevan corriente, agrupados por net. Se omiten GND (todos sus
 * terminales están en el mismo net), voltímetros (corriente 0), switches
 * (abiertos no conducen; cerrados quedan dentro de un solo net) y componentes
 * con ambos terminales en el mismo net.
 */
function tapsByNet(circuit: Circuit, sol: DCSolution): Map<number, Tap[]> {
  const taps = new Map<number, Tap[]>()
  for (const c of circuit.components) {
    if (c.kind === 'ground' || c.kind === 'voltmeter' || c.kind === 'switch') continue
    const tn = sol.terminalNets[c.id]
    if (tn.length === 2 && tn[0] === tn[1]) continue
    tn.forEach((net, terminal) => {
      // Las entradas de un op-amp no llevan corriente.
      if (c.kind === 'opamp' && terminal < 2) return
      if (!taps.has(net)) taps.set(net, [])
      taps.get(net)!.push({ component: c, terminal, other: tn.length === 2 ? tn[1 - terminal] : -1 })
    })
  }
  return taps
}

const resistance = (c: CircuitComponent) => (c.kind === 'resistor' ? c.resistance : 0)

export interface SeriesChain {
  /** Resistencias de la cadena, en orden. */
  resistors: { id: string; resistance: number }[]
  /** Suma de las resistencias. */
  total: number
  /** Voltaje entre los extremos de la cadena (valor absoluto). */
  voltage: number
  /** Corriente común (valor absoluto). */
  current: number
}

/**
 * Cadena de resistencias en serie que contiene a `id`. Se recorre mientras
 * cada nodo intermedio tenga exactamente dos terminales con corriente; los
 * amperímetros se atraviesan (son cables con lectura). null si no hay serie.
 */
export function seriesChain(circuit: Circuit, sol: DCSolution, id: string): SeriesChain | null {
  const start = circuit.components.find((c) => c.id === id)
  if (start?.kind !== 'resistor') return null
  const taps = tapsByNet(circuit, sol)
  const visited = new Set([id])

  const walk = (net: number, from: string): { chain: CircuitComponent[]; end: number } => {
    const chain: CircuitComponent[] = []
    let current = from
    for (;;) {
      const here = taps.get(net) ?? []
      if (here.length !== 2) break
      const next = here.find((t) => t.component.id !== current)
      if (!next || visited.has(next.component.id)) break
      if (next.component.kind !== 'resistor' && next.component.kind !== 'ammeter') break
      visited.add(next.component.id)
      if (next.component.kind === 'resistor') chain.push(next.component)
      current = next.component.id
      net = next.other
    }
    return { chain, end: net }
  }

  const [n0, n1] = sol.terminalNets[id]
  if (n0 === n1) return null
  const left = walk(n0, id)
  const right = walk(n1, id)
  const resistors = [...left.chain.reverse(), start, ...right.chain]
  if (resistors.length < 2) return null

  const total = resistors.reduce((s, r) => s + resistance(r), 0)
  return {
    resistors: resistors.map((r) => ({ id: r.id, resistance: resistance(r) })),
    total,
    voltage: Math.abs(sol.netVoltages[left.end] - sol.netVoltages[right.end]),
    current: Math.abs(sol.components[id].current),
  }
}

export interface ParallelGroup {
  resistors: { id: string; resistance: number; current: number }[]
  /** Resistencia equivalente. */
  total: number
  /** Voltaje común (valor absoluto). */
  voltage: number
  /** Suma de las corrientes de las ramas (valor absoluto). */
  current: number
}

/**
 * Resistencias conectadas entre los mismos dos nodos que `id`. Los
 * amperímetros cuentan como cables (0 V), así que una rama con amperímetro
 * sigue siendo una rama en paralelo. null si está sola.
 */
export function parallelGroup(circuit: Circuit, sol: DCSolution, id: string): ParallelGroup | null {
  const start = circuit.components.find((c) => c.id === id)
  if (start?.kind !== 'resistor') return null
  const merged = new UnionFind()
  sol.netVoltages.forEach(() => merged.add())
  for (const c of circuit.components) {
    if (c.kind === 'ammeter') merged.union(sol.terminalNets[c.id][0], sol.terminalNets[c.id][1])
  }
  const node = (cid: string, t: number) => merged.find(sol.terminalNets[cid][t])
  const [a, b] = [node(id, 0), node(id, 1)]
  if (a === b) return null
  const same = (c: CircuitComponent) => {
    const [x, y] = [node(c.id, 0), node(c.id, 1)]
    return (x === a && y === b) || (x === b && y === a)
  }
  const group = circuit.components.filter((c) => c.kind === 'resistor' && same(c))
  if (group.length < 2) return null
  const resistors = group.map((c) => ({
    id: c.id,
    resistance: resistance(c),
    current: Math.abs(sol.components[c.id].current),
  }))
  return {
    resistors,
    total: 1 / resistors.reduce((s, r) => s + 1 / r.resistance, 0),
    voltage: Math.abs(sol.netVoltages[a] - sol.netVoltages[b]),
    current: resistors.reduce((s, r) => s + r.current, 0),
  }
}

export interface NodeBalance {
  /** Corriente que cada componente mete al nodo (>0 entra, <0 sale). */
  flows: { id: string; current: number }[]
  entering: number
  leaving: number
}

/** Ley de corrientes de Kirchhoff en un net: lo que entra es lo que sale. */
export function nodeBalance(circuit: Circuit, sol: DCSolution, net: number): NodeBalance {
  const flows = (tapsByNet(circuit, sol).get(net) ?? [])
    .map((t) => ({ id: t.component.id, current: -sol.components[t.component.id].terminalCurrents[t.terminal] }))
  // Op-amps y compuertas toman (o devuelven) su corriente de la alimentación, que está en GND.
  if (net === sol.groundNet) {
    for (const c of circuit.components) {
      if (isGroundReferenced(c)) {
        flows.push({ id: `${c.id} (alimentación)`, current: sol.components[c.id].terminalCurrents.reduce((a, b) => a + b, 0) })
      }
    }
  }
  const nonzero = flows.filter((f) => Math.abs(f.current) > 1e-15)
  return {
    flows: nonzero,
    entering: nonzero.filter((f) => f.current > 0).reduce((s, f) => s + f.current, 0),
    leaving: -nonzero.filter((f) => f.current < 0).reduce((s, f) => s + f.current, 0),
  }
}

export interface FirstOrder {
  /** Resistencia de Thévenin vista desde los terminales del elemento (Infinity si no hay camino). */
  rth: number
  /** Constante de tiempo: R·C o L/R. */
  tau: number
  /** Valor final en régimen permanente: voltaje del capacitor o corriente de la bobina. */
  final: number
}

/**
 * Respuesta de primer orden de un capacitor o una bobina: hacia qué valor va
 * y con qué constante de tiempo. Exacta si es el único elemento reactivo.
 */
export function firstOrder(circuit: Circuit, id: string): FirstOrder | null {
  const target = circuit.components.find((c) => c.id === id)
  if (target?.kind !== 'capacitor' && target?.kind !== 'inductor') return null

  const dc = solveDC(circuit)
  if (!dc.ok) return null
  const final = target.kind === 'capacitor' ? dc.components[id].voltage : dc.components[id].current

  // Thévenin: fuentes apagadas (voltaje → cable, corriente → abierto), los
  // demás reactivos en régimen permanente, y una fuente de prueba de 1 A en
  // lugar del elemento: el voltaje que aparece es R_th.
  const open = (c: CircuitComponent): CircuitComponent => ({ id: c.id, kind: 'voltmeter' })
  const components = circuit.components.map((c): CircuitComponent => {
    if (c.id === id) return { id, kind: 'current-source', current: 1 }
    if (c.kind === 'voltage-source') return { ...c, voltage: 0 }
    if (c.kind === 'current-source' || c.kind === 'capacitor') return open(c)
    if (c.kind === 'inductor') return { id: c.id, kind: 'ammeter' }
    return c
  })
  const test = solveDC({ components, wires: circuit.wires })
  let rth: number
  if (test.ok) rth = test.components[id].voltage
  else if (test.issues.some((i) => i.code === 'current-source-open')) rth = Infinity
  else return null

  const tau = target.kind === 'capacitor' ? rth * target.capacitance : target.inductance / rth
  return { rth, tau, final }
}
