function parts(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).formatToParts(new Date(iso));
}
function pick(p: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return p.find((x) => x.type === type)?.value ?? '';
}

/** 7:30 PM */
export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** SAT, 14 NOV · 7:30 PM (card overline) */
export function formatCardDate(iso: string, tz: string): string {
  const p = parts(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${pick(p, 'weekday')}, ${pick(p, 'day')} ${pick(p, 'month')} · ${formatTime(iso, tz)}`.toUpperCase();
}

/** Saturday, 14 November 2026 · 7:30 – 10:00 PM */
export function formatLongRange(startIso: string, endIso: string, tz: string): string {
  const p = parts(startIso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const start = formatTime(startIso, tz);
  const end = formatTime(endIso, tz);
  const sameMeridiem = start.slice(-2) === end.slice(-2);
  return `${pick(p, 'weekday')}, ${pick(p, 'day')} ${pick(p, 'month')} ${pick(p, 'year')} · ${sameMeridiem ? start.slice(0, -3) : start} – ${end}`;
}

/** Sat, 14 Nov 2026 · 7:30 PM */
export function formatShort(iso: string, tz: string): string {
  const p = parts(iso, tz, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${pick(p, 'weekday')}, ${pick(p, 'day')} ${pick(p, 'month')} ${pick(p, 'year')} · ${formatTime(iso, tz)}`;
}

/** NOV / 14 for the date block */
export function formatDateBlock(iso: string, tz: string): { month: string; day: string } {
  const p = parts(iso, tz, { day: 'numeric', month: 'short' });
  return { month: pick(p, 'month').toUpperCase(), day: pick(p, 'day') };
}

/** 2 October 2026, 4:12 PM IST — in the viewer's zone for "booked on" */
export function formatBookedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(
    new Date(iso),
  );
}

export function seatLabel(seatId: string): string {
  return `Row ${seatId.slice(0, 1)} · Seat ${seatId.slice(1)}`;
}
