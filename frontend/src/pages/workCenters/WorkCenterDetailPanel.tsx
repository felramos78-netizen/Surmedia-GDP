// Panel de detalle de un Centro de Trabajo (tabs Personas/Honorarios).
// Extraído de WorkCentersPage.tsx.
import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, X, Save, Building2,
  DollarSign, TrendingUp, TrendingDown, Search, Wallet,
  UserPlus, UserMinus, Stethoscope, Repeat, RefreshCw, FileDown,
} from 'lucide-react'
import {
  useAddIngreso, useUpdateIngreso, useDeleteIngreso, useUpdateWorkCenter,
} from '@/hooks/useWorkCenters'
import { usePayrollTable, useMovements } from '@/hooks/useDotacion'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { WorkCenter, WorkCenterIngreso, PayrollRawEntry } from '@/types'
import {
  type DetailSortKey, type SortDir,
  fmt, fmtShort, MONTHS_LABEL, COST_TYPE_LABEL, COST_TYPE_COLOR,
  parsePayrollItems, getPonderacion, aggregateWCRows,
} from './wcUtils'
import { MiniStat, MovementList, DetailSortIcon } from './wcComponents'
import { exportRemuneracionesToExcel } from './wcExcel'

export function WorkCenterDetailPanel({ wc, allEntries, year, month, onEdit, onClose }: {
  wc: WorkCenter
  allEntries: PayrollRawEntry[]
  year: string; month: string
  onEdit: () => void; onClose: () => void
}) {
  useEscapeKey(onClose)
  const [outerTab,  setOuterTab]  = useState<'personas' | 'honorarios'>('personas')
  const [personTab, setPersonTab] = useState<'sueldos' | 'movimientos' | 'provisiones'>('sueldos')

  // Ingresos state
  const [addingIngreso, setAddingIngreso] = useState(false)
  const [newName,       setNewName]       = useState('')
  const [newAmount,     setNewAmount]     = useState('')
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editName,      setEditName]      = useState('')
  const [editAmount,    setEditAmount]    = useState('')

  const addIngreso    = useAddIngreso()
  const updateIngreso = useUpdateIngreso()
  const deleteIngreso = useDeleteIngreso()
  useUpdateWorkCenter()

  async function handleAddIngreso() {
    const amt = Number(newAmount.replace(/[^0-9]/g, ''))
    if (!newName.trim() || !amt) return
    await addIngreso.mutateAsync({ workCenterId: wc.id, name: newName.trim(), amount: amt })
    setNewName(''); setNewAmount(''); setAddingIngreso(false)
  }

  function startEdit(ing: WorkCenterIngreso) {
    setEditingId(ing.id)
    setEditName(ing.name)
    setEditAmount(String(Math.round(ing.amount)))
  }

  async function handleUpdateIngreso() {
    if (!editingId) return
    const amt = Number(editAmount.replace(/[^0-9]/g, ''))
    if (!editName.trim() || !amt) return
    await updateIngreso.mutateAsync({ workCenterId: wc.id, ingresoId: editingId, name: editName.trim(), amount: amt })
    setEditingId(null)
  }

  async function handleDeleteIngreso(ingresoId: string) {
    await deleteIngreso.mutateAsync({ workCenterId: wc.id, ingresoId })
  }

  // Annual data (always year-only, for Gastos acumulados part 1)
  const { data: annualEntries = [] } = usePayrollTable({ year, month: undefined })

  // Movements for this center
  const { data: movements, isLoading: movLoading } = useMovements({ year, month: month || undefined })

  // Entries filtered to this work center
  const centerEntries = useMemo(() =>
    allEntries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    ),
  [allEntries, wc.name])

  const centerAnnual = useMemo(() =>
    annualEntries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    ),
  [annualEntries, wc.name])

  // Payroll aggregation for table (respects month selection)
  const [detailSearch, setDetailSearch] = useState('')
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey>('employeeName')
  const [detailSortDir, setDetailSortDir] = useState<SortDir>('asc')

  const payrollRows = useMemo(() => {
    let rows = aggregateWCRows(centerEntries, !!month)
    if (detailSearch) {
      const q = detailSearch.toLowerCase()
      rows = rows.filter(r => r.employeeName.toLowerCase().includes(q) || r.rut.includes(q))
    }
    return [...rows].sort((a, b) => {
      const diff = typeof a[detailSortKey] === 'number'
        ? (a[detailSortKey] as number) - (b[detailSortKey] as number)
        : String(a[detailSortKey]).localeCompare(String(b[detailSortKey]), 'es')
      return detailSortDir === 'asc' ? diff : -diff
    })
  }, [centerEntries, month, detailSearch, detailSortKey, detailSortDir])

  function handleDetailSort(col: DetailSortKey) {
    if (col === detailSortKey) setDetailSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setDetailSortKey(col); setDetailSortDir('asc') }
  }

  // Gastos acumulados stats (ponderados por centro)
  const brutoanual = centerAnnual.reduce((s, e) => {
    const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
    return s + e.grossSalary * pond
  }, 0)
  const brutoMensual = month ? centerEntries.reduce((s, e) => {
    const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
    return s + e.grossSalary * pond
  }, 0) : null

  const estandarAnual = centerAnnual.reduce((s, e) => {
    const p    = parsePayrollItems(e.items ?? [], e.grossSalary)
    const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
    return s + (p.sueldoBase + p.gratificacion + p.noImponiblesTotal) * pond
  }, 0)
  const estandarMensual = month ? centerEntries.reduce((s, e) => {
    const p    = parsePayrollItems(e.items ?? [], e.grossSalary)
    const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
    return s + (p.sueldoBase + p.gratificacion + p.noImponiblesTotal) * pond
  }, 0) : null

  // Movements filtered to this center
  const filterByCenter = (emps: any[]) =>
    (emps ?? []).filter((e: any) => e.workCenters?.some((a: any) => a.workCenter?.name === wc.name))

  const movIngresos   = useMemo(() => filterByCenter(movements?.ingresos   ?? []), [movements, wc.name])
  const movSalidas    = useMemo(() => filterByCenter(movements?.salidas    ?? []), [movements, wc.name])
  const movVacaciones = useMemo(() =>
    (movements?.vacaciones ?? []).filter((v: any) =>
      v.employee?.workCenters?.some((a: any) => a.workCenter?.name === wc.name)
    ),
  [movements, wc.name])
  const movLicencias  = useMemo(() =>
    (movements?.licencias ?? []).filter((l: any) =>
      l.employee?.workCenters?.some((a: any) => a.workCenter?.name === wc.name)
    ),
  [movements, wc.name])
  const movReemplazos = useMemo(() => filterByCenter(movements?.reemplazos ?? []), [movements, wc.name])


  const periodoLabel = month ? `${MONTHS_LABEL[Number(month)]} ${year}` : year

  return (
    <div className="border border-brand-200 rounded-xl bg-white mt-1 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-brand-100 bg-brand-50/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-brand-500" />
          <span className="font-semibold text-gray-900 text-sm">{wc.name}</span>
          <span className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COST_TYPE_COLOR[wc.costType]}`}>
            {COST_TYPE_LABEL[wc.costType]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit}
            className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-100 transition-colors">
            <Pencil size={12} /> Editar
          </button>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 rounded hover:bg-gray-200 transition-colors ml-1">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Outer tabs: Personas | Honorarios */}
      <div className="flex border-b border-gray-100">
        {(['personas', 'honorarios'] as const).map(key => (
          <button key={key} onClick={() => setOuterTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              outerTab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-5">

        {/* ══ PERSONAS ══ */}
        {outerTab === 'personas' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(['sueldos', 'movimientos', 'provisiones'] as const).map(key => (
                <button key={key} onClick={() => setPersonTab(key)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                    personTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Sueldos ── */}
            {personTab === 'sueldos' && (
              <div className="space-y-4">
                {!year ? (
                  <p className="text-sm text-gray-400 text-center py-4">Selecciona un período para ver datos</p>
                ) : (
                  <>
                    {/* ── Cálculos derivados ── */}
                    {(() => {
                      const CONTRACTUAL = 160_000
                      // Solo cobra contratación a quienes tienen este como su primer centro
                      const isPrimary = (e: PayrollRawEntry) =>
                        (e.employee.workCenters ?? []).filter(a => a.legalEntity === e.legalEntity)[0]?.workCenter?.name === wc.name
                      const nAnual   = new Set(centerAnnual .filter(isPrimary).map(e => `${e.employeeId}::${e.legalEntity}`)).size
                      const nMensual = month ? new Set(centerEntries.filter(isPrimary).map(e => `${e.employeeId}::${e.legalEntity}`)).size : null

                      const contractAnual   = centerAnnual .filter(isPrimary).length * CONTRACTUAL
                      const contractMensual = month ? centerEntries.filter(isPrimary).length * CONTRACTUAL : null

                      const totalGastosAnual   = brutoanual + contractAnual
                      const totalGastosMensual = brutoMensual !== null ? brutoMensual + (contractMensual ?? 0) : null

                      const monthsAnual    = Math.max(new Set(annualEntries.map(e => e.month)).size, 1)
                      const ingresosAnual  = wc.totalIngresos * monthsAnual

                      return (
                        <>
                          {/* 3 viñetas de detalle */}
                          <div className="grid grid-cols-3 gap-4">

                            {/* Gastos acumulados — 6 datos */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <TrendingUp size={13} className="text-gray-400" /> Gastos acumulados
                              </p>
                              <div className="space-y-2">
                                {/* Bruto + Contractual */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Bruto + Contratación</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(totalGastosAnual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(totalGastosMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Sueldos brutos */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Sueldo bruto</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(brutoanual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(brutoMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Sueldos estándar */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Sueldo estándar</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-brand-700">{fmtShort(estandarAnual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-brand-600">{fmtShort(estandarMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Gastos de contratación */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-gray-400" /> Gastos de contratación
                              </p>
                              <div className="space-y-2">
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">$160.000 / persona · primer centro</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(contractAnual)}</span>
                                  </div>
                                  {month && contractMensual !== null && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(contractMensual)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Personas consideradas</p>
                                  <p className="text-sm font-bold text-gray-900">{nAnual} {month && nMensual !== null ? `(${nMensual} en ${MONTHS_LABEL[Number(month)]})` : ''}</p>
                                </div>
                              </div>
                            </div>

                            {/* Ingresos mensuales */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                                  <Wallet size={13} className="text-gray-400" /> Ingresos mensuales
                                </p>
                                {!addingIngreso && (
                                  <button onClick={() => setAddingIngreso(true)}
                                    className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1 transition-colors">
                                    <Plus size={11} /> Agregar
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                {wc.ingresos.map(ing => (
                                  <div key={ing.id} className="bg-white rounded-lg border border-gray-100 p-2.5">
                                    {editingId === ing.id ? (
                                      <div className="space-y-1.5">
                                        <input
                                          autoFocus
                                          value={editName}
                                          onChange={e => setEditName(e.target.value)}
                                          placeholder="Nombre"
                                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                          <input
                                            value={editAmount}
                                            onChange={e => setEditAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                                          />
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={handleUpdateIngreso}
                                            disabled={updateIngreso.isPending}
                                            className="flex-1 py-1 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-1"
                                          >
                                            <Save size={11} /> Guardar
                                          </button>
                                          <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600 flex-1 truncate" title={ing.name}>{ing.name}</span>
                                        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtShort(ing.amount)}</span>
                                        <button onClick={() => startEdit(ing)} aria-label="Editar ingreso" className="p-0.5 text-gray-300 hover:text-brand-500 transition-colors flex-shrink-0">
                                          <Pencil size={11} />
                                        </button>
                                        <button onClick={() => handleDeleteIngreso(ing.id)} disabled={deleteIngreso.isPending} aria-label="Eliminar ingreso" className="p-0.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {addingIngreso && (
                                  <div className="bg-white rounded-lg border border-brand-200 p-2.5 space-y-1.5">
                                    <input
                                      autoFocus
                                      value={newName}
                                      onChange={e => setNewName(e.target.value)}
                                      placeholder="Nombre (ej: Contrato Codelco)"
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                      <input
                                        value={newAmount}
                                        onChange={e => setNewAmount(e.target.value)}
                                        placeholder="0"
                                        onKeyDown={e => e.key === 'Enter' && handleAddIngreso()}
                                        className="w-full pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                                      />
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={handleAddIngreso}
                                        disabled={addIngreso.isPending}
                                        className="flex-1 py-1 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-1"
                                      >
                                        <Save size={11} /> Agregar
                                      </button>
                                      <button onClick={() => { setAddingIngreso(false); setNewName(''); setNewAmount('') }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {wc.ingresos.length === 0 && !addingIngreso && (
                                  <p className="text-xs text-gray-400 text-center py-1">Sin ingresos definidos</p>
                                )}
                              </div>

                              {wc.totalIngresos > 0 && (
                                <div className="mt-2 bg-white rounded-lg border border-gray-100 p-2.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Total mensual</span>
                                    <span className="text-sm font-bold text-emerald-700">{fmtShort(wc.totalIngresos)}</span>
                                  </div>
                                  <div className="flex justify-between items-baseline mt-1">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-emerald-600">{fmtShort(ingresosAnual)}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        </>
                      )
                    })()}

                    {/* Tabla colaboradores */}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                            placeholder="Buscar colaborador…"
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {payrollRows.length} colaborador{payrollRows.length !== 1 ? 'es' : ''} · {periodoLabel}
                        </span>
                        {payrollRows.length > 0 && (
                          <button
                            onClick={() => exportRemuneracionesToExcel(payrollRows, wc.name, periodoLabel)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                            title="Exportar a Excel"
                          >
                            <FileDown size={13} />
                            Excel
                          </button>
                        )}
                      </div>
                      {payrollRows.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Sin datos de remuneraciones para este período</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-left">
                                <th onClick={() => handleDetailSort('employeeName')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                                  Colaborador<DetailSortIcon col="employeeName" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('jobTitle')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap">
                                  Cargo<DetailSortIcon col="jobTitle" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('ponderacion')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Ponderación<DetailSortIcon col="ponderacion" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('grossSalary')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Sueldo bruto<DetailSortIcon col="grossSalary" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('sueldoEstandar')}
                                  className="px-4 py-2.5 text-xs font-semibold text-brand-600 uppercase tracking-wide cursor-pointer hover:text-brand-700 whitespace-nowrap text-right bg-brand-50/40">
                                  Sueldo estándar<DetailSortIcon col="sueldoEstandar" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('bonosTotal')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Total bonos<DetailSortIcon col="bonosTotal" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                  Bonos identificados
                                </th>
                                <th onClick={() => handleDetailSort('hhTotal')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Total HH extra<DetailSortIcon col="hhTotal" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                  HH extra identificadas
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">
                                  Gastos contractuales
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {payrollRows.map((r, i) => (
                                <tr key={`${r.employeeId}-${i}`} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 bg-white">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        r.status === 'ACTIVE' ? 'bg-green-500' : r.status === 'ON_LEAVE' ? 'bg-amber-400' : 'bg-gray-300'
                                      }`} />
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{r.employeeName}</p>
                                        <p className="text-xs text-gray-400 font-mono">{r.rut}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={r.jobTitle}>{r.jobTitle}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap font-mono text-xs">
                                    {(r.ponderacion * 100).toFixed(0)}%
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(r.grossSalary * r.ponderacion)}</td>
                                  <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${r.sueldoEstandar !== r.grossSalary ? 'text-brand-700 bg-brand-50/40' : 'text-gray-700'}`}>{fmt(r.sueldoEstandar * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.bonosTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={r.bonosNames}>{r.bonosNames}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.hhTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.hhDetail}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                                    {r.centers.split(', ')[0].trim() === wc.name
                                      ? fmt(160_000)
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Movimientos ── */}
            {personTab === 'movimientos' && (
              <div>
                {!year ? (
                  <p className="text-sm text-gray-400 text-center py-4">Selecciona un período para ver movimientos</p>
                ) : movLoading ? (
                  <div className="text-center py-6"><RefreshCw size={20} className="animate-spin text-brand-400 mx-auto" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <MiniStat label="Ingresos"   value={movIngresos.length}   icon={UserPlus}    color="text-green-600  bg-green-50"  />
                      <MiniStat label="Salidas"    value={movSalidas.length}    icon={UserMinus}   color="text-red-500    bg-red-50"    />
                      <MiniStat label="Vacaciones" value={movVacaciones.length} icon={TrendingDown} color="text-sky-600    bg-sky-50"   />
                      <MiniStat label="Licencias"  value={movLicencias.length}  icon={Stethoscope} color="text-amber-600  bg-amber-50"  />
                      <MiniStat label="Reemplazos" value={movReemplazos.length} icon={Repeat}      color="text-violet-600 bg-violet-50" />
                    </div>
                    {movIngresos.length > 0 && (
                      <MovementList title="Ingresos" color="green"
                        items={movIngresos.map((e: any) => ({ name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.startDate }))} />
                    )}
                    {movSalidas.length > 0 && (
                      <MovementList title="Salidas" color="red"
                        items={movSalidas.map((e: any) => ({ name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.endDate }))} />
                    )}
                    {movVacaciones.length > 0 && (
                      <MovementList title="Vacaciones" color="green"
                        items={movVacaciones.map((v: any) => ({
                          name: `${v.employee.firstName} ${v.employee.lastName}`,
                          date: v.startDate, info: `${v.days} días`,
                        }))} />
                    )}
                    {movLicencias.length > 0 && (
                      <MovementList title="Licencias médicas" color="amber"
                        items={movLicencias.map((l: any) => ({
                          name: `${l.employee.firstName} ${l.employee.lastName}`,
                          rut: l.employee.rut, date: l.startDate, info: `${l.days} días`,
                        }))} />
                    )}
                    {movReemplazos.length > 0 && (
                      <MovementList title="Reemplazos" color="violet"
                        items={movReemplazos.map((e: any) => ({
                          name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.startDate,
                          info: e.reemplazaA ? `Reemplaza a: ${e.reemplazaA}` : undefined,
                        }))} />
                    )}
                    {!movIngresos.length && !movSalidas.length && !movVacaciones.length && !movLicencias.length && !movReemplazos.length && (
                      <p className="text-sm text-gray-400 text-center py-4">Sin movimientos en este centro para el período</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Provisiones ── */}
            {personTab === 'provisiones' && (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">Próximamente</p>
              </div>
            )}
          </div>
        )}

        {/* ══ HONORARIOS ══ */}
        {outerTab === 'honorarios' && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">Próximamente</p>
          </div>
        )}

      </div>
    </div>
  )
}
