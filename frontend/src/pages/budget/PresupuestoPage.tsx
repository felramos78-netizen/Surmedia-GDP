import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from '@/lib/api'
import type { BudgetCategory, BudgetItem, ApiResponse } from '@/types'
import { formatCLP } from '@/lib/utils'
import { Loader2, Pencil, Check, X, AlertTriangle } from 'lucide-react'

function useBudget() {
  return useQuery<BudgetCategory[]>({
    queryKey: ['budget'],
    queryFn: async () => {
      const res = await axios.get<ApiResponse<BudgetCategory[]>>('/budget')
      return res.data.data
    },
  })
}

function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BudgetItem> }) => {
      await axios.patch(`/budget/items/${id}`, data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })
}

// ─── Celda de monto editable ──────────────────────────────────────────────────
function AmountCell({ item, field }: { item: BudgetItem; field: 'annualAmount' }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item[field])
  const update = useUpdateItem()

  const commit = async () => {
    if (value !== item[field]) await update.mutateAsync({ id: item.id, data: { [field]: value } })
    setEditing(false)
  }

  const cancel = () => {
    setValue(item[field])
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          type="number"
          className="w-36 px-2 py-0.5 border border-brand-400 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={value}
          onChange={e => setValue(parseInt(e.target.value) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          autoFocus
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setValue(item[field]); setEditing(true) }}
      className="group flex items-center justify-end gap-1.5 w-full text-right hover:text-brand-700 transition-colors"
    >
      <span>{formatCLP(item[field])}</span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  )
}

// ─── Celda de nombre editable ─────────────────────────────────────────────────
function NameCell({ item }: { item: BudgetItem }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.name)
  const update = useUpdateItem()

  const commit = async () => {
    if (value.trim() && value !== item.name)
      await update.mutateAsync({ id: item.id, data: { name: value.trim() } })
    setEditing(false)
  }

  const cancel = () => { setValue(item.name); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="flex-1 px-2 py-0.5 border border-brand-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          autoFocus
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setValue(item.name); setEditing(true) }}
      className="group flex items-center gap-1.5 text-left hover:text-brand-700 transition-colors"
    >
      <span>{item.name}</span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  )
}

// ─── Tabla de partidas ────────────────────────────────────────────────────────
function PartidasTable({ categories }: { categories: BudgetCategory[] }) {
  const total = categories.reduce(
    (s, cat) => s + cat.items.reduce((s2, i) => s2 + i.annualAmount, 0),
    0,
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left w-3/5">
              Partidas DPDO
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
              Total Anual
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => {
            const catTotal = cat.items.reduce((s, i) => s + i.annualAmount, 0)
            return (
              <React.Fragment key={cat.id}>
                <tr className="bg-brand-600 text-white">
                  <td className="px-6 py-2 text-sm font-semibold">{cat.name}</td>
                  <td className="px-6 py-2 text-sm font-semibold text-right">{formatCLP(catTotal)}</td>
                </tr>
                {cat.items.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-brand-50/40 transition-colors">
                    <td className="px-6 py-2.5 text-sm text-gray-700 pl-10">
                      <NameCell item={item} />
                    </td>
                    <td className="px-6 py-2.5 text-sm text-gray-900">
                      <AmountCell item={item} field="annualAmount" />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
          <tr className="bg-brand-700 text-white font-bold">
            <td className="px-6 py-3 text-sm uppercase tracking-wide">Total</td>
            <td className="px-6 py-3 text-sm text-right">{formatCLP(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Tabla de beneficios ──────────────────────────────────────────────────────
function BeneficiosTable({ categories }: { categories: BudgetCategory[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left w-3/5">
              Beneficios
            </th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
              Total Anual
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <React.Fragment key={cat.id}>
              {cat.items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-brand-50/40 transition-colors">
                  <td className="px-6 py-2.5 text-sm text-gray-700">
                    <NameCell item={item} />
                  </td>
                  <td className="px-6 py-2.5 text-sm text-gray-900">
                    <AmountCell item={item} field="annualAmount" />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PresupuestoPage() {
  const { data: categories, isLoading, isError } = useBudget()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle size={24} className="text-red-300" />
        <p className="text-sm text-gray-500">Error cargando el presupuesto. Intenta nuevamente.</p>
      </div>
    )
  }

  const partidas   = (categories ?? []).filter(c => c.section === 'PARTIDAS')
  const beneficios = (categories ?? []).filter(c => c.section === 'BENEFICIOS')

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Presupuesto DPDO</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestión de partidas y gastos anuales</p>
      </div>

      <PartidasTable categories={partidas} />

      {beneficios.length > 0 && <BeneficiosTable categories={beneficios} />}

      <p className="text-xs text-gray-400 italic">
        Haz clic en cualquier nombre o monto para editarlo. Confirma con Enter o el ícono ✓.
      </p>
    </div>
  )
}
