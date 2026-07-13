import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from '@/lib/api'
import type { BudgetCategory, BudgetItem, ApiResponse } from '@/types'
import { formatCLP } from '@/lib/utils'
import { Loader2, Pencil, Check, X, AlertTriangle, Trash2, Plus, GripVertical, Columns3, ChevronLeft, ChevronRight } from 'lucide-react'

// Mueve un elemento (por id) delante de otro dentro de un arreglo.
function moveBefore<T>(arr: T[], fromId: string, toId: string, idOf: (x: T) => string): T[] {
  const from = arr.findIndex(x => idOf(x) === fromId)
  const to = arr.findIndex(x => idOf(x) === toId)
  if (from < 0 || to < 0 || from === to) return arr
  const copy = [...arr]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

const VIRTUAL_CATEGORY_ID = 'virtual-unbudgeted'

function useBudget() {
  return useQuery<BudgetCategory[]>({
    queryKey: ['budget'],
    queryFn: async () => {
      const res = await axios.get<ApiResponse<BudgetCategory[]>>('/budget')
      return res.data.data
    },
  })
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────
function useBudgetMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['budget'] })

  return {
    updateItem: useMutation({
      mutationFn: (v: { id: string; data: Partial<BudgetItem> }) => axios.patch(`/budget/items/${v.id}`, v.data),
      onSuccess: inv,
    }),
    createItem: useMutation({
      mutationFn: (v: { categoryId: string; name: string; annualAmount: number }) => axios.post('/budget/items', v),
      onSuccess: inv,
    }),
    deleteItem: useMutation({
      mutationFn: (id: string) => axios.delete(`/budget/items/${id}`),
      onSuccess: inv,
    }),
    createCategory: useMutation({
      mutationFn: (name: string) => axios.post('/budget/categories', { name, section: 'PARTIDAS' }),
      onSuccess: inv,
    }),
    updateCategory: useMutation({
      mutationFn: (v: { id: string; name: string }) => axios.patch(`/budget/categories/${v.id}`, { name: v.name }),
      onSuccess: inv,
    }),
    deleteCategory: useMutation({
      mutationFn: (id: string) => axios.delete(`/budget/categories/${id}`),
      onSuccess: inv,
    }),
    reorderCategories: useMutation({
      mutationFn: (ids: string[]) => axios.patch('/budget/categories/reorder', { ids }),
      onSuccess: inv,
    }),
    reorderItems: useMutation({
      mutationFn: (v: { categoryId: string; ids: string[] }) => axios.patch('/budget/items/reorder', v),
      onSuccess: inv,
    }),
    renameExpenseCategory: useMutation({
      mutationFn: (v: { from: string; to: string }) => axios.patch('/budget/expense-category', v),
      onSuccess: inv,
    }),
  }
}

// ─── Celda de monto editable ──────────────────────────────────────────────────
function AmountCell({ item, field }: { item: BudgetItem; field: 'annualAmount' }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item[field])
  const { updateItem } = useBudgetMutations()

  const commit = async () => {
    if (value !== item[field]) await updateItem.mutateAsync({ id: item.id, data: { [field]: value } })
    setEditing(false)
  }

  const cancel = () => {
    setValue(item[field])
    setEditing(false)
  }

  // Fila virtual (gasto sin partida): no persiste, se muestra como texto plano.
  if (item.virtual) {
    return <span className="text-gray-300">—</span>
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
  const { updateItem } = useBudgetMutations()

  const commit = async () => {
    if (value.trim() && value !== item.name)
      await updateItem.mutateAsync({ id: item.id, data: { name: value.trim() } })
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

// ─── Nombre de una fila "gasto sin partida" (renombra la categoría en todos los docs) ──
function VirtualNameCell({ item }: { item: BudgetItem }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.name)
  const { renameExpenseCategory } = useBudgetMutations()

  const commit = async () => {
    const to = value.trim()
    if (to && to !== item.name) await renameExpenseCategory.mutateAsync({ from: item.name, to })
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
      className="group flex items-center gap-1.5 text-left text-gray-700 hover:text-brand-700 transition-colors"
      title="Renombrar la categoría en todos los gastos asociados"
    >
      <span>{item.name}</span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  )
}

// ─── Nombre de subárea editable (cabecera oscura) ─────────────────────────────
function CategoryNameCell({ cat }: { cat: BudgetCategory }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(cat.name)
  const { updateCategory } = useBudgetMutations()

  const commit = async () => {
    if (value.trim() && value !== cat.name) await updateCategory.mutateAsync({ id: cat.id, name: value.trim() })
    setEditing(false)
  }
  const cancel = () => { setValue(cat.name); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="flex-1 px-2 py-0.5 rounded text-sm text-gray-900 focus:outline-none"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          autoFocus
        />
        <button onClick={commit} className="text-green-200 hover:text-white"><Check size={15} /></button>
        <button onClick={cancel} className="text-white/70 hover:text-white"><X size={15} /></button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setValue(cat.name); setEditing(true) }}
      className="group flex items-center gap-1.5 text-left"
    >
      <span>{cat.name}</span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-70 transition-opacity" />
    </button>
  )
}

// ─── Fila para agregar una partida ────────────────────────────────────────────
function AddItemRow({ categoryId, colSpan }: { categoryId: string; colSpan: number }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const { createItem } = useBudgetMutations()

  const commit = async () => {
    if (!name.trim()) return
    await createItem.mutateAsync({ categoryId, name: name.trim(), annualAmount: amount })
    setName(''); setAmount(0); setOpen(false)
  }
  const cancel = () => { setName(''); setAmount(0); setOpen(false) }

  if (!open) {
    return (
      <tr className="border-b border-gray-100">
        <td colSpan={colSpan} className="px-6 py-1.5 pl-10">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors"
          >
            <Plus size={13} /> Agregar partida
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 bg-brand-50/30">
      <td className="px-6 py-2 pl-10">
        <input
          type="text"
          placeholder="Nombre de la partida"
          className="w-full px-2 py-0.5 border border-brand-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          autoFocus
        />
      </td>
      <td className="px-6 py-2">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            className="w-32 px-2 py-0.5 border border-brand-400 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={amount}
            onChange={e => setAmount(parseInt(e.target.value) || 0)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          />
          <button onClick={commit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      </td>
      {colSpan > 2 && <td colSpan={colSpan - 2} />}
    </tr>
  )
}

// ─── Fila para agregar una subárea ────────────────────────────────────────────
function AddCategoryRow({ colSpan }: { colSpan: number }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const { createCategory } = useBudgetMutations()

  const commit = async () => {
    if (!name.trim()) return
    await createCategory.mutateAsync(name.trim())
    setName(''); setOpen(false)
  }
  const cancel = () => { setName(''); setOpen(false) }

  if (!open) {
    return (
      <tr className="border-t border-gray-200">
        <td colSpan={colSpan} className="px-6 py-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            <Plus size={15} /> Agregar subárea
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-gray-200 bg-brand-50/40">
      <td colSpan={colSpan} className="px-6 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Nombre de la subárea"
            className="w-72 px-2 py-1 border border-brand-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            autoFocus
          />
          <button onClick={commit} className="text-green-600 hover:text-green-700"><Check size={16} /></button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
      </td>
    </tr>
  )
}

// ─── Celda de diferencia (presupuestado − gastado) ────────────────────────────
function DiffCell({ diff }: { diff: number }) {
  // diff ≥ 0 → saldo disponible (verde); diff < 0 → sobregiro (rojo)
  const color = diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-600' : 'text-gray-400'
  const sign  = diff < 0 ? '-' : ''
  return <span className={`font-medium ${color}`}>{sign}{formatCLP(Math.abs(diff))}</span>
}

// Variante de diferencia para filas con fondo oscuro (usa tonos claros).
function DiffCellInverse({ diff }: { diff: number }) {
  const color = diff < 0 ? 'text-red-200' : 'text-white'
  const sign  = diff < 0 ? '-' : ''
  return <span className={color}>{sign}{formatCLP(Math.abs(diff))}</span>
}

// Trimestre en curso (0..3) y cantidad de trimestres restantes en el año (incluye el actual).
const CURRENT_Q = Math.floor(new Date().getMonth() / 3)
const REMAINING_Q = 4 - CURRENT_Q

// Celdas de gasto por trimestre [Q1..Q4].
function QuarterCells({ quarters, dark }: { quarters: number[]; dark?: boolean }) {
  return (
    <>
      {[0, 1, 2, 3].map(q => {
        const v = quarters[q] ?? 0
        const isCurrent = q === CURRENT_Q
        return (
          <td
            key={q}
            className={`px-4 py-2.5 text-sm text-right tabular-nums ${dark ? '' : 'text-gray-600'} ${isCurrent ? (dark ? 'bg-white/10' : 'bg-brand-50/60') : ''}`}
          >
            {v > 0 ? formatCLP(v) : <span className={dark ? 'text-white/40' : 'text-gray-300'}>—</span>}
          </td>
        )
      })}
    </>
  )
}

// Celda de proyección: monto disponible para el resto del año (presupuestado − gastado),
// con el promedio disponible por trimestre restante.
function ProjectionCell({ annual, spent, dark }: { annual: number; spent: number; dark?: boolean }) {
  const avail = annual - spent
  const perQ = REMAINING_Q > 0 ? Math.round(avail / REMAINING_Q) : 0
  const neg = avail < 0
  const main = dark ? (neg ? 'text-red-200' : 'text-white') : (neg ? 'text-red-600' : 'text-emerald-600')
  const sub  = dark ? 'text-white/60' : 'text-gray-400'
  return (
    <td className="px-4 py-2.5 text-sm text-right tabular-nums">
      <div className={`font-medium ${main}`}>{neg ? '-' : ''}{formatCLP(Math.abs(avail))}</div>
      <div className={`text-[11px] ${sub}`}>≈ {neg ? '-' : ''}{formatCLP(Math.abs(perQ))}/Q</div>
    </td>
  )
}

// Estado de arrastre en curso.
type Drag =
  | { type: 'cat'; id: string }
  | { type: 'item'; id: string; catId: string }
  | null

const Q_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

// ─── Tabla de partidas ────────────────────────────────────────────────────────
function PartidasTable({ categories, expanded }: { categories: BudgetCategory[]; expanded: boolean }) {
  const { deleteItem, deleteCategory, reorderCategories, reorderItems, createItem } = useBudgetMutations()

  // Copia local para que el arrastre se sienta inmediato; se resincroniza cuando el
  // servidor devuelve datos nuevos (patrón "ajustar estado durante el render").
  const [cats, setCats] = useState(categories)
  const [prevCategories, setPrevCategories] = useState(categories)
  if (categories !== prevCategories) {
    setPrevCategories(categories)
    setCats(categories)
  }

  const [drag, setDrag] = useState<Drag>(null)

  const colSpan = expanded ? 9 : 4

  const sum = (fn: (i: BudgetItem) => number) =>
    cats.reduce((s, cat) => s + cat.items.reduce((s2, i) => s2 + fn(i), 0), 0)
  const totalAnnual = sum(i => i.annualAmount)
  const totalSpent  = sum(i => i.spentAmount)
  const totalQuarters = [0, 1, 2, 3].map(q =>
    cats.reduce((s, cat) => s + cat.items.reduce((s2, i) => s2 + (i.spentByQuarter?.[q] ?? 0), 0), 0),
  )

  const onDeleteItem = (item: BudgetItem) => {
    if (window.confirm(`¿Eliminar la partida "${item.name}"?`)) deleteItem.mutate(item.id)
  }
  const onDeleteCategory = (cat: BudgetCategory) => {
    if (window.confirm(`¿Eliminar la subárea "${cat.name}" y todas sus partidas?`)) deleteCategory.mutate(cat.id)
  }

  // ── Drop de subárea sobre otra subárea ──
  const dropOnCategory = (targetId: string) => {
    if (drag?.type !== 'cat' || drag.id === targetId || targetId === VIRTUAL_CATEGORY_ID) return
    const real = cats.filter(c => c.id !== VIRTUAL_CATEGORY_ID)
    const virtual = cats.filter(c => c.id === VIRTUAL_CATEGORY_ID)
    const reordered = moveBefore(real, drag.id, targetId, c => c.id)
    setCats([...reordered, ...virtual])
    reorderCategories.mutate(reordered.map(c => c.id))
    setDrag(null)
  }

  // ── Mueve una partida dentro de una subárea o a otra distinta ──
  // targetItemId = null → se agrega al final de la subárea destino.
  const moveItem = (fromCatId: string, itemId: string, toCatId: string, targetItemId: string | null) => {
    if (toCatId === VIRTUAL_CATEGORY_ID) return
    // Conversión: un "gasto sin partida" arrastrado a una subárea se persiste como partida real.
    // Al crearla con el mismo nombre, el gasto de esa categoría queda emparejado automáticamente.
    if (fromCatId === VIRTUAL_CATEGORY_ID) {
      const label = cats.find(c => c.id === VIRTUAL_CATEGORY_ID)?.items.find(i => i.id === itemId)?.name
      if (label) createItem.mutate({ categoryId: toCatId, name: label, annualAmount: 0 })
      setDrag(null)
      return
    }
    if (fromCatId === toCatId && itemId === targetItemId) return
    const moved = cats.find(c => c.id === fromCatId)?.items.find(i => i.id === itemId)
    if (!moved) return
    // 1. quitar del origen
    let next = cats.map(c => (c.id === fromCatId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c))
    // 2. insertar en el destino (antes del target, o al final)
    next = next.map(c => {
      if (c.id !== toCatId) return c
      const items = [...c.items]
      const idx = targetItemId ? items.findIndex(i => i.id === targetItemId) : items.length
      items.splice(idx < 0 ? items.length : idx, 0, { ...moved, categoryId: toCatId })
      return { ...c, items }
    })
    setCats(next)
    const target = next.find(c => c.id === toCatId)!
    reorderItems.mutate({ categoryId: toCatId, ids: target.items.map(i => i.id) })
    setDrag(null)
  }

  const thNum = 'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${expanded ? 'min-w-[880px]' : ''}`}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left w-2/5">
              Partidas DPDO
            </th>
            <th className={thNum}>Presupuestado</th>
            <th className={thNum}>Gastado</th>
            <th className={thNum}>Diferencia</th>
            {expanded && (
              <>
                {Q_LABELS.map((q, i) => (
                  <th key={q} className={`${thNum} ${i === CURRENT_Q ? 'text-brand-600' : ''}`}>
                    {q}{i === CURRENT_Q ? ' •' : ''}
                  </th>
                ))}
                <th className={thNum}>Disp. proyectado</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {cats.map(cat => {
            const isVirtual = cat.id === VIRTUAL_CATEGORY_ID
            const catAnnual = cat.items.reduce((s, i) => s + i.annualAmount, 0)
            const catSpent  = cat.items.reduce((s, i) => s + i.spentAmount, 0)
            const catQuarters = [0, 1, 2, 3].map(q => cat.items.reduce((s, i) => s + (i.spentByQuarter?.[q] ?? 0), 0))
            return (
              <React.Fragment key={cat.id}>
                <tr
                  className={`bg-brand-600 text-white group/cat ${drag?.type === 'cat' && drag.id === cat.id ? 'opacity-40' : ''}`}
                  onDragOver={e => { if ((drag?.type === 'cat' || drag?.type === 'item') && !isVirtual) e.preventDefault() }}
                  onDrop={() => {
                    if (drag?.type === 'cat') dropOnCategory(cat.id)
                    else if (drag?.type === 'item') moveItem(drag.catId, drag.id, cat.id, null)
                  }}
                >
                  <td className="px-6 py-2 text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      {!isVirtual && (
                        <span
                          draggable
                          onDragStart={() => setDrag({ type: 'cat', id: cat.id })}
                          onDragEnd={() => setDrag(null)}
                          className="cursor-grab active:cursor-grabbing opacity-30 group-hover/cat:opacity-80 transition-opacity"
                          title="Arrastrar para reordenar"
                        >
                          <GripVertical size={15} />
                        </span>
                      )}
                      {isVirtual ? <span>{cat.name}</span> : <CategoryNameCell cat={cat} />}
                      {!isVirtual && (
                        <button
                          onClick={() => onDeleteCategory(cat)}
                          className="opacity-0 group-hover/cat:opacity-70 hover:!opacity-100 text-white transition-opacity"
                          title="Eliminar subárea"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums">{formatCLP(catAnnual)}</td>
                  <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums">{formatCLP(catSpent)}</td>
                  <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums">
                    <DiffCellInverse diff={catAnnual - catSpent} />
                  </td>
                  {expanded && (
                    <>
                      <QuarterCells quarters={catQuarters} dark />
                      <ProjectionCell annual={catAnnual} spent={catSpent} dark />
                    </>
                  )}
                </tr>
                {cat.items.map(item => (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-100 hover:bg-brand-50/40 transition-colors group/item ${drag?.type === 'item' && drag.id === item.id ? 'opacity-40' : ''}`}
                    onDragOver={e => { if (drag?.type === 'item' && !item.virtual) e.preventDefault() }}
                    onDrop={() => { if (drag?.type === 'item') moveItem(drag.catId, drag.id, cat.id, item.id) }}
                  >
                    <td className="px-6 py-2.5 text-sm text-gray-700 pl-10">
                      <div className="flex items-center gap-2">
                        <span
                          draggable
                          onDragStart={() => setDrag({ type: 'item', id: item.id, catId: cat.id })}
                          onDragEnd={() => setDrag(null)}
                          className="cursor-grab active:cursor-grabbing text-gray-300 opacity-0 group-hover/item:opacity-100 transition-opacity"
                          title={item.virtual ? 'Arrastrar a una subárea para convertir en partida' : 'Arrastrar para reordenar o mover de subárea'}
                        >
                          <GripVertical size={13} />
                        </span>
                        {item.virtual ? <VirtualNameCell item={item} /> : <NameCell item={item} />}
                        {!item.virtual && (
                          <button
                            onClick={() => onDeleteItem(item)}
                            className="opacity-0 group-hover/item:opacity-60 hover:!opacity-100 text-gray-400 hover:text-red-600 transition-all"
                            title="Eliminar partida"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">
                      <AmountCell item={item} field="annualAmount" />
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-700 text-right tabular-nums">
                      {item.spentAmount > 0 ? formatCLP(item.spentAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                      <DiffCell diff={item.annualAmount - item.spentAmount} />
                    </td>
                    {expanded && (
                      <>
                        <QuarterCells quarters={item.spentByQuarter ?? [0, 0, 0, 0]} />
                        <ProjectionCell annual={item.annualAmount} spent={item.spentAmount} />
                      </>
                    )}
                  </tr>
                ))}
                {!isVirtual && <AddItemRow categoryId={cat.id} colSpan={colSpan} />}
              </React.Fragment>
            )
          })}
          <AddCategoryRow colSpan={colSpan} />
          <tr className="bg-brand-700 text-white font-bold">
            <td className="px-6 py-3 text-sm uppercase tracking-wide">Total</td>
            <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCLP(totalAnnual)}</td>
            <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCLP(totalSpent)}</td>
            <td className="px-4 py-3 text-sm text-right tabular-nums">
              <DiffCellInverse diff={totalAnnual - totalSpent} />
            </td>
            {expanded && (
              <>
                <QuarterCells quarters={totalQuarters} dark />
                <ProjectionCell annual={totalAnnual} spent={totalSpent} dark />
              </>
            )}
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PresupuestoPage() {
  const { data: categories, isLoading, isError } = useBudget()
  const [expanded, setExpanded] = useState(false)

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

  const partidas = (categories ?? []).filter(c => c.section === 'PARTIDAS')

  return (
    <div className={`p-8 mx-auto space-y-8 transition-[max-width] ${expanded ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto DPDO</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de partidas y gastos anuales</p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:text-brand-700 transition-colors whitespace-nowrap"
        >
          <Columns3 size={15} />
          {expanded ? 'Ocultar trimestres' : 'Ver trimestres'}
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      <PartidasTable categories={partidas} expanded={expanded} />

      <p className="text-xs text-gray-400 italic">
        Haz clic en cualquier nombre o monto para editarlo. Arrastra ⠿ para reordenar o mover partidas entre subáreas.
        {expanded && ' La columna «Disp. proyectado» es el presupuesto disponible para el resto del año (y su promedio por trimestre restante).'}
      </p>
    </div>
  )
}
