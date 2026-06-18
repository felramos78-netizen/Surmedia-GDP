import { useState, useMemo, useEffect, Fragment } from 'react'
import {
  Plus, Pencil, Trash2, Building2, Users, Briefcase,
  ChevronDown, ChevronUp, ChevronsUpDown, DollarSign, TrendingUp,
  TrendingDown, BarChart2, Search, Percent, UserPlus,
  UserMinus, RefreshCw, FileDown, Eye, EyeOff,
} from 'lucide-react'
import {
  useWorkCenters, useUpdateWorkCenter, useDeleteWorkCenter,
} from '@/hooks/useWorkCenters'
import { usePayrollTable, usePayrollYears, useMovements, useExpiringContracts, useEmployeeStats } from '@/hooks/useDotacion'
import type { WorkCenter, CostType, LegalEntity } from '@/types'
import { SmartTab } from './SmartTab'
import { DotacionTab } from './DotacionTab'
import { WorkCenterModal } from './WorkCenterModal'
import { WorkCenterDetailPanel } from './WorkCenterDetailPanel'
import { FilterSelect, MultiSelect, FilterRemTh, MiniStat } from './wcComponents'
import {
  type WCCardId, type SortKey, type SortDir, type CenterSortKey, type RemColFilters,
  MONTHS_LABEL, MONTHS, WC_CARD_IDS, NUMERIC_KEYS,
  fmt, fmtShort, getPonderacion, aggregateWCRows, getRemVal,
  COST_TYPE_LABEL, COST_TYPE_COLOR, LEGAL_ENTITY_LABEL, LEGAL_ENTITY_COLOR,
} from './wcUtils'
import { exportCentrosToExcel, exportRemuneracionesToExcel } from './wcExcel'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkCentersPage() {
  const [visible,      setVisible]      = useState(false)
  const [tab,          setTab]          = useState<'centros' | 'dotacion' | 'remuneraciones' | 'honorarios' | 'compras'>('centros')
  const [year,         setYear]         = useState('')
  const [month,        setMonth]        = useState('')
  const [modal,        setModal]        = useState<'create' | WorkCenter | null>(null)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [typeFilters,  setTypeFilters]  = useState<CostType[]>([])
  const [ubicFilters,  setUbicFilters]  = useState<string[]>([])
  const [selectedWC,   setSelectedWC]   = useState<WorkCenter | null>(null)
  const [remColFilters, setRemColFilters] = useState<RemColFilters>({})
  const [remSearch,     setRemSearch]     = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('employeeName')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [cSortKey,     setCSort]        = useState<CenterSortKey>('name')
  const [cSortDir,     setCDir]         = useState<SortDir>('asc')
  const [movTab,       setMovTab]       = useState<'vacaciones' | 'licencias' | 'reemplazos' | 'contratos'>('vacaciones')
  const [cardOrder,    setCardOrder]    = useState<WCCardId[]>(() => {
    try {
      const s = localStorage.getItem('gdp-wc-cards')
      const p = s ? JSON.parse(s) : null
      if (Array.isArray(p) && p.length === WC_CARD_IDS.length) return p as WCCardId[]
    } catch {}
    return [...WC_CARD_IDS]
  })
  const [dgFrom,       setDgFrom]       = useState<number | null>(null)
  const [dgOver,       setDgOver]       = useState<number | null>(null)

  const { data: centers = [], isLoading: centersLoading } = useWorkCenters()
  const { data: years   = [] }                             = usePayrollYears()
  const { data: empStats }                                 = useEmployeeStats()
  const deleteWC                                           = useDeleteWorkCenter()
  const updateWC                                           = useUpdateWorkCenter()

  useEffect(() => {
    if (years.length > 0 && !year) setYear(String(years[0]))
  }, [years, year])

  const { data: allEntries = [], isLoading: payrollLoading } = usePayrollTable({
    year, month: month || undefined,
  })

  const { data: movements }         = useMovements({ year, month: month || undefined })
  const { data: expiringContracts = [] } = useExpiringContracts()

  const isMonthly = !!month

  const monthsLoaded = useMemo(() =>
    isMonthly ? 1 : Math.max(new Set(allEntries.map(e => e.month)).size, 1)
  , [allEntries, isMonthly])

  // ── Centros tab stats ───────────────────────────────────────────────────────

  const ubicaciones = useMemo(() =>
    [...new Set(centers.map(c => c.ubicacion).filter((u): u is string => !!u))].sort()
  , [centers])

  const filtered = useMemo(() => centers.filter(wc => {
    const matchSearch = !search || wc.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilters.length === 0 || typeFilters.includes(wc.costType)
    const matchUbic   = ubicFilters.length === 0 || ubicFilters.includes(wc.ubicacion ?? '')
    return matchSearch && matchType && matchUbic
  }), [centers, search, typeFilters, ubicFilters])

  const enrichedCenters = useMemo(() =>
    filtered.map(wc => {
      const wcEntries = allEntries.filter(e =>
        e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
      )
      const costoReal = wcEntries.reduce((s, e) => {
        const pond    = getPonderacion(e.employee.workCenters, e.legalEntity)
        const isPrimary = (e.employee.workCenters ?? [])
          .filter(a => a.legalEntity === e.legalEntity)[0]?.workCenter?.name === wc.name
        return s + e.grossSalary * pond + (isPrimary ? 160_000 : 0)
      }, 0)
      const ingresos   = wc.totalIngresos * monthsLoaded
      const diferencia = ingresos > 0 ? ingresos - costoReal : null
      return { wc, costoReal, ingresos, diferencia }
    })
  , [filtered, allEntries, monthsLoaded])

  const sortedCenters = useMemo(() =>
    [...enrichedCenters].sort((a, b) => {
      let cmp = 0
      switch (cSortKey) {
        case 'name':      cmp = a.wc.name.localeCompare(b.wc.name, 'es'); break
        case 'ubicacion': cmp = (a.wc.ubicacion ?? '').localeCompare(b.wc.ubicacion ?? '', 'es'); break
        case 'costType':  cmp = a.wc.costType.localeCompare(b.wc.costType); break
        case 'personal':  cmp = (a.wc.totalPersonnel ?? 0) - (b.wc.totalPersonnel ?? 0); break
        case 'cargos':    cmp = (a.wc.positions?.length ?? 0) - (b.wc.positions?.length ?? 0); break
        case 'ingresos':  cmp = a.ingresos - b.ingresos; break
        case 'gasto':     cmp = a.costoReal - b.costoReal; break
        case 'diferencia':cmp = (a.diferencia ?? -Infinity) - (b.diferencia ?? -Infinity); break
      }
      return cSortDir === 'asc' ? cmp : -cmp
    })
  , [enrichedCenters, cSortKey, cSortDir])

  function swapDashCards(a: number, b: number) {
    const next = [...cardOrder]
    ;[next[a], next[b]] = [next[b], next[a]]
    setCardOrder(next)
    setDgFrom(null); setDgOver(null)
    try { localStorage.setItem('gdp-wc-cards', JSON.stringify(next)) } catch {}
  }

  function handleCenterSort(col: CenterSortKey) {
    if (col === cSortKey) setCDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCSort(col); setCDir('asc') }
  }

  const centerStats = useMemo(() => {
    const totalBudget    = centers.reduce((s, c) => s + (c.presupuesto ?? 0), 0)
    const totalPersonnel = centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)
    const byUbic: Record<string, number> = {}
    for (const c of centers) {
      const u = c.ubicacion ?? 'Sin ubicación'
      byUbic[u] = (byUbic[u] ?? 0) + 1
    }
    return {
      total: centers.length,
      directCount:   centers.filter(c => c.costType === 'DIRECTO').length,
      indirectCount: centers.filter(c => c.costType === 'INDIRECTO').length,
      totalPersonnel, totalBudget, byUbic,
    }
  }, [centers])

  // ── Indirect cost % from payroll ────────────────────────────────────────────

  const payrollStats = useMemo(() => {
    const typeMap = new Map(centers.map(c => [c.name, c.costType]))
    let directCost = 0, indirectCost = 0
    for (const e of allEntries) {
      const isIndirect = e.employee.workCenters
        ?.filter(a => a.legalEntity === e.legalEntity)
        .some(a => typeMap.get(a.workCenter.name) === 'INDIRECTO')
      if (isIndirect) indirectCost += e.grossSalary
      else            directCost   += e.grossSalary
    }
    const total = directCost + indirectCost
    return { directCost, indirectCost, total, pctIndirecto: total > 0 ? (indirectCost / total) * 100 : 0 }
  }, [allEntries, centers])

  // ── Remuneraciones tab rows ─────────────────────────────────────────────────

  const rows = useMemo(() => {
    const agg = aggregateWCRows(allEntries, isMonthly)
    return [...agg].sort((a, b) => {
      if (NUMERIC_KEYS.has(sortKey)) {
        const diff = (a[sortKey] as number) - (b[sortKey] as number)
        return sortDir === 'asc' ? diff : -diff
      }
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allEntries, isMonthly, sortKey, sortDir])

  const remTableRows = useMemo(() => {
    let result = rows
    if (remSearch) {
      const q = remSearch.toLowerCase()
      result = result.filter(r => r.employeeName.toLowerCase().includes(q) || r.rut.toLowerCase().includes(q))
    }
    const active = Object.entries(remColFilters).filter(([, vals]) => vals.size > 0)
    if (active.length > 0) result = result.filter(r => active.every(([col, vals]) => vals.has(getRemVal(r, col))))
    return result
  }, [rows, remColFilters, remSearch])

  function handleRemColFilter(col: string, vals: Set<string>) {
    setRemColFilters(prev => {
      if (vals.size === 0) { const { [col]: _, ...rest } = prev; return rest }
      return { ...prev, [col]: vals }
    })
  }

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  async function handleDelete(id: string) {
    await deleteWC.mutateAsync(id)
    setConfirmId(null)
    if (selectedWC?.id === id) setSelectedWC(null)
  }

  const periodoLabel = isMonthly ? `${MONTHS_LABEL[Number(month)]} ${year}` : year ? `${year} (anual)` : ''

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Centros de Trabajo
            <button
              onClick={() => setVisible(v => !v)}
              title={visible ? 'Ocultar datos' : 'Revelar datos'}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-300 hover:text-gray-500"
            >
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </h2>
          <p className="text-sm text-gray-500 mt-1">{centers.length} centros registrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect value={year} onChange={setYear} placeholder="Año"
            options={years.map(y => ({ value: String(y), label: String(y) }))} />
          <FilterSelect value={month} onChange={setMonth} placeholder="Todo el año"
            options={MONTHS} />
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} /> Nuevo centro
          </button>
        </div>
      </div>

      {/* CSS data-hiding: blur td cells and .gdp-val elements when hidden */}
      {!visible && (
        <style>{`
          .gdp-wc td                    { filter: blur(5px); user-select: none; pointer-events: none; }
          .gdp-wc .gdp-val              { filter: blur(5px); user-select: none; }
          .gdp-wc p.text-2xl,
          .gdp-wc p.text-xl             { filter: blur(5px); user-select: none; }
          .gdp-wc .gdp-content          { filter: blur(5px); user-select: none; pointer-events: none; }
        `}</style>
      )}
      <div className="gdp-wc">

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          ['centros',       'Centros'],
          ['dotacion',      'Dotación'],
          ['remuneraciones','Remuneraciones'],
          ['honorarios',    'Honorarios'],
          ['compras',       'Compras'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: CENTROS ══════════════ */}
      {tab === 'centros' && (
        <div className="space-y-5">

          {/* ── Dashboard 3/3/3/2 ─────────────────────────────────────── */}
          {(() => {
            // ── Computations ──────────────────────────────────────────────
            const uniquePeople = new Set(allEntries.map(e => e.employeeId)).size
            // Activos = still employed on the 1st of the NEXT period
            // Monthly: endDate null OR >= 2026-02-01
            // Annual:  endDate null OR >= 2027-01-01
            const nextPeriodStart = year
              ? (month ? new Date(Number(year), Number(month), 1)       // 1st of next month
                       : new Date(Number(year) + 1, 0, 1))              // 1st of next year
              : null
            const periodStart = year
              ? (month ? new Date(Number(year), Number(month) - 1, 1)
                       : new Date(Number(year), 0, 1))
              : null
            const isActiveAtClose = (e: typeof allEntries[0]) => {
              const ed = e.employee.endDate ? new Date(e.employee.endDate) : null
              return !ed || !nextPeriodStart || ed >= nextPeriodStart
            }
            const totalActive = new Set(allEntries.filter(isActiveAtClose).map(e => e.employeeId)).size
            const comActive   = new Set(allEntries.filter(e => e.legalEntity === 'COMUNICACIONES_SURMEDIA' && isActiveAtClose(e)).map(e => e.employeeId)).size
            const conActive   = new Set(allEntries.filter(e => e.legalEntity === 'SURMEDIA_CONSULTORIA'    && isActiveAtClose(e)).map(e => e.employeeId)).size
            // Bajas = endDate within the period
            const totalBajas  = new Set(allEntries.filter(e => {
              const ed = e.employee.endDate ? new Date(e.employee.endDate) : null
              return ed && periodStart && nextPeriodStart && ed >= periodStart && ed < nextPeriodStart
            }).map(e => e.employeeId)).size
            const contratacionN    = uniquePeople || centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)
            const uniquePersonMonths = new Set(allEntries.map(e => `${e.employeeId}-${e.year}-${e.month}`)).size
            const contratacionCost = uniquePersonMonths * 160_000
            const totalGastos      = payrollStats.total + contratacionCost
            const totalIngresos    = centers.reduce((s, c) => s + c.totalIngresos, 0) * monthsLoaded
            const diferencia       = totalIngresos - totalGastos
            const dPos             = diferencia >= 0
            const label            = year ? (month ? `${MONTHS_LABEL[Number(month)]} ${year}` : `Anual ${year}`) : ''
            const locMap           = new Map(centers.map(c => [c.name, c.ubicacion ?? '']))
            const locLabels        = ['Antofagasta', 'Atacama', 'Santiago / Rancagua']
            const gastoByLoc: Record<string, number> = {}
            for (const e of allEntries) {
              const wcs = e.employee.workCenters?.filter(a => a.legalEntity === e.legalEntity) ?? []
              for (const a of wcs) {
                const loc = locMap.get(a.workCenter.name) ?? ''
                if (!loc) continue
                const portion = e.grossSalary / wcs.length
                if (loc === 'Transversal') {
                  locLabels.forEach(lbl => { gastoByLoc[lbl] = (gastoByLoc[lbl] ?? 0) + portion / 3 })
                } else {
                  const key = (loc === 'Santiago' || loc === 'Rancagua') ? 'Santiago / Rancagua' : loc
                  gastoByLoc[key] = (gastoByLoc[key] ?? 0) + portion
                }
              }
            }
            const locTotal    = locLabels.reduce((s, l) => s + (gastoByLoc[l] ?? 0), 0)
            const ingresos    = movements?.ingresos   ?? []
            const salidas     = movements?.salidas    ?? []
            const vacaciones  = movements?.vacaciones ?? []
            const licencias   = movements?.licencias  ?? []
            const reemplazos  = movements?.reemplazos ?? []

            function fmtDate(d: any) {
              if (!d) return '—'
              const dt = new Date(d)
              return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
            }
            function getCenter(wcs: any[]) { return wcs?.[0]?.workCenter?.name ?? '—' }

            // ── Shared card shell ──────────────────────────────────────────
            const C = 'bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden h-full select-none'
            const H = 'px-3.5 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0'
            const hl = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'
            const sub = 'text-[10px] text-gray-300'
            const noData = <span className="text-gray-300 font-normal text-xl">—</span>

            // ── Card content by ID ─────────────────────────────────────────
            const renderCard = (id: WCCardId) => {
              switch (id) {

                case 'centros': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Building2 size={10}/>Centros</span></div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{centerStats.total}</p>
                      <p className="text-xs text-gray-500 mt-1">{centerStats.directCount} directos · {centerStats.indirectCount} indirectos</p>
                      <div className="mt-2 space-y-0.5">
                        {Object.entries(centerStats.byUbic).sort((a,b)=>b[1]-a[1]).map(([u,n])=>(
                          <div key={u} className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-300 flex-shrink-0"/>
                            <span className="text-[10px] text-gray-400 truncate">{n} · {u}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )

                case 'colaboradores': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Users size={10}/>Colaboradores</span><span className={sub}>{new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{empStats?.active ?? centers.reduce((s,c)=>s+(c.totalPersonnel??0),0)}</p>
                      {uniquePeople > 0
                        ? <>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">{uniquePeople} Sueldos Brutos</span>
                              {totalBajas > 0 && (
                                <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                                  {totalBajas} {totalBajas === 1 ? 'baja' : 'bajas'}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{empStats?.activeComunicaciones ?? comActive}</span>
                                <span className="text-[10px] text-gray-400">Comunicaciones</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">{empStats?.activeConsultoria ?? conActive}</span>
                                <span className="text-[10px] text-gray-400">Consultoría</span>
                              </div>
                            </div>
                          </>
                        : <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{empStats?.activeComunicaciones ?? '—'}</span>
                              <span className="text-[10px] text-gray-400">Comunicaciones</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">{empStats?.activeConsultoria ?? '—'}</span>
                              <span className="text-[10px] text-gray-400">Consultoría</span>
                            </div>
                          </div>
                      }
                    </div>
                  </div>
                )

                case 'contratacion': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Briefcase size={10}/>Gastos Contratación</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-violet-700">{uniquePersonMonths>0?fmtShort(contratacionCost):noData}</p>
                      {uniquePersonMonths>0&&<p className="text-xs text-gray-500 mt-1">{uniquePersonMonths} persona-mes · $160K c/u</p>}
                    </div>
                  </div>
                )

                case 'directo': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingUp size={10} className="text-brand-400"/>Gasto Directo</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-brand-700">{payrollStats.directCost>0?fmtShort(payrollStats.directCost):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-gray-400 mt-1">{(100-payrollStats.pctIndirecto).toFixed(1)}% del gasto total</p>}
                    </div>
                  </div>
                )

                case 'indirecto': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingDown size={10} className="text-gray-400"/>Gasto Indirecto</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-600">{payrollStats.indirectCost>0?fmtShort(payrollStats.indirectCost):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-amber-500 mt-1">{payrollStats.pctIndirecto.toFixed(1)}% del gasto total</p>}
                    </div>
                  </div>
                )

                case 'total-payroll': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><BarChart2 size={10}/>Sueldos</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{payrollStats.total>0?fmtShort(payrollStats.total):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-gray-400 mt-1">Sueldos brutos</p>}
                    </div>
                  </div>
                )

                case 'fin-gastos': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingDown size={10} className="text-red-400"/>Total Capital Humano</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{year?fmtShort(totalGastos):noData}</p>
                      <p className="text-[10px] text-gray-300 mt-1">Sueldos + contratación</p>
                    </div>
                  </div>
                )

                case 'fin-ingresos': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingUp size={10} className="text-emerald-400"/>Total Ingresos</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-emerald-700">{totalIngresos>0?fmtShort(totalIngresos):<span className="text-gray-300 font-normal text-xl">Sin definir</span>}</p>
                    </div>
                  </div>
                )

                case 'fin-diferencia': return (
                  <div className={`${C} ${year&&totalIngresos>0?(dPos?'border-emerald-200':'border-red-200'):''}`}>
                    <div className={H}><span className={hl}><BarChart2 size={10} className={year&&totalIngresos>0?(dPos?'text-emerald-400':'text-red-400'):'text-gray-400'}/>Diferencia</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className={`text-2xl font-bold ${year&&totalIngresos>0?(dPos?'text-emerald-700':'text-red-600'):'text-gray-900'}`}>{year&&totalIngresos>0?fmtShort(diferencia):noData}</p>
                    </div>
                  </div>
                )
              }
            }

            // ── Drag style helper ──────────────────────────────────────────
            const dragCls = (idx: number) =>
              `rounded-xl transition-all duration-100 ${dgFrom===idx?'opacity-25 scale-[0.97]':''} ${dgOver===idx&&dgFrom!==null&&dgFrom!==idx?'ring-2 ring-brand-400 ring-offset-1':''}`

            return (
              <div className="space-y-3">

                {/* ── 9 viñetas arrastrables (3 × 3) ── */}
                <div className="grid grid-cols-3 gap-3" style={{ gridAutoRows: '1fr' }}>
                  {cardOrder.map((id, idx) => (
                    <div
                      key={id}
                      draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed='move'; setDgFrom(idx) }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDgOver(idx) }}
                      onDrop={e => { e.preventDefault(); if(dgFrom!==null&&dgFrom!==idx) swapDashCards(dgFrom,idx) }}
                      onDragEnd={() => { setDgFrom(null); setDgOver(null) }}
                      className={`cursor-grab active:cursor-grabbing ${dragCls(idx)}`}
                      title="Arrastra para reorganizar"
                    >
                      {renderCard(id)}
                    </div>
                  ))}
                </div>

                {/* ── 2 paneles proporcionales (1/3 + 2/3) ── */}
                {year && (
                  <div className="grid grid-cols-3 gap-3" style={{ height: 360 }}>

                    {/* Panel: Ubicaciones (1/3) */}
                    <div className="col-span-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                      <div className={H}>
                        <span className={hl}>Gasto por Ubicación</span>
                        <span className={sub}>{label}</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-around overflow-y-auto gdp-content">
                        {locLabels.map(loc => {
                          const val = gastoByLoc[loc] ?? 0
                          const pct = locTotal>0?(val/locTotal)*100:0
                          return (
                            <div key={loc}>
                              <div className="flex items-baseline justify-between mb-1">
                                <span className="text-xs font-medium text-gray-700 truncate">{loc}</span>
                                <span className="text-xs font-bold text-gray-900 ml-2 flex-shrink-0">{val>0?fmtShort(val):<span className="text-gray-300">—</span>}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-300 rounded-full transition-all duration-500" style={{width:`${pct}%`}}/>
                              </div>
                              {locTotal>0&&<p className="text-[10px] text-gray-300 mt-0.5 text-right">{pct.toFixed(1)}%</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Panel: Movimientos (2/3) */}
                    <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                      <div className={H}>
                        <span className={hl}>Movimientos</span>
                        <span className={sub}>{label}</span>
                      </div>

                      {/* Ingresos / Salidas */}
                      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
                        {([
                          { icon: <UserPlus size={10} className="text-emerald-500"/>, label: 'Ingresos', list: ingresos, dateFn: (m:any)=>m.startDate, badge:'text-emerald-600 bg-emerald-50' },
                          { icon: <UserMinus size={10} className="text-red-400"/>,    label: 'Salidas',  list: salidas,  dateFn: (m:any)=>m.endDate,   badge:'text-red-500 bg-red-50'     },
                        ]).map(col => (
                          <div key={col.label} className="p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              {col.icon}
                              <span className="text-[10px] font-semibold text-gray-600">{col.label}</span>
                              <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>{col.list.length}</span>
                            </div>
                            {col.list.length===0
                              ? <p className="text-[10px] text-gray-300">—</p>
                              : <ul className="space-y-1.5 max-h-24 overflow-y-auto gdp-content">
                                  {col.list.map((m:any,i:number)=>(
                                    <li key={i}>
                                      <p className="text-[11px] font-medium text-gray-700 truncate">{m.firstName} {m.lastName}</p>
                                      <p className="text-[10px] text-gray-400 truncate">{fmtDate(col.dateFn(m))} · {getCenter(m.workCenters)}</p>
                                    </li>
                                  ))}
                                </ul>
                            }
                          </div>
                        ))}
                      </div>

                      {/* Tabs */}
                      <div className="flex border-b border-gray-100 flex-shrink-0">
                        {([
                          {key:'vacaciones' as const, label:'Vacaciones', count:vacaciones.length,        active:'border-brand-500 text-brand-600',    num:'text-brand-600'},
                          {key:'licencias'  as const, label:'Licencias',  count:licencias.length,         active:'border-amber-500 text-amber-600',  num:'text-amber-600'},
                          {key:'reemplazos' as const, label:'Reemplazos', count:reemplazos.length,        active:'border-purple-500 text-purple-600',num:'text-purple-600'},
                          {key:'contratos'  as const, label:'Por vencer', count:expiringContracts.length, active:'border-rose-500 text-rose-600',    num:'text-rose-600'},
                        ]).map(t=>(
                          <button key={t.key} onClick={()=>setMovTab(t.key)}
                            className={`flex-1 py-2 flex flex-col items-center border-b-2 transition-colors ${movTab===t.key?t.active:'border-transparent text-gray-400 hover:text-gray-600'}`}
                          >
                            <span className={`text-sm font-bold leading-none ${movTab===t.key?t.num:'text-gray-500'}`}>{t.count}</span>
                            <span className="text-[9px] uppercase tracking-wide mt-0.5">{t.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div className="flex-1 overflow-y-auto p-3 min-h-0 text-[10px] gdp-content">
                        {movTab==='vacaciones'&&(vacaciones.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin vacaciones en el período</p>
                          :<ul className="space-y-2">{vacaciones.map((v:any,i:number)=>(
                            <li key={i} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-700 truncate">{v.employee.firstName} {v.employee.lastName}</p>
                                <p className="text-gray-400">{fmtDate(v.startDate)} → {fmtDate(v.endDate)}</p>
                                <p className="text-gray-400 truncate">{getCenter(v.employee.workCenters)}</p>
                              </div>
                              <span className="font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{v.days}d</span>
                            </li>
                          ))}</ul>
                        )}
                        {movTab==='licencias'&&(licencias.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin licencias en el período</p>
                          :<ul className="space-y-2">{licencias.map((l:any,i:number)=>{
                            const days=l.days??(Math.round((new Date(l.endDate).getTime()-new Date(l.startDate).getTime())/86400000)+1)
                            return(
                              <li key={i} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-700 truncate">{l.employee.firstName} {l.employee.lastName}</p>
                                  <p className="text-gray-400">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</p>
                                  <p className="text-gray-400 truncate">{getCenter(l.employee.workCenters)}</p>
                                </div>
                                <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{days}d</span>
                              </li>
                            )
                          })}</ul>
                        )}
                        {movTab==='reemplazos'&&(reemplazos.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin reemplazos en el período</p>
                          :<ul className="space-y-2">{reemplazos.map((r:any,i:number)=>(
                            <li key={i} className="bg-purple-50/50 rounded-lg p-2">
                              <p className="font-semibold text-gray-700 truncate">{r.firstName} {r.lastName}</p>
                              <p className="text-gray-500 truncate">↳ {r.reemplazaA??'Sin especificar'}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-emerald-600 font-medium">Ing: {fmtDate(r.startDate)}</span>
                                {r.endDate&&<span className="text-red-400 font-medium">Sal: {fmtDate(r.endDate)}</span>}
                                <span className="text-gray-400 ml-auto truncate">{getCenter(r.workCenters)}</span>
                              </div>
                            </li>
                          ))}</ul>
                        )}
                        {movTab==='contratos'&&(expiringContracts.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin contratos por vencer (próx. 3 meses)</p>
                          :<ul className="space-y-2">{expiringContracts.map((c:any,i:number)=>{
                            const daysLeft=Math.ceil((new Date(c.endDate).getTime()-Date.now())/86400000)
                            return(
                              <li key={i} className="bg-rose-50/50 rounded-lg p-2">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-semibold text-gray-700 truncate">{c.employee.firstName} {c.employee.lastName}</p>
                                  <span className={`font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${daysLeft<=15?'bg-red-100 text-red-600':'bg-rose-100 text-rose-600'}`}>{daysLeft}d</span>
                                </div>
                                <p className="text-gray-400 truncate">{getCenter(c.employee.workCenters)}</p>
                                <p className="text-gray-400">Vence: {fmtDate(c.endDate)}</p>
                              </li>
                            )
                          })}</ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )
          })()}

          {/* Centers table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Buscar centro…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <MultiSelect<CostType>
                label="Tipo"
                selected={typeFilters}
                onChange={setTypeFilters}
                options={[{ value: 'DIRECTO', label: 'Directo' }, { value: 'INDIRECTO', label: 'Indirecto' }]}
              />
              <MultiSelect<string>
                label="Ubicación"
                selected={ubicFilters}
                onChange={setUbicFilters}
                options={ubicaciones.map(u => ({ value: u, label: u }))}
              />
              {(typeFilters.length > 0 || ubicFilters.length > 0) && (
                <button
                  onClick={() => { setTypeFilters([]); setUbicFilters([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => exportCentrosToExcel(filtered, allEntries, periodoLabel, isMonthly)}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Exportar tabla a Excel"
              >
                <FileDown size={14} />
                Exportar Excel
              </button>
            </div>

            {centersLoading ? (
              <div className="p-16 text-center text-sm text-gray-400">Cargando centros…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center">
                <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hay centros de trabajo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  const cTh = (label: string, col: CenterSortKey, right?: boolean) => (
                    <th
                      onClick={() => handleCenterSort(col)}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700 ${right ? 'text-right' : ''} ${cSortKey === col ? 'text-brand-600' : 'text-gray-500'}`}
                    >
                      {label}
                      {cSortKey === col
                        ? (cSortDir === 'asc'
                            ? <ChevronUp   size={12} className="ml-1 inline text-brand-500" />
                            : <ChevronDown size={12} className="ml-1 inline text-brand-500" />)
                        : <ChevronsUpDown size={12} className="ml-1 inline text-gray-300" />
                      }
                    </th>
                  )
                  return (
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      {cTh('Nombre', 'name')}
                      {cTh('Ubicación', 'ubicacion')}
                      {cTh('Tipo', 'costType')}
                      {cTh('Personal', 'personal')}
                      {cTh('Cargos', 'cargos')}
                      {cTh('Ingresos', 'ingresos', true)}
                      {cTh(periodoLabel ? `Costos ${periodoLabel}` : 'Costos período', 'gasto', true)}
                      <th
                        onClick={() => handleCenterSort('diferencia')}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap text-right ${cSortKey === 'diferencia' ? 'text-brand-600' : 'text-gray-500'} hover:text-gray-700`}
                      >
                        Diferencia
                        {cSortKey === 'diferencia'
                          ? (cSortDir === 'asc'
                              ? <ChevronUp   size={12} className="ml-1 inline text-brand-500" />
                              : <ChevronDown size={12} className="ml-1 inline text-brand-500" />)
                          : <ChevronsUpDown size={12} className="ml-1 inline text-gray-300" />
                        }
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedCenters.map(({ wc, costoReal, ingresos, diferencia }) => {
                      const isSelected = selectedWC?.id === wc.id
                      return (
                        <Fragment key={wc.id}>
                          <tr
                            onClick={() => setSelectedWC(isSelected ? null : wc)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 size={15} className={isSelected ? 'text-brand-500' : 'text-gray-400'} />
                                <span className="text-sm font-medium text-gray-900">{wc.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select
                                value={wc.ubicacion ?? ''}
                                onChange={e => updateWC.mutate({ id: wc.id, ubicacion: e.target.value || null })}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-700 cursor-pointer"
                              >
                                <option value="">—</option>
                                {['Antofagasta', 'Atacama', 'Santiago', 'Rancagua', 'Transversal'].map(loc => (
                                  <option key={loc} value={loc}>{loc}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COST_TYPE_COLOR[wc.costType]}`}>
                                {COST_TYPE_LABEL[wc.costType]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Users size={14} className="text-gray-400" />
                                {wc.totalPersonnel ?? 0}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-sm text-gray-500">
                                <Briefcase size={14} />
                                {wc.positions?.length ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {ingresos > 0 ? fmtShort(ingresos) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              {year ? fmtShort(costoReal) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {year && diferencia !== null ? (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                                  diferencia >= 0
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  {diferencia >= 0
                                    ? <TrendingUp  size={13} />
                                    : <TrendingDown size={13} />}
                                  {fmtShort(Math.abs(diferencia))}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setModal(wc)} aria-label="Editar centro"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => setConfirmId(wc.id)} aria-label="Eliminar centro"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isSelected && (
                            <tr>
                              <td colSpan={9} className="px-4 pb-4">
                                <WorkCenterDetailPanel
                                  wc={wc}
                                  allEntries={allEntries}
                                  year={year} month={month}
                                  onEdit={() => setModal(wc)}
                                  onClose={() => setSelectedWC(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  {year && sortedCenters.length > 0 && (() => {
                    const totalGasto    = sortedCenters.reduce((s, { costoReal }) => s + costoReal, 0)
                    const totalIngresos = sortedCenters.reduce((s, { ingresos }) => s + ingresos, 0)
                    const totalDiff     = totalIngresos > 0 ? totalIngresos - totalGasto : null
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide" colSpan={5}>
                            Total ({sortedCenters.length} centros)
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                            {totalIngresos > 0 ? fmtShort(totalIngresos) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                            {fmtShort(totalGasto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {totalDiff !== null ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                                totalDiff >= 0
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {totalDiff >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                {fmtShort(Math.abs(totalDiff))}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: DOTACIÓN ══════════════ */}
      {tab === 'dotacion' && (
        <DotacionTab year={year} month={month} />
      )}

      {/* ══════════════ TAB: REMUNERACIONES ══════════════ */}
      {tab === 'remuneraciones' && (
        <div className="space-y-5">

          {/* Cost-type breakdown cards */}
          {year && payrollStats.total > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MiniStat label={`Costo total${periodoLabel ? ` ${periodoLabel}` : ''}`} value={fmtShort(payrollStats.total)}       icon={DollarSign}  color="text-gray-600   bg-gray-100"   />
              <MiniStat label="Costo directo"                                          value={fmtShort(payrollStats.directCost)}   icon={TrendingUp}  color="text-brand-600  bg-brand-50"    />
              <MiniStat label="Costo indirecto"                                        value={fmtShort(payrollStats.indirectCost)} icon={TrendingDown} color="text-gray-500  bg-gray-100"   />
              <MiniStat label="% Costo indirecto"                                      value={`${payrollStats.pctIndirecto.toFixed(1)}%`} icon={Percent} color="text-amber-600 bg-amber-50" />
            </div>
          )}

          {/* Payroll table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-48 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Nombre o RUT…"
                  value={remSearch} onChange={e => setRemSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {remTableRows.length !== rows.length
                  ? `${remTableRows.length} de ${rows.length} registros`
                  : `${rows.length} ${isMonthly ? 'registros' : 'colaboradores'}${periodoLabel ? ` — ${periodoLabel}` : ''}`}
              </span>
              {rows.length > 0 && (
                <button
                  onClick={() => exportRemuneracionesToExcel(remTableRows, '', periodoLabel)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                  title="Exportar a Excel"
                >
                  <FileDown size={13} />
                  Excel
                </button>
              )}
            </div>

            {!year ? (
              <div className="p-16 text-center">
                <p className="text-sm text-gray-400">Selecciona un año para ver remuneraciones</p>
              </div>
            ) : payrollLoading ? (
              <div className="p-16 text-center">
                <RefreshCw size={24} className="animate-spin text-brand-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Cargando remuneraciones…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-16 text-center">
                <DollarSign size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Sin datos para el período seleccionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <FilterRemTh label="Colaborador"            col="employeeName"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} sticky />
                      <FilterRemTh label="Razón social"           col="legalEntity"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                      <FilterRemTh label="Centro"                 col="centers"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                      <FilterRemTh label="Período"                col="period"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                      <FilterRemTh label="Sueldo líquido"         col="liquidSalary"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Sueldo bruto"           col="grossSalary"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Sueldo estándar"        col="sueldoEstandar"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right highlight />
                      <FilterRemTh label="Sueldo base"            col="sueldoBase"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Gratificación"          col="gratificacion"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Total bonos"            col="bonosTotal"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Bonos identificados"    col="bonosNames"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                      <FilterRemTh label="Total HH extra"         col="hhTotal"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="HH extra identificadas" col="hhDetail"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                      <FilterRemTh label="Total hab. no imp."     col="noImponiblesTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} right />
                      <FilterRemTh label="Hab. no imp. identif."  col="noImponiblesNames" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} allRows={rows} colFilters={remColFilters} onFilterChange={handleRemColFilter} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {remTableRows.map((row, i) => (
                      <tr key={`${row.employeeId}-${row.legalEntity}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.status === 'ACTIVE' ? 'bg-green-500' : row.status === 'ON_LEAVE' ? 'bg-amber-400' : 'bg-gray-300'}`} />
                            <div>
                              <p className="font-medium text-gray-900">{row.employeeName}</p>
                              <p className="text-xs text-gray-400 font-mono">{row.rut}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEGAL_ENTITY_COLOR[row.legalEntity as LegalEntity] ?? 'bg-gray-100 text-gray-700'}`}>
                            {LEGAL_ENTITY_LABEL[row.legalEntity as LegalEntity] ?? row.legalEntity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[140px] truncate" title={row.centers}>{row.centers}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.period}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(row.liquidSalary)}</td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{fmt(row.grossSalary)}</td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${row.sueldoEstandar !== row.grossSalary ? 'text-brand-700 bg-brand-50/40' : 'text-gray-700'}`}>{fmt(row.sueldoEstandar)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.sueldoBase)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.gratificacion)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.bonosTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.bonosNames}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.hhTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.hhDetail}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.noImponiblesTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.noImponiblesNames}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                {remTableRows.length !== rows.length
                  ? `${remTableRows.length} de ${rows.length} ${isMonthly ? 'registros' : 'colaboradores'}`
                  : `${rows.length} ${isMonthly ? 'registros' : 'colaboradores'} — ${periodoLabel}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: HONORARIOS ══════════════ */}
      {tab === 'honorarios' && (
        <SmartTab category="honorarios" year={year} month={month} />
      )}

      {/* ══════════════ TAB: COMPRAS ══════════════ */}
      {tab === 'compras' && (
        <SmartTab category="compras" year={year} month={month} />
      )}

      </div>{/* end gdp-wc */}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {modal && (
        <WorkCenterModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">¿Eliminar centro?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminarán también todas las asignaciones de colaboradores a este centro.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmId)} disabled={deleteWC.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleteWC.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
