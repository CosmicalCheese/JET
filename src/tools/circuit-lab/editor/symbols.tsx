/* ─── Símbolos de los componentes ───
 * Se dibujan en coordenadas locales (px): eje del componente sobre x, de
 * −HALF·G a +HALF·G; el grupo padre aplica posición y rotación.
 */

import type { ComponentKind } from '../engine/types.ts'
import type { Placed } from './model.ts'
import { LED_HEX, METER_LETTER } from './labels.ts'
import type { LedColor } from '../engine/types.ts'

/** Tamaño de una celda de la cuadrícula, en px. */
export const G = 20
const L = 2 * G // medio largo en px

const BODY = '#3f3f46'

interface SymbolProps {
  c: Placed | { kind: ComponentKind; closed?: boolean; id?: string; color?: LedColor }
  /** Color de cada terminal (voltaje de su nodo). */
  leads?: [string, string?]
  /** id único para el degradado de la resistencia. */
  gradientId?: string
  /** Brillo del LED, de 0 a 1. */
  glow?: number
}

export function ComponentSymbol({ c, leads = [BODY, BODY], gradientId, glow = 0 }: SymbolProps) {
  const [c0, c1 = c0] = leads
  const lead = (x1: number, x2: number, color: string) => (
    <line x1={x1} y1={0} x2={x2} y2={0} stroke={color} strokeWidth={3} strokeLinecap="round" />
  )

  switch (c.kind) {
    case 'resistor': {
      const zig: string[] = []
      for (let i = 0; i <= 8; i++) zig.push(`${-20 + i * 5},${i === 0 || i === 8 ? 0 : i % 2 ? -8 : 8}`)
      const stroke = gradientId ? `url(#${gradientId})` : BODY
      return (
        <g>
          {gradientId && (
            <defs>
              <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={-20} y1={0} x2={20} y2={0}>
                <stop offset="0" stopColor={c0} />
                <stop offset="1" stopColor={c1} />
              </linearGradient>
            </defs>
          )}
          {lead(-L, -20, c0)}
          {lead(20, L, c1)}
          <polyline points={zig.join(' ')} fill="none" stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )
    }
    case 'voltage-source':
      return (
        <g>
          {lead(-L, -4, c0)}
          {lead(4, L, c1)}
          <line x1={-4} y1={-16} x2={-4} y2={16} stroke={BODY} strokeWidth={3} />
          <line x1={4} y1={-8} x2={4} y2={8} stroke={BODY} strokeWidth={5} />
          <text x={-14} y={-10} fontSize={12} fontWeight={700} fill={BODY} textAnchor="middle">+</text>
        </g>
      )
    case 'current-source':
      return (
        <g>
          {lead(-L, -14, c0)}
          {lead(14, L, c1)}
          <circle r={14} fill="white" stroke={BODY} strokeWidth={2.5} />
          {/* Flecha hacia el terminal 0: por ahí sale la corriente */}
          <line x1={8} y1={0} x2={-6} y2={0} stroke={BODY} strokeWidth={2.5} />
          <polyline points="-1,-5 -7,0 -1,5" fill="none" stroke={BODY} strokeWidth={2.5} strokeLinejoin="round" />
        </g>
      )
    case 'ground':
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={12} stroke={c0} strokeWidth={3} strokeLinecap="round" />
          <line x1={-12} y1={12} x2={12} y2={12} stroke={BODY} strokeWidth={3} strokeLinecap="round" />
          <line x1={-7} y1={18} x2={7} y2={18} stroke={BODY} strokeWidth={3} strokeLinecap="round" />
          <line x1={-2} y1={24} x2={2} y2={24} stroke={BODY} strokeWidth={3} strokeLinecap="round" />
        </g>
      )
    case 'switch': {
      const closed = 'closed' in c && c.closed
      return (
        <g>
          {lead(-L, -14, c0)}
          {lead(14, L, c1)}
          <line x1={-14} y1={0} x2={closed ? 14 : 10} y2={closed ? 0 : -14} stroke={BODY} strokeWidth={3} strokeLinecap="round" />
          <circle cx={-14} r={3.5} fill="white" stroke={BODY} strokeWidth={2} />
          <circle cx={14} r={3.5} fill="white" stroke={BODY} strokeWidth={2} />
        </g>
      )
    }
    case 'capacitor':
      return (
        <g>
          {lead(-L, -4, c0)}
          {lead(4, L, c1)}
          <line x1={-4} y1={-14} x2={-4} y2={14} stroke={BODY} strokeWidth={3.5} />
          <line x1={4} y1={-14} x2={4} y2={14} stroke={BODY} strokeWidth={3.5} />
        </g>
      )
    case 'inductor': {
      // Cuatro espiras de −20 a 20.
      const loops = Array.from({ length: 4 }, (_, i) => `A 5 6 0 0 1 ${-20 + (i + 1) * 10} 0`).join(' ')
      return (
        <g>
          {lead(-L, -20, c0)}
          {lead(20, L, c1)}
          <path d={`M -20 0 ${loops}`} fill="none" stroke={gradientId ? `url(#${gradientId})` : BODY} strokeWidth={3} />
          {gradientId && (
            <defs>
              <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={-20} y1={0} x2={20} y2={0}>
                <stop offset="0" stopColor={c0} />
                <stop offset="1" stopColor={c1} />
              </linearGradient>
            </defs>
          )}
        </g>
      )
    }
    case 'diode':
    case 'zener':
    case 'led': {
      // Triángulo del ánodo (terminal 0) al cátodo (terminal 1, la barra).
      const light = c.kind === 'led' ? LED_HEX[('color' in c && c.color) || 'red'] : BODY
      return (
        <g>
          {c.kind === 'led' && glow > 0.01 && (
            <circle r={10 + 16 * glow} fill={light} opacity={0.15 + 0.45 * glow} />
          )}
          {lead(-L, -10, c0)}
          {lead(10, L, c1)}
          <polygon points="-10,-10 -10,10 10,0" fill={c.kind === 'led' ? light : BODY} stroke={BODY} strokeWidth={2} strokeLinejoin="round" />
          {c.kind === 'zener'
            ? <polyline points="5,-14 10,-10 10,10 15,14" fill="none" stroke={BODY} strokeWidth={3} />
            : <line x1={10} y1={-11} x2={10} y2={11} stroke={BODY} strokeWidth={3} />}
          {c.kind === 'led' && (
            <g stroke={BODY} strokeWidth={1.8} fill="none" strokeLinecap="round">
              <path d="M -2 -13 L 4 -21 M 4 -21 L 0 -20 M 4 -21 L 4 -17" />
              <path d="M 5 -11 L 11 -19 M 11 -19 L 7 -18 M 11 -19 L 11 -15" />
            </g>
          )}
        </g>
      )
    }
    case 'voltmeter':
    case 'ammeter':
      return (
        <g>
          {lead(-L, -15, c0)}
          {lead(15, L, c1)}
          <circle r={15} fill="white" stroke={BODY} strokeWidth={2.5} />
          <text x={-11} y={-17} fontSize={11} fontWeight={700} fill={BODY} textAnchor="middle">+</text>
        </g>
      )
  }
}

/** Icono pequeño para la paleta. */
export function SymbolIcon({ kind, size = 28 }: { kind: ComponentKind; size?: number }) {
  const letter = METER_LETTER[kind]
  return (
    <svg width={size} height={size} viewBox={kind === 'ground' ? '-24 -8 48 48' : '-44 -24 88 48'}>
      <ComponentSymbol c={{ kind, closed: true }} />
      {letter && (
        <text y={5} fontSize={14} fontWeight={700} fill={BODY} textAnchor="middle">{letter}</text>
      )}
    </svg>
  )
}
