import { useState } from 'react'
import {
  RefreshCw, X, CheckCircle2, AlertTriangle, Info, Check, Minus,
  FileSpreadsheet, ChevronRight, ChevronDown,
} from 'lucide-react'
import {
  fetchBukPreview, useBukApply,
  type BukPreviewData, type BukSueldoNuevo, type BukSueldoCambio,
  type BukDotacionCambio, type BukVacNueva,
} from '@/hooks/useBuk'

// ─── Utils ────────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmtS = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : CLP.format(n)
const MONTHS: Record<number, string> = {
  1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic',
}
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

// ─── Vista de preview (inline, sin modal, sin sub-tabs) ───────────────────────

function BukPreview({ data, onDone }: { data: BukPreviewData; onDone: () => void }) {
  const sN = data.sueldos.nuevos,   sC = data.sueldos.cambios, sSync = data.sueldos.sincronizados ?? []
  const dC = data.dotacion.cambios, dN = data.dotacion.nuevos
  const vN = data.vacaciones.nuevas

  const [selSN,   setSelSN]  = useState<Set<string>>(() => new Set(sN.map(r => r.key)))
  const [selSC,   setSelSC]  = useState<Set<string>>(() => new Set(sC.map(r => r.key)))
  const [selDC,   setSelDC]  = useState<Set<string>>(() => new Set(dC.map(r => r.key)))
  const [selVN,   setSelVN]  = useState<Set<string>>(() => new Set(vN.map(r => r.key)))
  const [selSync, setSelSync] = useState<Set<string>>(new Set())
  const [selDN,   setSelDN]  = useState<Set<string>>(new Set())
  const [sueldosOverrides, setSueldosOverrides] = useState<SueldosOverrides>(new Map())

  const { mutate: doApply, isPending, data: result } = useBukApply()

  const total = selSN.size + selSC.size + selDC.size + selVN.size + selSync.size + selDN.size
  const totalItems = sN.length + sC.length + dC.length + dN.length + vN.length + sSync.length

  function apply() {
    const overridesObj = sueldosOverrides.size > 0 ? Object.fromEntries(sueldosOverrides) : undefined
    doApply({
      sueldos:    { nuevosKeys: [...selSN], cambiosKeys: [...selSC], sincronizadosKeys: [...selSync], overrides: overridesObj },
      dotacion:   { cambiosKeys: [...selDC], nuevosKeys: [...selDN] },
      vacaciones: { nuevasKeys: [...selVN] },
    })
  }

  const hasActions = sN.length + sC.length + dC.length + vN.length + dN.length > 0

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap gap-2 text-xs">
        {sSync.length > 0 && <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full">{sSync.length} sueldos ya en GDP</span>}
        {sN.length > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">{sN.length} sueldos nuevos</span>}
        {sC.length > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{sC.length} sueldos con cambio</span>}
        {dC.length > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">{dC.length} dotación con cambio</span>}
        {dN.length > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{dN.length} nuevos en BUK (no en GDP)</span>}
        {vN.length > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">{vN.length} vacaciones nuevas</span>}
        {data.sueldos.sinEmpleado.length > 0 && <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full">{data.sueldos.sinEmpleado.length} RUTs sin coincidencia</span>}
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
          <div className="px-4 pt-2 pb-1 text-[11px] text-gray-400">Empleados que existen en BUK pero aún no están en GDP. Se crearán con los datos del Excel. El email se puede corregir en Dotación después.</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
              <tr>
                <th className="px-3 py-1.5 w-8"></th>
                <th className="px-3 py-1.5 text-left">Colaborador</th>
                <th className="px-3 py-1.5">Emp.</th>
                <th className="px-3 py-1.5 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dN.map(r => {
                const k = `dot-nuevo|${r.rut}`
                return (
                  <tr key={r.rut} className={selDN.has(k) ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-1"><RowCheck checked={selDN.has(k)} onChange={() => setSelDN(toggle(selDN, k))} /></td>
                    <td className="px-3 py-1"><div className="font-medium text-gray-800">{r.nombre}</div><div className="text-gray-400">{r.rut}</div></td>
                    <td className="px-3 py-1"><Badge e={r.legalEntity} /></td>
                    <td className="px-3 py-1 text-gray-500">{r.estado}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      )}

      {/* Sin acciones pendientes */}
      {!hasActions && !result && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            GDP está sincronizado con BUK. Los registros anteriores se muestran arriba para auditoría.
            <div className="flex-1" />
            <button onClick={onDone} className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-white">Cerrar</button>
          </div>
          {(data as any)._debug && (
            <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-[10px] font-mono text-yellow-800 break-all">
              debug: {JSON.stringify((data as any)._debug)}
            </div>
          )}
        </div>
      )}

      {/* Acción */}
      {hasActions && result ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            Importación completa: {result.applied.sueldos} sueldos, {result.applied.dotacion} dotación, {result.applied.vacaciones} vacaciones.
          </span>
          <div className="flex-1" />
          <button onClick={onDone} className="text-sm text-emerald-700 hover:underline">Cerrar</button>
        </div>
      ) : hasActions ? (
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
              {isPending && <RefreshCw size={12} className="animate-spin" />}
              Importar{total > 0 ? ` (${total})` : ''}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── Tab BUK ──────────────────────────────────────────────────────────────────

function BukTab() {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [preview,  setPreview]  = useState<BukPreviewData | null>(null)

  async function load() {
    setLoading(true); setError(null); setPreview(null)
    try {
      const result = await fetchBukPreview()
      if ((result as any)._debug) console.warn('[BUK debug]', (result as any)._debug)
      setPreview(result)
    }
    catch (e: any) { setError(e?.response?.data?.message ?? e?.message ?? 'Error al leer archivos') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Lee automáticamente los 8 archivos Excel de la carpeta <code className="text-xs bg-gray-100 px-1 rounded">reportes/</code></p>
          <p className="text-xs text-gray-400 mt-0.5">Comunicaciones y Consultoría · Dotación, Sueldos, Vacaciones tomadas, Vacaciones y licencia</p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Leyendo archivos…' : preview ? 'Recargar' : 'Cargar y previsualizar'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      {preview && (
        <BukPreview data={preview} onDone={() => setPreview(null)} />
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
