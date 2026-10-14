import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Download, FilePlus2, Maximize, MousePointer2, Pause, Play, Redo2, RotateCcw, RotateCw, Spline,
  Timer, Trash2, Undo2, Upload, XCircle, Zap,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { cn, downloadBlob } from '../../lib/utils'
import { firstOrder } from './engine/analysis.ts'
import { isReactive } from './engine/transient.ts'
import type { CircuitIssue, ComponentKind } from './engine/types.ts'
import {
  createComponent, emptyDoc, ID_PREFIX, isCircuitDoc, nextId, polyline, replaceComponent, toCircuit, wireIds,
  type CircuitDoc, type Placed, type Pt, type Rotation,
} from './editor/model.ts'
import { EXAMPLES } from './editor/examples.ts'
import { CircuitCanvas, type Selection, type Tool } from './editor/CircuitCanvas.tsx'
import { SymbolIcon } from './editor/symbols.tsx'
import { KIND_LABEL } from './editor/labels.ts'
import { Inspector } from './Inspector.tsx'
import { Scope } from './Scope.tsx'
import { useSimulation } from './useSimulation.ts'
import { formatSI } from './editor/units.ts'

const STORAGE_KEY = 'jet-circuit-lab'
const PALETTE: ComponentKind[] = [
  'voltage-source', 'resistor', 'capacitor', 'inductor', 'diode', 'led', 'zener',
  'ground', 'switch', 'ammeter', 'voltmeter', 'current-source',
]

/** Velocidades: segundos simulados por cada segundo real. */
const SPEEDS = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1]
const NICE = [1, 2, 5]

/** Redondea a 1, 2 o 5 × 10ⁿ. */
function niceScale(x: number): number {
  const e = Math.floor(Math.log10(x))
  const m = x / 10 ** e
  const best = NICE.reduce((a, b) => (Math.abs(Math.log(b / m)) < Math.abs(Math.log(a / m)) ? b : a))
  return best * 10 ** e
}

function loadSaved(): CircuitDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const doc: unknown = raw ? JSON.parse(raw) : null
    return isCircuitDoc(doc) ? doc : null
  } catch {
    return null
  }
}

interface History {
  past: CircuitDoc[]
  present: CircuitDoc
  future: CircuitDoc[]
}

export function CircuitLabPage() {
  // ?ejemplo=divisor (los enlaces desde Formula Lab) abre ese ejemplo; el
  // circuito guardado queda en el historial para volver a él con Deshacer.
  const [searchParams, setSearchParams] = useSearchParams()
  const [linked] = useState(() => EXAMPLES.find((e) => e.id === searchParams.get('ejemplo')))
  const [history, setHistory] = useState<History>(() => {
    const saved = loadSaved()
    if (linked) return { past: saved ? [saved] : [], present: linked.build(), future: [] }
    return { past: [], present: saved ?? EXAMPLES[1].build(), future: [] }
  })
  const [traces, setTraces] = useState<string[]>(() => linked?.traces ?? [])
  const [speed, setSpeed] = useState<'auto' | number>('auto')
  useEffect(() => {
    if (searchParams.has('ejemplo')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])
  const doc = history.present
  const [tool, setTool] = useState<Tool>('select')
  const [placeRotation, setPlaceRotation] = useState<Rotation>(0)
  const [selection, setSelection] = useState<Selection>(null)
  const [animate, setAnimate] = useState(true)
  const [fitKey, setFitKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── Historial ─────────────────────────────────────────────────────────────
  const lastCoalesce = useRef<{ key: string; t: number } | null>(null)
  const dragOrigin = useRef<CircuitDoc | null>(null)

  /** Guarda un cambio. Cambios seguidos con la misma `coalesceKey` (p. ej. un deslizador) cuentan como uno. */
  const commit = useCallback((next: CircuitDoc, coalesceKey?: string) => {
    const now = Date.now()
    const last = lastCoalesce.current
    const merge = !!coalesceKey && last?.key === coalesceKey && now - last.t < 800
    lastCoalesce.current = coalesceKey ? { key: coalesceKey, t: now } : null
    setHistory((h) => ({
      past: merge ? h.past : [...h.past.slice(-99), h.present],
      present: next,
      future: [],
    }))
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h))
  }, [])
  const redo = useCallback(() => {
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
    } catch {
      // Sin almacenamiento (modo privado): el circuito vive solo en esta pestaña.
    }
  }, [doc])

  // ─── Simulación ────────────────────────────────────────────────────────────
  const translation = useMemo(() => toCircuit(doc), [doc])

  // Velocidad automática: que la constante de tiempo más corta dure ~1 s real.
  const autoScale = useMemo(() => {
    const taus = translation.circuit.components
      .filter(isReactive)
      .map((c) => firstOrder(translation.circuit, c.id)?.tau ?? NaN)
      .filter((t) => Number.isFinite(t) && t > 0)
    return taus.length ? niceScale(Math.min(...taus)) : 1
  }, [translation])
  const timescale = speed === 'auto' ? autoScale : speed
  const liveTraces = useMemo(
    () => traces.filter((id) => doc.components.some((c) => c.id === id)),
    [traces, doc],
  )
  const sim = useSimulation(translation.circuit, timescale, liveTraces)
  const result = sim.result
  // Avisos didácticos que no son errores del circuito: un LED con demasiada corriente.
  const burning = useMemo((): CircuitIssue[] => {
    if (!result.ok) return []
    return doc.components
      .filter((c) => c.kind === 'led' && (result.components[c.id]?.current ?? 0) > 0.03)
      .map((c) => ({
        code: 'invalid-value',
        message: `${c.id} lleva ${formatSI(result.components[c.id].current, 'A')}: un LED real se quemaría (máx. ≈ 20–30 mA). Pon una resistencia en serie.`,
        ids: [c.id],
      }))
  }, [result, doc])
  const issues = useMemo(() => (result.ok ? [...result.warnings, ...burning] : result.issues), [result, burning])
  const highlight = useMemo(() => new Set(issues.flatMap((i) => i.ids)), [issues])

  // ─── Acciones ──────────────────────────────────────────────────────────────
  const loadDoc = (next: CircuitDoc, nextTraces: string[] = []) => {
    commit(next)
    setTraces(nextTraces)
    sim.reset()
    setSelection(null)
    setTool('select')
    setFitKey((k) => k + 1)
  }

  const place = (kind: ComponentKind, at: Pt) => {
    const id = nextId(doc.components.map((c) => c.id), ID_PREFIX[kind])
    commit({ ...doc, components: [...doc.components, createComponent(kind, id, at, placeRotation)] })
    setSelection({ type: 'component', id })
    setTool('select')
  }

  const addWire = (points: Pt[]) => {
    const segments = polyline(wireIds(doc), ...points.map((p): [number, number] => [p.x, p.y]))
    commit({ ...doc, wires: [...doc.wires, ...segments] })
  }

  const updateComponent = (next: Placed, coalesceKey?: string) => commit(replaceComponent(doc, next), coalesceKey)

  const selected = selection?.type === 'component' ? doc.components.find((c) => c.id === selection.id) : undefined

  const rotate = () => {
    if (tool !== 'select' && tool !== 'wire') setPlaceRotation((r) => ((r + 1) % 4) as Rotation)
    else if (selected) updateComponent({ ...selected, rot: ((selected.rot + 1) % 4) as Rotation })
  }

  const deleteSelection = () => {
    if (!selection) return
    commit(
      selection.type === 'component'
        ? { ...doc, components: doc.components.filter((c) => c.id !== selection.id) }
        : { ...doc, wires: doc.wires.filter((w) => w.id !== selection.id) },
    )
    setSelection(null)
  }

  const toggleSwitch = (id: string) => {
    const c = doc.components.find((k) => k.id === id)
    if (c?.kind === 'switch') updateComponent({ ...c, closed: !c.closed })
  }

  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'circuito.json')
  }

  const importJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (isCircuitDoc(parsed)) loadDoc(parsed)
      else alert('El archivo no es un circuito de Circuit Lab.')
    } catch {
      alert('No se pudo leer el archivo (¿es JSON válido?).')
    }
  }

  // ─── Teclado ───────────────────────────────────────────────────────────────
  // Sin dependencias: se vuelve a suscribir en cada render para ver el estado actual.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, [contenteditable]')) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      redo()
    } else if (mod) {
      return
    } else if (e.key === 'r' || e.key === 'R') {
      rotate()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      deleteSelection()
    } else if (e.key === 'Escape') {
      setTool('select')
      setSelection(null)
    } else if (e.key === 'w' || e.key === 'W') {
      setTool('wire')
    } else if (e.key === ' ' && selected?.kind === 'switch') {
      e.preventDefault()
      toggleSwitch(selected.id)
    }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ─── UI ────────────────────────────────────────────────────────────────────
  const toolButton = (t: Tool, title: string, icon: React.ReactNode) => (
    <button
      key={t}
      title={title}
      onClick={() => {
        setTool(t)
        if (t !== 'select' && t !== 'wire') setSelection(null)
      }}
      className={cn(
        'h-10 min-w-10 px-1.5 inline-flex items-center justify-center rounded-lg border transition-colors',
        tool === t ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
      )}
    >
      {icon}
    </button>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Circuit Lab</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Arma un circuito y míralo funcionar: voltajes en color, corriente en movimiento y la fórmula que lo explica.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value=""
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.id === e.target.value)
              if (ex) loadDoc(ex.build(), ex.traces)
            }}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
            aria-label="Cargar ejemplo"
          >
            <option value="" disabled>Ejemplos…</option>
            {EXAMPLES.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <HeaderButton icon={<FilePlus2 size={14} />} label="Nuevo" onClick={() => loadDoc(emptyDoc())} />
          <HeaderButton icon={<Download size={14} />} label="Exportar" onClick={exportJson} />
          <HeaderButton icon={<Upload size={14} />} label="Importar" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importJson(f)
              e.target.value = ''
            }} />
        </div>
      </div>

      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-1.5">
        {toolButton('select', 'Seleccionar y mover (Esc)', <MousePointer2 size={17} />)}
        {toolButton('wire', 'Cable (W)', <Spline size={17} />)}
        <span className="w-px h-7 bg-zinc-200 mx-1" />
        {PALETTE.map((k) => toolButton(k, KIND_LABEL[k], <SymbolIcon kind={k} />))}
        <span className="w-px h-7 bg-zinc-200 mx-1" />
        <ActionButton title="Girar (R)" icon={<RotateCw size={16} />} onClick={rotate} disabled={!selected && (tool === 'select' || tool === 'wire')} />
        <ActionButton title="Borrar (Supr)" icon={<Trash2 size={16} />} onClick={deleteSelection} disabled={!selection} />
        <ActionButton title="Deshacer (⌘Z)" icon={<Undo2 size={16} />} onClick={undo} disabled={!history.past.length} />
        <ActionButton title="Rehacer (⇧⌘Z)" icon={<Redo2 size={16} />} onClick={redo} disabled={!history.future.length} />
        <ActionButton title="Corriente animada" icon={<Zap size={16} />} onClick={() => setAnimate((a) => !a)} active={animate} />
        <ActionButton title="Encuadrar" icon={<Maximize size={16} />} onClick={() => setFitKey((k) => k + 1)} />
      </div>

      {sim.active && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => sim.setRunning(!sim.running)}
            className={cn(
              'h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 font-medium',
              sim.running ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
            )}
          >
            {sim.running ? <Pause size={14} /> : <Play size={14} />} {sim.running ? 'Pausar' : 'Continuar'}
          </button>
          <button
            onClick={sim.reset}
            title="Descarga los capacitores y vuelve a t = 0"
            className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-zinc-700 hover:bg-zinc-50"
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
          <span className="inline-flex items-center gap-1.5 tabular-nums text-zinc-600 min-w-28">
            <Timer size={14} /> t = {formatSI(sim.time, 's')}
          </span>
          <label className="inline-flex items-center gap-2 text-zinc-500">
            Velocidad
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-zinc-700"
            >
              <option value="auto">Auto ({formatSI(autoScale, 's')} por segundo)</option>
              {SPEEDS.map((v) => <option key={v} value={v}>{formatSI(v, 's')} por segundo</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_270px]">
        <div className="relative h-[460px] sm:h-[560px] rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <CircuitCanvas
            doc={doc}
            translation={translation}
            result={result}
            tool={tool}
            placeRotation={placeRotation}
            selection={selection}
            highlight={highlight}
            highlightTone={result.ok ? 'warning' : 'error'}
            animate={animate}
            fitKey={fitKey}
            onSelect={setSelection}
            onPlace={place}
            onAddWire={addWire}
            onDragStart={() => { dragOrigin.current = doc }}
            onDragMove={(id, at) => {
              const origin = dragOrigin.current
              const c = origin?.components.find((k) => k.id === id)
              if (origin && c) setHistory((h) => ({ ...h, present: replaceComponent(origin, { ...c, x: at.x, y: at.y }) }))
            }}
            onDragEnd={() => {
              const origin = dragOrigin.current
              dragOrigin.current = null
              if (origin) setHistory((h) => ({ past: [...h.past.slice(-99), origin], present: h.present, future: [] }))
            }}
            onToggleSwitch={toggleSwitch}
          />
          {issues.length > 0 && (
            <div className="absolute top-3 left-3 right-3 space-y-1.5 pointer-events-none">
              {issues.map((i, n) => (
                <div key={n} className={cn(
                  'flex items-start gap-2 text-xs sm:text-sm rounded-lg px-3 py-2 border shadow-sm',
                  result.ok ? 'text-amber-800 bg-amber-50/95 border-amber-200' : 'text-red-800 bg-red-50/95 border-red-200',
                )}>
                  {result.ok ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
                  <span>
                    {i.message}
                    {i.ids.length > 0 && <span className="text-xs opacity-70"> ({i.ids.join(', ')})</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {tool !== 'select' && (
            <div className="absolute left-3 bottom-3 text-xs text-zinc-500 bg-white/90 border border-zinc-200 rounded-lg px-2.5 py-1.5 pointer-events-none">
              {tool === 'wire'
                ? 'Arrastra entre dos puntos para tender un cable · Esc para terminar'
                : `Clic para colocar: ${KIND_LABEL[tool]} · R para girar · Esc para cancelar`}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <Inspector
            doc={doc}
            translation={translation}
            result={result}
            selection={selection}
            onChange={updateComponent}
            onDelete={deleteSelection}
            traces={liveTraces}
            onToggleTrace={(id) => setTraces((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id].slice(-4)))}
          />
        </aside>
      </div>

      <Scope traces={liveTraces} samples={sim.samples} onRemove={(id) => setTraces((t) => t.filter((x) => x !== id))} />
    </div>
  )
}

function ActionButton({ title, icon, onClick, disabled = false, active = false }: {
  title: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 w-10 inline-flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40',
        active ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
      )}
    >
      {icon}
    </button>
  )
}

function HeaderButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50">
      {icon} {label}
    </button>
  )
}
