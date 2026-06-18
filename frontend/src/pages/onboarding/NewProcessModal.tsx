// Modal de creación de proceso de onboarding (2 pasos: formulario + calendario).
// Extraído de OnboardingPage.tsx.
import React, { useState, useMemo, useEffect } from 'react'
import {
  Plus, Rocket, AlertTriangle, X, ChevronRight, ChevronLeft,
  Calendar, Search, UserCheck, Building2,
} from 'lucide-react'
import { useCreateOnboarding, useTemplateTasks } from '@/hooks/useOnboarding'
import { useJobTitles, useJobFamilies, useWorkSchedules, useEmployees, useCreateEmployee } from '@/hooks/useDotacion'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import { useProfiles } from '@/hooks/useProfiles'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { OnboardingProcess, OnboardingDbTemplateTask, OnboardingPeriod, TaskAutomationType, Profile } from '@/types'
import EditableCombobox from './EditableCombobox'
import {
  WEEKDAYS, formatDays, buildJornada, parseDays,
  PERIOD_ORDER, PERIOD_LABELS, PERIOD_COLORS, AutoBadge,
  CalendarPreview, type CalItem, type CalItemWithTime,
} from './onboardingPageShared'

export function NewProcessModal({ onClose, onCreated, processes }: {
  onClose:   () => void
  onCreated: (id: string) => void
  processes: OnboardingProcess[]
}) {
  useEscapeKey(onClose)
  const [form, setForm] = useState({
    // Campos obligatorios
    collaboratorRut: '', collaboratorName: '', collaboratorEmail: '', collaboratorPersonalEmail: '',
    collaboratorPosition: '', collaboratorPhone: '', legalEntity: '', costCenter: '', startDate: '', notes: '',
    // Nombre desglosado
    primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
    // Datos personales adicionales
    city: '', commune: '',
    direccionCalle: '', direccionNumero: '', direccionDepto: '',
    address: '',
    birthDate: '', gender: '', nationality: '',
    // Datos laborales adicionales
    jobFamily: '', contractType: '', companyStartDate: '', contractEndDate: '',
    workSchedule: '', distribucionJornada: '', supervisorName: '', supervisorTitle: '', supervisorEmail: '',
    supervisorFirstName: '', supervisorLastName: '',
    mentorAsignado: '',
    // Vínculo laboral
    vinculo: '', reemplazaA: '',
    // Previsión social
    afp: '', isapre: '',
    // Datos bancarios
    banco: '', tipoCuenta: '', numeroCuenta: '',
    // Condiciones de la oferta
    tipoJornadaTipo: '', tipoJornadaHoras: '',
    horario: '',
    modalidadTipo: '', modalidad: '',
    sueldoLiquido: '',
  })
  const [beneficios, setBeneficios] = useState<string[]>([])
  const [rutSearch,          setRutSearch]          = useState('')
  const [matchedEmployee,    setMatchedEmployee]    = useState<{ id: string; name: string; position?: string | null; rut: string } | null>(null)
  const [duplicateProcessId, setDuplicateProcessId] = useState<string | null>(null)
  const [entityPickEmp,      setEntityPickEmp]      = useState<any | null>(null)
  const [creatingNew,        setCreatingNew]        = useState(false)
  const [positionMode,       setPositionMode]       = useState<'select' | 'custom'>('select')
  const [selected,           setSelected]           = useState<Set<string>>(new Set())
  const [showCalendar,         setShowCalendar]         = useState(false)
  const [eventExtraProfileIds, setEventExtraProfileIds] = useState<Record<string, string[]>>({})
  const [eventTimes,           setEventTimes]           = useState<Record<string, string>>({})
  const [expandedEventId,      setExpandedEventId]      = useState<string | null>(null)
  const [supervisorSearch,     setSupervisorSearch]     = useState('')
  const [supervisorOpen,       setSupervisorOpen]       = useState(false)
  const supervisorRef = React.useRef<HTMLDivElement>(null)
  const [mentorSearch,         setMentorSearch]         = useState('')
  const [mentorOpen,           setMentorOpen]           = useState(false)
  const mentorRef = React.useRef<HTMLDivElement>(null)
  const [reemplazaSearch,      setReemplazaSearch]      = useState('')
  const [reemplazaOpen,        setReemplazaOpen]        = useState(false)
  const reemplazaRef = React.useRef<HTMLDivElement>(null)
  const [jornadaDias,     setJornadaDias]     = useState<string[]>([])
  const [teletrabajoDias, setTeletrabajoDias] = useState<string[]>([])
  const [acreditacion,    setAcreditacion]    = useState(false)
  const [modalidades, setModalidades] = useState<string[]>([])
  const [beneficiosOpciones, setBeneficiosOpciones] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gdp_beneficios_opciones')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [
      'Seguro de salud complementario',
      'Día libre de cumpleaños',
      '5 días adicionales de vacaciones (al cumplir 1 año)',
      'Caja de compensación',
      'Pago de los 3 primeros días de las licencias médicas',
      'Oportunidades de capacitación',
    ]
  })

  const { data: rawTemplate = [], isLoading: templateLoading, isError: templateError, refetch: refetchTemplate } = useTemplateTasks()
  const template = rawTemplate.filter(t => t.isActive)
  const { data: jobTitles    = [] } = useJobTitles()
  const { data: jobFamilies  = [] } = useJobFamilies()
  const { data: workSchedules = [] } = useWorkSchedules()
  const { data: workCenters  = [] } = useWorkCenters()
  const { data: profiles     = [] } = useProfiles()
  const { data: empData, isFetching: searchFetching } = useEmployees(
    rutSearch.length >= 2 ? { search: rutSearch, status: ['ACTIVE', 'INACTIVE'] } : {}
  )
  const { data: supervisorEmpData } = useEmployees(
    supervisorSearch.length >= 2 ? { search: supervisorSearch, status: ['ACTIVE'] } : {}
  )
  const supervisorResults = supervisorSearch.length >= 2 ? (supervisorEmpData?.data ?? []).slice(0, 6) : []
  const { data: mentorEmpData } = useEmployees(
    mentorSearch.length >= 2 ? { search: mentorSearch, status: ['ACTIVE'] } : {}
  )
  const mentorResults = mentorSearch.length >= 2 ? (mentorEmpData?.data ?? []).slice(0, 6) : []
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

  // Recalcula la variable {{jornada}} (distribucionJornada) desde los días marcados.
  const applyJornada = (dias: string[], tele: string[]) => {
    setJornadaDias(dias)
    setTeletrabajoDias(tele)
    setForm(f => ({ ...f, distribucionJornada: buildJornada(dias, tele) }))
  }
  const toggleJornadaDia = (d: string) =>
    applyJornada(jornadaDias.includes(d) ? jornadaDias.filter(x => x !== d) : [...jornadaDias, d], teletrabajoDias)
  const toggleTeleDia = (d: string) =>
    applyJornada(jornadaDias, teletrabajoDias.includes(d) ? teletrabajoDias.filter(x => x !== d) : [...teletrabajoDias, d])
  const createOnboarding = useCreateOnboarding()
  const createEmployee   = useCreateEmployee()

  const employeeResults = rutSearch.length >= 2 ? (empData?.data ?? []).slice(0, 6) : []

  const applyEmployee = (emp: any, chosenLegalEntity?: string) => {
    const firstParts  = (emp.firstName ?? '').trim().split(/\s+/).filter(Boolean)
    const lastParts   = (emp.lastName  ?? '').trim().split(/\s+/).filter(Boolean)
    const primerNombre   = firstParts[0] ?? ''
    const segundoNombre  = firstParts.slice(1).join(' ')
    const primerApellido = lastParts[0] ?? ''
    const segundoApellido = emp.segundoApellido ?? lastParts.slice(1).join(' ')
    const fullName = [primerNombre, segundoNombre, primerApellido, segundoApellido].filter(Boolean).join(' ')

    setMatchedEmployee({ id: emp.id, name: fullName, position: emp.jobTitle, rut: emp.rut })
    const contract = chosenLegalEntity
      ? (emp.contracts ?? []).find((c: any) => c.isActive && c.legalEntity === chosenLegalEntity)
      : (emp.contracts ?? []).find((c: any) => c.isActive)

    const wcs = emp.workCenters ?? []
    const wcForEntity = chosenLegalEntity
      ? wcs.find((wc: any) => wc.legalEntity === chosenLegalEntity)
      : wcs[0]
    const wcName = wcForEntity?.workCenter?.name ?? ''

    setEntityPickEmp(null)
    setForm(f => ({
      ...f,
      collaboratorRut:           emp.rut,
      collaboratorName:          fullName,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      collaboratorPosition:      emp.jobTitle ?? f.collaboratorPosition,
      collaboratorEmail:         (!emp.email || emp.email.includes('@buk.import')) ? f.collaboratorEmail : emp.email,
      collaboratorPhone:         emp.phone ?? f.collaboratorPhone,
      collaboratorPersonalEmail: emp.personalEmail ?? f.collaboratorPersonalEmail,
      legalEntity:               chosenLegalEntity || f.legalEntity || (contract?.legalEntity ?? ''),
      costCenter:                wcName || f.costCenter,
      city:             emp.city ?? '',
      commune:          emp.commune ?? '',
      direccionCalle:   emp.address ?? '',
      direccionNumero:  '',
      direccionDepto:   '',
      address:          emp.address ?? '',
      birthDate:        emp.birthDate ? emp.birthDate.split('T')[0] : '',
      gender:           emp.gender ?? '',
      nationality:      emp.nationality ?? '',
      jobFamily:          emp.jobFamily ?? '',
      contractType:       contract?.type ?? '',
      companyStartDate:   emp.startDate ? emp.startDate.split('T')[0] : '',
      contractEndDate:    emp.endDate ? emp.endDate.split('T')[0] : (contract?.endDate ? contract.endDate.split('T')[0] : ''),
      workSchedule:       emp.workSchedule ?? '',
      distribucionJornada: emp.distribucionJornada ?? '',
      supervisorName:     emp.supervisorName ?? '',
      supervisorTitle:    emp.supervisorTitle ?? '',
      supervisorEmail:    '',
      vinculo:            emp.vinculo ?? '',
      reemplazaA:         emp.reemplazaA ?? '',
      afp:    emp.afp ?? '',
      isapre: emp.isapre ?? '',
      banco:        emp.banco ?? '',
      tipoCuenta:   emp.tipoCuenta ?? '',
      numeroCuenta: emp.numeroCuenta ?? '',
    }))
    // Precarga los días de jornada/teletrabajo desde el texto guardado.
    const dj = emp.distribucionJornada ?? ''
    const teleMatch = dj.toLowerCase().match(/teletrabajo\s*\(([^)]*)\)/)
    setTeletrabajoDias(teleMatch ? parseDays(teleMatch[1]) : [])
    setJornadaDias(parseDays(dj.replace(/teletrabajo\s*\([^)]*\)/i, '')))
  }

  const selectEmployee = (emp: any) => {
    const active = processes.find(p => p.collaboratorRut === emp.rut && p.status === 'IN_PROGRESS')
    if (active) { setDuplicateProcessId(active.id); setRutSearch(''); return }
    setDuplicateProcessId(null)
    setRutSearch('')

    const activeContracts = (emp.contracts ?? []).filter((c: any) => c.isActive)
    const hasComm    = activeContracts.some((c: any) => c.legalEntity === 'COMUNICACIONES_SURMEDIA')
    const hasConsult = activeContracts.some((c: any) => c.legalEntity === 'SURMEDIA_CONSULTORIA')

    if (hasComm && hasConsult) {
      setEntityPickEmp(emp)
      return
    }
    applyEmployee(emp)
  }

  const clearEmployee = () => {
    setMatchedEmployee(null)
    setDuplicateProcessId(null)
    setCreatingNew(false)
    setBeneficios([])
    setModalidades([])
    setJornadaDias([])
    setTeletrabajoDias([])
    setAcreditacion(false)
    setReemplazaSearch('')
    setForm(f => ({
      ...f,
      collaboratorRut: '', collaboratorName: '', collaboratorPosition: '',
      collaboratorEmail: '', collaboratorPhone: '', collaboratorPersonalEmail: '',
      primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
      city: '', commune: '', direccionCalle: '', direccionNumero: '', direccionDepto: '', address: '',
      birthDate: '', gender: '', nationality: '',
      jobFamily: '', contractType: '', companyStartDate: '', contractEndDate: '',
      workSchedule: '', distribucionJornada: '', supervisorName: '', supervisorTitle: '', supervisorEmail: '',
      supervisorFirstName: '', supervisorLastName: '', mentorAsignado: '',
      vinculo: '', reemplazaA: '',
      afp: '', isapre: '', banco: '', tipoCuenta: '', numeroCuenta: '',
      tipoJornadaTipo: '', tipoJornadaHoras: '', horario: '',
      modalidadTipo: '', modalidad: '', sueldoLiquido: '',
    }))
  }

  useEffect(() => {
    if (template.length > 0 && selected.size === 0)
      setSelected(new Set(template.map(t => t.key)))
  }, [template.length])

  useEffect(() => {
    localStorage.setItem('gdp_beneficios_opciones', JSON.stringify(beneficiosOpciones))
  }, [beneficiosOpciones])

  const field = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const toggle = (key: string) => setSelected(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  const togglePeriod = (period: OnboardingPeriod) => {
    const keys = template.filter(t => t.period === period).map(t => t.key)
    const allOn = keys.every(k => selected.has(k))
    setSelected(prev => {
      const next = new Set(prev); keys.forEach(k => allOn ? next.delete(k) : next.add(k)); return next
    })
  }

  const handleSubmit = async () => {
    const composedName = [form.primerNombre, form.segundoNombre, form.primerApellido, form.segundoApellido].filter(Boolean).join(' ')
    const composedAddress = [form.direccionCalle, form.direccionNumero, form.direccionDepto ? `Depto ${form.direccionDepto}` : ''].filter(Boolean).join(' ')

    const collaboratorData: Record<string, unknown> = {}
    const snap: [string, string][] = [
      ['primerNombre', form.primerNombre], ['segundoNombre', form.segundoNombre],
      ['primerApellido', form.primerApellido], ['segundoApellido', form.segundoApellido],
      ['city', form.city], ['commune', form.commune],
      ['address', composedAddress || form.address], ['birthDate', form.birthDate], ['gender', form.gender],
      ['nationality', form.nationality], ['jobFamily', form.jobFamily], ['contractType', form.contractType],
      ['companyStartDate', form.companyStartDate], ['contractEndDate', form.contractEndDate],
      ['workSchedule', form.workSchedule], ['distribucionJornada', form.distribucionJornada],
      ['supervisorName', form.supervisorName], ['supervisorTitle', form.supervisorTitle], ['supervisorEmail', form.supervisorEmail],
      ['supervisorFirstName', form.supervisorFirstName], ['supervisorLastName', form.supervisorLastName],
      ['mentorAsignado', form.mentorAsignado],
      ['vinculo', form.vinculo], ['reemplazaA', form.reemplazaA],
      ['afp', form.afp], ['isapre', form.isapre],
      ['banco', form.banco], ['tipoCuenta', form.tipoCuenta], ['numeroCuenta', form.numeroCuenta],
      ['tipoJornadaTipo', form.tipoJornadaTipo], ['tipoJornadaHoras', form.tipoJornadaHoras],
      ['horario', form.horario],
      ['modalidad', modalidades.length > 0 ? (modalidades.length === 1 ? modalidades[0] : modalidades.slice(0, -1).join(', ') + ' y ' + modalidades[modalidades.length - 1]) : ''],
      ['sueldoLiquido', form.sueldoLiquido],
    ]
    snap.forEach(([k, v]) => { if (v) collaboratorData[k] = v })
    if (beneficios.length > 0) collaboratorData.beneficios = beneficios
    if (modalidades.length > 0) collaboratorData.modalidades = modalidades
    collaboratorData.acreditacion = acreditacion

    try {
      if (creatingNew && form.collaboratorRut.trim()) {
        await createEmployee.mutateAsync({
          rut:          form.collaboratorRut.trim(),
          firstName:    form.primerNombre.trim(),
          lastName:     form.primerApellido.trim(),
          startDate:    form.startDate,
          email:        form.collaboratorEmail.trim() || undefined,
          phone:        form.collaboratorPhone.trim() || undefined,
          personalEmail: form.collaboratorPersonalEmail.trim() || undefined,
          legalEntity:  form.legalEntity || undefined,
          jobTitle:     form.collaboratorPosition.trim() || undefined,
          jobFamily:    form.jobFamily || undefined,
          costCenter:   form.costCenter.trim() || undefined,
          city:         form.city || undefined,
          commune:      form.commune || undefined,
          address:      composedAddress || form.address || undefined,
          birthDate:    form.birthDate || undefined,
          gender:       form.gender || undefined,
          nationality:  form.nationality || undefined,
          afp:          form.afp || undefined,
          isapre:       form.isapre || undefined,
          workSchedule: form.workSchedule || undefined,
          supervisorName:   form.supervisorName || undefined,
          supervisorTitle:  form.supervisorTitle || undefined,
          segundoApellido:  form.segundoApellido || undefined,
          distribucionJornada: form.distribucionJornada || undefined,
          banco:        form.banco || undefined,
          tipoCuenta:   form.tipoCuenta || undefined,
          numeroCuenta: form.numeroCuenta || undefined,
          vinculo:      form.vinculo || undefined,
          contractType: form.contractType || undefined,
        })
      }

      const process = await createOnboarding.mutateAsync({
        collaboratorRut:           form.collaboratorRut.trim() || undefined,
        collaboratorName:          (composedName || form.collaboratorName).trim(),
        collaboratorEmail:         form.collaboratorEmail.trim() || undefined,
        collaboratorPersonalEmail: form.collaboratorPersonalEmail.trim() || undefined,
        collaboratorPosition: form.collaboratorPosition.trim() || undefined,
        collaboratorPhone:    form.collaboratorPhone.trim() || undefined,
        legalEntity:          form.legalEntity || undefined,
        costCenter:           form.costCenter.trim() || undefined,
        startDate:            form.startDate || undefined,
        notes:                form.notes.trim() || undefined,
        selectedTaskIds:      Array.from(selected),
        collaboratorData:     Object.keys(collaboratorData).length ? collaboratorData : undefined,
      })
      onCreated(process.id)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al crear el proceso'
      alert(msg)
    }
  }

  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingDbTemplateTask[]>()
    PERIOD_ORDER.forEach(p => map.set(p, []))
    template.forEach(t => map.get(t.period as OnboardingPeriod)?.push(t))
    return map
  }, [template])

  const calItems: CalItem[] = useMemo(() => {
    if (!form.startDate) return []
    const startDate = new Date(form.startDate + 'T12:00:00Z')
    const periodStarts: Record<string, number> = {
      PRE_INGRESO: -7, DIA_1: 0, SEMANA_1: 1, MES_1: 8, EVALUACION: 60,
    }
    const resolveEmailsLocal = (profileIds: string[], itemId: string): string[] => {
      // If user has customized this event's invitees, use their full selection; otherwise use template defaults
      const overrideIds = eventExtraProfileIds[itemId]
      const allIds = overrideIds !== undefined ? overrideIds : (profileIds ?? [])
      const emails: string[] = allIds
        .map((id: string) => (profiles as Profile[]).find(p => p.id === id)?.email)
        .filter((e): e is string => !!e)
      const colEmail = form.collaboratorEmail.trim()
      if (colEmail && !emails.includes(colEmail)) emails.push(colEmail)
      return emails
    }
    const items: CalItem[] = []
    template.filter(t => selected.has(t.key)).forEach(t => {
      if (t.automationType === 'CALENDAR') {
        const cfg = (t.automationConfig ?? {}) as Record<string, any>
        const rawOffset = typeof cfg.daysFromStart === 'number'
          ? (t.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart)
          : (periodStarts[t.period] ?? 0)
        const s = new Date(startDate); s.setDate(s.getDate() + rawOffset); s.setHours(9, 0, 0, 0)
        items.push({ id: t.id, name: t.name, parentName: null, dayOffset: rawOffset, start: s, durationMinutes: cfg.durationMinutes ?? 60, attendeeEmails: resolveEmailsLocal(cfg.attendeeProfileIds ?? [], t.id), attendeeProfileIds: cfg.attendeeProfileIds ?? [] })
      }
      t.subTasks.forEach((st, si) => {
        if (st.tool === 'CALENDAR' && st.plantilla) {
          try {
            const cfg = JSON.parse(st.plantilla) as Record<string, any>
            const rawOffset = typeof cfg.daysFromStart === 'number'
              ? (t.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart)
              : (periodStarts[t.period] ?? 0)
            const s = new Date(startDate); s.setDate(s.getDate() + rawOffset); s.setHours(9, 0, 0, 0)
            const id = `${t.id}-st-${si}`
            items.push({ id, name: st.name, parentName: t.name, dayOffset: rawOffset, start: s, durationMinutes: cfg.durationMinutes ?? 60, attendeeEmails: resolveEmailsLocal(cfg.attendeeProfileIds ?? [], id), attendeeProfileIds: cfg.attendeeProfileIds ?? [] })
          } catch {}
        }
      })
    })
    return items.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [template, selected, form.startDate, form.collaboratorEmail, profiles, eventExtraProfileIds])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Nuevo proceso de onboarding</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selected.size} de {template.length} hitos seleccionados</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* ── Paso 2: Vista de calendario y confirmación ── */}
        {showCalendar && (() => {
          const resolveStart = (item: CalItem): Date => {
            if (item.durationMinutes === 0) return item.start
            const time = eventTimes[item.id]
            if (!time) return item.start
            const [h, m] = time.split(':').map(Number)
            const d = new Date(item.start); d.setHours(h, m, 0, 0); return d
          }

          const finalItems: CalItemWithTime[] = calItems.map(item => ({
            ...item, resolvedStart: resolveStart(item),
          }))

          const p = (n: number) => String(n).padStart(2, '0')
          const gcalFmt = (d: Date) => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
          const dateOnly = (d: Date) => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`

          const makeUrl = (item: CalItem): string => {
            const allDay = item.durationMinutes === 0
            const s = resolveStart(item)
            let dates: string
            if (allDay) {
              const next = new Date(s.getTime() + 86_400_000)
              dates = `${dateOnly(s)}/${dateOnly(next)}`
            } else {
              const end = new Date(s.getTime() + item.durationMinutes * 60_000)
              dates = `${gcalFmt(s)}/${gcalFmt(end)}`
            }
            const q = new URLSearchParams({ text: item.name, dates, details: `Onboarding ${form.collaboratorName} — ${item.name}` })
            if (item.attendeeEmails.length > 0) q.set('add', item.attendeeEmails.join(','))
            return `https://calendar.google.com/calendar/r/eventedit?${q}`
          }

          const timedMissingTime = calItems.some(item => item.durationMinutes !== 0 && !eventTimes[item.id])

          return (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {calItems.length > 0 ? (
                  <>
                    <p className="text-xs text-gray-500">
                      Se detectaron <span className="font-semibold text-purple-700">{calItems.length} evento{calItems.length !== 1 ? 's' : ''}</span> de calendario para este proceso.
                      {timedMissingTime && <span className="ml-1 text-amber-600 font-medium">Eventos con duración requieren horario obligatorio.</span>}
                    </p>

                    <CalendarPreview items={finalItems} eventTimes={eventTimes} />

                    <div className="space-y-2">
                      {calItems.map(item => {
                        const allDay = item.durationMinutes === 0
                        const label  = item.start.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
                        const isOpen = expandedEventId === item.id
                        const missingTime = !allDay && !eventTimes[item.id]
                        return (
                          <div key={item.id} className={`border rounded-xl overflow-hidden ${missingTime ? 'border-amber-300' : 'border-purple-100'}`}>
                            <div className={`flex items-center gap-2 px-3 py-2.5 ${missingTime ? 'bg-amber-50' : 'bg-purple-50/60'}`}>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${missingTime ? 'text-amber-900' : 'text-purple-900'}`}>
                                  {item.parentName ?? item.name}
                                </p>
                                {item.parentName && (
                                  <p className="text-[10px] text-gray-400 truncate">({item.name})</p>
                                )}
                                <p className={`text-[10px] mt-0.5 ${missingTime ? 'text-amber-500' : 'text-purple-400'}`}>
                                  {label}
                                  <span className="ml-1 font-semibold">{item.dayOffset < 0 ? `Día ${item.dayOffset}` : item.dayOffset === 0 ? 'Día 0' : `Día +${item.dayOffset}`}</span>
                                  {' · '}{allDay ? 'Día completo' : `${item.durationMinutes} min`}
                                  {item.attendeeEmails.length > 0 && ` · ${item.attendeeEmails.length} invitado${item.attendeeEmails.length !== 1 ? 's' : ''}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setExpandedEventId(isOpen ? null : item.id)}
                                  className="text-[10px] text-purple-500 hover:text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 hover:border-purple-300 transition-colors"
                                >
                                  {isOpen ? 'Cerrar' : 'Editar'}
                                </button>
                                <a href={makeUrl(item)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-purple-600 hover:underline">
                                  <Calendar size={10} /> Abrir
                                </a>
                              </div>
                            </div>

                            {/* Hora obligatoria para eventos con duración */}
                            {!allDay && (
                              <div className={`px-3 py-2 border-t flex items-center gap-2 ${missingTime ? 'border-amber-200 bg-amber-50/60' : 'border-purple-50 bg-white'}`}>
                                <span className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${missingTime ? 'text-amber-600' : 'text-gray-500'}`}>
                                  Hora{missingTime ? ' *' : ''}
                                </span>
                                <input
                                  type="time"
                                  value={eventTimes[item.id] ?? ''}
                                  onChange={e => setEventTimes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className={`px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 ${missingTime ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-purple-400'}`}
                                />
                              </div>
                            )}

                            {isOpen && (() => {
                              const checkedIds = eventExtraProfileIds[item.id] ?? item.attendeeProfileIds
                              return (
                                <div className="px-3 py-3 border-t border-purple-100 bg-white">
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Invitados
                                    <span className="ml-1 normal-case font-normal text-purple-500">({checkedIds.length} seleccionados)</span>
                                  </p>
                                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 py-0.5 px-1">
                                    {(profiles as Profile[]).map(pr => {
                                      const checked = checkedIds.includes(pr.id)
                                      return (
                                        <label key={pr.id} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-purple-50 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={e => {
                                              const newIds = e.target.checked
                                                ? [...checkedIds, pr.id]
                                                : checkedIds.filter(id => id !== pr.id)
                                              setEventExtraProfileIds(prev => ({ ...prev, [item.id]: newIds }))
                                            }}
                                            className="w-3 h-3 rounded accent-purple-600 flex-shrink-0"
                                          />
                                          <span className="text-[10px] text-gray-700 flex-1">{pr.name}</span>
                                          <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{pr.email}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400">
                    Este proceso no tiene eventos de calendario.
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <button onClick={() => setShowCalendar(false)} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  <ChevronLeft size={14} /> Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={timedMissingTime || createOnboarding.isPending}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {createOnboarding.isPending
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando...</>
                    : <><Rocket size={14} /> Crear proceso</>
                  }
                </button>
              </div>
            </div>
          )
        })()}

        {/* Body — paso 1 */}
        {!showCalendar && <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── Alerta: proceso activo duplicado ── */}
          {duplicateProcessId && !matchedEmployee && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Este colaborador ya tiene un proceso activo</p>
                <p className="text-xs text-amber-600 mt-0.5">No se puede crear un nuevo proceso mientras el anterior esté en curso.</p>
                <button onClick={() => { onCreated(duplicateProcessId); onClose() }}
                  className="mt-1.5 text-xs font-medium text-brand-600 hover:underline">Ver proceso activo →</button>
              </div>
            </div>
          )}

          {/* ── Alerta: colaborador en ambas razones sociales ── */}
          {entityPickEmp && (
            <div className="flex items-start gap-3 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl">
              <Building2 size={15} className="text-brand-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-800">
                  {entityPickEmp.firstName} {entityPickEmp.lastName} está en ambas razones sociales
                </p>
                <p className="text-xs text-brand-600 mt-0.5">¿Desde cuál quieres cargar los datos del proceso?</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => applyEmployee(entityPickEmp, 'COMUNICACIONES_SURMEDIA')}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-100"
                  >
                    Comunicaciones Surmedia
                  </button>
                  <button
                    onClick={() => applyEmployee(entityPickEmp, 'SURMEDIA_CONSULTORIA')}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-100"
                  >
                    Surmedia Consultoría
                  </button>
                  <button
                    onClick={() => setEntityPickEmp(null)}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Sección: Identidad (obligatoria) ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Identidad</p>
            <div className="grid grid-cols-2 gap-4">
              {/* RUT con búsqueda — sin campo manual */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  RUT <span className="text-red-400">*</span>
                  <span className="ml-2 font-normal text-gray-400">(busca el colaborador en el sistema)</span>
                </label>
                {matchedEmployee ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <UserCheck size={14} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{matchedEmployee.name}</p>
                      <p className="text-[10px] text-green-600">{matchedEmployee.rut} · {matchedEmployee.position ?? '—'}</p>
                    </div>
                    <button onClick={clearEmployee} aria-label="Quitar selección" className="p-1 text-green-500 hover:text-green-800"><X size={13} /></button>
                  </div>
                ) : creatingNew ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                      <Plus size={13} className="text-brand-500 flex-shrink-0" />
                      <p className="text-xs text-brand-700 flex-1">Nueva ficha de colaborador — ingresa el RUT</p>
                      <button onClick={clearEmployee} aria-label="Cancelar nueva ficha" className="p-1 text-brand-400 hover:text-brand-700"><X size={13} /></button>
                    </div>
                    <input
                      autoFocus type="text" placeholder="Ej: 12.345.678-9"
                      value={form.collaboratorRut}
                      onChange={e => field('collaboratorRut', e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.collaboratorRut.trim() ? 'border-gray-300' : 'border-gray-200'}`}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input autoFocus type="text" placeholder="Buscar por RUT o nombre (mín. 2 caracteres)..."
                      value={rutSearch} onChange={e => { setRutSearch(e.target.value); setDuplicateProcessId(null) }}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    {searchFetching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
                    {/* Resultados */}
                    {rutSearch.length >= 2 && !searchFetching && employeeResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {employeeResults.map((emp: any) => (
                          <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 uppercase">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-gray-400">{emp.rut} · {emp.jobTitle ?? '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Sin resultados → opción de crear aquí */}
                    {rutSearch.length >= 2 && !searchFetching && employeeResults.length === 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-amber-200 rounded-lg shadow-lg overflow-hidden">
                        <div className="flex items-start gap-2.5 px-4 py-3">
                          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800">Colaborador no encontrado</p>
                            <p className="text-xs text-amber-600 mt-0.5">No existe en el sistema. Puedes crear su ficha aquí.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setCreatingNew(true)
                                setRutSearch('')
                                // Pre-llenar el RUT si la búsqueda tiene formato de RUT
                                const looksLikeRut = /^\d[\d.]*[-]?[0-9kK]?$/.test(rutSearch.trim())
                                if (looksLikeRut) field('collaboratorRut', rutSearch.trim())
                              }}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                            >
                              <Plus size={11} /> Crear colaborador aquí
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Primer nombre <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Juan" value={form.primerNombre}
                  onChange={e => { field('primerNombre', e.target.value); field('collaboratorName', '') }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.primerNombre ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Segundo nombre</label>
                <input type="text" placeholder="Carlos" value={form.segundoNombre}
                  onChange={e => field('segundoNombre', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Primer apellido <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Pérez" value={form.primerApellido}
                  onChange={e => { field('primerApellido', e.target.value); field('collaboratorName', '') }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.primerApellido ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Segundo apellido</label>
                <input type="text" placeholder="Soto" value={form.segundoApellido}
                  onChange={e => field('segundoApellido', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo <span className="text-red-400">*</span></label>
                <input type="email" placeholder="juan.perez@surmedia.cl" value={form.collaboratorEmail}
                  onChange={e => field('collaboratorEmail', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.collaboratorEmail ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email personal</label>
                <input type="email" placeholder="juan.perez@gmail.com" value={form.collaboratorPersonalEmail}
                  onChange={e => field('collaboratorPersonalEmail', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
                <input type="text" placeholder="+56 9 XXXX XXXX" value={form.collaboratorPhone}
                  onChange={e => field('collaboratorPhone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo <span className="text-red-400">*</span></label>
                {positionMode === 'select' ? (
                  <select value={form.collaboratorPosition}
                    onChange={e => { if (e.target.value === '__otro__') { setPositionMode('custom'); field('collaboratorPosition', '') } else { field('collaboratorPosition', e.target.value) } }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${!form.collaboratorPosition ? 'border-gray-300' : 'border-gray-200'}`}>
                    <option value="">Seleccionar cargo...</option>
                    {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__otro__">Otro (ingresar manualmente)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus type="text" placeholder="Ej: Diseñador Gráfico" value={form.collaboratorPosition}
                      onChange={e => field('collaboratorPosition', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <button type="button" onClick={() => { setPositionMode('select'); field('collaboratorPosition', '') }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg">Lista</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa <span className="text-red-400">*</span></label>
                <select value={form.legalEntity} onChange={e => field('legalEntity', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${!form.legalEntity ? 'border-gray-300' : 'border-gray-200'}`}>
                  <option value="">Seleccionar empresa...</option>
                  <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
                  <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso <span className="text-red-400">*</span></label>
                <input type="date" value={form.startDate}
                  onChange={e => {
                    const v = e.target.value
                    const suggest90 = v ? (() => { const d = new Date(v + 'T12:00:00Z'); d.setDate(d.getDate() + 90); return d.toISOString().slice(0,10) })() : ''
                    setForm(f => ({
                      ...f,
                      startDate:       v,
                      companyStartDate: f.companyStartDate || v,
                      contractEndDate:  f.contractEndDate  || suggest90,
                    }))
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.startDate ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Centro de Trabajo <span className="text-red-400">*</span></label>
                <select value={form.costCenter} onChange={e => field('costCenter', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${!form.costCenter ? 'border-gray-300' : 'border-gray-200'}`}>
                  <option value="">Seleccionar centro...</option>
                  {workCenters.map(wc => <option key={wc.id} value={wc.name}>{wc.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Sección: Datos personales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos personales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de nacimiento</label>
                <input type="date" value={form.birthDate} onChange={e => field('birthDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sexo</label>
                <select value={form.gender} onChange={e => field('gender', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nacionalidad</label>
                <input type="text" placeholder="Chilena" value={form.nationality}
                  onChange={e => field('nationality', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ciudad</label>
                <input type="text" placeholder="Santiago" value={form.city}
                  onChange={e => field('city', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Comuna</label>
                <input type="text" placeholder="Providencia" value={form.commune}
                  onChange={e => field('commune', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Calle</label>
                <input type="text" placeholder="Av. Providencia" value={form.direccionCalle}
                  onChange={e => field('direccionCalle', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Número</label>
                <input type="text" placeholder="1234" value={form.direccionNumero}
                  onChange={e => field('direccionNumero', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Departamento</label>
                <input type="text" placeholder="501 (si aplica)" value={form.direccionDepto}
                  onChange={e => field('direccionDepto', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* ── Sección: Datos laborales adicionales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos laborales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Familia de cargo</label>
                <EditableCombobox value={form.jobFamily} onChange={v => field('jobFamily', v)}
                  systemOptions={jobFamilies} storageKey="gdp_jobfamily_opciones" placeholder="Ej: Tecnología" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de contrato</label>
                <select value={form.contractType} onChange={e => field('contractType', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="INDEFINIDO">Indefinido</option>
                  <option value="PLAZO_FIJO">Plazo fijo</option>
                  <option value="HONORARIOS">Honorarios</option>
                  <option value="PRACTICA">Práctica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha ingreso empresa</label>
                <input type="date" value={form.companyStartDate} onChange={e => field('companyStartDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha vencimiento contrato</label>
                <input type="date" value={form.contractEndDate} onChange={e => field('contractEndDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div ref={supervisorRef} className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre supervisor</label>
                <input
                  type="text"
                  placeholder="Buscar supervisor por nombre..."
                  value={form.supervisorName}
                  onChange={e => {
                    field('supervisorName', e.target.value)
                    setSupervisorSearch(e.target.value)
                    setSupervisorOpen(true)
                  }}
                  onFocus={() => setSupervisorOpen(true)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {supervisorOpen && supervisorResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {supervisorResults.map((emp: any) => (
                      <button
                        key={emp.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          const fullName = `${emp.firstName} ${emp.lastName}`
                          setForm(f => ({ ...f, supervisorName: fullName, supervisorTitle: emp.jobTitle ?? f.supervisorTitle, supervisorEmail: emp.email ?? '', supervisorFirstName: emp.firstName ?? '', supervisorLastName: (emp.lastName ?? '').split(' ')[0] }))
                          setSupervisorSearch('')
                          setSupervisorOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 uppercase">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{emp.firstName} {emp.lastName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{emp.jobTitle ?? '—'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo supervisor</label>
                <input type="text" placeholder="Cargo del supervisor" value={form.supervisorTitle}
                  onChange={e => field('supervisorTitle', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div ref={mentorRef} className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mentor asignado</label>
                <input
                  type="text"
                  placeholder="Buscar mentor por nombre..."
                  value={form.mentorAsignado}
                  onChange={e => { field('mentorAsignado', e.target.value); setMentorSearch(e.target.value); setMentorOpen(true) }}
                  onFocus={() => setMentorOpen(true)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {mentorOpen && mentorResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {mentorResults.map((emp: any) => (
                      <button
                        key={emp.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setForm(f => ({ ...f, mentorAsignado: `${emp.firstName} ${emp.lastName}` }))
                          setMentorSearch('')
                          setMentorOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 uppercase">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{emp.firstName} {emp.lastName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{emp.jobTitle ?? '—'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Vínculo</label>
                <select value={form.vinculo} onChange={e => field('vinculo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="Planta">Planta</option>
                  <option value="Reemplazo">Reemplazo</option>
                </select>
              </div>
              {form.vinculo === 'Reemplazo' && (
                <div ref={reemplazaRef} className="col-span-2 relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Reemplaza a <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    placeholder="Buscar persona por nombre..."
                    value={form.reemplazaA}
                    onChange={e => { field('reemplazaA', e.target.value); setReemplazaSearch(e.target.value); setReemplazaOpen(true) }}
                    onFocus={() => setReemplazaOpen(true)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {reemplazaOpen && reemplazaResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {reemplazaResults.map((emp: any) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            field('reemplazaA', `${emp.firstName} ${emp.lastName}`)
                            setReemplazaSearch('')
                            setReemplazaOpen(false)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-50 text-left border-b border-gray-50 last:border-0"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 uppercase">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-800 truncate">{emp.firstName} {emp.lastName}</div>
                            <div className="text-[10px] text-gray-400 truncate">{emp.jobTitle ?? '—'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sección: Condiciones de la oferta ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Condiciones de la oferta</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de jornada + horas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de jornada</label>
                <select value={form.tipoJornadaTipo} onChange={e => field('tipoJornadaTipo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="ordinaria">Ordinaria</option>
                  <option value="parcial">Parcial</option>
                  <option value="excepcional">Excepcional</option>
                  <option value="extraordinaria">Extraordinaria</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Horas semanales</label>
                <EditableCombobox value={form.tipoJornadaHoras} onChange={v => field('tipoJornadaHoras', v)}
                  systemOptions={['44', '40', '30', '20']} storageKey="gdp_horassemanales_opciones" placeholder="Ej: 40" />
                {form.tipoJornadaTipo && form.tipoJornadaHoras && (
                  <p className="text-[10px] text-brand-500 mt-1">
                    → jornada {form.tipoJornadaTipo} de {form.tipoJornadaHoras} horas semanales
                  </p>
                )}
              </div>
              {/* Jornada (días) */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Jornada (días)</label>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map(d => {
                      const on = jornadaDias.includes(d)
                      return (
                        <button key={d} type="button" onClick={() => toggleJornadaDia(d)}
                          className={`px-2.5 py-1 text-xs rounded-full border capitalize transition-colors ${on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'}`}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                  {form.distribucionJornada && (
                    <p className="text-[10px] text-brand-500 pt-2 border-t border-gray-200 mt-2">
                      → {form.distribucionJornada}
                    </p>
                  )}
                </div>
              </div>
              {/* Horario */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Horario de trabajo</label>
                <EditableCombobox value={form.horario} onChange={v => field('horario', v)} multiline
                  systemOptions={workSchedules} storageKey="gdp_horario_opciones"
                  placeholder="Ej: De lunes a jueves de 9:00 a 18:15 horas con 45 minutos de colación, y los viernes de 9:00 a 15:00 horas." />
              </div>
              {/* Modalidad - selección múltiple */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Modalidad de trabajo</label>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
                  {(['Presencial inplant', 'Presencial oficina Surmedia', 'Terreno', 'Teletrabajo'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={modalidades.includes(opt)}
                        onChange={e => {
                          const checked = e.target.checked
                          setModalidades(prev => checked ? [...prev, opt] : prev.filter(x => x !== opt))
                          if (opt === 'Teletrabajo' && !checked) applyJornada(jornadaDias, [])
                        }}
                        className="w-3.5 h-3.5 rounded accent-brand-600" />
                      <span className="text-xs text-gray-700">{opt}</span>
                    </label>
                  ))}
                  {modalidades.length > 0 && (
                    <p className="text-[10px] text-brand-500 pt-1.5 border-t border-gray-200 mt-1">
                      → {modalidades.join(', ')}
                    </p>
                  )}
                </div>
                {/* Días de teletrabajo (se agregan a la variable {{jornada}}) */}
                {modalidades.includes('Teletrabajo') && (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 mt-2">
                    <label className="block text-[11px] font-medium text-gray-500 mb-2">Días de teletrabajo</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map(d => {
                        const on = teletrabajoDias.includes(d)
                        return (
                          <button key={d} type="button" onClick={() => toggleTeleDia(d)}
                            className={`px-2.5 py-1 text-xs rounded-full border capitalize transition-colors ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                    {teletrabajoDias.length > 0 && (
                      <p className="text-[10px] text-indigo-500 pt-2 border-t border-gray-200 mt-2">
                        → Teletrabajo ({formatDays(teletrabajoDias)})
                      </p>
                    )}
                  </div>
                )}
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
              {/* Sueldo */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sueldo líquido mensual</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" placeholder="1200000" value={form.sueldoLiquido}
                    onChange={e => field('sueldoLiquido', e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                {form.sueldoLiquido && parseInt(form.sueldoLiquido) > 0 && (
                  <p className="text-[10px] text-brand-500 mt-1">
                    → ${parseInt(form.sueldoLiquido).toLocaleString('es-CL')} líquidos mensuales
                  </p>
                )}
              </div>
              {/* Beneficios - lista editable persistida */}
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
                      <input
                        type="text"
                        value={texto}
                        placeholder="Descripción del beneficio..."
                        onChange={e => {
                          const newText = e.target.value
                          setBeneficios(prev => prev.includes(texto) ? prev.map(b => b === texto ? newText : b) : prev)
                          setBeneficiosOpciones(prev => prev.map((t, i) => i === idx ? newText : t))
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                      <button type="button" onClick={() => {
                        setBeneficiosOpciones(prev => prev.filter((_, i) => i !== idx))
                        setBeneficios(prev => prev.filter(b => b !== texto))
                      }}
                        aria-label="Quitar beneficio"
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
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

          {/* ── Sección: Previsión social ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Previsión social</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">AFP</label>
                <input type="text" placeholder="Ej: Modelo, Habitat" value={form.afp}
                  onChange={e => field('afp', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fonasa / Isapre</label>
                <input type="text" placeholder="Ej: Fonasa, Banmédica" value={form.isapre}
                  onChange={e => field('isapre', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* ── Sección: Datos bancarios ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos bancarios</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Banco</label>
                <input type="text" placeholder="Ej: Banco Estado" value={form.banco}
                  onChange={e => field('banco', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de cuenta</label>
                <select value={form.tipoCuenta} onChange={e => field('tipoCuenta', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="Cuenta Vista">Cuenta Vista</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                  <option value="Cuenta RUT">Cuenta RUT</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Número de cuenta</label>
                <input type="text" placeholder="Ej: 00012345678" value={form.numeroCuenta}
                  onChange={e => field('numeroCuenta', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* ── Notas internas ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
            <textarea rows={2} placeholder="Información relevante para el proceso..." value={form.notes}
              onChange={e => field('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          {/* Hitos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hitos del proceso</p>
            {templateLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /> Cargando hitos…
              </div>
            ) : templateError ? (
              <div className="py-4 text-sm text-red-500 flex items-center gap-2">
                Error cargando hitos.
                <button onClick={() => refetchTemplate()} className="underline text-brand-600">Reintentar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {PERIOD_ORDER.map(period => {
                  const tasks = byPeriod.get(period) ?? []
                  if (tasks.length === 0) return null
                  const allOn = tasks.every(t => selected.has(t.key))
                  return (
                    <div key={period}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PERIOD_COLORS[period]}`}>{PERIOD_LABELS[period]}</span>
                        <button onClick={() => togglePeriod(period)} className="text-xs text-brand-600 hover:text-brand-800">
                          {allOn ? 'Quitar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {tasks.map(task => (
                          <label key={task.key} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                            selected.has(task.key) ? 'bg-brand-50 border-brand-100' : 'border-transparent hover:bg-gray-50'
                          }`}>
                            <input type="checkbox" checked={selected.has(task.key)} onChange={() => toggle(task.key)}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-brand-600 cursor-pointer" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${selected.has(task.key) ? 'text-gray-900' : 'text-gray-500'}`}>{task.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <AutoBadge type={task.automationType as TaskAutomationType} />
                                {task.taskType === 'FECHA_ESPECIFICA' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Fecha específica</span>
                                )}
                                {task.appliesWhen && <span className="text-[10px] text-gray-400 italic">{task.appliesWhen}</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>}

        {/* Footer paso 1 */}
        {!showCalendar && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={() => setShowCalendar(true)}
            disabled={
              (!matchedEmployee && !creatingNew) ||
              (creatingNew && !form.collaboratorRut.trim()) ||
              (!form.primerNombre.trim() && !form.collaboratorName.trim()) ||
              !form.primerApellido.trim() ||
              !form.legalEntity ||
              !form.collaboratorEmail.trim() || !form.collaboratorPosition.trim() ||
              !form.costCenter || !form.startDate ||
              selected.size === 0
            }
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronRight size={14} /> Continuar
          </button>
        </div>}
      </div>
    </div>
  )
}
