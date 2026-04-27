import { useState } from 'react'
import { Plus, Pencil, Trash2, Mail, Phone, Briefcase, X, UserCircle } from 'lucide-react'
import { useProfiles, useCreateProfile, useUpdateProfile, useDeleteProfile, AREAS, ROLE_TYPES } from '@/hooks/useProfiles'
import type { Profile } from '@/types'

const AREA_LABEL: Record<string, string> = Object.fromEntries(AREAS.map(a => [a.value, a.label]))
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_TYPES.map(r => [r.value, r.label]))

// ─── Modal ──────────────────────────────────────────────────────────────────

function ProfileModal({ profile, onClose }: { profile?: Profile; onClose: () => void }) {
  const [form, setForm] = useState({
    name:     profile?.name     ?? '',
    position: profile?.position ?? '',
    email:    profile?.email    ?? '',
    phone:    profile?.phone    ?? '',
    notes:    profile?.notes    ?? '',
  })
  const [roles, setRoles] = useState<{ area: string; roleType: string }[]>(
    profile?.roles.map(r => ({ area: r.area, roleType: r.roleType })) ?? []
  )
  const [newRole, setNewRole] = useState({ area: 'GENERAL', roleType: 'ENVIA_CORREOS' })

  const create = useCreateProfile()
  const update = useUpdateProfile()
  const isEdit = !!profile

  const field = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const addRole = () => {
    if (roles.some(r => r.area === newRole.area && r.roleType === newRole.roleType)) return
    setRoles(r => [...r, { ...newRole }])
  }

  const removeRole = (i: number) => setRoles(r => r.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.name.trim() || !form.position.trim() || !form.email.trim()) return
    const body = {
      name:     form.name.trim(),
      position: form.position.trim(),
      email:    form.email.trim(),
      phone:    form.phone.trim() || undefined,
      notes:    form.notes.trim() || undefined,
      roles,
    }
    if (isEdit) await update.mutateAsync({ id: profile.id, ...body })
    else         await create.mutateAsync(body)
    onClose()
  }

  const saving = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Editar perfil' : 'Nuevo perfil'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre completo *</label>
              <input value={form.name} onChange={e => field('name', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="María González" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo *</label>
              <input value={form.position} onChange={e => field('position', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Analista RRHH" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => field('phone', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+56 9 XXXX XXXX" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Correo *</label>
              <input type="email" value={form.email} onChange={e => field('email', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="maria.gonzalez@surmedia.cl" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas</label>
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Información adicional..." />
            </div>
          </div>

          {/* Roles */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Roles en el proceso</p>
            <div className="flex gap-2 mb-2">
              <select value={newRole.area} onChange={e => setNewRole(r => ({ ...r, area: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <select value={newRole.roleType} onChange={e => setNewRole(r => ({ ...r, roleType: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={addRole}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus size={14} />
              </button>
            </div>
            {roles.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">Sin roles asignados</p>
            )}
            <div className="flex flex-col gap-1">
              {roles.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                  <span className="font-medium text-gray-700">{AREA_LABEL[r.area] ?? r.area}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-600 flex-1">{ROLE_LABEL[r.roleType] ?? r.roleType}</span>
                  <button onClick={() => removeRole(i)} className="ml-2 p-0.5 rounded hover:bg-red-100 text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.position || !form.email}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear perfil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const { data: profiles = [], isLoading } = useProfiles()
  const deleteProfile = useDeleteProfile()
  const [modal, setModal] = useState<'new' | Profile | null>(null)

  const handleDelete = (p: Profile) => {
    if (!confirm(`¿Eliminar perfil de ${p.name}?`)) return
    deleteProfile.mutate(p.id)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Perfiles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personas y roles en el proceso de onboarding</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={15} /> Nuevo perfil
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando perfiles...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16">
          <UserCircle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No hay perfiles creados aún</p>
          <button onClick={() => setModal('new')}
            className="mt-3 text-sm text-blue-600 hover:underline">Crear el primero</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Briefcase size={10} /> {p.position}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(p)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Contact */}
              <div className="flex flex-col gap-1 mb-3">
                <a href={`mailto:${p.email}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Mail size={10} /> {p.email}
                </a>
                {p.phone && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone size={10} /> {p.phone}
                  </span>
                )}
              </div>

              {/* Roles */}
              {p.roles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.roles.map(r => (
                    <span key={r.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                      {AREA_LABEL[r.area] ?? r.area} · {ROLE_LABEL[r.roleType] ?? r.roleType}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProfileModal
          profile={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
