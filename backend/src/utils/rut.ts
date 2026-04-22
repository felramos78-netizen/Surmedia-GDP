// Validación y formateo de RUT chileno (XX.XXX.XXX-X)

export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut)
  if (clean.length < 2) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  if (!/^\d+$/.test(body)) return false

  let sum = 0
  let multiplier = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const remainder = sum % 11
  const expected = remainder === 0 ? '0' : remainder === 1 ? 'K' : String(11 - remainder)

  return dv === expected
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut)
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}
