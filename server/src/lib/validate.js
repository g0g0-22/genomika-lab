/**
 * A small schema validator for the administrative write endpoints.
 *
 * Those handlers used to merge the request body into the stored row and save
 * it, which let a string land in an INTEGER column and turned a null title or
 * an unknown group id into a 500. Each field now has a declared type and
 * bounds, unknown fields are dropped, and a failure is a 400 naming the field.
 */
import { db } from '../db.js';
import { isRealDate } from './dates.js';

const fail = (code) => ({ error: code });

export const text = ({ required = false, max = 500 } = {}) => (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return required ? fail('required') : { value: null };
  if (typeof v !== 'string' && typeof v !== 'number') return fail('invalid');
  const s = String(v).trim();
  return s.length > max ? fail('too_long') : { value: s };
};

export const int = ({ min = -Infinity, max = Infinity, required = false } = {}) => (v) => {
  if (v === undefined || v === null || v === '') return required ? fail('required') : { value: null };
  const n = Number(v);
  if (!Number.isInteger(n)) return fail('not_an_integer');
  return n < min || n > max ? fail('out_of_range') : { value: n };
};

export const num = ({ min = -Infinity, max = Infinity } = {}) => (v) => {
  if (v === undefined || v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return fail('not_a_number');
  return n < min || n > max ? fail('out_of_range') : { value: n };
};

export const bool = () => (v) => {
  if (v === undefined || v === null) return { value: null };
  if (v === true || v === 1 || v === '1' || v === 'true') return { value: 1 };
  if (v === false || v === 0 || v === '0' || v === 'false') return { value: 0 };
  return fail('not_a_boolean');
};

export const oneOf = (options) => (v) => {
  if (v === undefined || v === null || v === '') return { value: null };
  return options.includes(v) ? { value: v } : fail('not_allowed');
};

export const date = () => (v) => {
  if (v === undefined || v === null || v === '') return { value: null };
  return isRealDate(v) ? { value: v } : fail('invalid_date');
};

export const pattern = (re, { max = 200 } = {}) => (v) => {
  if (v === undefined || v === null || v === '') return { value: null };
  const s = String(v).trim();
  return s.length <= max && re.test(s) ? { value: s } : fail('invalid_format');
};

/** A foreign key: an id that must exist in `table`, or nothing. */
export const ref = (table) => (v) => {
  if (v === undefined || v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isInteger(n)) return fail('not_an_integer');
  return db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(n) ? { value: n } : fail('does_not_exist');
};

/**
 * Validates `input` against `schema`. With `partial`, only fields present in
 * the input are checked — an update need not resend the whole record — and a
 * required field may be omitted but never cleared.
 */
export function validate(schema, input, { partial = false } = {}) {
  const body = input && typeof input === 'object' ? input : {};
  const value = {}, errors = {};
  for (const [field, check] of Object.entries(schema)) {
    if (partial && !(field in body)) continue;
    const result = check(body[field]);
    if (result.error) errors[field] = result.error;
    else value[field] = result.value;
  }
  return { value, errors, ok: Object.keys(errors).length === 0 };
}
