export function getTimezoneOrDefault(timezone?: string): string {
  return timezone || 'America/Recife';
}

export function getLocalDateStart(date: Date, timezone?: string): Date {
  const timeZone = getTimezoneOrDefault(timezone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parseInt(parts.find((part) => part.type === 'year')?.value || '1970', 10);
  const month = parseInt(parts.find((part) => part.type === 'month')?.value || '01', 10);
  const day = parseInt(parts.find((part) => part.type === 'day')?.value || '01', 10);

  return new Date(Date.UTC(year, month - 1, day));
}
