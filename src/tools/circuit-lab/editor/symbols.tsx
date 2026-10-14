/* ─── Símbolos de los componentes ───
 * Se dibujan en coordenadas locales (px): eje del componente sobre x, de
 * −HALF·G a +HALF·G; el grupo padre aplica posición y rotación.
 */

import type { ComponentKind } from '../engine/types.ts'
import type { Placed } from './model.ts'
import { LED_HEX, METER_LETTER } from './labels.ts'
import { TERMINAL_COUNT, type LedColor } from '../engine/types.ts'

/** Tamaño de una celda de la cuadrícula, en px. */
export const G = 20
const L = 2 * G // medio largo en px

const BODY = '#3f3f46'

interface SymbolProps {
  c: Placed | { kind: ComponentKind; closed?: boolean; id?: string; color?: LedColor; polarity?: string }
  /** Color de cada terminal (voltaje de su nodo). */
  leads?: string[]
  /** id único para el degradado de la resistencia. */
  gradientId?: string
  /** Brillo del LED, de 0 a 1. */
  glow?: number
}

export function ComponentSymbol({ c, leads = [BODY, BODY], gradientId, glow = 0 }: SymbolProps) {
  const [c0 = BODY, c1 = c0, c2 = c1] = leads
  const polarity = 'polarity' in c ? c.polarity : undefined
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
    case 'ac-source':
      return (
        <g>
          {lead(-L, -14, c0)}
          {lead(14, L, c1)}
          <circle r={14} fill="white" stroke={BODY} strokeWidth={2.5} />
          <path d="M -8 0 C -6 -9, -2 -9, 0 0 S 6 9, 8 0" fill="none" stroke={BODY} strokeWidth={2.2} />
          <text x={-22} y={-10} fontSize={12} fontWeight={700} fill={BODY} textAnchor="middle">+</text>
        </g>
      )
    case 'bjt': {
      // C arriba (20,−40), B a la izquierda (−40,0), E abajo (20,40).
      const pnp = polarity === 'pnp'
      return (
        <g>
          <circle cx={4} r={27} fill="white" stroke={BODY} strokeWidth={1.5} opacity={0.9} />
          <line x1={-40} y1={0} x2={-8} y2={0} stroke={c1} strokeWidth={3} strokeLinecap="round" />
          <line x1={-8} y1={-15} x2={-8} y2={15} stroke={BODY} strokeWidth={4} />
          <polyline points="-8,-7 20,-24 20,-40" fill="none" stroke={c0} strokeWidth={3} strokeLinejoin="round" />
          <polyline points="-8,7 20,24 20,40" fill="none" stroke={c2} strokeWidth={3} strokeLinejoin="round" />
          {/* Flecha en el emisor: hacia afuera en NPN, hacia adentro en PNP */}
          <polygon points={pnp ? '1.8,13 7.2,21.5 11.8,13.8' : '16,21.6 6.1,20.7 10.7,13'} fill={BODY} />
        </g>
      )
    }
    case 'mosfet': {
      // D arriba (20,−40), G a la izquierda (−40,0), S abajo (20,40).
      const p = polarity === 'p'
      return (
        <g>
          <line x1={-40} y1={0} x2={-14} y2={0} stroke={c1} strokeWidth={3} strokeLinecap="round" />
          <line x1={-14} y1={-16} x2={-14} y2={16} stroke={BODY} strokeWidth={3} />
          {[-18, -4, 10].map((y) => <line key={y} x1={-6} y1={y} x2={-6} y2={y + 8} stroke={BODY} strokeWidth={3} />)}
          <polyline points="-6,-14 20,-14 20,-40" fill="none" stroke={c0} strokeWidth={3} strokeLinejoin="round" />
          <polyline points="-6,14 20,14 20,40" fill="none" stroke={c2} strokeWidth={3} strokeLinejoin="round" />
          <polyline points="-6,0 20,0 20,14" fill="none" stroke={BODY} strokeWidth={2} />
          {/* Flecha del sustrato: hacia el canal en N, hacia afuera en P */}
          <polygon points={p ? '10,-5 10,5 2,0' : '-4,0 4,-5 4,5'} fill={BODY} />
        </g>
      )
    }
    case 'opamp':
      // − arriba (−40,−20), + abajo (−40,20), salida (40,0).
      return (
        <g>
          <line x1={-40} y1={-20} x2={-26} y2={-20} stroke={c1} strokeWidth={3} strokeLinecap="round" />
          <line x1={-40} y1={20} x2={-26} y2={20} stroke={c0} strokeWidth={3} strokeLinecap="round" />
          <line x1={30} y1={0} x2={40} y2={0} stroke={c2} strokeWidth={3} strokeLinecap="round" />
          <polygon points="-26,-32 -26,32 30,0" fill="white" stroke={BODY} strokeWidth={2.5} strokeLinejoin="round" />
          <text x={-18} y={-15} fontSize={14} fontWeight={700} fill={BODY} textAnchor="middle">−</text>
          <text x={-18} y={25} fontSize={14} fontWeight={700} fill={BODY} textAnchor="middle">+</text>
        </g>
      )
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
    <svg width={size} height={size}
      viewBox={kind === 'ground' ? '-24 -8 48 48' : TERMINAL_COUNT[kind] === 3 ? '-44 -44 88 88' : '-44 -24 88 48'}>
      <ComponentSymbol c={{ kind, closed: true }} />
      {letter && (
        <text y={5} fontSize={14} fontWeight={700} fill={BODY} textAnchor="middle">{letter}</text>
      )}
    </svg>
  )
}
