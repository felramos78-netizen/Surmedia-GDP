import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function fullName(emp: { firstName: string; lastName: string }): string {
  return `${emp.firstName} ${emp.lastName}`
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  HONORARIOS: 'Honorarios',
  PRACTICA: 'Práctica',
}

export function contractTypeLabel(type: string): string {
  return CONTRACT_TYPE_LABELS[type] ?? type
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  LICENCIA_MEDICA: 'Licencia Médica',
  LICENCIA_MATERNIDAD: 'Lic. Maternidad',
  LICENCIA_PATERNIDAD: 'Lic. Paternidad',
  OTRO: 'Otro',
}

export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type] ?? type
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Con Licencia',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}
