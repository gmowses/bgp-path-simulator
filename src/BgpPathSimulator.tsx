import { useState, useCallback, useEffect } from 'react'
import { Sun, Moon, Languages, GitBranch, Plus, Trash2, Play, Trophy, ChevronDown, ChevronUp } from 'lucide-react'

const translations = {
  en: {
    title: 'BGP Path Simulator',
    subtitle: 'Simulate BGP best path selection following Cisco\'s decision algorithm. Add routes and see the step-by-step process.',
    addRoute: 'Add Route',
    routeN: 'Route',
    prefix: 'Prefix / Next-Hop',
    weight: 'Weight',
    localPref: 'LOCAL_PREF',
    asPath: 'AS_PATH',
    asPathLen: 'AS_PATH Length',
    origin: 'ORIGIN',
    med: 'MED',
    routerType: 'Peer Type',
    igpMetric: 'IGP Metric',
    routerId: 'Router ID',
    simulate: 'Simulate',
    clear: 'Clear All',
    result: 'Best Path Decision',
    winner: 'Winner',
    eliminated: 'Eliminated at step',
    step: 'Step',
    stepDesc: [
      'Highest Weight (Cisco proprietary)',
      'Highest LOCAL_PREF',
      'Locally originated route preferred',
      'Shortest AS_PATH',
      'Lowest ORIGIN code (i < e < ?)',
      'Lowest MED',
      'eBGP over iBGP',
      'Lowest IGP metric to next-hop',
      'Oldest eBGP route',
      'Lowest Router ID',
    ],
    survivors: 'Survivors',
    allTie: 'All routes tie at this step',
    originTypes: { i: 'IGP (i)', e: 'EGP (e)', '?': 'Incomplete (?)' },
    peerTypes: { ebgp: 'eBGP', ibgp: 'iBGP' },
    addMin2: 'Add at least 2 routes to simulate.',
    builtBy: 'Built by',
    references: 'References',
    refList: ['RFC 4271 – A Border Gateway Protocol 4 (BGP-4)'],
  },
  pt: {
    title: 'Simulador de Caminho BGP',
    subtitle: 'Simule a selecao do melhor caminho BGP seguindo o algoritmo Cisco. Adicione rotas e veja o processo passo a passo.',
    addRoute: 'Adicionar Rota',
    routeN: 'Rota',
    prefix: 'Prefixo / Next-Hop',
    weight: 'Weight',
    localPref: 'LOCAL_PREF',
    asPath: 'AS_PATH',
    asPathLen: 'Comprimento AS_PATH',
    origin: 'ORIGIN',
    med: 'MED',
    routerType: 'Tipo de Par',
    igpMetric: 'Metrica IGP',
    routerId: 'Router ID',
    simulate: 'Simular',
    clear: 'Limpar',
    result: 'Decisao de Melhor Caminho',
    winner: 'Vencedor',
    eliminated: 'Eliminado na etapa',
    step: 'Etapa',
    stepDesc: [
      'Maior Weight (proprietario Cisco)',
      'Maior LOCAL_PREF',
      'Rota originada localmente preferida',
      'Menor AS_PATH',
      'Menor codigo ORIGIN (i < e < ?)',
      'Menor MED',
      'eBGP sobre iBGP',
      'Menor metrica IGP ao next-hop',
      'Rota eBGP mais antiga',
      'Menor Router ID',
    ],
    survivors: 'Sobreviventes',
    allTie: 'Todas as rotas empatam nesta etapa',
    originTypes: { i: 'IGP (i)', e: 'EGP (e)', '?': 'Incompleto (?)' },
    peerTypes: { ebgp: 'eBGP', ibgp: 'iBGP' },
    addMin2: 'Adicione pelo menos 2 rotas para simular.',
    builtBy: 'Criado por',
    references: 'Referencias',
    refList: ['RFC 4271 – A Border Gateway Protocol 4 (BGP-4)'],
  },
} as const

type Lang = keyof typeof translations
type Origin = 'i' | 'e' | '?'
type PeerType = 'ebgp' | 'ibgp'

interface Route {
  id: number
  prefix: string
  weight: number
  localPref: number
  asPath: string
  origin: Origin
  med: number
  peerType: PeerType
  igpMetric: number
  routerId: string
}

interface StepResult {
  stepIndex: number
  desc: string
  survivors: number[]
  eliminated: number[]
  allTie: boolean
}

function asPathLen(path: string): number {
  if (!path.trim()) return 0
  return path.trim().split(/\s+/).length
}

function originCode(o: Origin): number {
  return o === 'i' ? 0 : o === 'e' ? 1 : 2
}

function routerIdToNum(rid: string): number {
  const parts = rid.split('.')
  if (parts.length === 4) {
    return parts.reduce((acc, p) => acc * 256 + parseInt(p, 10), 0)
  }
  return parseInt(rid, 10) || 0
}

function simulate(routes: Route[]): { steps: StepResult[]; winner: number | null } {
  if (routes.length < 2) return { steps: [], winner: null }

  const steps: StepResult[] = []
  let alive = routes.map(r => r.id)

  const criteria: Array<{ desc: (t: typeof translations.en) => string; score: (r: Route) => number; wantMax: boolean; stepIndex: number }> = [
    { desc: t => t.stepDesc[0], score: r => r.weight, wantMax: true, stepIndex: 0 },
    { desc: t => t.stepDesc[1], score: r => r.localPref, wantMax: true, stepIndex: 1 },
    { desc: t => t.stepDesc[3], score: r => asPathLen(r.asPath), wantMax: false, stepIndex: 3 },
    { desc: t => t.stepDesc[4], score: r => originCode(r.origin), wantMax: false, stepIndex: 4 },
    { desc: t => t.stepDesc[5], score: r => r.med, wantMax: false, stepIndex: 5 },
    { desc: t => t.stepDesc[6], score: r => r.peerType === 'ebgp' ? 0 : 1, wantMax: false, stepIndex: 6 },
    { desc: t => t.stepDesc[7], score: r => r.igpMetric, wantMax: false, stepIndex: 7 },
    { desc: t => t.stepDesc[9], score: r => routerIdToNum(r.routerId), wantMax: false, stepIndex: 9 },
  ]

  for (const crit of criteria) {
    if (alive.length <= 1) break
    const aliveR = routes.filter(r => alive.includes(r.id))
    const scores = aliveR.map(r => ({ id: r.id, val: crit.score(r) }))
    const bestVal = crit.wantMax
      ? Math.max(...scores.map(s => s.val))
      : Math.min(...scores.map(s => s.val))
    const newWinners = scores.filter(s => s.val === bestVal).map(s => s.id)
    const newEliminated = alive.filter(id => !newWinners.includes(id))
    const allTie = newWinners.length === alive.length

    steps.push({
      stepIndex: crit.stepIndex,
      desc: crit.desc(translations.en),
      survivors: newWinners,
      eliminated: newEliminated,
      allTie,
    })

    if (!allTie) alive = newWinners
  }

  return { steps, winner: alive[0] ?? null }
}

function defaultRoute(id: number): Route {
  return { id, prefix: `10.0.${id}.0/24 via 192.168.1.${id}`, weight: 0, localPref: 100, asPath: '65000 65001', origin: 'i', med: 0, peerType: 'ebgp', igpMetric: 10, routerId: `1.1.1.${id}` }
}

let nextId = 3

export default function BgpPathSimulator() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('pt') ? 'pt' : 'en'))
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [routes, setRoutes] = useState<Route[]>([defaultRoute(1), defaultRoute(2)])
  const [result, setResult] = useState<{ steps: StepResult[]; winner: number | null } | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]))
  const [error, setError] = useState('')

  const t = translations[lang]
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const addRoute = () => {
    setRoutes(r => [...r, defaultRoute(nextId++)])
    setResult(null)
  }

  const removeRoute = (id: number) => {
    setRoutes(r => r.filter(x => x.id !== id))
    setResult(null)
  }

  const updateRoute = (id: number, field: keyof Route, value: string | number) => {
    setRoutes(r => r.map(x => x.id === id ? { ...x, [field]: value } : x))
    setResult(null)
  }

  const handleSimulate = useCallback(() => {
    if (routes.length < 2) { setError(t.addMin2); return }
    setError('')
    setResult(simulate(routes))
    setExpandedSteps(new Set([0, 1, 2, 3, 4, 5, 6, 7]))
  }, [routes, t])

  const toggleStep = (i: number) => {
    setExpandedSteps(s => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  const routeColor = (id: number) => {
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
    return colors[(routes.findIndex(r => r.id === id)) % colors.length]
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <span className="font-semibold">BGP Path Simulator</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/bgp-path-simulator" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          {/* Routes */}
          <div className="space-y-4">
            {routes.map((route, idx) => (
              <div key={route.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: routeColor(route.id) }} />
                    <span className="font-semibold text-sm">{t.routeN} {idx + 1}</span>
                    {result?.winner === route.id && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold">
                        <Trophy size={10} /> {t.winner}
                      </span>
                    )}
                  </div>
                  {routes.length > 2 && (
                    <button onClick={() => removeRoute(route.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="text-xs text-zinc-500 block mb-1">{t.prefix}</label>
                    <input value={route.prefix} onChange={e => updateRoute(route.id, 'prefix', e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.weight}</label>
                    <input type="number" value={route.weight} onChange={e => updateRoute(route.id, 'weight', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.localPref}</label>
                    <input type="number" value={route.localPref} onChange={e => updateRoute(route.id, 'localPref', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-zinc-500 block mb-1">{t.asPath}</label>
                    <input value={route.asPath} onChange={e => updateRoute(route.id, 'asPath', e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.origin}</label>
                    <select value={route.origin} onChange={e => updateRoute(route.id, 'origin', e.target.value as Origin)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="i">{t.originTypes.i}</option>
                      <option value="e">{t.originTypes.e}</option>
                      <option value="?">{t.originTypes['?']}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.med}</label>
                    <input type="number" value={route.med} onChange={e => updateRoute(route.id, 'med', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.routerType}</label>
                    <select value={route.peerType} onChange={e => updateRoute(route.id, 'peerType', e.target.value as PeerType)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="ebgp">{t.peerTypes.ebgp}</option>
                      <option value="ibgp">{t.peerTypes.ibgp}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.igpMetric}</label>
                    <input type="number" value={route.igpMetric} onChange={e => updateRoute(route.id, 'igpMetric', Number(e.target.value))}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">{t.routerId}</label>
                    <input value={route.routerId} onChange={e => updateRoute(route.id, 'routerId', e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={addRoute} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Plus size={15} />{t.addRoute}
            </button>
            <button onClick={handleSimulate} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors">
              <Play size={15} />{t.simulate}
            </button>
            <button onClick={() => { setRoutes([defaultRoute(1), defaultRoute(2)]); setResult(null); nextId = 3 }}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Trash2 size={15} />{t.clear}
            </button>
          </div>

          {error && <p className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

          {/* Results */}
          {result && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-indigo-500" />
                <h2 className="font-semibold text-lg">{t.result}</h2>
              </div>

              {result.steps.map((step, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <button onClick={() => toggleStep(i)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium">{t.stepDesc[step.stepIndex]}</span>
                      {step.allTie && <span className="text-xs text-zinc-400 italic">{t.allTie}</span>}
                      {step.eliminated.length > 0 && !step.allTie && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                          -{step.eliminated.length} {t.eliminated}
                        </span>
                      )}
                    </div>
                    {expandedSteps.has(i) ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                  </button>

                  {expandedSteps.has(i) && (
                    <div className="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <p className="text-xs text-zinc-500 pt-3">{t.survivors}:</p>
                      <div className="flex flex-wrap gap-2">
                        {step.survivors.map(id => {
                          const r = routes.find(x => x.id === id)
                          const idx = routes.findIndex(x => x.id === id)
                          return r ? (
                            <span key={id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium"
                              style={{ borderColor: routeColor(id), color: routeColor(id), backgroundColor: `${routeColor(id)}15` }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: routeColor(id) }} />
                              {t.routeN} {idx + 1}
                            </span>
                          ) : null
                        })}
                      </div>
                      {step.eliminated.length > 0 && !step.allTie && (
                        <>
                          <p className="text-xs text-zinc-500">{t.eliminated}:</p>
                          <div className="flex flex-wrap gap-2">
                            {step.eliminated.map(id => {
                              const idx = routes.findIndex(x => x.id === id)
                              return (
                                <span key={id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800 text-red-500 bg-red-50 dark:bg-red-900/10 font-medium line-through">
                                  {t.routeN} {idx + 1}
                                </span>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {result.winner !== null && (
                <div className="rounded-xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 p-4 flex items-center gap-3">
                  <Trophy size={24} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{t.winner}: {t.routeN} {routes.findIndex(r => r.id === result.winner) + 1}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{routes.find(r => r.id === result.winner)?.prefix}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Decision process reference */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <h3 className="font-semibold mb-3 text-sm">Cisco BGP Best Path Algorithm</h3>
            <ol className="space-y-1.5">
              {t.stepDesc.map((desc, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{desc}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-500 transition-colors">Gabriel Mowses</a></span>
            <span>MIT License</span>
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <p className="text-xs font-medium text-zinc-500 mb-1">{t.references}</p>
            <ul className="space-y-0.5">
              {t.refList.map(ref => (
                <li key={ref} className="text-xs text-zinc-400">{ref}</li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}
