import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from './dc.ts'
import { simulate, transientStep } from './transient.ts'
import { firstOrder } from './analysis.ts'
import type { Circuit, CircuitComponent, Endpoint } from './types.ts'
import { toCircuit } from '../editor/model.ts'
import { EXAMPLES } from '../editor/examples.ts'

const near = (actual: number, expected: number, rel: number, label = '') =>
  assert.ok(Math.abs(actual - expected) <= rel * Math.max(1e-12, Math.abs(expected)), `${label} esperado ≈${expected}, obtenido ${actual}`)

const ep = (s: string): Endpoint => {
  const [component, terminal] = s.split('.')
  return { component, terminal: Number(terminal) }
}
const circuit = (components: CircuitComponent[], wires: [string, string][]): Circuit => ({
  components,
  wires: wires.map(([a, b], i) => ({ id: `w${i + 1}`, a: ep(a), b: ep(b) })),
})

/** Batería V → R → elemento X → GND. */
function seriesWith(V: number, R: number, x: CircuitComponent): Circuit {
  return circuit(
    [{ id: 'V1', kind: 'voltage-source', voltage: V }, { id: 'R1', kind: 'resistor', resistance: R }, x, { id: 'GND', kind: 'ground' }],
    [['V1.0', 'R1.0'], ['R1.1', `${x.id}.0`], [`${x.id}.1`, 'GND.0'], ['V1.1', 'GND.0']],
  )
}

test('RC: tras una constante de tiempo el capacitor llega al 63.2 %', () => {
  const c = seriesWith(10, 1000, { id: 'C1', kind: 'capacitor', capacitance: 100e-6 })
  const tau = 0.1
  const steps = 2000
  const { result, state } = simulate(c, {}, tau / steps, steps)
  // V_C(τ) = V(1 − e⁻¹). Euler implícito con dt = τ/2000 queda a < 0.1 %.
  near(state.C1, 10 * (1 - Math.exp(-1)), 1e-3, 'V_C(τ)')
  assert.ok(result.ok)
  near(result.components.C1.current, 0.01 * Math.exp(-1), 2e-3, 'i_C(τ)')
})

test('RC: al final se carga al voltaje de la batería y la corriente se apaga', () => {
  const c = seriesWith(10, 1000, { id: 'C1', kind: 'capacitor', capacitance: 100e-6 })
  const { result, state } = simulate(c, {}, 1e-3, 1000) // 10 τ
  near(state.C1, 10, 1e-4)
  assert.ok(result.ok)
  assert.ok(Math.abs(result.components.C1.current) < 1e-6)
})

test('RL: la corriente sube hacia V/R con τ = L/R', () => {
  const c = seriesWith(10, 100, { id: 'L1', kind: 'inductor', inductance: 1 })
  const tau = 0.01
  const { state } = simulate(c, {}, tau / 2000, 2000)
  near(state.L1, 0.1 * (1 - Math.exp(-1)), 1e-3, 'I_L(τ)')
})

test('el estado inicial cuenta: un capacitor cargado se descarga por la resistencia', () => {
  const c = circuit(
    [{ id: 'C1', kind: 'capacitor', capacitance: 1e-3 }, { id: 'R1', kind: 'resistor', resistance: 100 }, { id: 'GND', kind: 'ground' }],
    [['C1.0', 'R1.0'], ['R1.1', 'GND.0'], ['C1.1', 'GND.0']],
  )
  const first = transientStep(c, { C1: 5 }, 1e-6)
  assert.ok(first.result.ok)
  // Justo después: la corriente sale del + del capacitor por R1: 5 V / 100 Ω.
  near(first.result.components.R1.current, 0.05, 1e-3)
  const { state } = simulate(c, { C1: 5 }, 0.1 / 2000, 2000) // τ = 0.1 s
  near(state.C1, 5 * Math.exp(-1), 1e-3)
})

test('en DC el capacitor es abierto y la bobina un cable', () => {
  const rc = solveDC(seriesWith(10, 1000, { id: 'C1', kind: 'capacitor', capacitance: 1e-6 }))
  assert.ok(rc.ok)
  near(rc.components.C1.voltage, 10, 1e-12)
  assert.equal(rc.components.C1.current, 0)
  const rl = solveDC(seriesWith(10, 100, { id: 'L1', kind: 'inductor', inductance: 1 }))
  assert.ok(rl.ok)
  near(rl.components.L1.current, 0.1, 1e-12)
  near(rl.components.L1.voltage, 0, 1e-12)
})

test('una bobina directo sobre la batería es un corto en régimen permanente', () => {
  const c = circuit(
    [{ id: 'V1', kind: 'voltage-source', voltage: 5 }, { id: 'L1', kind: 'inductor', inductance: 1 }, { id: 'GND', kind: 'ground' }],
    [['V1.0', 'L1.0'], ['L1.1', 'V1.1'], ['V1.1', 'GND.0']],
  )
  const dc = solveDC(c)
  assert.equal(dc.ok, false)
  // En el tiempo sí se puede simular: la corriente crece en rampa, I = V·t/L.
  const { state } = simulate(c, {}, 1e-3, 100)
  near(state.L1, 5 * 0.1, 1e-9)
})

test('primer orden: τ y valor final del ejemplo RC (S1 cerrado, S2 abierto)', () => {
  const { circuit: c } = toCircuit(EXAMPLES.find((e) => e.id === 'rc')!.build())
  const fo = firstOrder(c, 'C1')
  assert.ok(fo)
  near(fo.rth, 1000, 1e-9)
  near(fo.tau, 0.1, 1e-9)
  near(fo.final, 10, 1e-9)
})

test('primer orden: con un divisor, R_th es el paralelo y V_final el del divisor', () => {
  // 12 V → R1 = 1k → nodo → (R2 = 2k ∥ C) → GND
  const c = circuit(
    [
      { id: 'V1', kind: 'voltage-source', voltage: 12 },
      { id: 'R1', kind: 'resistor', resistance: 1000 },
      { id: 'R2', kind: 'resistor', resistance: 2000 },
      { id: 'C1', kind: 'capacitor', capacitance: 1e-6 },
      { id: 'GND', kind: 'ground' },
    ],
    [['V1.0', 'R1.0'], ['R1.1', 'R2.0'], ['R1.1', 'C1.0'], ['R2.1', 'GND.0'], ['C1.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  const fo = firstOrder(c, 'C1')
  assert.ok(fo)
  near(fo.rth, 2000 / 3, 1e-9)
  near(fo.tau, (2000 / 3) * 1e-6, 1e-9)
  near(fo.final, 8, 1e-9)
})

test('primer orden: sin camino de carga, τ es infinita', () => {
  const doc = EXAMPLES.find((e) => e.id === 'rc')!.build()
  const S1 = doc.components.find((k) => k.id === 'S1')!
  if (S1.kind === 'switch') S1.closed = false
  const fo = firstOrder(toCircuit(doc).circuit, 'C1')
  assert.ok(fo)
  assert.equal(fo.tau, Infinity)
})

test('ejemplo RL: con S1 cerrado R_th = R1 ∥ R2 y la corriente final es V/R1', () => {
  const { circuit: c } = toCircuit(EXAMPLES.find((e) => e.id === 'rl')!.build())
  const fo = firstOrder(c, 'L1')
  assert.ok(fo)
  // R_th = R1 ∥ R2 = 100 ∥ 1000
  near(fo.rth, (100 * 1000) / 1100, 1e-9)
  near(fo.final, 0.1, 1e-9)
})
