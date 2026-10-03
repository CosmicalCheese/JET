import { useId } from 'react'
import { fmt } from './format'
import { Tex } from './Tex'

const W = 360
const C = { text: '#71717a', ink: '#27272a', axis: '#d4d4d8' }

/** Color aproximado de una longitud de onda visible (aproximación de Bruton) */
function wavelengthColor(nm: number): string {
  if (nm < 380) return '#7c3aed'
  let r = 0, g = 0, b = 0
  if (nm < 440) { r = (440 - nm) / 60; b = 1 }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20 }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65 }
  else if (nm <= 750) { r = 1 }
  else return '#71717a'
  // atenuamos los extremos, donde el ojo es menos sensible
  const k = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1
  const to = (x: number) => Math.round(255 * Math.pow(x * k, 0.8))
  return `rgb(${to(r)}, ${to(g)}, ${to(b)})`
}

function Frame({ h, children, caption }: { h: number; children: React.ReactNode; caption: React.ReactNode }) {
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${h}`} className="w-full h-auto bg-white rounded-lg border border-zinc-100" role="img">{children}</svg>
      <figcaption className="text-xs text-zinc-500 leading-relaxed">{caption}</figcaption>
    </figure>
  )
}

// ─── Espectro electromagnético ───────────────────────────────────────────────

export function SpectrumVisual({ nm }: { nm: number }) {
  const uid = useId().replace(/:/g, '')
  const lo = 100, hi = 1000, x0 = 16, x1 = W - 16
  const X = (v: number) => x0 + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (x1 - x0)
  const stops = Array.from({ length: 19 }, (_, i) => 380 + i * 20)
  const inside = nm >= lo && nm <= hi
  const mark = X(nm)

  return (
    <Frame h={130} caption={<>La línea negra marca <Tex latex={`\\lambda=${fmt(nm, 1)}\\ \\mathrm{nm}`} />. A la izquierda (menor <Tex latex="\lambda" />) los fotones tienen más energía.</>}>
      <defs>
        <linearGradient id={`${uid}v`} x1={X(380)} x2={X(750)} gradientUnits="userSpaceOnUse">
          {stops.map(s => <stop key={s} offset={(s - 380) / 370} stopColor={wavelengthColor(s)} />)}
        </linearGradient>
      </defs>
      <rect x={x0} y={40} width={X(380) - x0} height={34} fill="#ede9fe" />
      <rect x={X(380)} y={40} width={X(750) - X(380)} height={34} fill={`url(#${uid}v)`} />
      <rect x={X(750)} y={40} width={x1 - X(750)} height={34} fill="#fee2e2" />
      <text x={(x0 + X(380)) / 2} y={61} fontSize={11} fill="#6d28d9" textAnchor="middle">Ultravioleta</text>
      <text x={(X(750) + x1) / 2} y={61} fontSize={11} fill="#b91c1c" textAnchor="middle">Infrarrojo</text>
      {[200, 400, 600, 800].map(t => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={74} y2={79} stroke={C.axis} />
          <text x={X(t)} y={92} fontSize={10} fill={C.text} textAnchor="middle">{t} nm</text>
        </g>
      ))}
      <line x1={mark} x2={mark} y1={30} y2={80} stroke={C.ink} strokeWidth={2.5} />
      <text x={Math.min(W - 40, Math.max(40, mark))} y={22} fontSize={12} fontWeight={600} fill={C.ink} textAnchor="middle">
        {inside ? `${fmt(nm, 0)} nm` : nm < lo ? `← ${fmt(nm, 1)} nm` : `${fmt(nm, 0)} nm →`}
      </text>
      <text x={W / 2} y={118} fontSize={10} fill={C.text} textAnchor="middle">← más energía · menos energía →</text>
    </Frame>
  )
}

// ─── Niveles de energía del hidrógeno ────────────────────────────────────────

export function LevelsVisual({ ni, nf, nm }: { ni: number; nf: number; nm: number }) {
  const uid = useId().replace(/:/g, '')
  const H = 260, top = 18, bottom = H - 22
  const maxN = Math.max(6, ni, nf)
  const shown = Array.from({ length: Math.min(maxN, 8) }, (_, i) => i + 1)
  // E_n = −13.6/n² eV; el nivel ∞ (E = 0) queda arriba
  const Y = (n: number) => top + (bottom - top) * (1 / (n * n))
  const color = nm >= 380 && nm <= 750 ? wavelengthColor(nm) : '#7c3aed'
  const xArrow = W * 0.62
  // niveles mayores que 8 quedan casi pegados al ∞: los dibujamos en el 8
  const yFrom = Y(Math.min(ni, 8)), yTo = Y(Math.min(nf, 8))
  const down = ni > nf

  return (
    <Frame h={H} caption={<>Cada línea es un nivel de energía permitido (<Tex latex="E_n=-13.6/n^2\ \mathrm{eV}" />). La flecha es el salto del electrón; su color es el de la luz {down ? 'emitida' : 'absorbida'}{nm < 380 || nm > 750 ? ' (aquí invisible, la dibujamos en violeta)' : ''}.</>}>
      <defs>
        <marker id={`${uid}m`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      <line x1={70} x2={W - 30} y1={top} y2={top} stroke={C.axis} strokeDasharray="4 3" />
      <text x={62} y={top + 4} fontSize={10} fill={C.text} textAnchor="end">n = ∞</text>
      {shown.map(n => (
        <g key={n}>
          <line x1={70} x2={W - 30} y1={Y(n)} y2={Y(n)} stroke={n === ni || n === nf ? C.ink : C.axis} strokeWidth={n === ni || n === nf ? 2 : 1} />
          {(n <= 4 || n === ni || n === nf) && (
            <text x={62} y={Y(n) + 4} fontSize={10} fill={n === ni || n === nf ? C.ink : C.text} fontWeight={n === ni || n === nf ? 700 : 400} textAnchor="end">n = {n}</text>
          )}
        </g>
      ))}
      {maxN > 8 && <text x={W - 30} y={Y(8) - 4} fontSize={9} fill={C.text} textAnchor="end">niveles &gt; 8 casi juntos</text>}
      <line x1={xArrow} x2={xArrow} y1={yFrom} y2={yTo} stroke={color} strokeWidth={3} markerEnd={`url(#${uid}m)`} />
      <text x={xArrow + 10} y={(yFrom + yTo) / 2} fontSize={12} fontWeight={600} fill={C.ink}>{fmt(nm, 1)} nm</text>
    </Frame>
  )
}

// ─── Escala de pH ────────────────────────────────────────────────────────────

const PH_EXAMPLES: [number, string][] = [[2, 'limón'], [5, 'café'], [7, 'agua'], [8.3, 'bicarbonato'], [10, 'jabón'], [13, 'cloro']]
const PH_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#7c3aed', '#9333ea', '#a21caf']

export function PhVisual({ ph }: { ph: number }) {
  const uid = useId().replace(/:/g, '')
  const x0 = 16, x1 = W - 16
  const X = (v: number) => x0 + (Math.min(14, Math.max(0, v)) / 14) * (x1 - x0)

  return (
    <Frame h={128} caption="Escala de pH a 25 °C. Cada marca hacia la izquierda es 10 veces más ácida que la anterior.">
      <defs>
        <linearGradient id={`${uid}p`} x1={x0} x2={x1} gradientUnits="userSpaceOnUse">
          {PH_COLORS.map((c, i) => <stop key={i} offset={i / (PH_COLORS.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      {/* renglones alternados para que los nombres cercanos no se encimen */}
      {PH_EXAMPLES.map(([v, name], i) => (
        <text key={name} x={X(v)} y={i % 2 ? 18 : 31} fontSize={9} fill={C.text} textAnchor="middle">{name}</text>
      ))}
      <rect x={x0} y={38} width={x1 - x0} height={22} rx={4} fill={`url(#${uid}p)`} />
      {Array.from({ length: 15 }, (_, i) => (
        <text key={i} x={X(i)} y={74} fontSize={9} fill={C.text} textAnchor="middle">{i}</text>
      ))}
      <text x={X(3)} y={92} fontSize={10} fill="#dc2626" textAnchor="middle">ácido</text>
      <text x={X(7)} y={92} fontSize={10} fill="#10b981" textAnchor="middle">neutro</text>
      <text x={X(11)} y={92} fontSize={10} fill="#6366f1" textAnchor="middle">básico</text>
      <line x1={X(ph)} x2={X(ph)} y1={34} y2={64} stroke={C.ink} strokeWidth={2.5} />
      <text x={Math.min(W - 30, Math.max(30, X(ph)))} y={114} fontSize={12} fontWeight={600} fill={C.ink} textAnchor="middle">pH {fmt(ph, 2)}</text>
    </Frame>
  )
}
