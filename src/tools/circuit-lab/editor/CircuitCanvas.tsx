import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentKind, DCResult } from '../engine/types.ts'
import {
  HALF, keyOf, rotate, route, terminalPoints,
  type CircuitDoc, type Placed, type Pt, type Rotation, type Translation,
} from './model.ts'
import { ComponentSymbol, G } from './symbols.tsx'
import { LED_NAME, METER_LETTER } from './labels.ts'
import { formatSI } from './units.ts'

export type Tool = 'select' | 'wire' | ComponentKind
export type Selection = { type: 'component' | 'wire'; id: string } | null

export interface View {
  x: number
  y: number
  zoom: number
}

interface Props {
  doc: CircuitDoc
  translation: Translation
  result: DCResult
  tool: Tool
  placeRotation: Rotation
  selection: Selection
  highlight: Set<string>
  highlightTone: 'warning' | 'error'
  animate: boolean
  /** Cambia → reencuadra el circuito. */
  fitKey: number
  onSelect: (s: Selection) => void
  onPlace: (kind: ComponentKind, at: Pt) => void
  onAddWire: (points: Pt[]) => void
  onDragStart: () => void
  onDragMove: (id: string, at: Pt) => void
  onDragEnd: () => void
  onToggleSwitch: (id: string) => void
}

type Gesture =
  | { type: 'pan'; startX: number; startY: number; view: View }
  | { type: 'wire'; from: Pt; to: Pt }
  | { type: 'move'; id: string; offset: Pt; moved: boolean }

const NEUTRAL = '#a1a1aa'

/** Gris en 0 V, verde hacia el voltaje más alto, rojo hacia el más negativo. */
function voltageColor(v: number, max: number): string {
  const t = Math.max(-1, Math.min(1, v / max))
  const [r0, g0, b0] = [161, 161, 170]
  const [r1, g1, b1] = t >= 0 ? [22, 163, 74] : [220, 38, 38]
  const k = Math.abs(t)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k)
  return `rgb(${mix(r0, r1)},${mix(g0, g1)},${mix(b0, b1)})`
}

/** Velocidad de los puntos (px/s) según la corriente, en escala logarítmica. */
function flowSpeed(i: number): number {
  const a = Math.abs(i)
  if (a < 1e-7) return 0
  return Math.sign(i) * Math.min(140, 6 + 30 * Math.log10(1 + a / 1e-4))
}

/** Coordenadas locales (sin rotar) de un punto respecto a un componente. */
function toLocal(c: Placed, p: Pt): Pt {
  return rotate({ x: p.x - c.x, y: p.y - c.y }, ((4 - c.rot) % 4) as Rotation)
}

function hitComponent(c: Placed, p: Pt): boolean {
  const l = toLocal(c, p)
  if (c.kind === 'ground') return Math.abs(l.x) <= 0.8 && l.y >= -0.3 && l.y <= 1.4
  return Math.abs(l.x) <= HALF - 0.4 && Math.abs(l.y) <= 1
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function CircuitCanvas(props: Props) {
  const { doc, translation, result, tool, selection, highlight, animate } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [hover, setHover] = useState<Pt | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // ─── Encuadre ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const { width, height } = size
    if (!width || !height) return
    const pts: Pt[] = [
      // Terminales y espacio para la etiqueta (a la derecha si el componente es vertical).
      ...doc.components.flatMap((c) => [
        ...terminalPoints(c),
        { x: c.x, y: c.y + 1.5 },
        { x: c.x, y: c.y - 1.5 },
        ...(c.rot % 2 === 1 ? [{ x: c.x + 4.5, y: c.y }] : []),
      ]),
      ...doc.wires.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
    ]
    if (!pts.length) {
      setView({ x: width / 2, y: height / 2, zoom: 1 })
      return
    }
    const xs = pts.map((p) => p.x * G)
    const ys = pts.map((p) => p.y * G)
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const zoom = Math.max(0.4, Math.min(1.6, Math.min((width - 120) / (maxX - minX || 1), (height - 120) / (maxY - minY || 1))))
    setView({ x: width / 2 - ((minX + maxX) / 2) * zoom, y: height / 2 - ((minY + maxY) / 2) * zoom, zoom })
    // Solo al pedir un reencuadre o al cambiar el tamaño, no en cada edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fitKey, size])

  // ─── Animación de la corriente ─────────────────────────────────────────────
  useEffect(() => {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const offsets = new WeakMap<Element, number>()
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      svgRef.current?.querySelectorAll<SVGElement>('[data-speed]').forEach((el) => {
        const off = (offsets.get(el) ?? 0) + Number(el.dataset.speed) * dt
        offsets.set(el, off % 1e6)
        el.style.strokeDashoffset = String(-off)
      })
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [animate])

  // ─── Zoom con la rueda (listener no pasivo para poder hacer preventDefault) ─
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        const zoom = Math.max(0.35, Math.min(3, v.zoom * Math.exp(-e.deltaY * 0.0015)))
        const f = zoom / v.zoom
        return { zoom, x: mx - (mx - v.x) * f, y: my - (my - v.y) * f }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // ─── Datos derivados ───────────────────────────────────────────────────────
  const solution = result.ok ? result : null
  const maxV = useMemo(
    () => Math.max(1, ...(solution?.netVoltages.map(Math.abs) ?? [])),
    [solution],
  )
  const colorOfNet = (net: number | undefined) =>
    solution && net !== undefined ? voltageColor(solution.netVoltages[net], maxV) : NEUTRAL

  const junctionDegree = useMemo(() => {
    const degree = new Map<string, number>()
    for (const w of translation.circuit.wires) {
      for (const e of [w.a, w.b]) if ('junction' in e) degree.set(e.junction, (degree.get(e.junction) ?? 0) + 1)
    }
    return degree
  }, [translation])

  // ─── Puntero ───────────────────────────────────────────────────────────────
  const toGrid = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - view.x) / view.zoom / G,
      y: (e.clientY - rect.top - view.y) / view.zoom / G,
    }
  }
  const snap = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) })

  /** Terminal o extremo de cable cercano: ahí empieza un cable nuevo. */
  const connectorNear = (p: Pt): Pt | null => {
    const candidates = [
      ...doc.components.flatMap(terminalPoints),
      ...doc.wires.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
    ]
    let best: Pt | null = null
    let bestD = 0.45
    for (const c of candidates) {
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < bestD) [best, bestD] = [c, d]
    }
    return best
  }

  const componentAt = (p: Pt) => [...doc.components].reverse().find((c) => hitComponent(c, p))
  const wireAt = (p: Pt) =>
    doc.wires.find((w) => distToSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) <= 0.35)

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toGrid(e)

    if (tool !== 'select' && tool !== 'wire') {
      props.onPlace(tool, snap(p))
      return
    }
    const connector = connectorNear(p)
    if (connector || tool === 'wire') {
      const from = connector ?? snap(p)
      setGesture({ type: 'wire', from, to: from })
      return
    }
    const c = componentAt(p)
    if (c) {
      props.onSelect({ type: 'component', id: c.id })
      setGesture({ type: 'move', id: c.id, offset: { x: p.x - c.x, y: p.y - c.y }, moved: false })
      return
    }
    const w = wireAt(p)
    if (w) {
      props.onSelect({ type: 'wire', id: w.id })
      return
    }
    props.onSelect(null)
    setGesture({ type: 'pan', startX: e.clientX, startY: e.clientY, view })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toGrid(e)
    setHover(snap(p))
    if (!gesture) return
    if (gesture.type === 'pan') {
      setView({ ...gesture.view, x: gesture.view.x + e.clientX - gesture.startX, y: gesture.view.y + e.clientY - gesture.startY })
    } else if (gesture.type === 'wire') {
      const to = snap(p)
      if (to.x !== gesture.to.x || to.y !== gesture.to.y) setGesture({ ...gesture, to })
    } else if (gesture.type === 'move') {
      const at = snap({ x: p.x - gesture.offset.x, y: p.y - gesture.offset.y })
      const c = doc.components.find((k) => k.id === gesture.id)
      if (!c || (c.x === at.x && c.y === at.y)) return
      if (!gesture.moved) {
        props.onDragStart()
        setGesture({ ...gesture, moved: true })
      }
      props.onDragMove(gesture.id, at)
    }
  }

  const onPointerUp = () => {
    if (gesture?.type === 'wire') {
      const { from, to } = gesture
      if (from.x !== to.x || from.y !== to.y) props.onAddWire(route(from, to))
    } else if (gesture?.type === 'move' && gesture.moved) {
      props.onDragEnd()
    }
    setGesture(null)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const c = componentAt(toGrid(e))
    if (c?.kind === 'switch') props.onToggleSwitch(c.id)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const cursor =
    gesture?.type === 'pan' ? 'grabbing' : tool === 'select' ? 'default' : 'crosshair'
  const isSelected = (type: 'component' | 'wire', id: string) => selection?.type === type && selection.id === id
  const pieceList = [...translation.pieces.entries()]

  return (
    <svg
      ref={svgRef}
      className="block w-full h-full select-none"
      style={{ touchAction: 'none', cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
    >
      <defs>
        <pattern
          id="cl-grid"
          width={G * view.zoom}
          height={G * view.zoom}
          patternUnits="userSpaceOnUse"
          x={view.x}
          y={view.y}
        >
          <circle cx={0.5} cy={0.5} r={Math.max(0.6, view.zoom * 0.9)} fill="#d4d4d8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cl-grid)" />

      <g transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}>
        {/* Halo de selección / error en cables */}
        {doc.wires.map((w) => {
          const sel = isSelected('wire', w.id)
          if (!sel) return null
          return (
            <line key={`sel-${w.id}`} x1={w.x1 * G} y1={w.y1 * G} x2={w.x2 * G} y2={w.y2 * G}
              stroke="#93c5fd" strokeWidth={10} strokeLinecap="round" />
          )
        })}

        {/* Cables, coloreados por voltaje */}
        {pieceList.map(([id, piece]) => (
          <line key={id} x1={piece.a.x * G} y1={piece.a.y * G} x2={piece.b.x * G} y2={piece.b.y * G}
            stroke={colorOfNet(solution?.junctionNets[keyOf(piece.a)])} strokeWidth={3} strokeLinecap="round" />
        ))}

        {/* Componentes */}
        {doc.components.map((c) => {
          const nets = solution?.terminalNets[c.id]
          const leads: [string, string?] = [colorOfNet(nets?.[0]), colorOfNet(nets?.[1])]
          const sel = isSelected('component', c.id)
          const bad = highlight.has(c.id)
          return (
            <g key={c.id} transform={`translate(${c.x * G},${c.y * G}) rotate(${c.rot * 90})`}>
              {(sel || bad) && (
                <rect
                  x={c.kind === 'ground' ? -18 : -HALF * G - 6}
                  y={c.kind === 'ground' ? -8 : -22}
                  width={c.kind === 'ground' ? 36 : HALF * G * 2 + 12}
                  height={c.kind === 'ground' ? 40 : 44}
                  rx={8}
                  fill={sel ? '#dbeafe' : props.highlightTone === 'error' ? '#fee2e2' : '#fef3c7'}
                  stroke={sel ? '#60a5fa' : props.highlightTone === 'error' ? '#f87171' : '#fbbf24'}
                  strokeWidth={1.5}
                />
              )}
              <ComponentSymbol c={c} leads={leads} gradientId={`cl-grad-${c.id}`}
                glow={c.kind === 'led' && solution ? Math.min(1, Math.max(0, solution.components[c.id]?.current ?? 0) / 0.02) : 0} />
            </g>
          )
        })}

        {/* Corriente animada */}
        {animate && solution && (
          <g pointerEvents="none">
            {pieceList.map(([id, piece]) => {
              const speed = flowSpeed(solution.wireCurrents[id] ?? 0)
              if (!speed) return null
              return (
                <line key={`f-${id}`} data-speed={speed}
                  x1={piece.a.x * G} y1={piece.a.y * G} x2={piece.b.x * G} y2={piece.b.y * G}
                  stroke="#facc15" strokeWidth={4.5} strokeLinecap="round" strokeDasharray="0 16" />
              )
            })}
            {doc.components.map((c) => {
              if (c.kind === 'ground' || c.kind === 'voltmeter') return null
              const speed = flowSpeed(solution.components[c.id]?.current ?? 0)
              if (!speed) return null
              const [a, b] = terminalPoints(c)
              return (
                <line key={`f-${c.id}`} data-speed={speed}
                  x1={a.x * G} y1={a.y * G} x2={b.x * G} y2={b.y * G}
                  stroke="#facc15" strokeWidth={4.5} strokeLinecap="round" strokeDasharray="0 16" />
              )
            })}
          </g>
        )}

        {/* Uniones (3+ conexiones) y terminales sueltos */}
        {[...junctionDegree.entries()].map(([k, d]) => {
          if (d < 3) return null
          const [x, y] = k.split(',').map(Number)
          return <circle key={`j-${k}`} cx={x * G} cy={y * G} r={4.5} fill="#3f3f46" />
        })}
        {doc.components.flatMap((c) =>
          terminalPoints(c).map((p, t) =>
            junctionDegree.has(keyOf(p)) ? null : (
              <circle key={`t-${c.id}-${t}`} cx={p.x * G} cy={p.y * G} r={3.5} fill="white" stroke="#f59e0b" strokeWidth={2} />
            ),
          ),
        )}

        {/* Etiquetas (sin rotar) */}
        {doc.components.map((c) => <Label key={`l-${c.id}`} c={c} result={result} />)}

        {/* Vista previa: cable en curso */}
        {gesture?.type === 'wire' && (
          <polyline
            points={route(gesture.from, gesture.to).map((p) => `${p.x * G},${p.y * G}`).join(' ')}
            fill="none" stroke="#3b82f6" strokeWidth={3} strokeDasharray="6 4" strokeLinecap="round"
          />
        )}

        {/* Vista previa: componente por colocar */}
        {hover && tool !== 'select' && tool !== 'wire' && (
          <g transform={`translate(${hover.x * G},${hover.y * G}) rotate(${props.placeRotation * 90})`} opacity={0.45}>
            <ComponentSymbol c={{ kind: tool, closed: true }} />
          </g>
        )}
        {hover && !gesture && (tool === 'wire' || connectorNear(hover)) && (
          <circle cx={hover.x * G} cy={hover.y * G} r={5} fill="none" stroke="#3b82f6" strokeWidth={2} />
        )}
      </g>
    </svg>
  )
}

function Label({ c, result }: { c: Placed; result: DCResult }) {
  if (c.kind === 'ground') return null
  const state = result.ok ? result.components[c.id] : undefined
  let value = ''
  let strong = false
  switch (c.kind) {
    case 'resistor': value = formatSI(c.resistance, 'Ω'); break
    case 'voltage-source': value = formatSI(c.voltage, 'V'); break
    case 'current-source': value = formatSI(c.current, 'A'); break
    case 'capacitor': value = formatSI(c.capacitance, 'F'); break
    case 'inductor': value = formatSI(c.inductance, 'H'); break
    case 'zener': value = formatSI(c.zenerVoltage, 'V'); break
    case 'led': value = LED_NAME[c.color]; break
    case 'switch': value = c.closed ? 'cerrado' : 'abierto'; break
    case 'voltmeter': value = state ? formatSI(state.voltage, 'V') : '—'; strong = true; break
    case 'ammeter': value = state ? formatSI(state.current, 'A') : '—'; strong = true; break
  }
  const vertical = c.rot % 2 === 1
  const x = (c.x + (vertical ? 1.15 : 0)) * G
  const y = (c.y + (vertical ? 0.3 : -1.35)) * G
  const letter = METER_LETTER[c.kind]
  return (
    <g pointerEvents="none">
      {letter && (
        <text x={c.x * G} y={c.y * G + 5} fontSize={14} fontWeight={700} fill="#3f3f46" textAnchor="middle">{letter}</text>
      )}
      <text x={x} y={y} fontSize={11.5} textAnchor={vertical ? 'start' : 'middle'}
        fill={strong ? '#1d4ed8' : '#3f3f46'} fontWeight={strong ? 700 : 500}
        stroke="white" strokeWidth={3} paintOrder="stroke">
        <tspan fill="#a1a1aa" fontWeight={500}>{c.id} </tspan>{value}
      </text>
    </g>
  )
}

