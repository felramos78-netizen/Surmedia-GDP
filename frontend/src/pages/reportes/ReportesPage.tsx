import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Receipt, CalendarDays, AlertTriangle, Loader2 } from 'lucide-react'
import { usePayrollTable, usePayrollYears } from '@/hooks/useDotacion'
import { useHonorariosReport, useVacacionesReport } from '@/hooks/useReports'
import { exportRemuneracionesToExcel, buildRemuneracionRows } from './remuneracionesExcel'
import { exportHonorariosToExcel } from './honorariosExcel'
import { exportVacacionesToExcel } from './vacacionesExcel'
import { ENTITY_OPTIONS, MONTH_NAMES, periodoLabel } from './reportShared'

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

// Mes anterior al actual: es el período que normalmente se reporta.
function defaultPeriodo() {
  const now = new Date()
  const d   = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// ── Tarjeta de reporte ────────────────────────────────────────────────────────

interface ReportCardProps {
  icon:          React.ReactNode
  title:         string
  description:   string
  isLoading:     boolean
  count:         number
  countLabel:    string
  total?:        number
  warnings?:     { label: string; count: number }[]
  warningsTitle?: string
  onDownload:    () => void
}

function ReportCard({
  icon, title, description, isLoading, count, countLabel, total, warnings = [],
  warningsTitle = 'Celdas sin completar', onDownload,
}: ReportCardProps) {
  const empty = !isLoading && count === 0

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 flex-1">
        {isLoading ? (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Cargando…
          </p>
        ) : empty ? (
          <p className="text-sm text-gray-400">Sin datos para este período.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{count}</span>
              <span className="text-sm text-gray-500">{countLabel}</span>
            </div>
            {total !== undefined && (
              <p className="text-sm text-gray-600 tabular-nums mt-1">{CLP.format(total)}</p>
            )}
            {warnings.filter(w => w.count > 0).length > 0 && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{warningsTitle}</p>
                  <p className="text-amber-600 mt-0.5">
                    {warnings.filter(w => w.count > 0).map(w => `${w.count} ${w.label}`).join(' · ')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={onDownload}
        disabled={isLoading || empty}
        className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
      >
        <Download size={15} />
        Descargar Excel
      </button>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const inicial = defaultPeriodo()
  const [year,        setYear]        = useState(inicial.year)
  const [month,       setMonth]       = useState(inicial.month)
  const [legalEntity, setLegalEntity] = useState('')

  const { data: years = [] } = usePayrollYears()
  const yearOptions = useMemo(() => {
    const set = new Set<number>([...years, inicial.year, year])
    return [...set].sort((a, b) => b - a)
  }, [years, year, inicial.year])

  const { data: payrollEntries = [], isLoading: loadingRem } = usePayrollTable({
    year:        String(year),
    month:       String(month),
    legalEntity: legalEntity ? [legalEntity] : undefined,
  })

  const { data: honorarios, isLoading: loadingHon } = useHonorariosReport({
    year, month, legalEntity: legalEntity || undefined,
  })

  const { data: vacaciones, isLoading: loadingVac } = useVacacionesReport({
    legalEntity: legalEntity || undefined,
  })

  const remRows   = useMemo(() => buildRemuneracionRows(payrollEntries), [payrollEntries])
  const remTotal  = remRows.reduce((s, r) => s + r.bruto, 0)
  const honRows   = honorarios?.data ?? []
  const honMeta   = honorarios?.meta
  const vacRows   = vacaciones?.data ?? []
  const vacMeta   = vacaciones?.meta

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reportes mensuales estandarizados · {periodoLabel(year, month)}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          aria-label="Mes del reporte"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          aria-label="Año del reporte"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={legalEntity}
          onChange={e => setLegalEntity(e.target.value)}
          aria-label="Razón social"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Reportes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
        <ReportCard
          icon={<FileSpreadsheet size={19} />}
          title="Remuneraciones"
          description="Una fila por colaborador × centro, ponderada 1/n. Dashboard en hoja aparte."
          isLoading={loadingRem}
          count={remRows.length}
          countLabel={remRows.length === 1 ? 'fila' : 'filas'}
          total={remTotal}
          onDownload={() => exportRemuneracionesToExcel(payrollEntries, year, month)}
        />

        <ReportCard
          icon={<Receipt size={19} />}
          title="Honorarios"
          description="Boletas vigentes emitidas en el mes. El mes lo define la fecha de emisión."
          isLoading={loadingHon}
          count={honRows.length}
          countLabel={honRows.length === 1 ? 'boleta' : 'boletas'}
          total={honMeta?.montoTotal}
          warnings={[
            { label: 'sin contrato',       count: honMeta?.pendientes.sinContrato      ?? 0 },
            { label: 'sin clasificación',  count: honMeta?.pendientes.sinClasificacion ?? 0 },
            { label: 'sin reembolsable',   count: honMeta?.pendientes.sinReembolsable  ?? 0 },
          ]}
          onDownload={() => exportHonorariosToExcel(honRows, year, month)}
        />

        <ReportCard
          icon={<CalendarDays size={19} />}
          title="Saldo de Vacaciones"
          description={`Saldo vigente al ${vacMeta ? new Date(vacMeta.asOfDate + 'T00:00:00').toLocaleDateString('es-CL') : '—'}, descontando vacaciones aprobadas aún no ocurridas.`}
          isLoading={loadingVac}
          count={vacRows.length}
          countLabel={vacRows.length === 1 ? 'colaborador' : 'colaboradores'}
          warnings={[
            { label: 'con descuento por vacaciones aprobadas futuras', count: vacMeta?.conDescuento ?? 0 },
          ]}
          warningsTitle="Ajustes aplicados"
          onDownload={() => exportVacacionesToExcel(vacRows, vacMeta?.asOfDate ?? new Date().toISOString().slice(0, 10))}
        />
      </div>

      <p className="text-xs text-gray-400 mt-6 max-w-4xl">
        Los bonos salen completos en <span className="font-medium">Total bonos NR</span>; RRHH mueve
        el monto a <span className="font-medium">Total Bonos R</span> a mano cuando corresponde. La
        columna <span className="font-medium">HH Reembolsable</span> sale vacía: se marca con «Sí» y
        el Dashboard la suma solo.
      </p>
    </div>
  )
}
