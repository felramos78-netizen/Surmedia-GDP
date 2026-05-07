import { useState, Fragment } from 'react'
import {
  RefreshCw, X, CheckCircle2, AlertTriangle, Info, Check, Minus,
  FileSpreadsheet, ChevronRight, ChevronDown,
} from 'lucide-react'
import {
  fetchBukPreview,
  type BukPreviewData, type BukSueldoNuevo, type BukSueldoCambio,
  type BukDotacionCambio, type BukVacNueva, type BukDotacionNuevo,
} from '@/hooks/useBuk'
import { useImportStore } from '@/store/importStore'

// ─── Utils ────────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmtS = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : CLP.format(n)
const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Com.', SURMEDIA_CONSULTORIA: 'Cons.',
}
const ENTITY_COLOR: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

function Badge({ e }: { e: string }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ENTITY_COLOR[e] ?? 'bg-gray-100 text-gray-600'}`}>{ENTITY_LABEL[e] ?? e}</span>
}

function RowCheck({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}>
      {checked && <Check size={10} className="text-white" />}
    </button>
  )
}

function toggle(s: Set<string>, k: string): Set<string> {
  const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n
}
function setAll(s: Set<string>, keys: string[], on: boolean): Set<string> {
  const n = new Set(s); on ? keys.forEach(k => n.add(k)) : keys.forEach(k => n.delete(k)); return n
}

// ─── Sección colapsable ───────────────────────────────────────────────────────

function Section({ title, count, variant, children, allKeys, selected, onToggleAll }: {
  title: string; count: number; variant: 'new' | 'change' | 'info'
  children: React.ReactNode
  allKeys?: string[]; selected?: Set<string>; onToggleAll?: (on: boolean) => void
}) {
  const [open, setOpen] = useState(true)
  const colors = { new: 'text-emerald-600', change: 'text-amber-600', info: 'text-blue-500' }
  const icons  = { new: CheckCircle2, change: AlertTriangle, info: Info }
  const Icon   = icons[variant]
  const allSel = allKeys && selected ? allKeys.every(k => selected.has(k)) : false
  const someSel = allKeys && selected ? allKeys.some(k => selected.has(k)) : false

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 bg-gray-50 cursor-pointer select-none`} onClick={() => setOpen(v => !v)}>
        <Icon size={14} className={colors[variant]} />
        <span className="text-sm font-medium text-gray-700 flex-1">{title} <span className={`font-bold ${colors[variant]}`}>{count}</span></span>
        {allKeys && selected && onToggleAll && (
          <button
            onClick={e => { e.stopPropagation(); onToggleAll(!allSel) }}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors mr-1 ${allSel ? 'bg-blue-600 border-blue-600' : someSel ? 'bg-blue-100 border-blue-400' : 'border-gray-300 hover:border-blue-400'}`}
          >
            {allSel ? <Check size={10} className="text-white" /> : someSel ? <Minus size={10} className="text-blue-600" /> : null}
          </button>
        )}
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </div>
      {open && <div className="overflow-x-auto">{children}</div>}
    </div>
  )
}

// ─── Tablas ───────────────────────────────────────────────────────────────────

function EditableNum({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
      className={`w-24 text-right tabular-nums bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-blue-400 text-xs ${className ?? ''}`} />
  )
}

function TblSueldosNew({ rows, sel, setSel, overrides, setOverrides }: {
  rows: BukSueldoNuevo[]; sel: Set<string>; setSel: (s: Set<string>) => void
  overrides: SueldosOverrides; setOverrides: (m: SueldosOverrides) => void
}) {
  function setVal(key: string, row: BukSueldoNuevo, field: 'grossSalary' | 'liquidSalary', val: number) {
    const cur = overrides.get(key) ?? { grossSalary: row.grossSalary, liquidSalary: row.liquidSalary }
    setOverrides(new Map(overrides).set(key, { ...cur, [field]: val }))
  }
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
        <tr>
          <th className="px-3 py-1.5 w-8"></th>
          <th className="px-3 py-1.5 text-left">Colaborador</th>
          <th className="px-3 py-1.5">Emp.</th>
          <th className="px-3 py-1.5 text-left">Período</th>
          <th className="px-3 py-1.5 text-right">Bruto</th>
          <th className="px-3 py-1.5 text-right">Líquido</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(r => (
          <tr key={r.key} className={sel.has(r.key) ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}>
            <td className="px-3 py-1"><RowCheck checked={sel.has(r.key)} onChange={() => setSel(toggle(sel, r.key))} /></td>
            <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
            <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
            <td className="px-3 py-1 text-gray-500">{MONTHS[r.month]} {r.year}</td>
            <td className="px-3 py-1 text-right">
              <EditableNum value={overrides.get(r.key)?.grossSalary ?? r.grossSalary}
                onChange={v => setVal(r.key, r, 'grossSalary', v)} className="text-gray-700" />
            </td>
            <td className="px-3 py-1 text-right">
              <EditableNum value={overrides.get(r.key)?.liquidSalary ?? r.liquidSalary}
                onChange={v => setVal(r.key, r, 'liquidSalary', v)} className="text-gray-700" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type SueldosOverrides = Map<string, { grossSalary: number; liquidSalary: number }>

function TblSueldosChange({ rows, sel, setSel, overrides, setOverrides }: {
  rows: BukSueldoCambio[]; sel: Set<string>; setSel: (s: Set<string>) => void
  overrides: SueldosOverrides; setOverrides: (m: SueldosOverrides) => void
}) {
  function getVal(key: string, field: 'grossSalary' | 'liquidSalary', fallback: number) {
    return overrides.get(key)?.[field] ?? fallback
  }
  function setVal(key: string, row: BukSueldoCambio, field: 'grossSalary' | 'liquidSalary', val: number) {
    const cur = overrides.get(key) ?? { grossSalary: row.despues.grossSalary, liquidSalary: row.despues.liquidSalary }
    const next = new Map(overrides)
    next.set(key, { ...cur, [field]: val })
    setOverrides(next)
  }
  return (
    <table className="w-full text-xs">
      <thead className="bg-amber-50/60 text-amber-600 text-[10px] uppercase">
        <tr>
          <th className="px-3 py-1.5 w-8"></th>
          <th className="px-3 py-1.5 text-left">Colaborador</th>
          <th className="px-3 py-1.5">Emp.</th>
          <th className="px-3 py-1.5 text-left">Período</th>
          <th className="px-3 py-1.5 text-right">Bruto antes</th>
          <th className="px-3 py-1.5 text-right">Bruto nuevo</th>
          <th className="px-3 py-1.5 text-right">Liq. antes</th>
          <th className="px-3 py-1.5 text-right">Liq. nuevo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-amber-50/30">
        {rows.map(r => (
          <tr key={r.key} className={sel.has(r.key) ? 'bg-amber-50/50' : 'hover:bg-amber-50/20'}>
            <td className="px-3 py-1"><RowCheck checked={sel.has(r.key)} onChange={() => setSel(toggle(sel, r.key))} /></td>
            <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
            <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
            <td className="px-3 py-1 text-gray-500">{MONTHS[r.month]} {r.year}</td>
            <td className="px-3 py-1 text-right tabular-nums text-gray-400 line-through">{fmtS(r.antes.grossSalary)}</td>
            <td className="px-3 py-1 text-right">
              <EditableNum value={getVal(r.key, 'grossSalary', r.despues.grossSalary)}
                onChange={v => setVal(r.key, r, 'grossSalary', v)} className="font-semibold text-emerald-700 border-emerald-300" />
            </td>
            <td className="px-3 py-1 text-right tabular-nums text-gray-400 line-through">{fmtS(r.antes.liquidSalary)}</td>
            <td className="px-3 py-1 text-right">
              <EditableNum value={getVal(r.key, 'liquidSalary', r.despues.liquidSalary)}
                onChange={v => setVal(r.key, r, 'liquidSalary', v)} className="font-semibold text-emerald-700 border-emerald-300" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TblDotChange({ rows, sel, setSel }: { rows: BukDotacionCambio[]; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  const [exp, setExp] = useState<Set<string>>(new Set())
  return (
    <table className="w-full text-xs">
      <thead className="bg-amber-50/60 text-amber-600 text-[10px] uppercase">
        <tr>
          <th className="px-3 py-1.5 w-8"></th>
          <th className="px-3 py-1.5 text-left">Colaborador</th>
          <th className="px-3 py-1.5">Emp.</th>
          <th className="px-3 py-1.5 text-left">Campos</th>
          <th className="px-3 py-1.5 w-8"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-amber-50/30">
        {rows.map(r => (
          <>
            <tr key={r.key} className={sel.has(r.key) ? 'bg-amber-50/50' : 'hover:bg-amber-50/20'}>
              <td className="px-3 py-1"><RowCheck checked={sel.has(r.key)} onChange={() => setSel(toggle(sel, r.key))} /></td>
              <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
              <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
              <td className="px-3 py-1 text-gray-500">{r.campos.map(c => c.campo).join(', ')}</td>
              <td className="px-3 py-1 text-center">
                <button onClick={() => setExp(s => toggle(s, r.key))} className="text-gray-400 hover:text-gray-600">
                  {exp.has(r.key) ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                </button>
              </td>
            </tr>
            {exp.has(r.key) && (
              <tr key={`${r.key}-d`} className="bg-gray-50">
                <td /><td colSpan={4} className="px-4 py-2">
                  <table className="text-[11px]"><tbody className="divide-y divide-gray-100">
                    {r.campos.map(c => (
                      <tr key={c.campo}>
                        <td className="pr-5 py-0.5 text-gray-500 font-medium w-28">{c.campo}</td>
                        <td className="pr-5 py-0.5 text-gray-400 line-through">{c.antes ?? '—'}</td>
                        <td className="py-0.5 text-emerald-700 font-medium">{c.despues ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  )
}

function TblVacNew({ rows, sel, setSel }: { rows: BukVacNueva[]; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
        <tr>
          <th className="px-3 py-1.5 w-8"></th>
          <th className="px-3 py-1.5 text-left">Colaborador</th>
          <th className="px-3 py-1.5">Emp.</th>
          <th className="px-3 py-1.5 text-left">Inicio</th>
          <th className="px-3 py-1.5 text-left">Término</th>
          <th className="px-3 py-1.5 text-right">Días</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(r => (
          <tr key={r.key} className={sel.has(r.key) ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}>
            <td className="px-3 py-1"><RowCheck checked={sel.has(r.key)} onChange={() => setSel(toggle(sel, r.key))} /></td>
            <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
            <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
            <td className="px-3 py-1 text-gray-500">{fmt(r.startDate)}</td>
            <td className="px-3 py-1 text-gray-500">{fmt(r.endDate)}</td>
            <td className="px-3 py-1 text-right text-gray-700">{r.days}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TblDotNew({ rows, sel, setSel }: { rows: BukDotacionNuevo[]; sel: Set<string>; setSel: (s: Set<string>) => void }) {
  const [exp, setExp] = useState<Set<string>>(new Set())
  const fmtDate = (d?: string | null) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : null
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
        <tr>
          <th className="px-3 py-1.5 w-8"></th>
          <th className="px-3 py-1.5 text-left">Colaborador</th>
          <th className="px-3 py-1.5">Emp.</th>
          <th className="px-3 py-1.5 text-left">Estado</th>
          <th className="px-3 py-1.5 w-8"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(r => {
          const k = `dot-nuevo|${r.rut}`
          const isExp = exp.has(r.rut)
          const details: Array<[string, string | null | undefined]> = [
            ['Cargo', r.cargo],
            ['AFP', r.afp],
            ['Isapre', r.isapre],
            ['Contrato', r.tipoContrato],
            ['Ingreso', fmtDate(r.fechaIngreso)],
            ['Supervisor', r.supervisorNombre],
            ['Jornada', r.jornada],
          ].filter(([, v]) => !!v) as Array<[string, string]>
          return (
            <Fragment key={r.rut}>
              <tr className={sel.has(k) ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}>
                <td className="px-3 py-1"><RowCheck checked={sel.has(k)} onChange={() => setSel(toggle(sel, k))} /></td>
                <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
                <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
                <td className="px-3 py-1 text-gray-500">{r.estado}</td>
                <td className="px-3 py-1 text-center">
                  {details.length > 0 && (
                    <button onClick={() => setExp(s => toggle(s, r.rut))} className="text-gray-400 hover:text-gray-600">
                      {isExp ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                    </button>
                  )}
                </td>
              </tr>
              {isExp && (
                <tr className="bg-gray-50">
                  <td /><td colSpan={4} className="px-4 py-2">
                    <table className="text-[11px]"><tbody className="divide-y divide-gray-100">
                      {details.map(([label, val]) => (
                        <tr key={label}>
                          <td className="pr-5 py-0.5 text-gray-400 font-medium w-24">{label}</td>
                          <td className="py-0.5 text-gray-700">{val}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Vista de preview (inline, sin modal, sin sub-tabs) ───────────────────────

const MONTHS: Record<number, string> = {
  1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic',
}

function BukPreview({ data, year, onDone }: { data: BukPreviewData; year: string; onDone: () => void }) {
  const sN = data.sueldos.nuevos,   sC = data.sueldos.cambios, sSync = data.sueldos.sincronizados ?? []
  const dC = data.dotacion.cambios, dN = data.dotacion.nuevos
  const vN = data.vacaciones.nuevas
  const vL = data.vacLicencia?.registros ?? []

  const [selSN,   setSelSN]  = useState<Set<string>>(() => new Set(sN.map(r => r.key)))
  const [selSC,   setSelSC]  = useState<Set<string>>(() => new Set(sC.map(r => r.key)))
  const [selDC,   setSelDC]  = useState<Set<string>>(() => new Set(dC.map(r => r.key)))
  const [selVN,   setSelVN]  = useState<Set<string>>(() => new Set(vN.map(r => r.key)))
  const [selVL,   setSelVL]  = useState<Set<string>>(() => new Set(vL.map(r => r.key)))
  const [selSync, setSelSync] = useState<Set<string>>(new Set())
  const [selDN,   setSelDN]  = useState<Set<string>>(() => new Set(dN.map(r => `dot-nuevo|${r.rut}`)))
  const [sueldosOverrides, setSueldosOverrides] = useState<SueldosOverrides>(new Map())

  const allActionKeys = [
    ...sN.map(r => r.key), ...sC.map(r => r.key),
    ...dC.map(r => r.key), ...vN.map(r => r.key),
    ...dN.map(r => `dot-nuevo|${r.rut}`),
    ...vL.map(r => r.key),
  ]
  const allSelected = allActionKeys.length > 0 && allActionKeys.every(k =>
    selSN.has(k) || selSC.has(k) || selDC.has(k) || selVN.has(k) || selDN.has(k) || selVL.has(k)
  )
  const someSelected = allActionKeys.some(k =>
    selSN.has(k) || selSC.has(k) || selDC.has(k) || selVN.has(k) || selDN.has(k) || selVL.has(k)
  )
  function toggleAll(on: boolean) {
    setSelSN(setAll(selSN, sN.map(r => r.key), on))
    setSelSC(setAll(selSC, sC.map(r => r.key), on))
    setSelDC(setAll(selDC, dC.map(r => r.key), on))
    setSelVN(setAll(selVN, vN.map(r => r.key), on))
    setSelDN(setAll(selDN, dN.map(r => `dot-nuevo|${r.rut}`), on))
    setSelVL(setAll(selVL, vL.map(r => r.key), on))
  }

  const { status: importStatus, startImport } = useImportStore()
  const isPending = importStatus === 'running'

  const total = selSN.size + selSC.size + selDC.size + selVN.size + selSync.size + selDN.size + selVL.size

  function apply() {
    const overridesObj = sueldosOverrides.size > 0 ? Object.fromEntries(sueldosOverrides) : undefined
    const label = `Importando ${total} registro${total !== 1 ? 's' : ''}…`
    startImport({
      year: Number(year),
      sueldos:     { nuevosKeys: [...selSN], cambiosKeys: [...selSC], sincronizadosKeys: [...selSync], overrides: overridesObj },
      dotacion:    { cambiosKeys: [...selDC], nuevosKeys: [...selDN] },
      vacaciones:  { nuevasKeys: [...selVN] },
      vacLicencia: { keys: [...selVL] },
    }, label)
    onDone()
  }

  const hasActions = sN.length + sC.length + dC.length + vN.length + dN.length + vL.length > 0

  return (
    <div className="space-y-4">
      {/* Resumen + select all */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {sSync.length > 0 && <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full">{sSync.length} sueldos ya en GDP</span>}
        {sN.length > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">{sN.length} sueldos nuevos</span>}
        {sC.length > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{sC.length} sueldos con cambio</span>}
        {dC.length > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{dC.length} dotación con cambio</span>}
        {dN.length > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{dN.length} nuevos en BUK (no en GDP)</span>}
        {vN.length > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">{vN.length} vacaciones nuevas</span>}
        {vL.length > 0 && <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">{vL.length} saldos de vacaciones</span>}
        {data.sueldos.sinEmpleado.length > 0 && <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full">{data.sueldos.sinEmpleado.length} RUTs sin coincidencia</span>}
        {allActionKeys.length > 0 && (
          <button
            onClick={() => toggleAll(!allSelected)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors
              ${allSelected ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' : someSelected ? 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-blue-600 border-blue-600' : someSelected ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}>
              {allSelected ? <Check size={8} className="text-white" /> : someSelected ? <Minus size={8} className="text-blue-600" /> : null}
            </span>
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        )}
      </div>

      {/* Secciones */}
      {sN.length > 0 && (
        <Section title="Sueldos nuevos —" count={sN.length} variant="new"
          allKeys={sN.map(r => r.key)} selected={selSN}
          onToggleAll={on => setSelSN(setAll(selSN, sN.map(r => r.key), on))}>
          <TblSueldosNew rows={sN} sel={selSN} setSel={setSelSN} overrides={sueldosOverrides} setOverrides={setSueldosOverrides} />
        </Section>
      )}
      {sC.length > 0 && (
        <Section title="Sueldos con cambio — requieren aprobación" count={sC.length} variant="change"
          allKeys={sC.map(r => r.key)} selected={selSC}
          onToggleAll={on => setSelSC(setAll(selSC, sC.map(r => r.key), on))}>
          <TblSueldosChange rows={sC} sel={selSC} setSel={setSelSC} overrides={sueldosOverrides} setOverrides={setSueldosOverrides} />
        </Section>
      )}
      {dC.length > 0 && (
        <Section title="Dotación con cambio — requieren aprobación" count={dC.length} variant="change"
          allKeys={dC.map(r => r.key)} selected={selDC}
          onToggleAll={on => setSelDC(setAll(selDC, dC.map(r => r.key), on))}>
          <TblDotChange rows={dC} sel={selDC} setSel={setSelDC} />
        </Section>
      )}
      {vN.length > 0 && (
        <Section title="Vacaciones tomadas nuevas —" count={vN.length} variant="new"
          allKeys={vN.map(r => r.key)} selected={selVN}
          onToggleAll={on => setSelVN(setAll(selVN, vN.map(r => r.key), on))}>
          <TblVacNew rows={vN} sel={selVN} setSel={setSelVN} />
        </Section>
      )}
      {sSync.length > 0 && (
        <Section title="Ya en GDP — editar para forzar actualización" count={sSync.length} variant="info"
          allKeys={sSync.map(r => r.key)} selected={selSync}
          onToggleAll={on => setSelSync(setAll(selSync, sSync.map(r => r.key), on))}>
          <TblSueldosNew rows={sSync} sel={selSync} setSel={setSelSync} overrides={sueldosOverrides} setOverrides={setSueldosOverrides} />
        </Section>
      )}
      {dN.length > 0 && (
        <Section title="Nuevos en BUK — crear en GDP" count={dN.length} variant="new"
          allKeys={dN.map(r => `dot-nuevo|${r.rut}`)} selected={selDN}
          onToggleAll={on => setSelDN(setAll(selDN, dN.map(r => `dot-nuevo|${r.rut}`), on))}>
          <TblDotNew rows={dN} sel={selDN} setSel={setSelDN} />
        </Section>
      )}
      {vL.length > 0 && (
        <Section title="Saldo de vacaciones y licencias —" count={vL.length} variant="new"
          allKeys={vL.map(r => r.key)} selected={selVL}
          onToggleAll={on => setSelVL(setAll(selVL, vL.map(r => r.key), on))}>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Emp.</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2 text-right">Legal</th>
              <th className="px-3 py-2 text-right">Progresivas</th>
              <th className="px-3 py-2 text-right">Administrativos</th>
              <th className="px-3 py-2 text-right">Total saldo</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {vL.map(r => (
                <tr key={r.key} className={selVL.has(r.key) ? 'bg-purple-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-1"><RowCheck checked={selVL.has(r.key)} onChange={() => setSelVL(toggle(selVL, r.key))} /></td>
                  <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
                  <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
                  <td className="px-3 py-1 text-gray-500">{MONTHS[r.month]} {r.year}</td>
                  <td className="px-3 py-1 text-right text-gray-700">{r.saldoLegal.toFixed(1)}</td>
                  <td className="px-3 py-1 text-right text-gray-700">{r.saldoProgresivas.toFixed(1)}</td>
                  <td className="px-3 py-1 text-right text-gray-700">{r.saldoAdministrativos.toFixed(1)}</td>
                  <td className="px-3 py-1 text-right font-medium text-purple-700">
                    {(r.saldoLegal + r.saldoProgresivas + r.saldoAdministrativos).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Sin acciones pendientes */}
      {!hasActions && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            GDP está sincronizado con BUK. Los registros anteriores se muestran arriba para auditoría.
            <div className="flex-1" />
            <button onClick={onDone} className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-white">Cerrar</button>
          </div>
        </div>
      )}

      {/* Acción */}
      {hasActions && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {total > 0 ? <><span className="font-medium text-gray-700">{total}</span> registros seleccionados</> : 'Ningún registro seleccionado'}
          </span>
          <div className="flex gap-2">
            <button onClick={onDone} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button
              onClick={apply}
              disabled={isPending || total === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40"
            >
              Importar{total > 0 ? ` (${total})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab BUK ──────────────────────────────────────────────────────────────────

function BukTab() {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [preview,  setPreview]  = useState<BukPreviewData | null>(null)
  const [year,     setYear]     = useState(String(new Date().getFullYear()))

  async function load() {
    setLoading(true); setError(null); setPreview(null)
    try {
      const result = await fetchBukPreview(year)
      if ((result as any)._debug) console.warn('[BUK debug]', (result as any)._debug)
      setPreview(result)
    }
    catch (e: any) { setError(e?.response?.data?.message ?? e?.message ?? 'Error al leer archivos') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Lee automáticamente los 8 archivos Excel de la carpeta <code className="text-xs bg-gray-100 px-1 rounded">reportes/</code></p>
          <p className="text-xs text-gray-400 mt-0.5">Comunicaciones y Consultoría · Dotación, Sueldos, Vacaciones tomadas, Vacaciones y licencia</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap">Año sueldos</label>
            <input
              type="number" value={year} onChange={e => setYear(e.target.value)}
              min={2020} max={2099} step={1}
              className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
            />
          </div>
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Leyendo archivos…' : preview ? 'Recargar' : 'Cargar y previsualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      {preview && (
        <BukPreview data={preview} year={year} onDone={() => setPreview(null)} />
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type PageTab = 'buk' | 'smart'

export default function ImportablesPage() {
  const [tab, setTab] = useState<PageTab>('buk')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importables Excel</h1>
        <p className="text-sm text-gray-500 mt-1">Sincronización de datos desde plataformas externas.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([['buk', 'BUK'], ['smart', 'Smart CTO']] as [PageTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {tab === 'buk'   && <BukTab />}
        {tab === 'smart' && (
          <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
            <FileSpreadsheet size={32} className="text-gray-300" />
            <p className="text-sm">Módulo Smart CTO — próximamente</p>
          </div>
        )}
      </div>
    </div>
  )
}
