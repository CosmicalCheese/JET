import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from './dc.ts'
import { simulate } from './transient.ts'
import { LED_VF } from './diode.ts'
import type { Circuit, CircuitComponent, DCSolution, Endpoint, LedColor } from './types.ts'

const ep = (s: string): Endpoint => {
  const [component, terminal] = s.split('.')
  return { component, terminal: Number(terminal) }
}
const circuit = (components: CircuitComponent[], wires: [string, string][]): Circuit => ({
  components,
  wires: wires.map(([a, b], i) => ({ id: `w${i + 1}`, a: ep(a), b: ep(b) })),
})
function solved(c: Circuit): DCSolution {
  const r = solveDC(c)
  if (!r.ok) assert.fail(r.issues.map((i) => i.message).join(' | '))
  return r
}
const between = (x: number, lo: number, hi: number, label: string) =>
  assert.ok(x >= lo && x <= hi, `${label}: ${x} fuera de [${lo}, ${hi}]`)

const V = (id: string, voltage: number): CircuitComponent => ({ id, kind: 'voltage-source', voltage })
const R = (id: string, resistance: number): CircuitComponent => ({ id, kind: 'resistor', resistance })
const GND: CircuitComponent = { id: 'GND', kind: 'ground' }

/** Fuente → R → elemento X (terminal 0 arriba) → GND. */
function series(volts: number, ohms: number, x: CircuitComponent, flip = false): Circuit {
  const [top, bottom] = flip ? [`${x.id}.1`, `${x.id}.0`] : [`${x.id}.0`, `${x.id}.1`]
  return circuit([V('V1', volts), R('R1', ohms), x, GND], [['V1.0', 'R1.0'], ['R1.1', top], [bottom, 'GND.0'], ['V1.1', 'GND.0']])
}

test('diodo en directa: ~0.7 V y el resto cae en la resistencia', () => {
  const s = solved(series(5, 1000, { id: 'D1', kind: 'diode' }))
  between(s.components.D1.voltage, 0.6, 0.75, 'V_D')
  // Kirchhoff de voltajes y misma corriente en serie, exactos tras converger.
  assert.ok(Math.abs(s.components.D1.voltage + s.components.R1.voltage - 5) < 1e-9)
  assert.ok(Math.abs(s.components.D1.current - s.components.R1.current) < 1e-9)
  between(s.components.D1.current, 4.25e-3, 4.4e-3, 'I_D')
})

test('diodo en inversa: bloquea (corriente prácticamente 0)', () => {
  const s = solved(series(5, 1000, { id: 'D1', kind: 'diode' }, true))
  assert.ok(Math.abs(s.components.D1.current) < 1e-9, `I = ${s.components.D1.current}`)
  assert.ok(Math.abs(s.components.D1.voltage + 5) < 1e-6, 'todo el voltaje queda en el diodo')
})

test('converge aunque el voltaje sea muy alto (limitación de pasos)', () => {
  const s = solved(series(1000, 1, { id: 'D1', kind: 'diode' }))
  between(s.components.D1.current, 998, 1000, 'I_D')
})

test('LED rojo con 9 V y 330 Ω: ~1.9 V y ~21 mA', () => {
  const s = solved(series(9, 330, { id: 'LED1', kind: 'led', color: 'red' }))
  between(s.components.LED1.voltage, 1.85, 1.95, 'V_f')
  between(s.components.LED1.current, 0.0210, 0.0218, 'I')
})

test('cada color de LED tiene su voltaje típico a 20 mA', () => {
  for (const color of Object.keys(LED_VF) as LedColor[]) {
    const s = solved(circuit(
      [{ id: 'I1', kind: 'current-source', current: 0.02 }, { id: 'LED1', kind: 'led', color }, GND],
      [['I1.0', 'LED1.0'], ['LED1.1', 'GND.0'], ['I1.1', 'GND.0']],
    ))
    assert.ok(Math.abs(s.components.LED1.voltage - LED_VF[color]) < 1e-6, `${color}: ${s.components.LED1.voltage}`)
  }
})

test('regulador Zener: la carga recibe ≈ Vz aunque la fuente sea mayor', () => {
  // 12 V → 470 Ω → nodo → Zener 5.1 V (cátodo arriba) ∥ carga 1 kΩ → GND
  const c = circuit(
    [V('V1', 12), R('R1', 470), { id: 'DZ1', kind: 'zener', zenerVoltage: 5.1 }, R('RL', 1000), GND],
    [['V1.0', 'R1.0'], ['R1.1', 'DZ1.1'], ['R1.1', 'RL.0'], ['DZ1.0', 'GND.0'], ['RL.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  const s = solved(c)
  between(s.components.RL.voltage, 4.95, 5.15, 'V_out')
  // El Zener absorbe lo que la carga no usa (corriente negativa: va de cátodo a ánodo).
  const iz = -s.components.DZ1.current
  between(iz, 0.009, 0.0102, 'I_Z')
})

test('Zener en directa se comporta como un diodo normal', () => {
  const s = solved(series(5, 1000, { id: 'DZ1', kind: 'zener', zenerVoltage: 5.1 }))
  between(s.components.DZ1.voltage, 0.6, 0.75, 'V_D')
})

test('Zener por debajo de Vz no conduce en inversa', () => {
  const s = solved(series(3, 1000, { id: 'DZ1', kind: 'zener', zenerVoltage: 5.1 }, true))
  assert.ok(Math.abs(s.components.DZ1.current) < 1e-6)
})

test('dos diodos iguales en paralelo se reparten la corriente', () => {
  const c = circuit(
    [V('V1', 5), R('R1', 100), { id: 'D1', kind: 'diode' }, { id: 'D2', kind: 'diode' }, GND],
    [['V1.0', 'R1.0'], ['R1.1', 'D1.0'], ['R1.1', 'D2.0'], ['D1.1', 'GND.0'], ['D2.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  const s = solved(c)
  assert.ok(Math.abs(s.components.D1.current - s.components.D2.current) < 1e-9)
})

test('diodo + capacitor en el tiempo: el capacitor se carga a través del diodo', () => {
  const c = circuit(
    [V('V1', 10), R('R1', 1000), { id: 'D1', kind: 'diode' }, { id: 'C1', kind: 'capacitor', capacitance: 1e-6 }, GND],
    [['V1.0', 'R1.0'], ['R1.1', 'D1.0'], ['D1.1', 'C1.0'], ['C1.1', 'GND.0'], ['V1.1', 'GND.0']],
  )
  const { result, state } = simulate(c, {}, 1e-5, 500) // 5 τ
  assert.ok(result.ok)
  // Se queda un poco por debajo de 10 V: el diodo necesita algo de voltaje para seguir conduciendo.
  between(state.C1, 9.3, 9.95, 'V_C')
})
