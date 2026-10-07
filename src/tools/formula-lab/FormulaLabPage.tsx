import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Info, Library, Plus, RotateCcw, Search, Trash2, Wrench,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../../components/ui/Button'
import { AREAS, CATEGORIES, getCategory, getFormula, searchFormulas } from './formulas'
import type { Calculator, CategoryId, Formula, InputDef, Interpretation, Values } from './types'
import { Rich, Tex } from './Tex'
import { Visual } from './visuals'
import { Glossary } from './GlossaryPage'
import { glossaryFor } from './glossary-data'

// ═══ Router entry ════════════════════════════════════════════════════════════

export function FormulaLabPage() {
  const { formulaId } = useParams<{ formulaId: string }>()
  if (formulaId === 'glosario') return <Glossary />
  const formula = getFormula(formulaId)
  if (formulaId && !formula) return <Catalog notFound={formulaId} />
  if (!formula) return <Catalog />
  // key: al cambiar de fórmula se reinicia todo el estado del detalle
  return <Detail key={formula.id} formula={formula} />
}

// ═══ Catálogo ════════════════════════════════════════════════════════════════

function Catalog({ notFound }: { notFound?: string }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')

  const results = useMemo(() => {
    const found = searchFormulas(query)
    return cat === 'all' ? found : found.filter(f => f.category === cat)
  }, [query, cat])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Formula Lab</h2>
        <p className="text-sm text-zinc-500 mt-2 max-w-2xl">
          No sólo calcula: explica qué significa cada fórmula, de dónde sale y qué te dice el resultado.
          Basado en el Formulario de Ciencias Básicas ENECB 2026 y en el formulario de derivadas e integrales.
        </p>
      </div>

      {notFound && (
        <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={14} /> No existe la fórmula “{notFound}”. Elige una del catálogo.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar: producto punto, integral, binomial, presión…"
            className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <Link
          to="/formula-lab/glosario"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 hover:bg-violet-100"
        >
          <Library size={13} /> Glosario de símbolos
        </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>Todas</Chip>
          {CATEGORIES.map(c => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>
          ))}
        </div>
      </div>

      {results.length === 0 && <p className="text-sm text-zinc-500">Ninguna fórmula coincide con tu búsqueda.</p>}

      {AREAS.map(area => {
        const cats = CATEGORIES.filter(c => c.area === area.id && results.some(f => f.category === c.id))
        if (cats.length === 0) return null
        return (
          <section key={area.id} className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{area.label}</h3>
            {cats.map(c => (
              <div key={c.id} className="space-y-2">
                <p className="text-sm font-semibold text-zinc-700">{c.label}</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {results.filter(f => f.category === c.id).map(f => <FormulaCard key={f.id} formula={f} />)}
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900',
      )}
    >
      {children}
    </button>
  )
}

function FormulaCard({ formula }: { formula: Formula }) {
  return (
    <Link
      to={`/formula-lab/${formula.id}`}
      className="group flex flex-col gap-2 bg-white border border-zinc-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 group-hover:text-blue-700">{formula.name}</p>
        <ArrowRight size={14} className="text-zinc-300 group-hover:text-blue-500 shrink-0 mt-0.5" />
      </div>
      <div className="text-zinc-800 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_85%,transparent)]">
        <Tex latex={formula.latex} />
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{formula.summary}</p>
      <div className="flex items-center gap-2 mt-auto pt-1">
        {formula.ref && <span className="text-[10px] font-mono text-zinc-400">§{formula.ref}</span>}
        {formula.toolLink && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
            <Wrench size={9} /> {formula.toolLink.label}
          </span>
        )}
      </div>
    </Link>
  )
}

// ═══ Detalle ═════════════════════════════════════════════════════════════════

function Detail({ formula }: { formula: Formula }) {
  const category = getCategory(formula.category)
  const related = (formula.related ?? []).map(getFormula).filter((f): f is Formula => !!f)
  const notation = glossaryFor(formula)
  const toExplanation = () => document.getElementById('explicacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="space-y-3">
        <Link to="/formula-lab" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-blue-600">
          <ArrowLeft size={13} /> Formula Lab
          <span className="text-zinc-300">/</span>
          <span>{category.label}</span>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">{formula.name}</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl"><Rich text={formula.summary} /></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toExplanation}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 hover:bg-violet-100"
          >
            <ArrowDown size={12} /> Entender la fórmula
          </button>
          {formula.toolLink && (
            <Link
              to={formula.toolLink.path}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-100"
            >
              <Wrench size={12} /> Abrir {formula.toolLink.label}
            </Link>
          )}
          {formula.ref && (
            <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
              Formulario §{formula.ref}
            </span>
          )}
        </div>
      </div>

      {/* ── Fórmula ── */}
      <div className="bg-white border border-zinc-200 rounded-lg px-4 py-4 sm:px-5">
        <div className="text-xl sm:text-2xl text-zinc-900 text-center">
          <Tex latex={formula.latex} display />
        </div>
        {/* en el teléfono las otras formas bajan a la explicación para que el ejemplo quede arriba */}
        {formula.forms && (
          <div className="hidden md:grid mt-3 pt-3 border-t border-zinc-100 gap-3 grid-cols-2">
            {formula.forms.map(f => (
              <div key={f.label} className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{f.label}</p>
                <div className="text-zinc-800"><Tex latex={f.latex} display /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Primero la práctica ── */}
      <CalculatorPanel formula={formula} />

      {/* ── Después la teoría ── */}
      <section id="explicacion" className="scroll-mt-6 space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2"><BookOpen size={18} className="text-violet-500" /> Entender la fórmula</h3>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <div className="columns-1 lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <Panel title="¿Qué estamos buscando?">
            <p className="text-sm text-zinc-700 leading-relaxed"><Rich text={formula.goal} /></p>
          </Panel>

          {formula.forms && (
            <div className="md:hidden">
              <Panel title="Otras formas de la fórmula">
                <div className="space-y-3">
                  {formula.forms.map(f => (
                    <div key={f.label} className="min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{f.label}</p>
                      <div className="text-zinc-800"><Tex latex={f.latex} display /></div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          <Panel title="¿Qué significa cada símbolo?">
            <dl className="divide-y divide-zinc-100">
              {formula.variables.map(v => (
                <div key={v.symbol} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                  <dt className="w-20 shrink-0 text-zinc-900"><Tex latex={v.symbol} /></dt>
                  <dd className="text-sm text-zinc-600 leading-relaxed">
                    <Rich text={v.meaning} />
                    {v.unit && <span className="ml-1.5 text-[11px] font-mono text-zinc-400">[{v.unit}]</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {notation.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-100 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Notación que aparece aquí</p>
                <div className="flex flex-wrap gap-1.5">
                  {notation.map(g => (
                    <Link
                      key={g.id}
                      to={`/formula-lab/glosario#g-${g.id}`}
                      title={g.name}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 hover:border-violet-300 hover:text-violet-700"
                    >
                      <span className="text-zinc-900"><Tex latex={g.symbol} /></span> {g.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <Link to="/formula-lab/glosario" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
              Glosario completo de símbolos <ArrowRight size={11} />
            </Link>
          </Panel>

          <Panel title="La idea">
            <div className="space-y-3">
              {formula.intuition.map((p, i) => (
                <p key={i} className="text-sm text-zinc-700 leading-relaxed"><Rich text={p} /></p>
              ))}
            </div>
          </Panel>

          {formula.derivation && (
            <Collapsible title="¿De dónde sale?">
              <div className="space-y-3">
                {formula.derivation.intro && <p className="text-sm text-zinc-700 leading-relaxed"><Rich text={formula.derivation.intro} /></p>}
                <StepList steps={formula.derivation.steps} />
                {formula.derivation.outro && <p className="text-sm text-zinc-700 leading-relaxed"><Rich text={formula.derivation.outro} /></p>}
              </div>
            </Collapsible>
          )}

          <Panel title="¿Cuándo usarla?">
            <Bullets items={formula.whenToUse} />
          </Panel>

          {formula.commonMistakes && (
            <Panel title="Errores comunes">
              <Bullets items={formula.commonMistakes} marker="warn" />
            </Panel>
          )}

          {related.length > 0 && (
            <Panel title="Fórmulas relacionadas">
              <div className="flex flex-wrap gap-2">
                {related.map(r => (
                  <Link key={r.id} to={`/formula-lab/${r.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:border-blue-300 hover:text-blue-700">
                    {r.name} <ArrowRight size={11} />
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </section>
    </div>
  )
}

// ═══ Calculadora ═════════════════════════════════════════════════════════════

type RawValue = string | string[] | [string, string][]

function toRaw(input: InputDef): RawValue {
  switch (input.kind) {
    case 'number': return String(input.default)
    case 'vector': return input.default.map(String)
    case 'pairs': return input.default.map(([x, y]) => [String(x), String(y)] as [string, string])
    case 'list': return input.default.join(', ')
  }
}

function initialRaw(formula: Formula): Record<string, RawValue> {
  const raw: Record<string, RawValue> = {}
  for (const c of formula.calculators) {
    for (const i of c.inputs) if (!(i.id in raw)) raw[i.id] = toRaw(i)
  }
  return raw
}

/** Acepta coma decimal y notación científica (6.67e-11) */
function parseNum(s: string): number {
  const t = s.trim().replace(',', '.')
  if (t === '' || t === '-' || t === '.') return NaN
  return Number(t)
}

function parseValues(inputs: InputDef[], raw: Record<string, RawValue>): Values {
  const out: Values = {}
  for (const input of inputs) {
    const r = raw[input.id]
    switch (input.kind) {
      case 'number': {
        const n = parseNum(r as string)
        if (!Number.isFinite(n)) throw new Error(`Escribe un número válido en “${input.label}”.`)
        out[input.id] = n
        break
      }
      case 'vector': {
        const comps = (r as string[]).map(parseNum)
        if (comps.some(c => !Number.isFinite(c))) throw new Error(`Completa todas las componentes de “${input.label}”.`)
        out[input.id] = comps
        break
      }
      case 'pairs': {
        const rows = (r as [string, string][]).filter(([x, y]) => x.trim() !== '' || y.trim() !== '')
        const parsed = rows.map(([x, y]) => [parseNum(x), parseNum(y)] as [number, number])
        if (parsed.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) throw new Error('Hay una fila con un valor vacío o inválido.')
        out[input.id] = parsed
        break
      }
      case 'list': {
        const parts = (r as string).split(/[\s,;]+/).filter(Boolean)
        const nums = parts.map(Number)
        if (nums.some(n => !Number.isFinite(n))) throw new Error(`Hay un valor inválido en “${input.label}”. Sepáralos con comas o espacios.`)
        out[input.id] = nums
        break
      }
    }
  }
  return out
}

interface Evaluated {
  error?: string
  steps?: ReturnType<Calculator['steps']>
  answer?: string
  extras?: { label: string; latex: string }[]
  interpretation?: Interpretation[]
  visual?: ReturnType<NonNullable<Calculator['visual']>>
  tool?: ReturnType<NonNullable<Calculator['tryInTool']>>
}

function evaluate(calc: Calculator, raw: Record<string, RawValue>): Evaluated {
  try {
    const v = parseValues(calc.inputs, raw)
    const r = calc.compute(v)
    return {
      steps: calc.steps(v, r),
      answer: calc.answer(v, r),
      extras: calc.extras?.(v, r) ?? [],
      interpretation: calc.interpret(v, r),
      visual: calc.visual?.(v, r),
      tool: calc.tryInTool?.(v, r),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

function CalculatorPanel({ formula }: { formula: Formula }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [raw, setRaw] = useState(() => initialRaw(formula))
  const calc = formula.calculators[tab]
  const result = useMemo(() => evaluate(calc, raw), [calc, raw])

  const set = (id: string, value: RawValue) => setRaw(prev => ({ ...prev, [id]: value }))
  // 2D ↔ 3D cambia todos los vectores juntos: operar vectores de distinta dimensión no tiene sentido
  const setDims = (dims: number) => setRaw(prev => {
    const next = { ...prev }
    for (const i of calc.inputs) {
      if (i.kind !== 'vector' || i.fixedDims) continue
      const comps = prev[i.id] as string[]
      next[i.id] = dims === 3 ? [...comps.slice(0, 2), comps[2] ?? '0'] : comps.slice(0, 2)
    }
    return next
  })
  const reset = () => setRaw(prev => {
    const next = { ...prev }
    for (const i of calc.inputs) next[i.id] = toRaw(i)
    return next
  })

  return (
    <section aria-label="Ejemplo interactivo" className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4 min-w-0">
        <div className="bg-white border-2 border-blue-100 rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Ejemplo interactivo · cambia los datos</p>
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-600" title="Restaurar el ejemplo">
              <RotateCcw size={12} /> Restaurar ejemplo
            </button>
          </div>

          {formula.calculators.length > 1 && (
            <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
              {formula.calculators.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setTab(i)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', i === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {calc.example && (
            <p className="text-xs text-zinc-500"><span className="font-medium text-zinc-600">Ejemplo:</span> <Rich text={calc.example} /></p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {calc.inputs.map(input => (
              <InputField key={input.id} input={input} value={raw[input.id]} onChange={v => set(input.id, v)} onDims={setDims} />
            ))}
          </div>
        </div>

        {result.error ? (
          <div className="flex gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
            <Rich text={result.error} />
          </div>
        ) : (
          <>
            <div className="bg-blue-50/60 border border-blue-200 rounded-lg px-5 py-4 space-y-3">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Resultado</p>
              <div className="text-xl text-zinc-900"><Tex latex={result.answer!} display /></div>
              {result.extras!.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.extras!.map(e => (
                    <div key={e.label} className="bg-white border border-blue-100 rounded-md px-2.5 py-1.5">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{e.label}</p>
                      <div className="text-sm text-zinc-800"><Tex latex={e.latex} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Panel title="¿Qué significa?">
              <ul className="space-y-2.5">
                {result.interpretation!.map((it, i) => <InterpretationItem key={i} item={it} />)}
              </ul>
              {result.tool && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { result.tool!.prefill?.(); navigate(result.tool!.path) }}
                  >
                    {result.tool.label} <ArrowRight size={13} />
                  </Button>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>

      {!result.error && (
        <div className="space-y-4 min-w-0">
          {result.visual && (
            <Panel title="Gráfica">
              <Visual spec={result.visual} />
            </Panel>
          )}

          <Panel title="Paso a paso con tus datos">
            <StepList steps={result.steps!} />
          </Panel>
        </div>
      )}
    </section>
  )
}

const inputClass = 'w-full rounded border border-zinc-200 px-2 py-1.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400'

function InputField({ input, value, onChange, onDims }: { input: InputDef; value: RawValue; onChange: (v: RawValue) => void; onDims: (dims: number) => void }) {
  const label = (
    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 mb-1">
      <span className="text-zinc-900"><Tex latex={input.symbol} /></span>
      <span>{input.label}</span>
      {input.kind === 'number' && input.unit && <span className="text-zinc-400 font-mono text-[10px]">[{input.unit}]</span>}
    </span>
  )

  switch (input.kind) {
    case 'number':
      return (
        <label className="block">
          {label}
          <input value={value as string} onChange={e => onChange(e.target.value)} inputMode="decimal" className={inputClass} />
        </label>
      )

    case 'vector': {
      const comps = value as string[]
      return (
        <div>
          <div className="flex items-center justify-between">
            {label}
            {!input.fixedDims && (
              <div className="flex text-[10px] font-medium rounded border border-zinc-200 overflow-hidden mb-1">
                {[2, 3].map(d => (
                  <button key={d} onClick={() => onDims(d)} className={cn('px-1.5 py-0.5', comps.length === d ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-50')}>{d}D</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 font-mono text-zinc-400">
            <span>⟨</span>
            {comps.map((c, i) => (
              <input
                key={i}
                value={c}
                onChange={e => onChange(comps.map((x, j) => (j === i ? e.target.value : x)))}
                inputMode="decimal"
                aria-label={`${input.label} componente ${i + 1}`}
                className={cn(inputClass, 'text-center px-1')}
              />
            ))}
            <span>⟩</span>
          </div>
        </div>
      )
    }

    case 'list':
      return (
        <label className="block sm:col-span-2">
          {label}
          <input value={value as string} onChange={e => onChange(e.target.value)} className={inputClass} placeholder="4, 8, 6, 5…" />
          <span className="text-[10px] text-zinc-400">Separa los datos con comas o espacios.</span>
        </label>
      )

    case 'pairs': {
      const rows = value as [string, string][]
      const update = (i: number, col: 0 | 1, v: string) => onChange(rows.map((r, j): [string, string] => (j === i ? (col === 0 ? [v, r[1]] : [r[0], v]) : r)))
      return (
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            {label}
            <button onClick={() => onChange([...rows, ['', '']])} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-600 mb-1">
              <Plus size={12} /> Fila
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50">
                <tr>
                  <th className="text-left px-2 py-1 text-[11px] font-semibold text-zinc-400 w-8">i</th>
                  <th className="text-left px-2 py-1 text-[11px] font-semibold text-blue-600"><Tex latex={input.xLabel} /></th>
                  <th className="text-left px-2 py-1 text-[11px] font-semibold text-emerald-600"><Tex latex={input.yLabel} /></th>
                  <th className="w-7" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-2 py-1 text-[11px] text-zinc-400 font-mono">{i + 1}</td>
                    <td className="px-1 py-1"><input value={r[0]} onChange={e => update(i, 0, e.target.value)} inputMode="decimal" className={inputClass} aria-label={`x${i + 1}`} /></td>
                    <td className="px-1 py-1"><input value={r[1]} onChange={e => update(i, 1, e.target.value)} inputMode="decimal" className={inputClass} aria-label={`y${i + 1}`} /></td>
                    <td className="px-1 text-center">
                      {rows.length > 1 && (
                        <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-400" aria-label="Eliminar fila">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
  }
}

// ═══ Piezas de presentación ══════════════════════════════════════════════════

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-lg p-5">
      <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </section>
  )
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors">
        <span className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wide">
          <BookOpen size={13} className="text-violet-500" /> {title}
        </span>
        <span className="flex items-center gap-1 text-xs text-zinc-400">
          {open ? 'Ocultar' : 'Ver derivación'} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  )
}

function StepList({ steps }: { steps: { label?: string; latex: string }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 shrink-0 mt-0.5">{i + 1}</span>
          <div className="min-w-0 flex-1">
            {s.label && <p className="text-xs text-zinc-500 mb-0.5"><Rich text={s.label} /></p>}
            <div className="text-zinc-900"><Tex latex={s.latex} display /></div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Bullets({ items, marker = 'dot' }: { items: string[]; marker?: 'dot' | 'warn' }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
          {marker === 'warn'
            ? <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-1" />
            : <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0 mt-2" />}
          <Rich text={t} />
        </li>
      ))}
    </ul>
  )
}

function InterpretationItem({ item }: { item: Interpretation }) {
  const Icon = item.tone === 'good' ? CheckCircle2 : item.tone === 'warn' ? AlertTriangle : Info
  return (
    <li className="flex gap-2.5 text-sm text-zinc-700 leading-relaxed">
      <Icon size={15} className={cn('shrink-0 mt-0.5', item.tone === 'good' ? 'text-emerald-500' : item.tone === 'warn' ? 'text-amber-500' : 'text-blue-400')} />
      <Rich text={item.text} />
    </li>
  )
}

