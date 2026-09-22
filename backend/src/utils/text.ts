/**
 * Normaliza texto para búsquedas y clasificación: minúsculas, sin tildes y con
 * `_ - .` como espacios. BUK nombra archivos como
 * "2026_09-21_Certificado_de_Vacaciones.pdf" y a veces borra las tildes
 * ("Liquidacin"), así que todo se compara en esta forma.
 */
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ')
    .trim()
}
