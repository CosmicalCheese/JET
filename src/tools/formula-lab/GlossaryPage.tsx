import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { FORMULAS, normalize } from './formulas'
import { GLOSSARY, GLOSSARY_GROUPS, formulasUsing } from './glossary-data'
import { Rich, Tex } from './Tex'

export function Glossary() {
  const location = useLocation()
  const [query, setQuery] = useState('')
  const target = location.hash.replace('#', '')

  // Al llegar desde una fórmula (…/glosario#g-sumatoria) llevamos la vista a esa entrada
  useEffect(() => {
    if (!target) return
    document.getElementById(target)?.scrollIntoView({ block: 'center' })
  }, [target])

  const entries = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return GLOSSARY
    return GLOSSARY.filter(g => normalize(`${g.name} ${g.read ?? ''} ${g.meaning} ${g.symbol}`).includes(q))
  }, [query])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link to="/formula-lab" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-blue-600">
          <ArrowLeft size={13} /> Formula Lab
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Glosario de símbolos</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Qué significa cada símbolo, cómo se lee en voz alta y en qué fórmulas aparece.
          </p>
        </div>
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar: sumatoria, sigma, vector, joule…"
            className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {entries.length === 0 && <p className="text-sm text-zinc-500">Ningún símbolo coincide con tu búsqueda.</p>}

      {GLOSSARY_GROUPS.map(group => {
        const items = entries.filter(e => e.group === group.id)
        if (items.length === 0) return null
        return (
          <section key={group.id} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">{group.label}</h3>
              <p className="text-xs text-zinc-500">{group.description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map(entry => {
                const used = formulasUsing(entry, FORMULAS)
                const id = `g-${entry.id}`
                return (
                  <article
                    key={entry.id}
                    id={id}
                    className={cn(
                      'scroll-mt-6 bg-white border rounded-lg p-4 flex gap-4',
                      target === id ? 'border-violet-400 ring-2 ring-violet-100' : 'border-zinc-200',
                    )}
                  >
                    <div className="w-20 shrink-0 flex items-start justify-center pt-1 text-lg text-zinc-900">
                      <Tex latex={entry.symbol} />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold text-zinc-900">
                        {entry.name}
                        {entry.read && <span className="ml-2 text-xs font-normal text-zinc-400">se lee {entry.read}</span>}
                      </p>
                      <p className="text-sm text-zinc-600 leading-relaxed"><Rich text={entry.meaning} /></p>
                      {entry.example && (
                        <p className="text-xs text-zinc-500">Ejemplo: <Tex latex={entry.example} /></p>
                      )}
                      {used.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {used.slice(0, 8).map(f => (
                            <Link key={f.id} to={`/formula-lab/${f.id}`} className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-1.5 py-0.5 hover:border-blue-300 hover:text-blue-700">
                              {f.name}
                            </Link>
                          ))}
                          {used.length > 8 && <span className="text-[11px] text-zinc-400 px-1">y {used.length - 8} más</span>}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
