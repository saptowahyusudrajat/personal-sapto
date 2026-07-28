'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateClaimSummary } from '@/lib/feeCalculator';
import { claimFileName } from '@/lib/claimFile';
import BackupCard from '@/components/BackupCard';
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle
} from 'lucide-react';

interface Session {
  id: string;
  materi: string;
  date_start: string;
  date_end: string;
  io_type: 'In' | 'Out';
  instansi: string;
  teaching_hours: number;
  total_hours: number;
  participant_count: number;
  feedback_score: number;
  feedback_fee: number;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function ClaimExport() {
  // Bulan & tahun berjalan sebagai nilai awal. Sebelumnya di-hardcode ke
  // "Januari 2026" sehingga halaman ini akan selalu membuka periode yang salah
  // begitu tahunnya berganti.
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[today.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [earliestYear, setEarliestYear] = useState<number | null>(null);
  const [result, setResult] = useState<{ key: string; sessions: Session[] }>({ key: '', sessions: [] });
  const [refreshToken, setRefreshToken] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const monthYearStr = `${selectedMonth} ${selectedYear}`;
  // Kunci permintaan: berubah saat periode diganti atau tombol Segarkan ditekan.
  const requestKey = `${monthYearStr}#${refreshToken}`;
  // `loading` diturunkan dari selisih data yang tampil vs periode yang diminta,
  // sehingga tidak perlu setState sinkron di dalam effect.
  const loading = result.key !== requestKey;
  const sessions = result.sessions;

  useEffect(() => {
    let cancelled = false;

    const monthIndex = MONTHS.indexOf(selectedMonth);
    const year = parseInt(selectedYear);
    const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(new Date(year, monthIndex + 1, 0).getDate()).padStart(2, '0')}`;

    // Sesi diklaim penuh pada bulan tanggal mulainya (lihat catatan di
    // src/app/api/claim/download/route.ts). Pratinjau ini harus memakai
    // penyaringan yang sama persis dengan berkas Excel yang diunduh.
    supabase
      .from('sessions')
      .select('*')
      .gte('date_start', firstDay)
      .lte('date_start', lastDay)
      .order('date_start', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setResult({ key: requestKey, sessions: [] });
        } else {
          setResult({ key: requestKey, sessions: (data as Session[]) || [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear, requestKey]);

  // Tahun sesi paling awal, dipakai untuk menyusun pilihan tahun.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('sessions')
      .select('date_start')
      .order('date_start', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;
        setEarliestYear(new Date(data[0].date_start).getFullYear());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rentang tahun: dari sesi paling awal sampai satu tahun ke depan, sehingga
  // daftar ini tidak pernah kedaluwarsa seiring bergantinya tahun.
  const currentYear = today.getFullYear();
  const startYear = Math.min(earliestYear ?? currentYear, currentYear);
  const yearOptions: string[] = [];
  for (let y = startYear; y <= currentYear + 1; y++) {
    yearOptions.push(String(y));
  }
  // Jaga-jaga bila tahun terpilih berada di luar rentang (mis. data lama)
  if (!yearOptions.includes(selectedYear)) {
    yearOptions.push(selectedYear);
    yearOptions.sort();
  }

  // Calculations for preview
  const {
    totalHours,
    totalFeedbackFee,
    mandatoryHours,
    extraHours,
    extraHourRate,
    extraHoursFee,
    grandTotalFee
  } = calculateClaimSummary(sessions);

  const handleDownloadExcel = async () => {
    if (sessions.length === 0 || downloading) return;

    setDownloading(true);
    setDownloadError('');
    try {
      // Endpoint klaim butuh token login, jadi tidak bisa dibuka lewat window.open
      // (tag <a>/window.open tidak dapat mengirim header Authorization).
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Sesi login sudah berakhir. Silakan masuk kembali.');
      }

      const res = await fetch(
        `/api/claim/download?month_year=${encodeURIComponent(monthYearStr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || `Gagal mengunduh berkas (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = claimFileName(monthYearStr);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Gagal mengunduh berkas.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Title Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Generator Klaim Mengajar (.xlsx)</h2>
        <p style={styles.subtitle}>
          Pilih bulan klaim Anda untuk meninjau pratinjau data dan mengunduh berkas Excel resmi untuk INIXINDO Surabaya.
        </p>
      </div>

      {/* Selector Card */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Calendar size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={styles.cardTitle}>Pilih Periode Klaim</h3>
        </div>

        <div style={styles.selectorRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Bulan</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              style={styles.select}
            >
              {MONTHS.map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tahun</label>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              style={styles.select}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setRefreshToken(t => t + 1)}
            disabled={loading}
            style={styles.refreshBtn}
          >
            Segarkan Data
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat pratinjau klaim...</p>
        </div>
      ) : sessions.length > 0 ? (
        <div style={styles.previewGrid}>
          {/* Preview Analytics */}
          <div style={styles.previewCard}>
            <h3 style={styles.previewCardTitle}>Pratinjau Ringkasan Klaim ({monthYearStr})</h3>
            <div style={styles.statsPreviewGrid}>
              <div style={styles.statBox}>
                <Clock size={16} style={{ color: 'var(--primary)' }} />
                <div>
                  <div style={styles.statBoxLabel}>Total Jam</div>
                  <div style={styles.statBoxValue}>{totalHours.toFixed(1)} <span style={{ fontSize: '13px' }}>Jam</span></div>
                </div>
              </div>

              <div style={styles.statBox}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div style={styles.statBoxLabel}>Kelas Diajar</div>
                  <div style={styles.statBoxValue}>{sessions.length} <span style={{ fontSize: '13px' }}>Sesi</span></div>
                </div>
              </div>

              <div style={styles.statBox}>
                <DollarSign size={16} style={{ color: 'var(--success)' }} />
                <div>
                  <div style={styles.statBoxLabel}>Feedback Fee</div>
                  <div style={styles.statBoxValue}>Rp {totalFeedbackFee.toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div style={styles.statBox}>
                <DollarSign size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={styles.statBoxLabel}>Extra Jam Fee</div>
                  <div style={styles.statBoxValue}>Rp {extraHoursFee.toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>

            {/* Simulated Calculations */}
            <div style={styles.calcBox}>
              <div style={styles.calcRow}>
                <span>Total Jam Mengajar Bulan Ini</span>
                <span>{totalHours.toFixed(1)} Jam</span>
              </div>
              <div style={styles.calcRow}>
                <span>Batas Minimum Jam (Mandatory)</span>
                <span>{mandatoryHours.toFixed(1)} Jam</span>
              </div>
              <div style={styles.calcRow}>
                <span>Kelebihan Jam (Extra Hours)</span>
                <span style={{ color: extraHours > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {extraHours.toFixed(1)} Jam
                </span>
              </div>
              <div style={styles.calcRow}>
                <span>Extra Jam Fee ({extraHours.toFixed(1)} jam &times; Rp {extraHourRate.toLocaleString('id-ID')})</span>
                <span style={{ color: extraHoursFee > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  Rp {extraHoursFee.toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ ...styles.calcRow, borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                <span>Feedback Fee</span>
                <span>Rp {totalFeedbackFee.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ ...styles.calcRow, fontWeight: 700, paddingTop: '8px' }}>
                <span>GRAND TOTAL KLAIM</span>
                <span style={{ color: 'var(--foreground)' }}>Rp {grandTotalFee.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {downloadError && <div style={styles.downloadError}>{downloadError}</div>}

            <button onClick={handleDownloadExcel} disabled={downloading} style={styles.downloadBtn}>
              <FileSpreadsheet size={18} />{' '}
              {downloading ? 'Menyiapkan berkas...' : 'Unduh Berkas Excel (.xlsx)'}
            </button>
          </div>

          {/* Sesi List Preview */}
          <div style={styles.detailsCard}>
            <h3 style={styles.previewCardTitle}>Daftar Kelas dalam Klaim</h3>
            <div style={styles.sessionsList}>
              {sessions.map((s, idx) => (
                <div key={s.id} style={styles.sessionItem}>
                  <div style={styles.sessionIndex}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={styles.sessionMateri}>{s.materi}</h4>
                    <p style={styles.sessionMeta}>
                      {s.instansi || 'No Instansi'} &bull; {new Date(s.date_start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(s.date_end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.sessionHours}>{s.total_hours} Jam</div>
                    <div style={styles.sessionFee}>
                      {s.feedback_fee > 0 ? `Rp ${Number(s.feedback_fee).toLocaleString('id-ID')}` : 'No Fee'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>
          <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>Tidak Ada Data Mengajar</h3>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Belum ada riwayat mengajar Anda yang diinput pada periode <strong>{monthYearStr}</strong>.
          </p>
        </div>
      )}

      {/* Pencadangan tidak bergantung pada periode yang dipilih, jadi selalu
          ditampilkan walau bulan ini kosong. */}
      <BackupCard />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-muted)',
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    flex: '1',
    minWidth: '150px',
  },
  label: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--foreground)',
    lineHeight: 1.4,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '15px',
    outline: 'none',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground)',
    cursor: 'pointer',
  },
  refreshBtn: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-muted)',
    height: '36px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--primary-light)',
    borderTop: '3px solid var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  previewGrid: {
    display: 'grid',
    // Runtuh jadi satu kolom saat lebar tak lagi cukup, tanpa perlu media query
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  previewCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(18px, 3.5vw, 28px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  previewCardTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--card-border)',
    paddingBottom: '12px',
  },
  statsPreviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },
  statBox: {
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statBoxLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  statBoxValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  calcBox: {
    backgroundColor: 'var(--background)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    fontSize: '15px',
  },
  calcRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-muted)',
  },
  downloadBtn: {
    backgroundColor: 'var(--success)',
    color: 'var(--on-accent)',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 'var(--radius)',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  downloadError: {
    backgroundColor: 'var(--error-bg)',
    color: 'var(--error)',
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--error-border)',
    fontSize: '14px',
    fontWeight: 500,
  },
  detailsCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(18px, 3.5vw, 28px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    maxHeight: '440px',
    overflowY: 'auto' as const,
  },
  sessionsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  sessionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '15px',
  },
  sessionIndex: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: 700,
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
  },
  sessionMateri: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: 0,
  },
  sessionMeta: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  sessionHours: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--foreground)',
  },
  sessionFee: {
    fontSize: '13px',
    color: 'var(--success)',
    fontWeight: 500,
  },
  emptyState: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '60px 24px',
    textAlign: 'center' as const,
    boxShadow: 'var(--shadow-sm)',
  }
};
export type ClaimStylesType = typeof styles;
