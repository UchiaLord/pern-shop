import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounced callback ohne externe Libs.
 * - scheduled calls werden beim unmount gecancelt
 * - stable reference via useCallback
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  delayMs: number,
) {
  const fnRef = useRef(fn);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(
    async (...args: TArgs) => {
      cancel();
      await fnRef.current(...args);
    },
    [cancel],
  );

  const debounced = useCallback(
    (...args: TArgs) => {
      cancel();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void fnRef.current(...args);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  return { debounced, cancel, flush };
}