export function formatArsFromCents(cents: number): string {
  const pesos = cents / 100;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: pesos % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

export function formatBpsAsPercentage(bps: number): string {
  return `${(bps / 100).toFixed(2).replace('.', ',')}%`;
}

export function formatDateTimeAr(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}
