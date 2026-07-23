'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface UseTableFiltersResult<F extends Record<string, string | boolean>> {
  /** Current filter values, read from the URL query string (falls back to `defaults`). */
  filters: F;
  /** Set one filter. `null`/`''`/`false` removes it from the URL (back to its default). */
  setFilter: <K extends keyof F>(key: K, value: F[K] | null) => void;
  /** Reset every filter to its default (strips all of them from the URL). */
  clearFilters: () => void;
  /** True if any filter currently differs from its default. */
  hasActiveFilters: boolean;
  /** Page number, NOT stored in the URL (matches the pre-existing convention
   * in app/inventory/stock/page.tsx this hook was extracted from) — resets to
   * 1 automatically whenever any filter value changes. */
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
}

/**
 * Shared "list page reads its filters from the URL query string" pattern
 * (`?warehouseId=&lowStock=`, etc.), extracted from app/inventory/stock's
 * original hand-rolled version once the dashboard phase needed the same
 * shape elsewhere (see README "Suggested next phases").
 *
 * `defaults`' value TYPES (not values) drive parsing: a `boolean` default
 * means the URL param is read as `'true' | '1'` -> true; anything else is
 * read as a plain string, falling back to the given default when absent.
 *
 * Must be used inside a Suspense boundary — same Next.js requirement
 * `useSearchParams` always has (see the `<Suspense>` wrapper pattern in
 * app/inventory/stock/page.tsx).
 */
export function useTableFilters<F extends Record<string, string | boolean>>(
  defaults: F,
): UseTableFiltersResult<F> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);

  const filters = {} as F;
  for (const key of Object.keys(defaults) as Array<keyof F>) {
    const raw = searchParams.get(String(key));
    const def = defaults[key];
    if (typeof def === 'boolean') {
      filters[key] = (raw === 'true' || raw === '1') as F[typeof key];
    } else {
      filters[key] = (raw ?? def) as F[typeof key];
    }
  }

  // Reset to page 1 whenever the resolved filter values change.
  const filterKey = JSON.stringify(filters);
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setPage(1);
    }
  }, [filterKey]);

  const setFilter = useCallback(
    <K extends keyof F>(key: K, value: F[K] | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '' || value === false) {
        params.delete(String(key));
      } else if (value === true) {
        params.set(String(key), 'true');
      } else {
        params.set(String(key), String(value));
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, pathname, router],
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  const hasActiveFilters = (Object.keys(defaults) as Array<keyof F>).some(
    (key) => filters[key] !== defaults[key],
  );

  return { filters, setFilter, clearFilters, hasActiveFilters, page, setPage };
}
