import { useEffect, useState } from 'react';

/**
 * Holds back a rapidly-changing value until it settles.
 *
 * The tools derive everything — cleaned sequence, digest, reading frames — from
 * the textarea synchronously, so without this every keystroke recomputes and
 * re-renders the whole result set.
 */
export function useDebounced<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return settled;
}
