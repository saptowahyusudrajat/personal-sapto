'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Membaca media query dari peramban. Memakai useSyncExternalStore, bukan
 * useState + useEffect, supaya tidak ada salinan keadaan yang bisa basi dan
 * agar aman saat dirender di server.
 *
 * Saat render di server nilainya selalu false, jadi tata letak lebar dipakai
 * sebagai kondisi awal lalu dikoreksi begitu React aktif di peramban.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Ambang layar sempit yang dipakai bersama di seluruh aplikasi. */
export const NARROW_QUERY = '(max-width: 760px)';

export function useIsNarrow() {
  return useMediaQuery(NARROW_QUERY);
}
