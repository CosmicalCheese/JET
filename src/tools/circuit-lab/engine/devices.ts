/* ─── Dispositivos no lineales ───
 *
 * Cada dispositivo se describe con:
 *   - C: sus voltajes de control como combinación de los voltajes de sus
 *     terminales (ctrl = C · v). Ej.: un BJT se controla con V_BE y V_BC.
 *   - evaluate(ctrl): la corriente que entra por cada terminal (I) y su
 *     derivada respecto a cada voltaje de control (D = ∂I/∂ctrl).
 *   - limit: cuánto se deja avanzar a Newton-Raphson en cada iteración.
 *
 * El solver linealiza I ≈ I₀ + D·(ctrl − ctrl₀) y lo estampa igual para
 * todos: conductancias G = D·C y una fuente de corriente constante.
 */

import { diodeCurrent, diodeParams, GMIN, isDiodeLike, limitStep, pnjlim, safeExp, VT } from './diode.ts'
import type { Bjt, CircuitComponent, Mosfet } from './types.ts'

export interface DeviceModel {
  C: number[][]
  initial: number[]
  evaluate(ctrl: number[]): { I: number[]; D: number[][] }
  limit(next: number[], prev: number[]): number[]
}

export function deviceModel(c: CircuitComponent): DeviceModel | null {
  if (isDiodeLike(c)) return diodeModel(c)
  if (c.kind === 'bjt') return c.polarity === 'npn' ? bjtModel(c) : flipped(bjtModel(c))
  if (c.kind === 'mosfet') return c.polarity === 'n' ? mosfetModel(c) : flipped(mosfetModel(c))
  return null
}

/**
 * PNP / canal P: el mismo modelo con todos los voltajes y corrientes
 * invertidos. ctrl = −C·v, I = −f(ctrl), así que D = −f'(ctrl).
 */
function flipped(m: DeviceModel): DeviceModel {
  return {
    C: m.C.map((row) => row.map((x) => -x)),
    initial: m.initial,
    evaluate(ctrl) {
      const { I, D } = m.evaluate(ctrl)
      return { I: I.map((x) => -x), D: D.map((row) => row.map((x) => -x)) }
    },
    limit: m.limit,
  }
}

// ─── Diodo ───────────────────────────────────────────────────────────────────

function diodeModel(c: Parameters<typeof diodeParams>[0]): DeviceModel {
  const p = diodeParams(c)
  return {
    C: [[1, -1]], // V = V_ánodo − V_cátodo
    initial: [0],
    evaluate([v]) {
      const { i, g } = diodeCurrent(p, v)
      return { I: [i, -i], D: [[g], [-g]] }
    },
    limit: ([vn], [vo]) => [limitStep(p, vn, vo)],
  }
}

// ─── BJT (Ebers-Moll, modelo de transporte) ──────────────────────────────────

const BJT_IS = 1e-14
const BJT_BETA_R = 1
const BJT_VCRIT = VT * Math.log(VT / (Math.SQRT2 * BJT_IS))

/**
 * NPN con terminales (C, B, E) y control (V_BE, V_BC):
 *   iF = Is(e^{V_BE/Vt} − 1),  iR = Is(e^{V_BC/Vt} − 1)
 *   Ic = iF − iR·(1 + 1/βR),   Ib = iF/βF + iR/βR,   Ie = −(Ic + Ib)
 * En zona activa (V_BE ≈ 0.7 V, V_BC < 0) queda Ic ≈ βF·Ib.
 */
function bjtModel(c: Bjt): DeviceModel {
  const bf = c.beta
  const br = BJT_BETA_R
  return {
    C: [
      [0, 1, -1], // V_BE
      [-1, 1, 0], // V_BC
    ],
    initial: [0, 0],
    evaluate([vbe, vbc]) {
      const f = safeExp(vbe / VT)
      const r = safeExp(vbc / VT)
      const iF = BJT_IS * (f.e - 1)
      const iR = BJT_IS * (r.e - 1)
      const gF = (BJT_IS * f.de) / VT
      const gR = (BJT_IS * r.de) / VT
      // GMIN en cada unión para que nunca quede un nodo sin conductancia.
      const ic = iF - iR * (1 + 1 / br) - GMIN * vbc
      const ib = iF / bf + iR / br + GMIN * (vbe + vbc)
      const dIc = [gF, -gR * (1 + 1 / br) - GMIN]
      const dIb = [gF / bf + GMIN, gR / br + GMIN]
      return {
        I: [ic, ib, -(ic + ib)],
        D: [dIc, dIb, [-(dIc[0] + dIb[0]), -(dIc[1] + dIb[1])]],
      }
    },
    limit: ([be, bc], [beo, bco]) => [pnjlim(be, beo, VT, BJT_VCRIT), pnjlim(bc, bco, VT, BJT_VCRIT)],
  }
}

// ─── MOSFET (ley cuadrática de Shichman-Hodges) ──────────────────────────────

const MOS_LAMBDA = 0.01

/** Id, ∂Id/∂Vgs, ∂Id/∂Vds para Vds ≥ 0 (canal N). */
function mosForward(vgs: number, vds: number, vth: number, k: number) {
  const vov = vgs - vth
  if (vov <= 0) return { id: 0, gm: 0, gds: 0 } // corte
  const clm = 1 + MOS_LAMBDA * vds
  if (vds < vov) {
    // Triodo (zona óhmica): se comporta como una resistencia controlada por Vgs.
    const base = k * (vov * vds - (vds * vds) / 2)
    return { id: base * clm, gm: k * vds * clm, gds: k * (vov - vds) * clm + MOS_LAMBDA * base }
  }
  // Saturación: la corriente casi no depende de Vds.
  const base = (k / 2) * vov * vov
  return { id: base * clm, gm: k * vov * clm, gds: MOS_LAMBDA * base }
}

const MOS_STEP = 2 // V máximos por iteración

function mosfetModel(c: Mosfet): DeviceModel {
  const { threshold: vth, k } = c
  return {
    C: [
      [0, 1, -1], // V_GS
      [1, 0, -1], // V_DS
    ],
    initial: [0, 0],
    evaluate([vgs, vds]) {
      let id: number, dVgs: number, dVds: number
      if (vds >= 0) {
        const f = mosForward(vgs, vds, vth, k)
        ;[id, dVgs, dVds] = [f.id, f.gm, f.gds]
      } else {
        // Simétrico: con Vds < 0 el drenador y la fuente intercambian papeles.
        const f = mosForward(vgs - vds, -vds, vth, k)
        ;[id, dVgs, dVds] = [-f.id, -f.gm, f.gm + f.gds]
      }
      id += GMIN * vds
      dVds += GMIN
      return { I: [id, 0, -id], D: [[dVgs, dVds], [0, 0], [-dVgs, -dVds]] }
    },
    limit: (next, prev) => next.map((v, i) => prev[i] + Math.max(-MOS_STEP, Math.min(MOS_STEP, v - prev[i]))),
  }
}

// ─── Fuente AC ───────────────────────────────────────────────────────────────

export function acValue(c: Extract<CircuitComponent, { kind: 'ac-source' }>, t: number): number {
  return c.offset + c.amplitude * Math.sin(2 * Math.PI * c.frequency * t + (c.phase * Math.PI) / 180)
}

// ─── Op-amp ──────────────────────────────────────────────────────────────────

export const OPAMP_GAIN = 1e5

/** Salida (respecto a GND) en función de V+ − V−, con saturación suave, y su derivada. */
export function opampOutput(saturation: number, vd: number): { v: number; dv: number } {
  const t = Math.tanh((OPAMP_GAIN * vd) / saturation)
  return { v: saturation * t, dv: OPAMP_GAIN * (1 - t * t) }
}
