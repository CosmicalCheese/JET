import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveCircuit, solveDC } from './dc.ts'
import { simulate, transientStep } from './transient.ts'
import { nodeBalance } from './analysis.ts'
import type { Circuit, CircuitComponent, DCSolution, Endpoint, ReactiveState } from './types.ts'

const ep = (s: string): Endpoint => {
  const [component, terminal] = s.split('.')
  return { component, terminal: Number(terminal) }
}
const circuit = (components: CircuitComponent[], wires: [string, string][]): Circuit => ({
  components,
  wires: wires.map(([a, b], i) => ({ id: `w${i + 1}`, a: ep(a), b: ep(b) })),
})
function solved(c: Circuit, time?: number): DCSolution {
  const r = solveCircuit(c, { kind: 'dc', time })
  if (!r.ok) assert.fail(r.issues.map((i) => i.message).join(' | '))
  return r
}
const near = (x: number, expected: number, tol: number, label = '') =>
  assert.ok(Math.abs(x - expected) <= tol, `${label}: esperado ${expected} ± ${tol}, obtenido ${x}`)

const V = (id: string, voltage: number): CircuitComponent => ({ id, kind: 'voltage-source', voltage })
const R = (id: string, resistance: number): CircuitComponent => ({ id, kind: 'resistor', resistance })
const D = (id: string): CircuitComponent => ({ id, kind: 'diode' })
const AC = (id: string, amplitude: number, frequency: number): CircuitComponent =>
  ({ id, kind: 'ac-source', amplitude, frequency, offset: 0, phase: 0 })
const GND: CircuitComponent = { id: 'GND', kind: 'ground' }

/** Recorre un periodo completo y devuelve (min, max) de una función del resultado. */
function sweep(c: Circuit, f: number, read: (s: DCSolution) => number, periods = 1, warmup = 0) {
  const steps = 400
  const dt = 1 / f / steps
  let state: ReactiveState = {}
  let lo = Infinity
  let hi = -Infinity
  for (let k = 1; k <= steps * (periods + warmup); k++) {
    const step = transientStep(c, state, dt, k * dt)
    if (!step.result.ok) assert.fail(step.result.issues[0].message)
    state = step.state
    if (k > steps * warmup) {
      const v = read(step.result)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
  }
  return { lo, hi }
}

// ─── Fuente AC ───────────────────────────────────────────────────────────────

test('fuente AC: V(t) = A·sen(2πft), con offset y fase', () => {
  const src: CircuitComponent = { id: 'V1', kind: 'ac-source', amplitude: 10, frequency: 50, offset: 1, phase: 90 }
  const c = circuit([src, R('R1', 1000), GND], [['V1.0', 'R1.0'], ['R1.1', 'GND.0'], ['V1.1', 'GND.0']])
  near(solved(c, 0).components.R1.voltage, 11, 1e-9, 't=0 (fase 90° → cos)')
  near(solved(c, 1 / 100).components.R1.voltage, -9, 1e-9, 'medio periodo')
})

// ─── Rectificadores ──────────────────────────────────────────────────────────

test('media onda: la carga solo ve los semiciclos positivos, menos ~0.7 V', () => {
  const c = circuit([AC('V1', 10, 50), D('D1'), R('RL', 1000), GND],
    [['V1.0', 'D1.0'], ['D1.1', 'RL.0'], ['RL.1', 'GND.0'], ['V1.1', 'GND.0']])
  const { lo, hi } = sweep(c, 50, (s) => s.components.RL.voltage)
  near(hi, 9.3, 0.15, 'pico')
  assert.ok(lo > -1e-4, `nunca negativo, salvo la fuga del diodo (mín ${lo})`)
})

/** Puente de 4 diodos: la carga RL (con capacitor opcional) entre "+" y GND. */
function bridge(withCap: boolean): Circuit {
  const parts: CircuitComponent[] = [AC('V1', 10, 50), D('D1'), D('D2'), D('D3'), D('D4'), R('RL', 1000), GND]
  const wires: [string, string][] = [
    // a = V1.0, b = V1.1. D1: a→+, D2: b→+, D3: GND→a, D4: GND→b
    ['V1.0', 'D1.0'], ['V1.1', 'D2.0'], ['D1.1', 'RL.0'], ['D2.1', 'RL.0'],
    ['D3.1', 'V1.0'], ['D4.1', 'V1.1'], ['D3.0', 'GND.0'], ['D4.0', 'GND.0'], ['RL.1', 'GND.0'],
  ]
  if (withCap) {
    parts.push({ id: 'C1', kind: 'capacitor', capacitance: 470e-6 })
    wires.push(['C1.0', 'RL.0'], ['C1.1', 'GND.0'])
  }
  return circuit(parts, wires)
}

test('onda completa (puente): los dos semiciclos llegan positivos a la carga, menos 2 diodos', () => {
  const c = bridge(false)
  const { lo, hi } = sweep(c, 50, (s) => s.components.RL.voltage)
  near(hi, 10 - 1.4, 0.2, 'pico')
  assert.ok(lo > -1e-6, `nunca negativo (mín ${lo})`)
  // En el semiciclo negativo de la fuente también hay voltaje en la carga.
  const r = solveCircuit(c, { kind: 'dc', time: 0.015 }) // 3/4 de periodo: V1 = −10 V
  assert.ok(r.ok && r.components.RL.voltage > 8, 'semiciclo negativo rectificado')
})

test('puente con capacitor y pasos de tiempo muy cortos (como en el navegador)', () => {
  // Con S1 abierto el capacitor queda aislado; con dt diminuto vale C/dt ≈ 10⁵ S,
  // y los diodos apagados apenas 10⁻⁹ S. No debe confundirse con una matriz singular.
  const c = bridge(true)
  const { result } = simulate(c, {}, 1e-8, 200, 0.0166)
  assert.ok(result.ok, result.ok ? '' : result.issues[0].message)
})

test('filtro con capacitor: rizado pequeño tras unos ciclos', () => {
  const { lo, hi } = sweep(bridge(true), 50, (s) => s.components.RL.voltage, 1, 5)
  assert.ok(hi - lo < 0.5, `rizado ${hi - lo}`)
  assert.ok(lo > 7.5, `mínimo ${lo}`)
})

// ─── BJT ─────────────────────────────────────────────────────────────────────

/** Emisor común NPN: Vcc → Rc → C; Vb → Rb → B; E → GND. */
function commonEmitter(rb: number, vb: number, beta = 100): Circuit {
  return circuit(
    [V('VCC', 10), V('VB', vb), R('RC', 1000), R('RB', rb), { id: 'Q1', kind: 'bjt', polarity: 'npn', beta }, GND],
    [['VCC.0', 'RC.0'], ['RC.1', 'Q1.0'], ['VB.0', 'RB.0'], ['RB.1', 'Q1.1'], ['Q1.2', 'GND.0'],
      ['VCC.1', 'GND.0'], ['VB.1', 'GND.0']],
  )
}

test('BJT en zona activa: Ic = β·Ib', () => {
  const s = solved(commonEmitter(100e3, 5))
  const [ic, ib, ie] = s.components.Q1.terminalCurrents
  near(ic / ib, 100, 2, 'β')
  near(ib, (5 - 0.7) / 100e3, 3e-6, 'Ib')
  near(ic + ib + ie, 0, 1e-12, 'Kirchhoff en el transistor')
  assert.ok(s.components.Q1.voltage > 1, `V_CE = ${s.components.Q1.voltage} (activa)`)
})

test('BJT saturado: V_CE ≈ 0.1 V, trabaja como interruptor cerrado', () => {
  const s = solved(commonEmitter(10e3, 5))
  assert.ok(s.components.Q1.voltage < 0.3, `V_CE = ${s.components.Q1.voltage}`)
  near(s.components.RC.current, 0.01, 0.0005, 'Ic ≈ Vcc/Rc')
})

test('BJT en corte: sin corriente de base no hay corriente de colector', () => {
  const s = solved(commonEmitter(10e3, 0))
  assert.ok(Math.abs(s.components.Q1.current) < 1e-7)
  near(s.components.Q1.voltage, 10, 1e-4, 'V_CE = Vcc')
})

test('BJT PNP: el espejo del NPN', () => {
  // Emisor a +10 V, base a GND por 100 kΩ, colector a GND por 500 Ω.
  const c = circuit(
    [V('VCC', 10), R('RB', 100e3), R('RC', 500), { id: 'Q1', kind: 'bjt', polarity: 'pnp', beta: 100 }, GND],
    [['VCC.0', 'Q1.2'], ['Q1.1', 'RB.0'], ['RB.1', 'GND.0'], ['Q1.0', 'RC.0'], ['RC.1', 'GND.0'], ['VCC.1', 'GND.0']],
  )
  const s = solved(c)
  const [ic, ib] = s.components.Q1.terminalCurrents
  assert.ok(ic < 0 && ib < 0, 'en un PNP la corriente sale por colector y base')
  near(ic / ib, 100, 2, 'β')
})

// ─── MOSFET ──────────────────────────────────────────────────────────────────

function nmos(vgs: number, rd: number): Circuit {
  return circuit(
    [V('VDD', 10), V('VG', vgs), R('RD', rd), { id: 'M1', kind: 'mosfet', polarity: 'n', threshold: 2, k: 0.1 }, GND],
    [['VDD.0', 'RD.0'], ['RD.1', 'M1.0'], ['VG.0', 'M1.1'], ['M1.2', 'GND.0'], ['VDD.1', 'GND.0'], ['VG.1', 'GND.0']],
  )
}

test('MOSFET en saturación: Id = k/2·(Vgs − Vth)²·(1 + λVds)', () => {
  const s = solved(nmos(3, 100))
  // Id = 0.05·(1 + 0.01·Vds) con Vds = 10 − 100·Id  →  Id = 0.055/1.05
  near(s.components.M1.current, 0.055 / 1.05, 1e-7, 'Id')
  near(s.components.M1.terminalCurrents[1], 0, 0, 'la compuerta no toma corriente')
})

test('MOSFET en corte (Vgs < Vth) y como interruptor cerrado (Vgs alto)', () => {
  assert.ok(Math.abs(solved(nmos(1, 1000)).components.M1.current) < 1e-7)
  const on = solved(nmos(10, 1000))
  assert.ok(on.components.M1.voltage < 0.05, `V_DS = ${on.components.M1.voltage} (zona óhmica)`)
})

test('MOSFET canal P: conduce con la compuerta por debajo de la fuente', () => {
  const c = circuit(
    [V('VDD', 10), V('VG', 6), R('RD', 100), { id: 'M1', kind: 'mosfet', polarity: 'p', threshold: 2, k: 0.1 }, GND],
    [['VDD.0', 'M1.2'], ['VG.0', 'M1.1'], ['M1.0', 'RD.0'], ['RD.1', 'GND.0'], ['VDD.1', 'GND.0'], ['VG.1', 'GND.0']],
  )
  const s = solved(c)
  // Vsg = 4 V, Vov = 2 V → Id ≈ k/2·4 = 0.2 A pero Rd lo limita: zona óhmica con Vd cerca de 10 V.
  assert.ok(s.components.RD.voltage > 9, `V_RD = ${s.components.RD.voltage}`)
  assert.ok(s.components.M1.current < 0, 'en canal P la corriente sale por el drenador')
})

// ─── Op-amp ──────────────────────────────────────────────────────────────────

const OA = (id: string, saturation = 15): CircuitComponent => ({ id, kind: 'opamp', saturation })

/** Inversor: Vin → Rin → (−); Rf de (−) a salida; (+) a GND. */
function inverting(vin: CircuitComponent, rin = 1000, rf = 10e3): Circuit {
  return circuit(
    [vin, R('RIN', rin), R('RF', rf), OA('U1'), R('RL', 10e3), GND],
    [['V1.0', 'RIN.0'], ['RIN.1', 'U1.1'], ['RF.0', 'U1.1'], ['RF.1', 'U1.2'], ['U1.0', 'GND.0'],
      ['U1.2', 'RL.0'], ['RL.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
}

test('op-amp inversor: Vout = −(Rf/Rin)·Vin', () => {
  const s = solved(inverting(V('V1', 0.5)))
  near(s.components.U1.voltage, -5, 1e-3, 'Vout')
  near(s.netVoltages[s.terminalNets.U1[1]], 0, 1e-3, 'tierra virtual en (−)')
})

test('op-amp no inversor (1 + Rf/Rg) y seguidor', () => {
  const ni = circuit(
    [V('V1', 0.3), OA('U1'), R('RF', 9000), R('RG', 1000), GND],
    [['V1.0', 'U1.0'], ['U1.1', 'RF.0'], ['RF.1', 'U1.2'], ['U1.1', 'RG.0'], ['RG.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  near(solved(ni).components.U1.voltage, 3, 1e-3, 'ganancia 10')
  const follower = circuit(
    [V('V1', 2.5), OA('U1'), R('RL', 100), GND],
    [['V1.0', 'U1.0'], ['U1.1', 'U1.2'], ['U1.2', 'RL.0'], ['RL.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  const s = solved(follower)
  near(s.components.U1.voltage, 2.5, 1e-3, 'seguidor')
  near(s.components.U1.current, 0.025, 1e-4, 'la salida entrega la corriente de la carga')
})

test('op-amp sin retroalimentación: comparador que se satura', () => {
  const c = circuit(
    [V('V1', 1), OA('U1', 12), R('RL', 10e3), GND],
    [['V1.0', 'U1.0'], ['U1.1', 'GND.0'], ['U1.2', 'RL.0'], ['RL.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  near(solved(c).components.U1.voltage, 12, 1e-6, 'satura en +12 V')
})

test('op-amp: Kirchhoff se cumple en todos los nodos (la salida usa la alimentación)', () => {
  const c = inverting(V('V1', 0.5))
  const s = solved(c)
  for (let net = 0; net < s.netVoltages.length; net++) {
    const b = nodeBalance(c, s, net)
    near(b.entering, b.leaving, 1e-9, `net ${net}`)
  }
})

test('op-amp sin GND → error claro', () => {
  const c = circuit([V('V1', 1), OA('U1'), R('RL', 1000)], [['V1.0', 'U1.0'], ['U1.1', 'U1.2'], ['U1.2', 'RL.0'], ['RL.1', 'V1.1']])
  const r = solveDC(c)
  assert.equal(r.ok, false)
  assert.ok(!r.ok && r.issues[0].code === 'needs-ground')
})

test('op-amp inversor con entrada AC: la salida es la senoide invertida ×10', () => {
  const c = inverting(AC('V1', 0.5, 100))
  const { result } = simulate(c, {}, 1e-5, 250) // t = 2.5 ms = 1/4 de periodo: Vin = +0.5
  assert.ok(result.ok)
  near(result.components.U1.voltage, -5, 0.01, 'Vout en el pico')
})

// ─── Ejemplos del editor ─────────────────────────────────────────────────────

test('ejemplos de la etapa 4: resuelven y hacen lo que dicen', async () => {
  const { EXAMPLES } = await import('../editor/examples.ts')
  const { toCircuit } = await import('../editor/model.ts')
  const build = (id: string, edit?: (doc: ReturnType<(typeof EXAMPLES)[number]['build']>) => void) => {
    const doc = EXAMPLES.find((e) => e.id === id)!.build()
    edit?.(doc)
    return toCircuit(doc).circuit
  }
  const close = (doc: Parameters<NonNullable<Parameters<typeof build>[1]>>[0], id: string) => {
    const s = doc.components.find((c) => c.id === id)
    if (s?.kind === 'switch') s.closed = true
  }

  // Media onda: pico ≈ 9.3 V a los 1/4 de periodo de 60 Hz.
  near(solved(build('media-onda'), 1 / 240).components.RL.voltage, 9.3, 0.15, 'media onda')
  // Puente: en el semiciclo negativo también llega voltaje positivo.
  assert.ok(solved(build('onda-completa'), 3 / 240).components.RL.voltage > 10)

  // Interruptores con transistor: LED apagado con S1 abierto, encendido con S1 cerrado.
  for (const id of ['bjt', 'mosfet']) {
    const off = solved(build(id))
    const on = solved(build(id, (doc) => close(doc, 'S1')))
    assert.ok(off.components.LED1.current < 1e-6, `${id} apagado`)
    assert.ok(on.components.LED1.current > 0.015, `${id} encendido: ${on.components.LED1.current}`)
  }

  // Inversor: en el pico de la entrada (+0.5 V) la salida es −5 V.
  near(solved(build('inversor'), 1 / 400).components.U1.voltage, -5, 0.01, 'inversor')
})
