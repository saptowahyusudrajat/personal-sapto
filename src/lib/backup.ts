import { supabase } from './supabase';

/**
 * Pencadangan seluruh isi portal.
 *
 * Alasannya sederhana: semua riwayat mengajar sejak 2025 hanya hidup di satu
 * proyek Supabase. Proyek gratis bisa dijeda bila lama tidak aktif, dan bila
 * terhapus, tidak ada salinan lain.
 */

/** Kolom CSV sesi, urutannya sengaja disamakan dengan berkas migrasi awal
 *  agar hasil cadangan bisa diimpor kembali memakai `node import-csv.js`. */
export const SESSION_CSV_COLUMNS = [
  'materi',
  'date_start',
  'date_end',
  'io_type',
  'instansi',
  'teaching_hours',
  'total_hours',
  'participant_count',
  'feedback_score',
  'feedback_fee'
] as const;

export interface BackupBundle {
  app: string;
  version: number;
  exported_at: string;
  counts: { sessions: number; feedbacks: number };
  sessions: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
}

/**
 * Mengambil seluruh baris sebuah tabel dengan penomoran halaman.
 * Supabase membatasi 1000 baris per permintaan, jadi sekadar select() akan
 * diam-diam memotong data begitu jumlah sesi melewati angka itu.
 */
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  const all: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      // Urutan tetap diperlukan agar penomoran halaman tidak melewatkan baris
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
  }

  return all;
}

export async function buildBackup(): Promise<BackupBundle> {
  const [sessions, feedbacks] = await Promise.all([
    fetchAllRows('sessions'),
    fetchAllRows('feedbacks')
  ]);

  return {
    app: 'sapto-teaching-portal',
    version: 1,
    exported_at: new Date().toISOString(),
    counts: { sessions: sessions.length, feedbacks: feedbacks.length },
    sessions,
    feedbacks
  };
}

/** Membungkus satu nilai sesuai aturan CSV: tanda kutip digandakan, dan sel
 *  yang memuat koma, kutip, atau ganti baris dibungkus tanda kutip. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sessionsToCsv(sessions: Record<string, unknown>[]): string {
  const lines = [SESSION_CSV_COLUMNS.join(',')];
  for (const row of sessions) {
    lines.push(SESSION_CSV_COLUMNS.map(col => csvCell(row[col])).join(','));
  }
  // BOM di depan supaya Excel di Windows membaca huruf beraksen dengan benar
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** "2026-07-27" untuk penamaan berkas. */
export function backupDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Memicu unduhan di peramban dari teks yang sudah dibentuk. */
export function downloadText(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
