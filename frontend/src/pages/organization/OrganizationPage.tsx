import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Briefcase, Pencil, Trash2, X, ChevronRight } from 'lucide-react'
import { departmentsApi, positionsApi } from '@/lib/api'
import type { Department, Position } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const deptSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  code: z.string().min(1, 'Requerido').max(10).toUpperCase(),
  parentId: z.string().optional(),
})

const posSchema = z.object({
  title: z.string().min(1, 'Requerido'),
  departmentId: z.string().min(1, 'Selecciona un área'),
  level: z.string().optional(),
})

type DeptForm = z.infer<typeof deptSchema>
type PosForm = z.infer<typeof posSchema>

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function DeptModal({
  dept,
  departments,
  onClose,
  onSuccess,
}: {
  dept?: Department
  departments: Department[]
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeptForm>({
    resolver: zodResolver(deptSchema),
    defaultValues: dept ? { name: dept.name, code: dept.code, parentId: dept.parentId ?? '' } : {},
  })

  async function onSubmit(data: DeptForm) {
    const payload = { ...data, parentId: data.parentId || undefined, code: data.code.toUpperCase() }
    if (dept) {
      await departmentsApi.update(dept.id, payload)
    } else {
      await departmentsApi.create(payload)
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{dept ? 'Editar área' : 'Nueva área'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={16} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
            <input {...register('name')} className={inputClass} placeholder="Gestión de Personas" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Código</label>
            <input {...register('code')} className={inputClass} placeholder="RRHH" maxLength={10} />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Área padre (opcional)</label>
            <select {...register('parentId')} className={inputClass}>
              <option value="">Sin área padre</option>
              {departments.filter((d) => d.id !== dept?.id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : dept ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PosModal({
  pos,
  departments,
  onClose,
  onSuccess,
}: {
  pos?: Position
  departments: Department[]
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PosForm>({
    resolver: zodResolver(posSchema),
    defaultValues: pos ? { title: pos.title, departmentId: pos.departmentId, level: pos.level ?? '' } : {},
  })

  async function onSubmit(data: PosForm) {
    const payload = { ...data, level: data.level || undefined }
    if (pos) {
      await positionsApi.update(pos.id, payload)
    } else {
      await positionsApi.create(payload)
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{pos ? 'Editar cargo' : 'Nuevo cargo'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={16} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del cargo</label>
            <input {...register('title')} className={inputClass} placeholder="Analista de RRHH" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Área</label>
            <select {...register('departmentId')} className={inputClass}>
              <option value="">Seleccionar área...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {errors.departmentId && <p className="text-xs text-red-500 mt-1">{errors.departmentId.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nivel (opcional)</label>
            <select {...register('level')} className={inputClass}>
              <option value="">Sin nivel</option>
              {['Jefatura', 'Senior', 'Semi Senior', 'Junior', 'Trainee', 'Gerencia', 'Dirección'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : pos ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OrganizationPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'departments' | 'positions'>('departments')
  const [deptModal, setDeptModal] = useState<{ open: boolean; dept?: Department }>({ open: false })
  const [posModal, setPosModal] = useState<{ open: boolean; pos?: Position }>({ open: false })
  const [expandedDept, setExpandedDept] = useState<string | null>(null)

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  })

  const { data: positions = [], isLoading: loadingPos } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list(),
  })

  const deleteDeptMutation = useMutation({
    mutationFn: departmentsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  })

  const deletePosMutation = useMutation({
    mutationFn: positionsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['departments'] })
    queryClient.invalidateQueries({ queryKey: ['positions'] })
  }

  const rootDepts = departments.filter((d) => !d.parentId)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organización</h2>
          <p className="text-gray-500 mt-1">{departments.length} área(s) · {positions.length} cargo(s)</p>
        </div>
        <button
          onClick={() => activeTab === 'departments' ? setDeptModal({ open: true }) : setPosModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {activeTab === 'departments' ? 'Nueva área' : 'Nuevo cargo'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['departments', 'positions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'departments' ? <Building2 size={15} /> : <Briefcase size={15} />}
            {tab === 'departments' ? 'Áreas' : 'Cargos'}
          </button>
        ))}
      </div>

      {/* Departments tab */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingDepts ? (
            <div className="p-8 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : departments.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay áreas registradas aún.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rootDepts.map((dept) => {
                const children = departments.filter((d) => d.parentId === dept.id)
                const isExpanded = expandedDept === dept.id
                return (
                  <li key={dept.id}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {children.length > 0 && (
                          <button onClick={() => setExpandedDept(isExpanded ? null : dept.id)} className="text-gray-400 hover:text-gray-700">
                            <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        )}
                        {children.length === 0 && <span className="w-4" />}
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{dept.name}</p>
                          <p className="text-xs text-gray-400">{dept.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {(dept as any)._count?.employees ?? 0} colaborador(es)
                        </span>
                        <button onClick={() => setDeptModal({ open: true, dept })} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`¿Eliminar el área "${dept.name}"?`)) deleteDeptMutation.mutate(dept.id) }}
                          className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between px-4 py-2.5 pl-12 bg-gray-50 border-t border-gray-100 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Building2 size={12} className="text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{child.name}</p>
                            <p className="text-xs text-gray-400">{child.code}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setDeptModal({ open: true, dept: child })} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => { if (confirm(`¿Eliminar "${child.name}"?`)) deleteDeptMutation.mutate(child.id) }} className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Positions tab */}
      {activeTab === 'positions' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingPos ? (
            <div className="p-8 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : positions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay cargos registrados aún.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nivel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaboradores</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{pos.title}</td>
                    <td className="px-4 py-3 text-gray-600">{pos.department?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {pos.level ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{pos.level}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{(pos as any)._count?.employees ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setPosModal({ open: true, pos })} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => { if (confirm(`¿Eliminar el cargo "${pos.title}"?`)) deletePosMutation.mutate(pos.id) }} className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {deptModal.open && (
        <DeptModal
          dept={deptModal.dept}
          departments={departments}
          onClose={() => setDeptModal({ open: false })}
          onSuccess={refresh}
        />
      )}
      {posModal.open && (
        <PosModal
          pos={posModal.pos}
          departments={departments}
          onClose={() => setPosModal({ open: false })}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}
