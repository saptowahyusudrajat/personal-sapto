'use client';

import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'sapto-portal-theme';

/* --------------------------------------------------------------------------
   Sumber kebenaran tema adalah atribut data-theme pada elemen <html>, yang
   sudah dipasang skrip anti-kedip di layout.tsx sebelum halaman digambar.
   React membacanya lewat useSyncExternalStore, bukan menyalinnya ke state,
   supaya tidak ada dua sumber kebenaran yang bisa berbeda.
   -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(next: Theme, remember: boolean) {
  document.documentElement.setAttribute('data-theme', next);
  if (remember) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Mode penyamaran atau penyimpanan penuh: tema tetap berlaku untuk sesi ini
    }
  }
  notify();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  // Ikuti pengaturan sistem selama pengguna belum memilih tema sendiri
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = (e: MediaQueryListEvent) => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === 'dark' || stored === 'light') return;
    applyTheme(e.matches ? 'dark' : 'light', false);
  };
  media.addEventListener('change', onSystemChange);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onSystemChange);
  };
}

// Saat dirender di server, atribut belum ada. Nilai ini hanya dipakai sesaat;
// skrip di <head> sudah memasang tema yang benar sebelum halaman tampil.
const getServerSnapshot = (): Theme => 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === 'dark' ? 'light' : 'dark', true);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Warna untuk grafik. Recharts menuliskan warna sebagai atribut SVG, dan
 * var(--...) tidak selalu diterjemahkan di sana, jadi nilainya dipilih di sini
 * berdasarkan tema aktif. Nilai-nilai ini harus senada dengan token di
 * globals.css.
 */
export function chartColors(theme: Theme) {
  return theme === 'dark'
    ? {
        bar: '#c3ab90',
        grid: '#302d38',
        axis: '#b3aca4',
        reference: '#e0956c',
        tooltipBg: '#1f1d24',
        tooltipBorder: '#34313c'
      }
    : {
        bar: '#6f5d4a',
        grid: '#ece7e0',
        axis: '#5f574d',
        reference: '#b3623c',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e4ded6'
      };
}
