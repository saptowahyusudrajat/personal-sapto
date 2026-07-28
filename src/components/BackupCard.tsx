'use client';

import React, { useState } from 'react';
import { DatabaseBackup, FileJson, FileSpreadsheet, CheckCircle } from 'lucide-react';
import {
  buildBackup,
  sessionsToCsv,
  backupDateStamp,
  downloadText
} from '@/lib/backup';

type Busy = 'json' | 'csv' | null;

export default function BackupCard() {
  const [busy, setBusy] = useState<Busy>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const run = async (kind: Exclude<Busy, null>) => {
    if (busy) return;
    setBusy(kind);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const bundle = await buildBackup();
      const stamp = backupDateStamp();

      if (kind === 'json') {
        downloadText(
          `cadangan-teaching-portal-${stamp}.json`,
          JSON.stringify(bundle, null, 2),
          'application/json'
        );
        setSuccessMsg(
          `Tersimpan: ${bundle.counts.sessions} sesi dan ${bundle.counts.feedbacks} rincian feedback.`
        );
      } else {
        downloadText(
          `cadangan-sesi-${stamp}.csv`,
          sessionsToCsv(bundle.sessions),
          'text/csv'
        );
        setSuccessMsg(`Tersimpan: ${bundle.counts.sessions} sesi dalam format CSV.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat cadangan.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <DatabaseBackup size={20} style={{ color: 'var(--primary)' }} />
        <h3 style={styles.title}>Cadangan Data</h3>
      </div>

      <p style={styles.desc}>
        Seluruh riwayat mengajar Anda hanya tersimpan di satu proyek Supabase. Unduh salinannya
        secara berkala, lalu simpan di tempat lain seperti Google Drive, agar data tetap ada
        seandainya proyek itu terhapus atau dijeda.
      </p>

      {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}
      {successMsg && (
        <div style={styles.successAlert}>
          <CheckCircle size={17} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={styles.options}>
        <div style={styles.option}>
          <div>
            <h4 style={styles.optionTitle}>Cadangan lengkap (JSON)</h4>
            <p style={styles.optionDesc}>
              Berisi sesi <strong>dan</strong> rincian feedback, termasuk teks aslinya. Pilih ini
              untuk cadangan sesungguhnya.
            </p>
          </div>
          <button
            type="button"
            onClick={() => run('json')}
            disabled={busy !== null}
            style={styles.primaryBtn}
          >
            <FileJson size={17} /> {busy === 'json' ? 'Menyiapkan...' : 'Unduh JSON'}
          </button>
        </div>

        <div style={styles.option}>
          <div>
            <h4 style={styles.optionTitle}>Daftar sesi (CSV)</h4>
            <p style={styles.optionDesc}>
              Hanya tabel sesi, bisa dibuka di Excel. Kolomnya sama dengan berkas migrasi awal,
              jadi bisa diimpor kembali lewat <code style={styles.code}>node import-csv.js</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => run('csv')}
            disabled={busy !== null}
            style={styles.secondaryBtn}
          >
            <FileSpreadsheet size={17} /> {busy === 'csv' ? 'Menyiapkan...' : 'Unduh CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
  },
  desc: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    maxWidth: '760px',
  },
  errorAlert: {
    backgroundColor: 'var(--error-bg)',
    color: 'var(--error)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--error-border)',
    fontSize: '15px',
    fontWeight: 500,
  },
  successAlert: {
    backgroundColor: 'var(--success-bg)',
    color: 'var(--success)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--success-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    fontWeight: 500,
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  option: {
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    backgroundColor: 'var(--card-bg-alt)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: '14px',
  },
  optionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  optionDesc: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    lineHeight: 1.55,
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '13px',
    backgroundColor: 'var(--primary-light)',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'var(--primary)',
    color: 'var(--on-accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '11px 20px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '11px 20px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
