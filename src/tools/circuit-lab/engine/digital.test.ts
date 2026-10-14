import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from './dc.ts'
import { simulate, transientStep } from './transient.ts'
import { nodeBalance } from './analysis.ts'
import type { Circuit, CircuitComponent, DCSolution, Endpoint, GateOp, ReactiveState } from './types.ts'

const ep = (s: string): Endpoint => {
  const [component, terminal] = s.split('.')
  return { component, terminal: Number(terminal) }
}
const circuit = (components: CircuitComponent[], wires: [string, string][]): Circuit => ({
  components,
  wires: wires.map(([a, b], i) => ({ id: `w${i + 1}`, a: ep(a), b: ep(b) })),
})
const GND: CircuitComponent = { id: 'GND', kind: 'ground' }
const IN = (id: string, high: boolean): CircuitComponent => ({ id, kind: 'logic-input', high })
const PROBE = (id: string): CircuitComponent => ({ id, kind: 'probe' })

/** Corre unos pasos para que la lógica se propague y devuelve el último resultado. */
function settle(c: Circuit, steps = 10): DCSolution {
  const { result } = simulate(c, {}, 1e-3, steps)
  if (!result.ok) assert.fail(result.issues.map((i) => i.message).join(' | '))
  return result
}
const level = (s: DCSolution, id: string) => (s.components[id].voltage > 2.5 ? 1 : 0)

test('tablas de verdad de las seis compuertas', () => {
  const expected: Record<GateOp, number[]> = {
    and: [0, 0, 0, 1], or: [0, 1, 1, 1], xor: [0, 1, 1, 0],
    nand: [1, 1, 1, 0], nor: [1, 0, 0, 0], xnor: [1, 0, 0, 1],
  }
  for (const op of Object.keys(expected) as GateOp[]) {
    ;[[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([a, b], row) => {
      const c = circuit(
        [IN('A', !!a), IN('B', !!b), { id: 'G1', kind: 'gate', op }, PROBE('P1'), GND],
        [['A.0', 'G1.0'], ['B.0', 'G1.1'], ['G1.2', 'P1.0']],
      )
      assert.equal(level(settle(c), 'P1'), expected[op][row], `${op}(${a}, ${b})`)
    })
  }
})

test('inversor y niveles de voltaje: 0 V y 5 V en la salida', () => {
  const c = circuit([IN('A', false), { id: 'N1', kind: 'not' }, PROBE('P1'), GND], [['A.0', 'N1.0'], ['N1.1', 'P1.0']])
  const s = settle(c)
  assert.ok(Math.abs(s.components.P1.voltage - 5) < 1e-3, `${s.components.P1.voltage}`)
})

test('una entrada al aire lee 0', () => {
  const c = circuit([{ id: 'N1', kind: 'not' }, PROBE('P1'), GND], [['N1.1', 'P1.0']])
  assert.equal(level(settle(c), 'P1'), 1)
})

test('una salida lógica puede encender un LED con su resistencia', () => {
  const c = circuit(
    [IN('A', true), { id: 'R1', kind: 'resistor', resistance: 330 }, { id: 'LED1', kind: 'led', color: 'red' }, GND],
    [['A.0', 'R1.0'], ['R1.1', 'LED1.0'], ['LED1.1', 'GND.0']],
  )
  const s = settle(c, 2)
  // (5 − 1.9) / (330 + 25 de resistencia de salida) ≈ 8.7 mA
  assert.ok(Math.abs(s.components.LED1.current - 0.0087) < 0.0004, `${s.components.LED1.current}`)
})

test('reloj: onda cuadrada que empieza en 0 y cambia cada medio periodo', () => {
  const c = circuit([{ id: 'CLK', kind: 'clock', frequency: 10 }, PROBE('P1'), GND], [['CLK.0', 'P1.0']])
  let state: ReactiveState = {}
  const seen: number[] = []
  for (let k = 1; k <= 200; k++) {
    const r = transientStep(c, state, 1e-3, k * 1e-3)
    assert.ok(r.result.ok)
    state = r.state
    if (k % 25 === 0) seen.push(level(r.result, 'P1')) // cada 25 ms
  }
  assert.deepEqual(seen, [0, 1, 1, 0, 0, 1, 1, 0])
})

/** Contador de 2 bits con flip-flops D: cada uno se divide entre 2 con Q̄ → D. */
function counter(): Circuit {
  return circuit(
    [{ id: 'CLK', kind: 'clock', frequency: 10 }, { id: 'FF1', kind: 'dff' }, { id: 'FF2', kind: 'dff' }, GND],
    [['CLK.0', 'FF1.1'], ['FF1.3', 'FF1.0'], ['FF1.3', 'FF2.1'], ['FF2.3', 'FF2.0']],
  )
}

test('flip-flop D: el contador cuenta 0, 1, 2, 3, 0… en binario', () => {
  const c = counter()
  let state: ReactiveState = {}
  const counts: number[] = []
  const dt = 1e-3
  for (let k = 1; k <= 1000; k++) {
    const r = transientStep(c, state, dt, k * dt)
    assert.ok(r.result.ok)
    state = r.state
    // Muestra a mitad de cada periodo del reloj (t = 0.075, 0.175, …): justo después de cada flanco de subida.
    if ((k - 75) % 100 === 0 && k >= 75) counts.push(level(r.result, 'FF1') + 2 * level(r.result, 'FF2'))
  }
  assert.deepEqual(counts, [1, 2, 3, 0, 1, 2, 3, 0, 1, 2])
})

test('oscilador en anillo: tres inversores en lazo no se quedan quietos', () => {
  const c = circuit(
    [{ id: 'N1', kind: 'not' }, { id: 'N2', kind: 'not' }, { id: 'N3', kind: 'not' }, GND],
    [['N1.1', 'N2.0'], ['N2.1', 'N3.0'], ['N3.1', 'N1.0']],
  )
  let state: ReactiveState = {}
  const values = new Set<number>()
  for (let k = 1; k <= 20; k++) {
    const r = transientStep(c, state, 1e-6, k * 1e-6)
    assert.ok(r.result.ok)
    state = r.state
    values.add(level(r.result, 'N3'))
  }
  assert.equal(values.size, 2)
})

test('digital sin GND → error claro; Kirchhoff con la alimentación implícita', () => {
  const noGround = circuit([IN('A', true), PROBE('P1')], [['A.0', 'P1.0']])
  const r = solveDC(noGround)
  assert.ok(!r.ok && r.issues[0].code === 'needs-ground')

  const c = circuit(
    [IN('A', true), { id: 'R1', kind: 'resistor', resistance: 1000 }, GND],
    [['A.0', 'R1.0'], ['R1.1', 'GND.0']],
  )
  const s = settle(c, 2)
  for (let net = 0; net < s.netVoltages.length; net++) {
    const b = nodeBalance(c, s, net)
    assert.ok(Math.abs(b.entering - b.leaving) < 1e-12, `net ${net}`)
  }
})

test('ejemplos digitales del editor', async () => {
  const { EXAMPLES } = await import('../editor/examples.ts')
  const { toCircuit } = await import('../editor/model.ts')
  const build = (id: string, high: Record<string, boolean> = {}) => {
    const doc = EXAMPLES.find((e) => e.id === id)!.build()
    for (const c of doc.components) if (c.kind === 'logic-input' && c.id in high) c.high = high[c.id]
    return toCircuit(doc).circuit
  }
  // Compuertas: con A = 1, B = 0 → AND 0, OR 1, XOR 1.
  const g = settle(build('compuertas', { A: true }))
  assert.deepEqual(['P1', 'P2', 'P3'].map((p) => level(g, p)), [0, 1, 1])
  const g11 = settle(build('compuertas', { A: true, B: true }))
  assert.deepEqual(['P1', 'P2', 'P3'].map((p) => level(g11, p)), [1, 1, 0])

  // LED: con A = 0 el inversor da 5 V y el LED enciende; con A = 1 se apaga.
  assert.ok(settle(build('logica-led')).components.LED1.current > 0.005)
  assert.ok(settle(build('logica-led', { A: true })).components.LED1.current < 1e-6)

  // Contador: tras 3 flancos de subida (reloj de 1 Hz, t = 3.25 s) cuenta 3.
  const c = build('contador')
  let state: ReactiveState = {}
  let last: DCSolution | null = null
  for (let k = 1; k <= 3250; k++) {
    const r = transientStep(c, state, 1e-3, k * 1e-3)
    assert.ok(r.result.ok)
    state = r.state
    last = r.result
  }
  assert.equal(level(last!, 'P1') + 2 * level(last!, 'P2'), 3)
})
