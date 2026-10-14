/* ─── Modelo de diodos (Shockley) ───
 *
 *   I(V) = Is · (e^{V/(n·Vt)} − 1)
 *
 * El Zener suma una segunda exponencial "al revés" que se dispara cuando el
 * voltaje inverso llega a Vz. Para Newton-Raphson se necesita también la
 * derivada dI/dV, y un límite al cambio de V entre iteraciones (pnjlim, el
 * mismo truco que usa SPICE) para que la exponencial no explote.
 */

import type { CircuitComponent, LedColor } from './types.ts'

/** Voltaje térmico kT/q a 27 °C. */
export const VT = 0.025852

/**
 * Conductancia mínima en paralelo con cada unión: evita matrices casi
 * singulares cuando un diodo está bloqueado. SPICE usa 1e-12; aquí 1e-9
 * (nanoamperes de fuga), porque con pasos de tiempo cortos un capacitor
 * puede valer 10⁷ S y 1e-12 quedaría por debajo de la precisión numérica.
 */
export const GMIN = 1e-9

export interface DiodeParams {
  /** Corriente de saturación (A). */
  is: number
  /** Factor de idealidad. */
  n: number
  /** Ruptura Zener: voltaje inverso y corriente en ese punto. */
  breakdown?: { vz: number; iz: number }
}

/** Voltaje directo típico a 20 mA de cada color de LED. */
export const LED_VF: Record<LedColor, number> = {
  red: 1.9,
  yellow: 2.0,
  green: 2.1,
  blue: 3.0,
  white: 3.1,
}

const LED_N = 2
const LED_I_REF = 0.02

export type DiodeLike = Extract<CircuitComponent, { kind: 'diode' | 'led' | 'zener' }>

export function isDiodeLike(c: CircuitComponent): c is DiodeLike {
  return c.kind === 'diode' || c.kind === 'led' || c.kind === 'zener'
}

export function diodeParams(c: DiodeLike): DiodeParams {
  switch (c.kind) {
    case 'diode':
      return { is: 1e-14, n: 1 }
    case 'led': {
      // Is tal que a 20 mA el voltaje sea el Vf típico del color.
      const vf = LED_VF[c.color]
      return { is: LED_I_REF / Math.expm1(vf / (LED_N * VT)), n: LED_N }
    }
    case 'zener':
      return { is: 1e-14, n: 1, breakdown: { vz: c.zenerVoltage, iz: 5e-3 } }
  }
}

/** e^x sin desbordarse: más allá de x = 80 continúa en línea recta. */
export function safeExp(x: number): { e: number; de: number } {
  if (x <= 80) {
    const e = Math.exp(x)
    return { e, de: e }
  }
  const e80 = Math.exp(80)
  return { e: e80 * (1 + x - 80), de: e80 }
}

/** Corriente (ánodo → cátodo) y su derivada dI/dV. */
export function diodeCurrent(p: DiodeParams, v: number): { i: number; g: number } {
  const nvt = p.n * VT
  const f = safeExp(v / nvt)
  let i = p.is * (f.e - 1)
  let g = (p.is * f.de) / nvt
  if (p.breakdown) {
    const { vz, iz } = p.breakdown
    const r = safeExp((-v - vz) / nvt)
    // Restamos la constante para que I(0) = 0 exactamente.
    i -= iz * (r.e - Math.exp(-vz / nvt))
    g += (iz * r.de) / nvt
  }
  return { i: i + GMIN * v, g: g + GMIN }
}

/** Limita un paso de Newton sobre una unión p-n (pnjlim de SPICE). */
export function pnjlim(vnew: number, vold: number, nvt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nvt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nvt
      return arg > 0 ? vold + nvt * Math.log(arg) : vcrit
    }
    return nvt * Math.log(vnew / nvt)
  }
  return vnew
}

/** Siguiente voltaje de prueba, limitado en la zona directa y en la de ruptura. */
export function limitStep(p: DiodeParams, vnew: number, vold: number): number {
  const nvt = p.n * VT
  const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * p.is))
  const forward = pnjlim(vnew, vold, nvt, vcrit)
  if (forward !== vnew || !p.breakdown) return forward
  // Ruptura: la misma idea sobre u = −V − Vz.
  const { vz, iz } = p.breakdown
  const ucrit = nvt * Math.log(nvt / (Math.SQRT2 * iz))
  const u = pnjlim(-vnew - vz, -vold - vz, nvt, ucrit)
  return -u - vz
}
