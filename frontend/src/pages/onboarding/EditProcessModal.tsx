// Modal de edición de proceso de onboarding. Extraído de OnboardingDrawer.tsx.
import React, { useState } from 'react'
import { X, Plus, Save } from 'lucide-react'
import { useUpdateOnboarding } from '@/hooks/useOnboarding'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import { useJobTitles, useEmployees, useUpdateEmployee } from '@/hooks/useDotacion'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { OnboardingProcess } from '@/types'

export function EditProcessModal({ process, onClose }: { process: OnboardingProcess; onClose: () => void }) {
  useEscapeKey(onClose)
  const cd = (process.collaboratorData as Record<string, any>) ?? {}
  const [form, setForm] = useState({
    collaboratorRut:           process.collaboratorRut ?? '',
    collaboratorName:          process.collaboratorName ?? '',
    collaboratorEmail:         process.collaboratorEmail ?? '',
    collaboratorPersonalEmail: process.collaboratorPersonalEmail ?? '',
    collaboratorPosition:      process.collaboratorPosition ?? '',
    collaboratorPhone:         process.collaboratorPhone ?? '',
    legalEntity:               process.legalEntity ?? '',
    costCenter:                process.costCenter ?? '',
    startDate:                 process.startDate ? process.startDate.slice(0, 10) : '',
    notes:                     process.notes ?? '',
    // Datos personales
    birthDate:    cd.birthDate    ?? '',
    gender:       cd.gender       ?? '',
    nationality:  cd.nationality  ?? '',
    city:         cd.city         ?? '',
    commune:      cd.commune      ?? '',
    address:      cd.address      ?? '',
    // Datos laborales
    jobFamily:        cd.jobFamily        ?? '',
    companyStartDate: cd.companyStartDate ?? '',
    supervisorName:      cd.supervisorName      ?? '',
    supervisorTitle:     cd.supervisorTitle     ?? '',
    supervisorEmail:     cd.supervisorEmail     ?? '',
    supervisorFirstName: cd.supervisorFirstName ?? '',
    supervisorLastName:  cd.supervisorLastName  ?? '',
    mentorAsignado:      cd.mentorAsignado      ?? '',
    vinculo:             cd.vinculo             ?? '',
    reemplazaA:          cd.reemplazaA          ?? '',
    contractType:     cd.contractType     ?? '',
    contractEndDate:  cd.contractEndDate  ?? '',
    // Condiciones de la oferta
    tipoJornadaTipo:     cd.tipoJornadaTipo     ?? '',
    tipoJornadaHoras:    cd.tipoJornadaHoras    ?? '',
    distribucionJornada: cd.distribucionJornada ?? '',
    horario:             cd.horario             ?? '',
    sueldoLiquido:       cd.sueldoLiquido       ?? '',
    // Previsión social
    afp:    cd.afp    ?? '',
    isapre: cd.isapre ?? '',
    // Datos bancarios
    banco:        cd.banco        ?? '',
    tipoCuenta:   cd.tipoCuenta   ?? '',
    numeroCuenta: cd.numeroCuenta ?? '',
  })

  const [modalidades, setModalidades] = useState<string[]>(() => Array.isArray(cd.modalidades) ? cd.modalidades : [])
  const [beneficios, setBeneficios]   = useState<string[]>(() => Array.isArray(cd.beneficios)  ? cd.beneficios  : [])
  const [acreditacion, setAcreditacion] = useState<boolean>(() => !!cd.acreditacion)
  const [beneficiosOpciones, setBeneficiosOpciones] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gdp_beneficios_opciones')
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed }
    } catch {}
    return ['Seguro de salud complementario', 'Día libre de cumpleaños', '5 días adicionales de vacaciones (al cumplir 1 año)', 'Caja de compensación', 'Pago de los 3 primeros días de las licencias médicas', 'Oportunidades de capacitación']
  })

  React.useEffect(() => {
    localStorage.setItem('gdp_beneficios_opciones', JSON.stringify(beneficiosOpciones))
  }, [beneficiosOpciones])

  const updateOnboarding = useUpdateOnboarding()
  const updateEmployee   = useUpdateEmployee()
  const { data: workCenters = [] } = useWorkCenters()
  const { data: jobTitles   = [] } = useJobTitles()

  // Supervisor search
  const [supervisorSearch, setSupervisorSearch] = useState('')
  const [supervisorOpen, setSupervisorOpen]     = useState(false)
  const supervisorRef = React.useRef<HTMLDivElement>(null)
  const { data: supervisorEmpData } = useEmployees(
    supervisorSearch.length >= 2 ? { search: supervisorSearch, status: ['ACTIVE'] } : {}
  )
  const supervisorResults = supervisorSearch.length >= 2 ? (supervisorEmpData?.data ?? []).slice(0, 6) : []

  // Mentor search
  const [mentorSearch, setMentorSearch] = useState('')
  const [mentorOpen, setMentorOpen]     = useState(false)
  const mentorRef = React.useRef<HTMLDivElement>(null)
  const { data: mentorEmpData } = useEmployees(
    mentorSearch.length >= 2 ? { search: mentorSearch, status: ['ACTIVE'] } : {}
  )
  const mentorResults = mentorSearch.length >= 2 ? (mentorEmpData?.data ?? []).slice(0, 6) : []

  // Reemplaza a search
  const [reemplazaSearch, setReemplazaSearch] = useState('')
  const [reemplazaOpen, setReemplazaOpen]     = useState(false)
  const reemplazaRef = React.useRef<HTMLDivElement>(null)
  const { data: reemplazaEmpData } = useEmployees(
    reemplazaSearch.length >= 2 ? { search: reemplazaSearch, status: ['ACTIVE'] } : {}
  )
  const reemplazaResults = reemplazaSearch.length >= 2 ? (reemplazaEmpData?.data ?? []).slice(0, 6) : []

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supervisorRef.current && !supervisorRef.current.contains(e.target as Node)) setSupervisorOpen(false)
      if (mentorRef.current && !mentorRef.current.contains(e.target as Node)) setMentorOpen(false)
      if (reemplazaRef.current && !reemplazaRef.current.contains(e.target as Node)) setReemplazaOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const field = (key: keyof typeof form, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.collaboratorName.trim()) return
    try {
      const collaboratorData: Record<string, unknown> = {}
      // Datos personales
      if (form.birthDate)   collaboratorData.birthDate   = form.birthDate
      if (form.gender)      collaboratorData.gender      = form.gender
      if (form.nationality) collaboratorData.nationality = form.nationality.trim()
      if (form.city)        collaboratorData.city        = form.city.trim()
      if (form.commune)     collaboratorData.commune     = form.commune.trim()
      if (form.address)     collaboratorData.address     = form.address.trim()
      // Datos laborales
      if (form.jobFamily)        collaboratorData.jobFamily        = form.jobFamily.trim()
      if (form.companyStartDate) collaboratorData.companyStartDate = form.companyStartDate
      if (form.supervisorName)      collaboratorData.supervisorName      = form.supervisorName.trim()
      if (form.supervisorTitle)     collaboratorData.supervisorTitle     = form.supervisorTitle.trim()
      if (form.supervisorEmail)     collaboratorData.supervisorEmail     = form.supervisorEmail.trim()
      if (form.supervisorFirstName) collaboratorData.supervisorFirstName = form.supervisorFirstName.trim()
      if (form.supervisorLastName)  collaboratorData.supervisorLastName  = form.supervisorLastName.trim()
      if (form.mentorAsignado)      collaboratorData.mentorAsignado      = form.mentorAsignado.trim()
      if (form.vinculo)             collaboratorData.vinculo             = form.vinculo
      if (form.reemplazaA)          collaboratorData.reemplazaA          = form.reemplazaA.trim()
      if (form.contractType)        collaboratorData.contractType        = form.contractType
      if (form.contractEndDate)     collaboratorData.contractEndDate     = form.contractEndDate
      // Condiciones de la oferta
      if (form.tipoJornadaTipo)     collaboratorData.tipoJornadaTipo     = form.tipoJornadaTipo
      if (form.tipoJornadaHoras)    collaboratorData.tipoJornadaHoras    = form.tipoJornadaHoras
      if (form.distribucionJornada) collaboratorData.distribucionJornada = form.distribucionJornada.trim()
      if (form.horario)             collaboratorData.horario             = form.horario.trim()
      if (modalidades.length > 0) {
        collaboratorData.modalidades = modalidades
        collaboratorData.modalidad   = modalidades.length === 1
          ? modalidades[0]
          : modalidades.slice(0, -1).join(', ') + ' y ' + modalidades[modalidades.length - 1]
      }
      if (form.sueldoLiquido) collaboratorData.sueldoLiquido = form.sueldoLiquido
      if (beneficios.length > 0) collaboratorData.beneficios = beneficios
      collaboratorData.acreditacion = acreditacion
      // Previsión social
      if (form.afp)    collaboratorData.afp    = form.afp.trim()
      if (form.isapre) collaboratorData.isapre = form.isapre.trim()
      // Datos bancarios
      if (form.banco)        collaboratorData.banco        = form.banco.trim()
      if (form.tipoCuenta)   collaboratorData.tipoCuenta   = form.tipoCuenta
      if (form.numeroCuenta) collaboratorData.numeroCuenta = form.numeroCuenta.trim()

      await updateOnboarding.mutateAsync({
        id:                        process.id,
        collaboratorRut:           form.collaboratorRut.trim() || null,
        collaboratorName:          form.collaboratorName.trim(),
        collaboratorEmail:         form.collaboratorEmail.trim() || null,
        collaboratorPersonalEmail: form.collaboratorPersonalEmail.trim() || null,
        collaboratorPosition:      form.collaboratorPosition.trim() || null,
        collaboratorPhone:         form.collaboratorPhone.trim() || null,
        legalEntity:               form.legalEntity || null,
        costCenter:                form.costCenter.trim() || null,
        startDate:                 form.startDate || undefined,
        notes:                     form.notes.trim() || null,
        collaboratorData:          Object.keys(collaboratorData).length ? collaboratorData : undefined,
      })

      // Sync to linked Employee if one exists
      if (process.employeeId) {
        await updateEmployee.mutateAsync({
          id:              process.employeeId,
          email:           form.collaboratorEmail.trim()         || undefined,
          personalEmail:   form.collaboratorPersonalEmail.trim() || null,
          phone:           form.collaboratorPhone.trim()         || null,
          jobTitle:        form.collaboratorPosition.trim()      || null,
          jobFamily:       form.jobFamily.trim()                 || null,
          startDate:       form.startDate                        || undefined,
          city:            form.city.trim()                      || null,
          commune:         form.commune.trim()                   || null,
          address:         form.address.trim()                   || null,
          birthDate:       form.birthDate                        || null,
          gender:          form.gender                           || null,
          nationality:     form.nationality.trim()               || null,
          supervisorName:  form.supervisorName.trim()            || null,
          supervisorTitle: form.supervisorTitle.trim()           || null,
          vinculo:         form.vinculo                          || null,
          endDate:         form.contractEndDate                  || null,
          afp:             form.afp.trim()                       || null,
          isapre:          form.isapre.trim()                    || null,
          reemplazaA:      form.reemplazaA.trim()                || null,
          banco:           form.banco.trim()                     || null,
          tipoCuenta:      form.tipoCuenta                       || null,
          numeroCuenta:    form.numeroCuenta.trim()              || null,
        })
      }

      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al guardar los cambios')
    }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const sel = inp + ' bg-white'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Editar proceso</h2>
            <p className="text-xs text-gray-400 mt-0.5">Modifica los datos del colaborador</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[78vh]">

          {/* ── Identificación ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre completo <span className="text-red-400">*</span></label>
                <input autoFocus type="text" value={form.collaboratorName} onChange={e => field('collaboratorName', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">RUT</label>
                <input type="text" value={form.collaboratorRut} onChange={e => field('collaboratorRut', e.target.value)} placeholder="12.345.678-9" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
                <input type="text" value={form.collaboratorPhone} onChange={e => field('collaboratorPhone', e.target.value)} placeholder="+56 9 XXXX XXXX" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo</label>
                <input type="email" value={form.collaboratorEmail} onChange={e => field('collaboratorEmail', e.target.value)} placeholder="juan.perez@surmedia.cl" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email personal</label>
                <input type="email" value={form.collaboratorPersonalEmail} onChange={e => field('collaboratorPersonalEmail', e.target.value)} placeholder="juan.perez@gmail.com" className={inp} />
              </div>
            </div>
          </div>

          {/* ── Datos personales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos personales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de nacimiento</label>
                <input type="date" value={form.birthDate} onChange={e => field('birthDate', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sexo</label>
                <select value={form.gender} onChange={e => field('gender', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nacionalidad</label>
                <input type="text" placeholder="Chilena" value={form.nationality} onChange={e => field('nationality', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ciudad</label>
                <input type="text" placeholder="Santiago" value={form.city} onChange={e => field('city', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Comuna</label>
                <input type="text" placeholder="Providencia" value={form.commune} onChange={e => field('commune', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Dirección</label>
                <input type="text" placeholder="Av. Providencia 1234, Dpto 501" value={form.address} onChange={e => field('address', e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* ── Datos laborales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos laborales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo</label>
                <select value={form.collaboratorPosition} onChange={e => field('collaboratorPosition', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  {jobTitles.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Familia de cargo</label>
                <input type="text" placeholder="Ej: Tecnología" value={form.jobFamily} onChange={e => field('jobFamily', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa</label>
                <select value={form.legalEntity} onChange={e => field('legalEntity', e.target.value)} className={sel}>
                  <option value="">Sin especificar</option>
                  <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
                  <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Centro de Trabajo</label>
                <select value={form.costCenter} onChange={e => field('costCenter', e.target.value)} className={sel}>
                  <option value="">Seleccionar centro...</option>
                  {(workCenters as any[]).map(wc => <option key={wc.id} value={wc.name}>{wc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso</label>
                <input type="date" value={form.startDate} onChange={e => field('startDate', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha ingreso empresa</label>
                <input type="date" value={form.companyStartDate} onChange={e => field('companyStartDate', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de contrato</label>
                <select value={form.contractType} onChange={e => field('contractType', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  <option value="INDEFINIDO">Indefinido</option>
                  <option value="PLAZO_FIJO">Plazo fijo</option>
                  <option value="HONORARIOS">Honorarios</option>
                  <option value="PRACTICA">Práctica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha vencimiento contrato</label>
                <input type="date" value={form.contractEndDate} onChange={e => field('contractEndDate', e.target.value)} className={inp} />
              </div>
              <div ref={supervisorRef} className="relative col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre supervisor</label>
                <input type="text" placeholder="Buscar supervisor por nombre..."
                  value={form.supervisorName}
                  onChange={e => { field('supervisorName', e.target.value); setSupervisorSearch(e.target.value); setSupervisorOpen(true) }}
                  onFocus={() => setSupervisorOpen(true)}
                  className={inp} />
                {supervisorOpen && supervisorResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                    {supervisorResults.map((emp: any) => (
                      <button key={emp.id} type="button" onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setForm(f => ({ ...f, supervisorName: `${emp.firstName} ${emp.lastName}`, supervisorTitle: emp.jobTitle ?? f.supervisorTitle, supervisorEmail: emp.email ?? '', supervisorFirstName: emp.firstName ?? '', supervisorLastName: (emp.lastName ?? '').split(' ')[0] }))
                          setSupervisorSearch(''); setSupervisorOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0">
                        <div className="text-xs font-medium text-gray-800">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[10px] text-gray-400 ml-2">{emp.jobTitle ?? '—'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo supervisor</label>
                <input type="text" value={form.supervisorTitle} onChange={e => field('supervisorTitle', e.target.value)} placeholder="Cargo del supervisor" className={inp} />
              </div>
              <div ref={mentorRef} className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mentor asignado</label>
                <input type="text" placeholder="Buscar mentor por nombre..."
                  value={form.mentorAsignado}
                  onChange={e => { field('mentorAsignado', e.target.value); setMentorSearch(e.target.value); setMentorOpen(true) }}
                  onFocus={() => setMentorOpen(true)}
                  className={inp} />
                {mentorOpen && mentorResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                    {mentorResults.map((emp: any) => (
                      <button key={emp.id} type="button" onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setForm(f => ({ ...f, mentorAsignado: `${emp.firstName} ${emp.lastName}` }))
                          setMentorSearch(''); setMentorOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0">
                        <div className="text-xs font-medium text-gray-800">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[10px] text-gray-400 ml-2">{emp.jobTitle ?? '—'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Vínculo</label>
                <select value={form.vinculo} onChange={e => field('vinculo', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  <option value="Planta">Planta</option>
                  <option value="Reemplazo">Reemplazo</option>
                </select>
              </div>
              {form.vinculo === 'Reemplazo' && (
                <div ref={reemplazaRef} className="col-span-2 relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Reemplaza a</label>
                  <input type="text" placeholder="Buscar persona por nombre..."
                    value={form.reemplazaA}
                    onChange={e => { field('reemplazaA', e.target.value); setReemplazaSearch(e.target.value); setReemplazaOpen(true) }}
                    onFocus={() => setReemplazaOpen(true)}
                    className={inp} />
                  {reemplazaOpen && reemplazaResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                      {reemplazaResults.map((emp: any) => (
                        <button key={emp.id} type="button" onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            field('reemplazaA', `${emp.firstName} ${emp.lastName}`)
                            setReemplazaSearch(''); setReemplazaOpen(false)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0">
                          <div className="text-xs font-medium text-gray-800">{emp.firstName} {emp.lastName}</div>
                          <div className="text-[10px] text-gray-400 ml-2">{emp.jobTitle ?? '—'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Condiciones de la oferta ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Condiciones de la oferta</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de jornada</label>
                <select value={form.tipoJornadaTipo} onChange={e => field('tipoJornadaTipo', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="parcial">Parcial</option>
                  <option value="excepcional">Excepcional</option>
                  <option value="extraordinaria">Extraordinaria</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Horas semanales</label>
                <input type="number" min="1" max="80" placeholder="Ej: 40" value={form.tipoJornadaHoras} onChange={e => field('tipoJornadaHoras', e.target.value)} className={inp} />
                {form.tipoJornadaTipo && form.tipoJornadaHoras && (
                  <p className="text-[10px] text-brand-500 mt-1">→ jornada {form.tipoJornadaTipo} de {form.tipoJornadaHoras} horas semanales</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Jornada (días)</label>
                <input type="text" placeholder="Ej: lunes a viernes" value={form.distribucionJornada}
                  onChange={e => field('distribucionJornada', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Horario de trabajo</label>
                <textarea rows={2} placeholder="Ej: De lunes a jueves de 9:00 a 18:15 horas con 45 minutos de colación, y los viernes de 9:00 a 15:00 horas."
                  value={form.horario} onChange={e => field('horario', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Modalidad de trabajo</label>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
                  {(['Presencial inplant', 'Presencial oficina Surmedia', 'Terreno', 'Teletrabajo'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={modalidades.includes(opt)}
                        onChange={e => setModalidades(prev => e.target.checked ? [...prev, opt] : prev.filter(x => x !== opt))}
                        className="w-3.5 h-3.5 rounded accent-brand-600" />
                      <span className="text-xs text-gray-700">{opt}</span>
                    </label>
                  ))}
                  {modalidades.length > 0 && (
                    <p className="text-[10px] text-brand-500 pt-1.5 border-t border-gray-200 mt-1">→ {modalidades.join(', ')}</p>
                  )}
                </div>
              </div>
              {/* Acreditación → variable {{exámenes}} */}
              <div className="col-span-2">
                <label className={`flex items-start gap-2.5 cursor-pointer border rounded-lg p-3 transition-colors ${acreditacion ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200 hover:border-brand-300'}`}>
                  <input type="checkbox" checked={acreditacion}
                    onChange={e => setAcreditacion(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-brand-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-gray-700">
                    <span className="font-medium">Acreditación</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      Si se activa, agrega la cláusula de exámenes preocupacionales / acreditación. Si no, esa línea se elimina del documento.
                    </span>
                    {acreditacion && (
                      <span className="block text-[10px] text-brand-500 mt-1.5 pt-1.5 border-t border-brand-200">
                        → El contrato queda sujeto a los resultados de los exámenes preocupaciones que exige el cliente para el trabajo en terreno y acreditación.
                      </span>
                    )}
                  </span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sueldo líquido mensual</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" placeholder="1200000" value={form.sueldoLiquido} onChange={e => field('sueldoLiquido', e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                {form.sueldoLiquido && parseInt(form.sueldoLiquido) > 0 && (
                  <p className="text-[10px] text-brand-500 mt-1">→ ${parseInt(form.sueldoLiquido).toLocaleString('es-CL')} líquidos mensuales</p>
                )}
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-600">Beneficios</label>
                  <button type="button" onClick={() => setBeneficiosOpciones(prev => [...prev, ''])}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
                    <Plus size={11} /> Agregar
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
                  {beneficiosOpciones.length > 0 && (
                    <label className="flex items-center gap-2 pb-2 border-b border-gray-200 cursor-pointer">
                      <input type="checkbox"
                        checked={beneficiosOpciones.filter(t => t.trim()).length > 0 && beneficiosOpciones.filter(t => t.trim()).every(t => beneficios.includes(t))}
                        onChange={e => setBeneficios(e.target.checked ? beneficiosOpciones.filter(t => t.trim()) : [])}
                        className="w-3.5 h-3.5 rounded accent-brand-600" />
                      <span className="text-xs font-semibold text-gray-700">Todos</span>
                    </label>
                  )}
                  {beneficiosOpciones.map((texto, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="checkbox" checked={beneficios.includes(texto)}
                        onChange={e => setBeneficios(prev =>
                          e.target.checked && texto.trim() ? [...prev, texto] : prev.filter(b => b !== texto)
                        )}
                        className="w-3.5 h-3.5 rounded accent-brand-600 flex-shrink-0" />
                      <input type="text" value={texto} placeholder="Descripción del beneficio..."
                        onChange={e => {
                          const newText = e.target.value
                          setBeneficios(prev => prev.includes(texto) ? prev.map(b => b === texto ? newText : b) : prev)
                          setBeneficiosOpciones(prev => prev.map((t, i) => i === idx ? newText : t))
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white" />
                      <button type="button" onClick={() => {
                        setBeneficiosOpciones(prev => prev.filter((_, i) => i !== idx))
                        setBeneficios(prev => prev.filter(b => b !== texto))
                      }} className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {beneficiosOpciones.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Sin beneficios. Agrega uno con el botón de arriba.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Previsión social ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Previsión social</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">AFP</label>
                <input type="text" placeholder="Ej: Modelo, Habitat" value={form.afp} onChange={e => field('afp', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fonasa / Isapre</label>
                <input type="text" placeholder="Ej: Fonasa, Banmédica" value={form.isapre} onChange={e => field('isapre', e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* ── Datos bancarios ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos bancarios</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Banco</label>
                <input type="text" placeholder="Ej: Banco Estado" value={form.banco} onChange={e => field('banco', e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de cuenta</label>
                <select value={form.tipoCuenta} onChange={e => field('tipoCuenta', e.target.value)} className={sel}>
                  <option value="">Seleccionar...</option>
                  <option value="Cuenta Vista">Cuenta Vista</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                  <option value="Cuenta RUT">Cuenta RUT</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Número de cuenta</label>
                <input type="text" placeholder="Ej: 00012345678" value={form.numeroCuenta} onChange={e => field('numeroCuenta', e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* ── Notas internas ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
            <textarea rows={2} value={form.notes} onChange={e => field('notes', e.target.value)}
              placeholder="Información relevante para el proceso..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button onClick={handleSave}
            disabled={!form.collaboratorName.trim() || updateOnboarding.isPending || updateEmployee.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {(updateOnboarding.isPending || updateEmployee.isPending)
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : <><Save size={14} /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </div>
  )
}
