import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DenseMatrix, solveLinear } from './linear.ts'

function matrix(rows: number[][]): DenseMatrix {
  const m = new DenseMatrix(rows.length)
  rows.forEach((row, r) => row.forEach((v, c) => m.add(r, c, v)))
  return m
}

test('resuelve un sistema 3×3', () => {
  // 2x + y − z = 8, −3x − y + 2z = −11, −2x + y + 2z = −3 → (2, 3, −1)
  const x = solveLinear(matrix([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]]), [8, -11, -3])
  assert.ok(x)
  ;[2, 3, -1].forEach((v, i) => assert.ok(Math.abs(x[i] - v) < 1e-12))
})

test('necesita pivoteo (cero en la diagonal)', () => {
  const x = solveLinear(matrix([[0, 1], [1, 0]]), [3, 4])
  assert.deepEqual(Array.from(x!), [4, 3])
})

test('detecta matriz singular', () => {
  assert.equal(solveLinear(matrix([[1, 2], [2, 4]]), [1, 2]), null)
})

test('no modifica las entradas', () => {
  const A = matrix([[4, 1], [1, 3]])
  const b = [1, 2]
  const before = Array.from(A.data)
  solveLinear(A, b)
  assert.deepEqual(Array.from(A.data), before)
  assert.deepEqual(b, [1, 2])
})
