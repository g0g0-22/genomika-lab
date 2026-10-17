/**
 * Today's date as YYYY-MM-DD on the visitor's own calendar. toISOString()
 * gives the UTC date, which in Skopje is still yesterday until 01:00 or 02:00.
 */
export function localIsoDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
