import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from '../engine/dc.ts'
import type { DCSolution } from '../engine/types.ts'
import { createComponent, replaceComponent, rotate, terminalPoints, toCircuit, type CircuitDoc } from './model.ts'
import { EXAMPLES } from './examples.ts'
import { formatSI, parseSI } from './units.ts'

const close = (actual: number, expected: number, label = '') =>
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label} esperado ${expected}, obtenido ${actual}`)

function solveDoc(doc: CircuitDoc): DCSolution {
  const result = solveDC(toCircuit(doc).circuit)
  if (!result.ok) assert.fail(result.issues.map((i) => i.message).join(' | '))
  return result
}

const example = (id: string) => EXAMPLES.find((e) => e.id === id)!.build()

test('rotación en pasos de 90°', () => {
  assert.deepEqual(rotate({ x: -2, y: 0 }, 1), { x: 0, y: -2 })
  assert.deepEqual(rotate({ x: -2, y: 0 }, 2), { x: 2, y: 0 })
  assert.deepEqual(rotate({ x: -2, y: 0 }, 3), { x: 0, y: 2 })
  const r = createComponent('resistor', 'R1', { x: 10, y: 0 }, 1)
  assert.deepEqual(terminalPoints(r), [{ x: 10, y: -2 }, { x: 10, y: 2 }])
})

test('ejemplo Ley de Ohm: 10 mA', () => {
  const s = solveDoc(example('ohm'))
  close(s.components.A1.current, 0.01)
  close(s.components.R1.voltage, 10)
})

test('ejemplo divisor: el voltímetro (conectado en T) lee 8 V', () => {
  const s = solveDoc(example('divisor'))
  close(s.components.VM1.voltage, 8)
  close(s.components.R1.current, 0.004)
})

test('ejemplo paralelo: 2 mA y 1 mA', () => {
  const s = solveDoc(example('paralelo'))
  close(s.components.A1.current, 0.002)
  close(s.components.A2.current, 0.001)
})

test('ejemplo interruptor: abierto no hay corriente', () => {
  const s = solveDoc(example('switch'))
  close(s.components.A1.current, 0)
})

test('todos los ejemplos resuelven sin avisos', () => {
  for (const e of EXAMPLES) assert.deepEqual(solveDoc(e.build()).warnings, [], e.id)
})

test('un cable que pasa junto a un terminal sin terminar en él sí conecta (cae sobre el cable)', () => {
  // R1 horizontal en (0,0): terminales (-2,0) y (2,0). Un cable de (2,-3) a (2,3) pasa por (2,0).
  const doc: CircuitDoc = {
    version: 1,
    components: [createComponent('resistor', 'R1', { x: 0, y: 0 })],
    wires: [{ id: 'w1', x1: 2, y1: -3, x2: 2, y2: 3 }],
  }
  const { circuit, pieces } = toCircuit(doc)
  assert.equal(pieces.size, 2, 'el cable se parte en el terminal')
  assert.ok(circuit.wires.some((w) => w.id === 'R1:1'))
})

test('componentes que se tocan directamente quedan conectados', () => {
  // Batería y resistencia en línea, compartiendo el punto (2,0); el otro extremo cerrado por cable.
  const V1 = createComponent('voltage-source', 'V1', { x: 0, y: 0 })
  const R1 = createComponent('resistor', 'R1', { x: 4, y: 0 })
  const doc: CircuitDoc = {
    version: 1,
    components: [V1, R1, createComponent('ground', 'GND1', { x: -2, y: 0 })],
    wires: [
      { id: 'w1', x1: 6, y1: 0, x2: 6, y2: 2 },
      { id: 'w2', x1: 6, y1: 2, x2: -2, y2: 2 },
      { id: 'w3', x1: -2, y1: 2, x2: -2, y2: 0 },
    ],
  }
  // El − de V1 toca el terminal 0 de R1, así que la corriente va de R1:1 a R1:0.
  close(solveDoc(doc).components.R1.current, -9 / 1000)
})

test('al mover o rotar un componente, los cables conectados lo siguen', () => {
  const doc = example('ohm')
  const R1 = doc.components.find((c) => c.id === 'R1')!
  const moved = replaceComponent(doc, { ...R1, x: R1.x + 2 })
  assert.ok(moved.wires.some((w) => w.x2 === 12 && w.y2 === -2), 'el cable superior llega al nuevo terminal')
  close(solveDoc(moved).components.A1.current, 0.01)
  const rotated = replaceComponent(doc, { ...R1, rot: 2 }) // un giro de 90° (tecla R)
  close(solveDoc(rotated).components.A1.current, 0.01)
})

test('unidades SI', () => {
  assert.equal(formatSI(0.004, 'A'), '4 mA')
  assert.equal(formatSI(4700, 'Ω'), '4.7 kΩ')
  assert.equal(formatSI(-0.01, 'W'), '-10 mW')
  assert.equal(formatSI(0, 'V'), '0 V')
  assert.equal(formatSI(999.99, 'Ω'), '1 kΩ')
  assert.equal(parseSI('4.7k'), 4700)
  assert.equal(parseSI('100 mA'), 0.1)
  assert.equal(parseSI('2,2 MΩ'), 2.2e6)
  assert.equal(parseSI('1e3'), 1000)
  assert.equal(parseSI('10µ'), 1e-5)
  assert.equal(parseSI('abc'), null)
})
