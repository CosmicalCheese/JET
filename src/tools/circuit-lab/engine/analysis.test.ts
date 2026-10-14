import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDC } from './dc.ts'
import { nodeBalance, parallelGroup, seriesChain } from './analysis.ts'
import type { Circuit, DCSolution } from './types.ts'
import { toCircuit } from '../editor/model.ts'
import { EXAMPLES } from '../editor/examples.ts'

const close = (actual: number, expected: number, label = '') =>
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label} esperado ${expected}, obtenido ${actual}`)

function example(id: string): { circuit: Circuit; sol: DCSolution } {
  const { circuit } = toCircuit(EXAMPLES.find((e) => e.id === id)!.build())
  const sol = solveDC(circuit)
  if (!sol.ok) assert.fail(sol.issues[0].message)
  return { circuit, sol }
}

test('divisor: R1 y R2 en serie, 12 V repartidos', () => {
  const { circuit, sol } = example('divisor')
  const chain = seriesChain(circuit, sol, 'R2')
  assert.ok(chain)
  assert.deepEqual(chain.resistors.map((r) => r.id), ['R1', 'R2'])
  close(chain.total, 3000)
  close(chain.voltage, 12)
  close(chain.current, 0.004)
  assert.equal(parallelGroup(circuit, sol, 'R2'), null, 'el voltímetro no cuenta como rama')
})

test('ley de Ohm: el amperímetro no rompe la serie, pero una sola resistencia no es cadena', () => {
  const { circuit, sol } = example('ohm')
  assert.equal(seriesChain(circuit, sol, 'R1'), null)
})

test('paralelo: 3 kΩ ∥ 6 kΩ = 2 kΩ, 3 mA en total', () => {
  const { circuit, sol } = example('paralelo')
  const group = parallelGroup(circuit, sol, 'R1')
  assert.ok(group)
  assert.deepEqual(group.resistors.map((r) => r.id).sort(), ['R1', 'R2'])
  close(group.total, 2000)
  close(group.voltage, 6)
  close(group.current, 0.003)
  assert.equal(seriesChain(circuit, sol, 'R1'), null, 'las ramas no están en serie entre sí')
})

test('Kirchhoff: en el nodo de arriba del paralelo entra 3 mA y sale 2 + 1 mA', () => {
  const { circuit, sol } = example('paralelo')
  const top = sol.terminalNets.V1[0]
  const b = nodeBalance(circuit, sol, top)
  close(b.entering, 0.003)
  close(b.leaving, 0.003)
  assert.equal(b.flows.length, 3)
})

test('Kirchhoff se cumple en todos los nodos de todos los ejemplos', () => {
  for (const e of EXAMPLES) {
    const { circuit, sol } = example(e.id)
    for (let net = 0; net < sol.netVoltages.length; net++) {
      const b = nodeBalance(circuit, sol, net)
      close(b.entering, b.leaving, `${e.id} net ${net}`)
    }
  }
})
