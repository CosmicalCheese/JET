/* ─── Solver (Modified Nodal Analysis + Newton-Raphson) ───
 *
 * Incógnitas: el voltaje de cada net (menos uno de referencia por cada parte
 * conectada) y la corriente de cada elemento "tipo fuente de voltaje"
 * (fuentes de voltaje y amperímetros, que son fuentes de 0 V; en DC también
 * las bobinas).
 *
 * En modo transitorio, capacitores y bobinas se reemplazan por su "modelo
 * compañero" de Euler implícito: una conductancia en paralelo con una fuente
 * de corriente que depende del paso anterior.
 *   Capacitor: i = C·(v − v₀)/dt  →  G = C/dt,  fuente G·v₀
 *   Bobina:    v = L·(i − i₀)/dt  →  G = dt/L,  fuente i₀
 *
 * Los diodos no son lineales: se resuelven con Newton-Raphson, linealizando
 * cada uno alrededor de un voltaje de prueba y repitiendo hasta que converge.
 *
 *   [ G  B ] [ v ]   [ i ]
 *   [ C  0 ] [ j ] = [ e ]
 *
 * Antes de armar la matriz se diagnostican los casos que la harían singular
 * (cortos, lazos de fuentes, fuentes de corriente al aire) para devolver un
 * mensaje útil en vez de un simple "no se pudo resolver".
 */

import { cloneMatrix, DenseMatrix, solveLinear } from './linear.ts'
import { diodeCurrent, diodeParams, isDiodeLike, limitStep, LED_VF } from './diode.ts'
import { buildNetlist, terminalKey, endpointKey, UnionFind, type Netlist } from './netlist.ts'
import {
  TERMINAL_COUNT,
  type Circuit,
  type CircuitComponent,
  type CircuitIssue,
  type ComponentState,
  type DCResult,
  type SolveMode,
} from './types.ts'

const MAX_NEWTON = 100

/** Elementos que fijan una diferencia de voltaje y aportan una corriente incógnita. */
function isVoltageLike(c: CircuitComponent, mode: SolveMode): boolean {
  return c.kind === 'voltage-source' || c.kind === 'ammeter' || (c.kind === 'inductor' && mode.kind === 'dc')
}

/** Elementos que dan un camino entre sus terminales (para saber qué está conectado con qué). */
function isConductive(c: CircuitComponent, mode: SolveMode): boolean {
  if (c.kind === 'resistor' || isVoltageLike(c, mode) || isDiodeLike(c)) return true
  return mode.kind === 'transient' && (c.kind === 'capacitor' || c.kind === 'inductor')
}

// ─── Validación ──────────────────────────────────────────────────────────────

export function validateCircuit(circuit: Circuit): CircuitIssue[] {
  const issues: CircuitIssue[] = []
  const byId = new Map<string, CircuitComponent>()
  const seen = new Set<string>()

  for (const item of [...circuit.components, ...circuit.wires]) {
    if (seen.has(item.id)) {
      issues.push({ code: 'duplicate-id', message: `El id "${item.id}" está repetido.`, ids: [item.id] })
    }
    seen.add(item.id)
  }

  for (const c of circuit.components) {
    byId.set(c.id, c)
    const bad = (what: string) =>
      issues.push({ code: 'invalid-value', message: `${c.id}: ${what}.`, ids: [c.id] })
    switch (c.kind) {
      case 'resistor':
        if (!Number.isFinite(c.resistance) || c.resistance <= 0) bad('la resistencia debe ser mayor que 0 Ω')
        break
      case 'voltage-source':
        if (!Number.isFinite(c.voltage)) bad('el voltaje no es un número válido')
        break
      case 'current-source':
        if (!Number.isFinite(c.current)) bad('la corriente no es un número válido')
        break
      case 'capacitor':
        if (!Number.isFinite(c.capacitance) || c.capacitance <= 0) bad('la capacitancia debe ser mayor que 0 F')
        break
      case 'inductor':
        if (!Number.isFinite(c.inductance) || c.inductance <= 0) bad('la inductancia debe ser mayor que 0 H')
        break
      case 'zener':
        if (!Number.isFinite(c.zenerVoltage) || c.zenerVoltage <= 0) bad('el voltaje Zener debe ser mayor que 0 V')
        break
      case 'led':
        if (!(c.color in LED_VF)) bad('color de LED desconocido')
        break
    }
  }

  for (const w of circuit.wires) {
    for (const e of [w.a, w.b]) {
      if ('junction' in e) continue
      const c = byId.get(e.component)
      if (!c || !Number.isInteger(e.terminal) || e.terminal < 0 || e.terminal >= TERMINAL_COUNT[c.kind]) {
        issues.push({
          code: 'unknown-endpoint',
          message: `El cable ${w.id} apunta a un terminal que no existe (${e.component}:${e.terminal}).`,
          ids: [w.id],
        })
      }
    }
  }
  return issues
}

// ─── Diagnóstico topológico ──────────────────────────────────────────────────

/**
 * Busca cortos y lazos formados solo por fuentes de voltaje / amperímetros
 * (y cables): ahí la corriente sería infinita o indeterminada.
 */
function findSourceLoops(
  voltageLike: CircuitComponent[],
  nets: Netlist,
  netOf: (id: string, t: number) => number,
): CircuitIssue[] {
  const issues: CircuitIssue[] = []
  const uf = new UnionFind()
  for (let i = 0; i < nets.netCount; i++) uf.add()
  // Bosque de aristas aceptadas, para reconstruir el lazo cuando aparece.
  const adjacency: { to: number; id: string }[][] = Array.from({ length: nets.netCount }, () => [])

  for (const c of voltageLike) {
    const a = netOf(c.id, 0)
    const b = netOf(c.id, 1)
    if (a === b) {
      if (c.kind === 'ammeter') {
        issues.push({
          code: 'short-circuit',
          message: `El amperímetro ${c.id} está puenteado por un cable: no hay forma de saber qué corriente pasa por él.`,
          ids: [c.id],
        })
      } else if (c.kind === 'voltage-source' && c.voltage !== 0) {
        issues.push({
          code: 'short-circuit',
          message: `La fuente ${c.id} está en cortocircuito: sus terminales están unidos por un cable.`,
          ids: [c.id],
        })
      } else {
        issues.push({
          code: 'short-circuit',
          message: `La fuente ${c.id} (0 V) está puenteada por un cable: su corriente es indeterminada.`,
          ids: [c.id],
        })
      }
      continue
    }
    if (!uf.union(a, b)) {
      const ids = [...pathBetween(adjacency, a, b), c.id]
      const withInductor = voltageLike.some((k) => k.kind === 'inductor' && ids.includes(k.id))
      issues.push({
        code: 'source-loop',
        message:
          'Hay un lazo formado solo por fuentes de voltaje, amperímetros y cables. ' +
          'Sin una resistencia en el lazo, la corriente sería infinita o indeterminada.' +
          (withInductor ? ' (En régimen permanente una bobina se comporta como un cable.)' : ''),
        ids,
      })
      continue
    }
    adjacency[a].push({ to: b, id: c.id })
    adjacency[b].push({ to: a, id: c.id })
  }
  return issues
}

function pathBetween(adjacency: { to: number; id: string }[][], from: number, to: number): string[] {
  const prev = new Map<number, { node: number; id: string }>()
  const queue = [from]
  const visited = new Set([from])
  while (queue.length) {
    const n = queue.shift()!
    if (n === to) break
    for (const e of adjacency[n]) {
      if (visited.has(e.to)) continue
      visited.add(e.to)
      prev.set(e.to, { node: n, id: e.id })
      queue.push(e.to)
    }
  }
  const ids: string[] = []
  for (let n = to; n !== from; ) {
    const p = prev.get(n)
    if (!p) break
    ids.push(p.id)
    n = p.node
  }
  return ids.reverse()
}

// ─── Solver ──────────────────────────────────────────────────────────────────

/** Régimen permanente: capacitores abiertos, bobinas como cables. */
export function solveDC(circuit: Circuit): DCResult {
  return solveCircuit(circuit, { kind: 'dc' })
}

export function solveCircuit(circuit: Circuit, mode: SolveMode): DCResult {
  const invalid = validateCircuit(circuit)
  if (invalid.length) return { ok: false, issues: invalid }

  const nets = buildNetlist(circuit)
  const vertexOf = (id: string, t: number) => nets.vertexOf.get(terminalKey(id, t))!
  const netOf = (id: string, t: number) => nets.netOfVertex[vertexOf(id, t)]

  // Una bobina puenteada por un cable en DC no lleva corriente definida ni hace daño: se ignora.
  const voltageLike = circuit.components.filter(
    (c) => isVoltageLike(c, mode) && !(c.kind === 'inductor' && netOf(c.id, 0) === netOf(c.id, 1)),
  )
  const isBranch = new Set(voltageLike.map((c) => c.id))

  const loops = findSourceLoops(voltageLike, nets, netOf)
  if (loops.length) return { ok: false, issues: loops }

  // Partes conectadas por caminos DC. Cada una necesita su propio nodo de
  // referencia; la que contiene GND usa GND.
  const islands = new UnionFind()
  for (let i = 0; i < nets.netCount; i++) islands.add()
  for (const c of circuit.components) {
    if (isConductive(c, mode)) islands.union(netOf(c.id, 0), netOf(c.id, 1))
  }

  const issues: CircuitIssue[] = []
  for (const c of circuit.components) {
    if (c.kind === 'current-source' && islands.find(netOf(c.id, 0)) !== islands.find(netOf(c.id, 1))) {
      issues.push({
        code: 'current-source-open',
        message: `La fuente de corriente ${c.id} no tiene un camino cerrado por donde circular.`,
        ids: [c.id],
      })
    }
  }
  if (issues.length) return { ok: false, issues }

  const referenceOf = new Map<number, number>() // raíz de la isla → net de referencia
  if (nets.groundNet !== null) referenceOf.set(islands.find(nets.groundNet), nets.groundNet)
  for (let n = 0; n < nets.netCount; n++) {
    const root = islands.find(n)
    if (!referenceOf.has(root)) referenceOf.set(root, n)
  }

  const warnings = floatingWarnings(circuit, nets, netOf, islands, mode)

  // Índices de incógnitas.
  const unknownOfNet: number[] = new Array(nets.netCount).fill(-1)
  let size = 0
  for (let n = 0; n < nets.netCount; n++) {
    if (referenceOf.get(islands.find(n)) !== n) unknownOfNet[n] = size++
  }
  const branchOf = new Map<string, number>()
  for (const c of voltageLike) branchOf.set(c.id, size++)
  const state = mode.kind === 'transient' ? mode.state : {}
  const companionG = (c: CircuitComponent): number =>
    mode.kind !== 'transient' ? 0
      : c.kind === 'capacitor' ? c.capacitance / mode.dt
      : c.kind === 'inductor' ? mode.dt / c.inductance
      : 0

  // Estampado.
  const A = new DenseMatrix(size)
  const z = new Float64Array(size)
  const stampConductance = (a: number, b: number, g: number) => {
    const ia = unknownOfNet[a]
    const ib = unknownOfNet[b]
    if (ia >= 0) A.add(ia, ia, g)
    if (ib >= 0) A.add(ib, ib, g)
    if (ia >= 0 && ib >= 0) {
      A.add(ia, ib, -g)
      A.add(ib, ia, -g)
    }
  }

  /** Fuente de corriente que empuja `i` hacia el net a y la saca del net b. */
  const stampSource = (a: number, b: number, i: number) => {
    if (unknownOfNet[a] >= 0) z[unknownOfNet[a]] += i
    if (unknownOfNet[b] >= 0) z[unknownOfNet[b]] -= i
  }

  for (const c of circuit.components) {
    if (c.kind === 'ground') continue
    const a = netOf(c.id, 0)
    const b = netOf(c.id, 1)
    const ia = unknownOfNet[a]
    const ib = unknownOfNet[b]
    if (isBranch.has(c.id)) {
      const k = branchOf.get(c.id)!
      if (ia >= 0) {
        A.add(ia, k, 1)
        A.add(k, ia, 1)
      }
      if (ib >= 0) {
        A.add(ib, k, -1)
        A.add(k, ib, -1)
      }
      z[k] = c.kind === 'voltage-source' ? c.voltage : 0
      continue
    }
    switch (c.kind) {
      case 'resistor':
        stampConductance(a, b, 1 / c.resistance)
        break
      case 'current-source':
        // Sale del terminal 0 hacia el circuito → entra al net a.
        stampSource(a, b, c.current)
        break
      case 'capacitor':
        if (mode.kind === 'transient') {
          const g = companionG(c)
          stampConductance(a, b, g)
          stampSource(a, b, g * (state[c.id] ?? 0))
        }
        break // en DC: abierto
      case 'inductor':
        // Solo llega aquí en transitorio (en DC es una rama tipo fuente de 0 V).
        stampConductance(a, b, companionG(c))
        stampSource(a, b, -(state[c.id] ?? 0))
        break
      default:
        break // switch y voltímetro: abiertos para el solver; el switch cerrado ya es parte del netlist
    }
  }

  // Diodos: cada uno se reemplaza por su recta tangente en un voltaje de
  // prueba (conductancia g + fuente), se resuelve, y se repite con el voltaje
  // resultante hasta que deja de cambiar.
  const diodes = circuit.components.filter(isDiodeLike).map((d) => ({
    id: d.id, p: diodeParams(d), a: netOf(d.id, 0), b: netOf(d.id, 1),
  }))
  const guess = new Map(diodes.map((d) => [d.id, mode.guess?.[d.id] ?? 0]))
  const nodeV = (sol: Float64Array, n: number) => (unknownOfNet[n] >= 0 ? sol[unknownOfNet[n]] : 0)

  let x: Float64Array | null = null
  let converged = diodes.length === 0
  for (let iter = 0; iter < (diodes.length ? MAX_NEWTON : 1); iter++) {
    let Ak = A
    let zk = z
    if (diodes.length) {
      Ak = cloneMatrix(A)
      zk = Float64Array.from(z)
      for (const d of diodes) {
        const v = guess.get(d.id)!
        const { i, g } = diodeCurrent(d.p, v)
        const ia = unknownOfNet[d.a]
        const ib = unknownOfNet[d.b]
        if (ia >= 0) Ak.add(ia, ia, g)
        if (ib >= 0) Ak.add(ib, ib, g)
        if (ia >= 0 && ib >= 0) {
          Ak.add(ia, ib, -g)
          Ak.add(ib, ia, -g)
        }
        // Corriente del diodo ≈ g·V + ieq, del ánodo al cátodo.
        const ieq = i - g * v
        if (ia >= 0) zk[ia] -= ieq
        if (ib >= 0) zk[ib] += ieq
      }
    }
    x = size > 0 ? solveLinear(Ak, zk) : new Float64Array(0)
    if (!x || !diodes.length) break
    converged = true
    for (const d of diodes) {
      const vold = guess.get(d.id)!
      const vnew = nodeV(x, d.a) - nodeV(x, d.b)
      if (Math.abs(vnew - vold) > 1e-9 + 1e-6 * Math.abs(vold)) converged = false
      guess.set(d.id, limitStep(d.p, vnew, vold))
    }
    if (converged) break
  }
  if (!x) {
    return {
      ok: false,
      issues: [{ code: 'singular', message: 'No se pudo resolver el circuito (sistema singular).', ids: [] }],
    }
  }
  if (!converged) {
    return {
      ok: false,
      issues: [{
        code: 'no-convergence',
        message: 'No se encontró un punto de operación estable para los diodos. Revisa que no haya diodos en paralelo directo con una fuente.',
        ids: diodes.map((d) => d.id),
      }],
    }
  }

  const netVoltages = unknownOfNet.map((u) => (u >= 0 ? x[u] : 0))

  // Estado de los componentes (convención pasiva).
  const components: Record<string, ComponentState> = {}
  const terminalNets: Record<string, number[]> = {}
  for (const c of circuit.components) {
    terminalNets[c.id] = Array.from({ length: TERMINAL_COUNT[c.kind] }, (_, t) => netOf(c.id, t))
    if (c.kind === 'ground') continue
    const voltage = netVoltages[netOf(c.id, 0)] - netVoltages[netOf(c.id, 1)]
    let current = 0
    if (isBranch.has(c.id)) current = x[branchOf.get(c.id)!]
    else if (c.kind === 'resistor') current = voltage / c.resistance
    else if (c.kind === 'current-source') current = -c.current
    else if (c.kind === 'capacitor' && mode.kind === 'transient') current = companionG(c) * (voltage - (state[c.id] ?? 0))
    else if (c.kind === 'inductor' && mode.kind === 'transient') current = companionG(c) * voltage + (state[c.id] ?? 0)
    else if (isDiodeLike(c)) current = diodeCurrent(diodeParams(c), voltage).i
    components[c.id] = { voltage, current, power: voltage * current }
  }

  // Corrientes en cables, switches cerrados y GND.
  const idealCurrents = solveIdealEdgeCurrents(circuit, nets, vertexOf, components)
  const wireCurrents: Record<string, number> = {}
  for (const w of circuit.wires) wireCurrents[w.id] = idealCurrents.get(w.id) ?? 0
  for (const c of circuit.components) {
    if (c.kind === 'switch' || c.kind === 'ground') {
      const current = idealCurrents.get(c.id) ?? 0
      const voltage = c.kind === 'ground' ? 0 : components[c.id].voltage
      components[c.id] = { voltage, current, power: voltage * current }
    }
  }

  const junctionNets: Record<string, number> = {}
  for (const w of circuit.wires) {
    for (const e of [w.a, w.b]) {
      if ('junction' in e) junctionNets[e.junction] = nets.netOfVertex[nets.vertexOf.get(endpointKey(e))!]
    }
  }

  return { ok: true, netVoltages, terminalNets, junctionNets, components, wireCurrents, warnings }
}

function floatingWarnings(
  circuit: Circuit,
  nets: Netlist,
  netOf: (id: string, t: number) => number,
  islands: UnionFind,
  mode: SolveMode,
): CircuitIssue[] {
  const groundRoot = nets.groundNet === null ? null : islands.find(nets.groundNet)
  const byIsland = new Map<number, Set<string>>()
  for (const c of circuit.components) {
    if (c.kind === 'ground' || (c.kind === 'switch' && !c.closed)) continue
    // En DC un capacitor es abierto: no avisamos por el lado que queda "colgando".
    if (c.kind === 'capacitor' && mode.kind === 'dc') continue
    for (let t = 0; t < TERMINAL_COUNT[c.kind]; t++) {
      const root = islands.find(netOf(c.id, t))
      if (root === groundRoot) continue
      if (!byIsland.has(root)) byIsland.set(root, new Set())
      byIsland.get(root)!.add(c.id)
    }
  }
  return [...byIsland.values()].map((ids) => ({
    code: 'floating' as const,
    message:
      nets.groundNet === null
        ? 'El circuito no tiene GND: los voltajes se miden respecto a un nodo elegido automáticamente.'
        : 'Esta parte del circuito no está conectada a GND: sus voltajes son relativos y pueden no tener sentido.',
    ids: [...ids],
  }))
}

/**
 * Las aristas ideales (cables, switches cerrados, GND) no aparecen en la MNA:
 * se reparten la corriente que inyectan los componentes en cada net.
 * Sobre un árbol generador la solución es única; en lazos de cables ideales
 * la corriente es indeterminada y se asigna toda al árbol (0 en el resto).
 */
function solveIdealEdgeCurrents(
  circuit: Circuit,
  nets: Netlist,
  vertexOf: (id: string, t: number) => number,
  components: Record<string, ComponentState>,
): Map<string, number> {
  // Corriente que cada componente empuja hacia el vértice de su terminal.
  const injection = new Float64Array(nets.vertexCount)
  for (const c of circuit.components) {
    if (c.kind === 'ground' || c.kind === 'switch') continue
    const i = components[c.id].current
    injection[vertexOf(c.id, 0)] -= i
    injection[vertexOf(c.id, 1)] += i
  }

  const adjacency: number[][] = Array.from({ length: nets.vertexCount }, () => [])
  nets.idealEdges.forEach((e, k) => {
    adjacency[e.a].push(k)
    adjacency[e.b].push(k)
  })

  const result = new Map<string, number>()
  for (const e of nets.idealEdges) result.set(e.owner, 0)

  const visited = new Uint8Array(nets.vertexCount)
  const parentEdge = new Int32Array(nets.vertexCount).fill(-1)
  for (let root = 0; root < nets.vertexCount; root++) {
    if (visited[root]) continue
    visited[root] = 1
    const order = [root]
    for (let q = 0; q < order.length; q++) {
      const v = order[q]
      for (const k of adjacency[v]) {
        const e = nets.idealEdges[k]
        const w = e.a === v ? e.b : e.a
        if (visited[w]) continue
        visited[w] = 1
        parentEdge[w] = k
        order.push(w)
      }
    }
    // De las hojas hacia la raíz: cada arista lleva todo lo que inyecta su subárbol.
    const up = new Float64Array(order.length)
    const position = new Map(order.map((v, i) => [v, i]))
    for (let i = order.length - 1; i > 0; i--) {
      const v = order[i]
      const flow = injection[v] + up[i]
      const e = nets.idealEdges[parentEdge[v]]
      const parent = e.a === v ? e.b : e.a
      up[position.get(parent)!] += flow
      result.set(e.owner, e.a === v ? flow : -flow)
    }
  }
  return result
}
