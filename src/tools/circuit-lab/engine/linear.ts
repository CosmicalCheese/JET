/* ─── Sistema lineal denso ───
 *
 * Eliminación gaussiana con pivoteo parcial. Para circuitos educativos
 * (< ~200 incógnitas) una matriz densa es instantánea y mucho más simple
 * que un solver disperso.
 */

/** Matriz n×n en orden por filas: a[row * n + col]. */
export class DenseMatrix {
  readonly n: number
  readonly data: Float64Array

  constructor(n: number) {
    this.n = n
    this.data = new Float64Array(n * n)
  }

  get(row: number, col: number): number {
    return this.data[row * this.n + col]
  }

  add(row: number, col: number, value: number): void {
    this.data[row * this.n + col] += value
  }
}

/**
 * Resuelve A·x = b. No modifica las entradas.
 * Devuelve null si la matriz es singular (o numéricamente casi singular).
 */
export function solveLinear(A: DenseMatrix, b: ArrayLike<number>): Float64Array | null {
  const n = A.n
  const m = Float64Array.from(A.data)
  const x = Float64Array.from(b)

  let scale = 0
  for (let i = 0; i < m.length; i++) scale = Math.max(scale, Math.abs(m[i]))
  // Muy estricto a propósito: los casos singulares "de verdad" (lazos de fuentes,
  // nodos sin conexión) ya se detectan antes por topología. Aquí solo queremos
  // atrapar ceros exactos, no pivotes pequeños pero legítimos (diodos apagados
  // junto a capacitores con pasos de tiempo cortos).
  const tolerance = (scale || 1) * 1e-17

  for (let k = 0; k < n; k++) {
    let pivot = k
    for (let r = k + 1; r < n; r++) {
      if (Math.abs(m[r * n + k]) > Math.abs(m[pivot * n + k])) pivot = r
    }
    if (Math.abs(m[pivot * n + k]) <= tolerance) return null

    if (pivot !== k) {
      for (let c = k; c < n; c++) {
        const t = m[k * n + c]
        m[k * n + c] = m[pivot * n + c]
        m[pivot * n + c] = t
      }
      const t = x[k]
      x[k] = x[pivot]
      x[pivot] = t
    }

    const diag = m[k * n + k]
    for (let r = k + 1; r < n; r++) {
      const f = m[r * n + k] / diag
      if (f === 0) continue
      for (let c = k; c < n; c++) m[r * n + c] -= f * m[k * n + c]
      x[r] -= f * x[k]
    }
  }

  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]
    for (let c = r + 1; c < n; c++) s -= m[r * n + c] * x[c]
    x[r] = s / m[r * n + r]
  }
  return x
}

export function cloneMatrix(A: DenseMatrix): DenseMatrix {
  const copy = new DenseMatrix(A.n)
  copy.data.set(A.data)
  return copy
}
