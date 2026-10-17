/**
 * Calendar helpers in the laboratory's own time zone.
 *
 * "Today" for a booking is a wall-clock idea: a researcher in Skopje booking at
 * 00:30 means the date on their calendar, not the date in UTC. The container
 * sets TZ, so local date arithmetic here is Skopje arithmetic.
 */
const pad = (n) => String(n).padStart(2, '0');

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A strict calendar check. The shape alone (\d{4}-\d{2}-\d{2}) accepted
 * "2099-99-99"; this one requires the date to exist.
 */
export function isRealDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function daysFromToday(value) {
  const [y, m, d] = value.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}
