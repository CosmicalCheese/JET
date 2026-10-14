/* ─── Solver (Modified Nodal Analysis + Newton-Raphson) ───
 *
 * Incógnitas: el voltaje de cada net (menos uno de referencia por cada parte
 * conectada) y la corriente de cada "rama tipo fuente de voltaje": fuentes de
 * voltaje (DC y AC), amperímetros (fuentes de 0 V), la salida de cada op-amp
 * y, en DC, las bobinas.
 *
 *   [ G  B ] [ v ]   [ i ]
 *   [ C  0 ] [ j ] = [ e ]
 *
 * En modo transitorio, capacitores y bobinas se reemplazan por su "modelo
 * compañero" de Euler implícito: una conductancia en paralelo con una fuente
 * de corriente que depende del paso anterior.
 *   Capacitor: i = C·(v − v₀)/dt  →  G = C/dt,  fuente G·v₀
 *   Bobina:    v = L·(i − i₀)/dt  →  G = dt/L,  fuente i₀
 *
 * Los componentes digitales (ver digital.ts) son entradas de alta impedancia y
 * salidas de 0/5 V con resistencia de salida, todas referidas a GND.
 *
 * Diodos, transistores y op-amps no son lineales: se resuelven con
 * Newton-Raphson, linealizando cada uno alrededor de un punto de prueba y
 * repitiendo hasta que converge (ver devices.ts).
 *
 * Antes de armar la matriz se diagnostican los casos que la harían singular
 * (cortos, lazos de fuentes, fuentes de corriente al aire) para devolver un
 * mensaje útil en vez de un simple "no se pudo resolver".
 */

import { cloneMatrix, DenseMatrix, solveLinear } from './linear.ts'
import { LED_VF } from './diode.ts'
import { acValue, deviceModel, opampOutput, type DeviceModel } from './devices.ts'
import { digitalPins, G_IN, isDigital, outputLevels, R_OUT, VDD } from './digital.ts'
import { buildNetlist, terminalKey, endpointKey, GROUND_KEY, UnionFind, type Netlist } from './netlist.ts'
import {
  TERMINAL_COUNT,
  type Circuit,
  type CircuitComponent,
  type CircuitIssue,
  type ComponentState,
  type DCResult,
  type DiodeGuess,
  type SolveMode,
} from './types.ts'

const MAX_NEWTON = 100

/** Componentes cuya alimentación está implícita en GND: su corriente regresa por tierra. */
export function isGroundReferenced(c: CircuitComponent): boolean {
  return c.kind === 'opamp' || isDigital(c)
}

/** Rama tipo fuente de voltaje: fija V(a) − V(b) y aporta su corriente como incógnita. */
interface Branch {
  c: CircuitComponent
  a: number
  b: number
}

/** Elementos de dos terminales que fijan una diferencia de voltaje. */
function isVoltageLike(c: CircuitComponent, mode: SolveMode): boolean {
  return (
    c.kind === 'voltage-source' || c.kind === 'ac-source' || c.kind === 'ammeter' ||
    (c.kind === 'inductor' && mode.kind === 'dc')
  )
}

/** Pares de terminales unidos por un camino (para saber qué está conectado con qué). */
function conductivePairs(c: CircuitComponent, mode: SolveMode): [number, number][] {
  switch (c.kind) {
    case 'resistor':
    case 'voltage-source':
    case 'ac-source':
    case 'ammeter':
    case 'diode':
    case 'led':
    case 'zener':
      return [[0, 1]]
    case 'capacitor':
      return mode.kind === 'transient' ? [[0, 1]] : []
    case 'inductor':
      return [[0, 1]]
    case 'bjt':
      return [[0, 1], [1, 2]]
    case 'mosfet':
      return [[0, 2]] // la compuerta está aislada
    default:
      return [] // fuente de corriente, switch, voltímetro, GND, op-amp (se trata aparte)
  }
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
    const positive = (x: number) => Number.isFinite(x) && x > 0
    switch (c.kind) {
      case 'resistor':
        if (!positive(c.resistance)) bad('la resistencia debe ser mayor que 0 Ω')
        break
      case 'voltage-source':
        if (!Number.isFinite(c.voltage)) bad('el voltaje no es un número válido')
        break
      case 'current-source':
        if (!Number.isFinite(c.current)) bad('la corriente no es un número válido')
        break
      case 'capacitor':
        if (!positive(c.capacitance)) bad('la capacitancia debe ser mayor que 0 F')
        break
      case 'inductor':
        if (!positive(c.inductance)) bad('la inductancia debe ser mayor que 0 H')
        break
      case 'zener':
        if (!positive(c.zenerVoltage)) bad('el voltaje Zener debe ser mayor que 0 V')
        break
      case 'led':
        if (!(c.color in LED_VF)) bad('color de LED desconocido')
        break
      case 'ac-source':
        if (![c.amplitude, c.offset, c.phase].every(Number.isFinite)) bad('amplitud, offset y fase deben ser números')
        if (!positive(c.frequency)) bad('la frecuencia debe ser mayor que 0 Hz')
        break
      case 'bjt':
        if (!positive(c.beta)) bad('β debe ser mayor que 0')
        break
      case 'mosfet':
        if (!positive(c.threshold)) bad('el voltaje de umbral debe ser mayor que 0 V')
        if (!positive(c.k)) bad('k debe ser mayor que 0')
        break
      case 'opamp':
        if (!positive(c.saturation)) bad('el voltaje de saturación debe ser mayor que 0 V')
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
 * Busca cortos y lazos formados solo por ramas tipo fuente de voltaje (y
 * cables): ahí la corriente sería infinita o indeterminada.
 */
function findSourceLoops(branches: Branch[], netCount: number): CircuitIssue[] {
  const issues: CircuitIssue[] = []
  const uf = new UnionFind()
  for (let i = 0; i < netCount; i++) uf.add()
  // Bosque de aristas aceptadas, para reconstruir el lazo cuando aparece.
  const adjacency: { to: number; id: string }[][] = Array.from({ length: netCount }, () => [])

  for (const { c, a, b } of branches) {
    if (a === b) {
      let message: string
      if (c.kind === 'ammeter') {
        message = `El amperímetro ${c.id} está puenteado por un cable: no hay forma de saber qué corriente pasa por él.`
      } else if (c.kind === 'opamp') {
        message = `La salida del op-amp ${c.id} está conectada directo a GND.`
      } else if ((c.kind === 'voltage-source' && c.voltage !== 0) || c.kind === 'ac-source') {
        message = `La fuente ${c.id} está en cortocircuito: sus terminales están unidos por un cable.`
      } else {
        message = `La fuente ${c.id} (0 V) está puenteada por un cable: su corriente es indeterminada.`
      }
      issues.push({ code: 'short-circuit', message, ids: [c.id] })
      continue
    }
    if (!uf.union(a, b)) {
      const ids = [...pathBetween(adjacency, a, b), c.id]
      const withInductor = branches.some((k) => k.c.kind === 'inductor' && ids.includes(k.c.id))
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

const fail = (issues: CircuitIssue[]): DCResult => ({ ok: false, issues })

export function solveCircuit(circuit: Circuit, mode: SolveMode): DCResult {
  const invalid = validateCircuit(circuit)
  if (invalid.length) return fail(invalid)

  const nets = buildNetlist(circuit)
  const vertexOf = (id: string, t: number) => nets.vertexOf.get(terminalKey(id, t))!
  const netOf = (id: string, t: number) => nets.netOfVertex[vertexOf(id, t)]
  const time = mode.time ?? 0

  const opamps = circuit.components.filter((c) => c.kind === 'opamp')
  const digital = circuit.components.filter(isDigital)
  if ((opamps.length || digital.length) && nets.groundNet === null) {
    return fail([{
      code: 'needs-ground',
      message: 'Los op-amps y los componentes digitales necesitan GND: sus voltajes se miden respecto a tierra (ahí se conecta su alimentación).',
      ids: [...opamps, ...digital].map((c) => c.id),
    }])
  }
  const groundNet = nets.groundNet!

  // Una bobina puenteada por un cable en DC no lleva corriente definida ni hace daño: se ignora.
  const branches: Branch[] = [
    ...circuit.components
      .filter((c) => isVoltageLike(c, mode) && !(c.kind === 'inductor' && netOf(c.id, 0) === netOf(c.id, 1)))
      .map((c) => ({ c, a: netOf(c.id, 0), b: netOf(c.id, 1) })),
    ...opamps.map((c) => ({ c, a: netOf(c.id, 2), b: nets.groundNet! })),
  ]
  const isBranch = new Set(branches.map((br) => br.c.id))

  const loops = findSourceLoops(branches, nets.netCount)
  if (loops.length) return fail(loops)

  // Partes conectadas por caminos. Cada una necesita su propio nodo de
  // referencia; la que contiene GND usa GND.
  const islands = new UnionFind()
  for (let i = 0; i < nets.netCount; i++) islands.add()
  for (const c of circuit.components) {
    for (const [s, t] of conductivePairs(c, mode)) islands.union(netOf(c.id, s), netOf(c.id, t))
  }
  for (const br of branches) islands.union(br.a, br.b)
  for (const c of digital) {
    for (let t = 0; t < TERMINAL_COUNT[c.kind]; t++) islands.union(netOf(c.id, t), groundNet)
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
  if (issues.length) return fail(issues)

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
  for (const br of branches) branchOf.set(br.c.id, size++)
  const state = mode.kind === 'transient' ? mode.state : {}
  const companionG = (c: CircuitComponent): number =>
    mode.kind !== 'transient' ? 0
      : c.kind === 'capacitor' ? c.capacitance / mode.dt
      : c.kind === 'inductor' ? mode.dt / c.inductance
      : 0

  // ─── Parte lineal ──────────────────────────────────────────────────────────
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

  for (const br of branches) {
    const k = branchOf.get(br.c.id)!
    const ia = unknownOfNet[br.a]
    const ib = unknownOfNet[br.b]
    // La corriente de la rama sale del net a hacia el componente y vuelve por b.
    if (ia >= 0) A.add(ia, k, 1)
    if (ib >= 0) A.add(ib, k, -1)
    if (br.c.kind === 'opamp') continue // su ecuación de rama es no lineal: se arma en Newton
    if (ia >= 0) A.add(k, ia, 1)
    if (ib >= 0) A.add(k, ib, -1)
    z[k] = br.c.kind === 'voltage-source' ? br.c.voltage : br.c.kind === 'ac-source' ? acValue(br.c, time) : 0
  }

  for (const c of circuit.components) {
    if (isBranch.has(c.id) || TERMINAL_COUNT[c.kind] !== 2) continue
    const a = netOf(c.id, 0)
    const b = netOf(c.id, 1)
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
        break // switch y voltímetro: abiertos; diodos: no lineales (abajo)
    }
  }

  // Digital: entradas = G_IN a GND; salidas = fuente de nivel·VDD con R_OUT (equivalente de Norton).
  const logic = mode.logic ?? {}
  const levels = new Map<string, number[]>()
  for (const c of digital) {
    const { inputs, outputs } = digitalPins(c)
    const lv = outputLevels(c, logic, time)
    levels.set(c.id, lv)
    for (const t of inputs) stampConductance(netOf(c.id, t), groundNet, G_IN)
    outputs.forEach((t, k) => {
      stampConductance(netOf(c.id, t), groundNet, 1 / R_OUT)
      stampSource(netOf(c.id, t), groundNet, (lv[k] * VDD) / R_OUT)
    })
  }

  // ─── Parte no lineal: Newton-Raphson ───────────────────────────────────────
  interface Device { id: string; m: DeviceModel; nets: number[] }
  const devices: Device[] = []
  for (const c of circuit.components) {
    const m = deviceModel(c)
    if (m) devices.push({ id: c.id, m, nets: Array.from({ length: TERMINAL_COUNT[c.kind] }, (_, t) => netOf(c.id, t)) })
  }
  const ctrl = new Map(devices.map((d) => [d.id, d.m.initial.map((v, k) => mode.guess?.[`${d.id}#${k}`] ?? v)]))
  const opDiff = new Map(opamps.map((c) => [c.id, mode.guess?.[`${c.id}#0`] ?? 0]))
  const nonlinear = devices.length + opamps.length > 0

  const nodeV = (sol: Float64Array, n: number) => (unknownOfNet[n] >= 0 ? sol[unknownOfNet[n]] : 0)
  const ctrlOf = (d: Device, sol: Float64Array) => {
    const v = d.nets.map((n) => nodeV(sol, n))
    return d.m.C.map((row) => row.reduce((s, cij, j) => s + cij * v[j], 0))
  }
  // Convergencia como en SPICE: el voltaje de control dejó de cambiar (1 µV +
  // 10⁻⁵ relativo) o, si no, la corriente del dispositivo (1 pA + 10⁻⁵). Lo
  // segundo hace falta cuando un nodo cuelga solo de diodos apagados: su
  // voltaje queda mal condicionado y vibra al nivel del redondeo, pero la
  // corriente que eso produce es despreciable.
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 + 1e-5 * Math.abs(b)
  const closeI = (a: number, b: number) => Math.abs(a - b) <= 1e-12 + 1e-5 * Math.abs(b)

  let x: Float64Array | null = null
  let converged = !nonlinear
  for (let iter = 0; iter < (nonlinear ? MAX_NEWTON : 1); iter++) {
    let Ak = A
    let zk = z
    if (nonlinear) {
      Ak = cloneMatrix(A)
      zk = Float64Array.from(z)
      // I ≈ I₀ + D·(ctrl − ctrl₀) con ctrl = C·v  →  G = D·C,  fuente I₀ − D·ctrl₀
      for (const d of devices) {
        const c0 = ctrl.get(d.id)!
        const { I, D } = d.m.evaluate(c0)
        for (let i = 0; i < d.nets.length; i++) {
          const row = unknownOfNet[d.nets[i]]
          if (row < 0) continue
          for (let j = 0; j < d.nets.length; j++) {
            const col = unknownOfNet[d.nets[j]]
            if (col < 0) continue
            let g = 0
            for (let k = 0; k < c0.length; k++) g += D[i][k] * d.m.C[k][j]
            Ak.add(row, col, g)
          }
          let constant = I[i]
          for (let k = 0; k < c0.length; k++) constant -= D[i][k] * c0[k]
          zk[row] -= constant
        }
      }
      // Op-amp: V_salida = f(V+ − V−) ≈ f(vd₀) + f'(vd₀)·(vd − vd₀)
      for (const c of opamps) {
        if (c.kind !== 'opamp') continue
        const k = branchOf.get(c.id)!
        const vd0 = opDiff.get(c.id)!
        const { v, dv } = opampOutput(c.saturation, vd0)
        const [p, n, out] = [netOf(c.id, 0), netOf(c.id, 1), netOf(c.id, 2)]
        if (unknownOfNet[out] >= 0) Ak.add(k, unknownOfNet[out], 1)
        if (unknownOfNet[p] >= 0) Ak.add(k, unknownOfNet[p], -dv)
        if (unknownOfNet[n] >= 0) Ak.add(k, unknownOfNet[n], dv)
        zk[k] = v - dv * vd0
      }
    }
    x = size > 0 ? solveLinear(Ak, zk) : new Float64Array(0)
    if (!x || !nonlinear) break
    converged = true
    for (const d of devices) {
      const old = ctrl.get(d.id)!
      const next = ctrlOf(d, x)
      if (next.some((v, k) => !close(v, old[k]))) {
        const iOld = d.m.evaluate(old).I
        const iNew = d.m.evaluate(next).I
        if (iNew.some((i, t) => !closeI(i, iOld[t]))) converged = false
      }
      ctrl.set(d.id, d.m.limit(next, old))
    }
    for (const c of opamps) {
      if (c.kind !== 'opamp') continue
      const old = opDiff.get(c.id)!
      const next = nodeV(x, netOf(c.id, 0)) - nodeV(x, netOf(c.id, 1))
      // Se compara la salida: V+ − V− es diminuto (la ganancia es 10⁵).
      if (!close(opampOutput(c.saturation, next).v, opampOutput(c.saturation, old).v)) converged = false
      opDiff.set(c.id, next)
    }
    if (converged) break
  }
  if (!x) return fail([{ code: 'singular', message: 'No se pudo resolver el circuito (sistema singular).', ids: [] }])
  if (!converged) {
    return fail([{
      code: 'no-convergence',
      message: 'No se encontró un punto de operación estable para los diodos, transistores u op-amps. Revisa sus conexiones.',
      ids: [...devices.map((d) => d.id), ...opamps.map((c) => c.id)],
    }])
  }

  const netVoltages = unknownOfNet.map((u) => (u >= 0 ? x[u] : 0))
  const guess: DiodeGuess = {}

  // ─── Estado de los componentes (convención pasiva) ─────────────────────────
  const components: Record<string, ComponentState> = {}
  const terminalNets: Record<string, number[]> = {}
  const deviceById = new Map(devices.map((d) => [d.id, d]))
  for (const c of circuit.components) {
    const tn = Array.from({ length: TERMINAL_COUNT[c.kind] }, (_, t) => netOf(c.id, t))
    terminalNets[c.id] = tn
    if (c.kind === 'ground') continue
    const vt = tn.map((n) => netVoltages[n])

    const device = deviceById.get(c.id)
    if (device) {
      const cv = ctrlOf(device, x)
      cv.forEach((v, k) => (guess[`${c.id}#${k}`] = v))
      const I = device.m.evaluate(cv).I
      // 2 terminales: V(0) − V(1) e I(0→1). Transistores: V_CE / V_DS e I_C / I_D.
      const voltage = tn.length === 2 ? vt[0] - vt[1] : vt[0] - vt[2]
      components[c.id] = { voltage, current: I[0], power: vt.reduce((s, v, t) => s + v * I[t], 0), terminalCurrents: I }
      continue
    }
    if (isDigital(c)) {
      const { inputs, outputs } = digitalPins(c)
      const lv = levels.get(c.id)!
      const tc = new Array(tn.length).fill(0)
      for (const t of inputs) tc[t] = vt[t] * G_IN
      outputs.forEach((t, k) => (tc[t] = (vt[t] - lv[k] * VDD) / R_OUT))
      const main = outputs[0] ?? inputs[0]
      components[c.id] = {
        voltage: vt[main],
        current: outputs.length ? -tc[main] : tc[main],
        power: vt.reduce((s, v, t) => s + v * tc[t], 0),
        terminalCurrents: tc,
      }
      continue
    }
    if (c.kind === 'opamp') {
      const iOut = x[branchOf.get(c.id)!] // entra a la salida desde el circuito
      guess[`${c.id}#0`] = vt[0] - vt[1]
      components[c.id] = { voltage: vt[2], current: -iOut, power: vt[2] * iOut, terminalCurrents: [0, 0, iOut] }
      continue
    }

    const voltage = vt[0] - vt[1]
    let current = 0
    if (isBranch.has(c.id)) current = x[branchOf.get(c.id)!]
    else if (c.kind === 'resistor') current = voltage / c.resistance
    else if (c.kind === 'current-source') current = -c.current
    else if (c.kind === 'capacitor' && mode.kind === 'transient') current = companionG(c) * (voltage - (state[c.id] ?? 0))
    else if (c.kind === 'inductor' && mode.kind === 'transient') current = companionG(c) * voltage + (state[c.id] ?? 0)
    components[c.id] = { voltage, current, power: voltage * current, terminalCurrents: [current, -current] }
  }

  // Corrientes en cables, switches cerrados y GND.
  const idealCurrents = solveIdealEdgeCurrents(circuit, nets, vertexOf, components)
  const wireCurrents: Record<string, number> = {}
  for (const w of circuit.wires) wireCurrents[w.id] = idealCurrents.get(w.id) ?? 0
  for (const c of circuit.components) {
    if (c.kind === 'switch' || c.kind === 'ground') {
      const current = idealCurrents.get(c.id) ?? 0
      const voltage = c.kind === 'ground' ? 0 : components[c.id].voltage
      components[c.id] = {
        voltage, current, power: voltage * current,
        terminalCurrents: c.kind === 'ground' ? [current] : [current, -current],
      }
    }
  }

  const junctionNets: Record<string, number> = {}
  for (const w of circuit.wires) {
    for (const e of [w.a, w.b]) {
      if ('junction' in e) junctionNets[e.junction] = nets.netOfVertex[nets.vertexOf.get(endpointKey(e))!]
    }
  }

  return {
    ok: true, netVoltages, terminalNets, junctionNets, components, wireCurrents, warnings,
    groundNet: nets.groundNet, guess,
  }
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
  // Corriente que cada componente empuja hacia el vértice de cada terminal.
  const injection = new Float64Array(nets.vertexCount)
  const groundVertex = nets.vertexOf.get(GROUND_KEY)
  for (const c of circuit.components) {
    if (c.kind === 'ground' || c.kind === 'switch') continue
    const tc = components[c.id].terminalCurrents
    tc.forEach((i, t) => (injection[vertexOf(c.id, t)] -= i))
    // La corriente de un op-amp o una compuerta vuelve por su alimentación, que está en GND.
    if (isGroundReferenced(c) && groundVertex !== undefined) injection[groundVertex] += tc.reduce((a, b) => a + b, 0)
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
