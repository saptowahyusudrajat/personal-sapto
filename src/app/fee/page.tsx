'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useIsNarrow } from '@/components/useMediaQuery';
import { DollarSign, Award, Clock, AlertCircle } from 'lucide-react';
import {
  calculateClaimSummaryByMonth,
  calculateMonthlyClaims,
  MANDATORY_HOURS,
  EXTRA_HOUR_RATE
} from '@/lib/feeCalculator';
import { MONTHS_FULL } from '@/lib/claimFile';

interface Session {
  id: string;
  materi: string;
  date_start: string;
  total_hours: number;
  feedback_fee: number;
}

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/** "2026-07" menjadi "Juli 2026" */
const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS_FULL[month - 1]} ${year}`;
};

export default function FeeRecap() {
  const isNarrow = useIsNarrow();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('All');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('sessions')
      .select('id, materi, date_start, total_hours, feedback_fee')
      .order('date_start', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setSessions((data as Session[]) || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = Array.from(
    new Set(sessions.map(s => String(new Date(s.date_start).getFullYear())))
  ).sort().reverse();

  const filtered =
    selectedYear === 'All'
      ? sessions
      : sessions.filter(s => String(new Date(s.date_start).getFullYear()) === selectedYear);

  const total = calculateClaimSummaryByMonth(filtered);
  const monthly = calculateMonthlyClaims(filtered);
  const monthsWithExtra = monthly.filter(m => m.extraHours > 0).length;

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat rekap fee...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Rekap Fee Mengajar</h2>
        <p style={styles.subtitle}>
          Seluruh angka rupiah dikumpulkan di halaman ini, terpisah dari Dashboard, supaya
          dashboard tetap nyaman ditampilkan ke orang lain.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div style={styles.emptyState}>
          <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>Belum Ada Data</h3>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Belum ada sesi mengajar yang tercatat.
          </p>
          <Link href="/add" style={styles.linkBtn}>Input Kelas Pertama</Link>
        </div>
      ) : (
        <>
          {/* Penyaring tahun */}
          <div style={styles.filterRow}>
            <label style={styles.filterLabel} htmlFor="tahun">Tahun</label>
            <select
              id="tahun"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={styles.select}
            >
              <option value="All">Semua Tahun</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Angka utama */}
          <div style={styles.grandCard}>
            <span style={styles.grandLabel}>Total Fee Klaim</span>
            <span style={styles.grandValue}>{rupiah(total.grandTotalFee)}</span>
            <span style={styles.grandNote}>
              Dari {filtered.length} sesi pada {monthly.length} bulan
              {selectedYear !== 'All' && ` di tahun ${selectedYear}`}
            </span>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <Award size={20} style={{ color: 'var(--success)' }} />
                <span style={styles.cardTitle}>Feedback Fee</span>
              </div>
              <div style={styles.cardValue}>{rupiah(total.totalFeedbackFee)}</div>
              <div style={styles.cardLabel}>
                Dari {filtered.filter(s => Number(s.feedback_fee) > 0).length} sesi yang memenuhi ambang nilai
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <Clock size={20} style={{ color: 'var(--accent)' }} />
                <span style={styles.cardTitle}>Extra Jam Fee</span>
              </div>
              <div style={styles.cardValue}>{rupiah(total.extraHoursFee)}</div>
              <div style={styles.cardLabel}>
                {total.extraHours.toFixed(1)} jam melebihi batas, dari {monthsWithExtra} bulan
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <DollarSign size={20} style={{ color: 'var(--primary)' }} />
                <span style={styles.cardTitle}>Tarif Berlaku</span>
              </div>
              <div style={styles.cardValue}>{rupiah(EXTRA_HOUR_RATE)}</div>
              <div style={styles.cardLabel}>
                Per jam di atas batas mandatory {MANDATORY_HOURS} jam per bulan
              </div>
            </div>
          </div>

          {/* Rincian bulan per bulan */}
          <div style={styles.tableSection}>
            <h3 style={styles.sectionTitle}>Rincian per Bulan</h3>
            <p style={styles.sectionNote}>
              Batas {MANDATORY_HOURS} jam berlaku per bulan, jadi extra fee dihitung terpisah
              untuk setiap bulan lalu dijumlahkan.
            </p>

            {isNarrow ? (
              <div style={styles.cardList}>
                {monthly.map(m => (
                  <div key={m.monthKey} style={styles.monthCard}>
                    <div style={styles.monthCardTop}>
                      <h4 style={styles.monthCardTitle}>{monthLabel(m.monthKey)}</h4>
                      <span style={styles.monthCardTotal}>{rupiah(m.grandTotalFee)}</span>
                    </div>
                    <p style={styles.monthCardMeta}>
                      {m.sessionCount} sesi &bull; {m.totalHours.toFixed(1)} jam
                      {m.extraHours > 0
                        ? ` (lebih ${m.extraHours.toFixed(1)} jam)`
                        : ` (belum sampai ${MANDATORY_HOURS} jam)`}
                    </p>
                    <div style={styles.monthCardStats}>
                      <div style={styles.monthCardStat}>
                        <span style={styles.monthCardStatLabel}>Feedback</span>
                        <span style={styles.monthCardStatValue}>{rupiah(m.totalFeedbackFee)}</span>
                      </div>
                      <div style={styles.monthCardStat}>
                        <span style={styles.monthCardStatLabel}>Extra Jam</span>
                        <span style={styles.monthCardStatValue}>{rupiah(m.extraHoursFee)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Bulan</th>
                      <th style={styles.thRight}>Sesi</th>
                      <th style={styles.thRight}>Total Jam</th>
                      <th style={styles.thRight}>Extra Jam</th>
                      <th style={styles.thRight}>Feedback Fee</th>
                      <th style={styles.thRight}>Extra Jam Fee</th>
                      <th style={styles.thRight}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, idx) => (
                      <tr
                        key={m.monthKey}
                        style={{
                          ...styles.tr,
                          backgroundColor: idx % 2 === 0 ? 'var(--card-bg)' : 'var(--card-bg-alt)'
                        }}
                      >
                        <td style={styles.tdMonth}>{monthLabel(m.monthKey)}</td>
                        <td style={styles.tdNum}>{m.sessionCount}</td>
                        <td style={styles.tdNum}>{m.totalHours.toFixed(1)}</td>
                        <td
                          style={{
                            ...styles.tdNum,
                            color: m.extraHours > 0 ? 'var(--accent)' : 'var(--text-muted)'
                          }}
                        >
                          {m.extraHours > 0 ? m.extraHours.toFixed(1) : '-'}
                        </td>
                        <td style={styles.tdNum}>{rupiah(m.totalFeedbackFee)}</td>
                        <td style={styles.tdNum}>
                          {m.extraHoursFee > 0 ? rupiah(m.extraHoursFee) : '-'}
                        </td>
                        <td style={styles.tdTotal}>{rupiah(m.grandTotalFee)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={styles.tfLabel}>Total</td>
                      <td style={styles.tfNum}>{filtered.length}</td>
                      <td style={styles.tfNum}>{total.totalHours.toFixed(1)}</td>
                      <td style={styles.tfNum}>{total.extraHours.toFixed(1)}</td>
                      <td style={styles.tfNum}>{rupiah(total.totalFeedbackFee)}</td>
                      <td style={styles.tfNum}>{rupiah(total.extraHoursFee)}</td>
                      <td style={styles.tfNum}>{rupiah(total.grandTotalFee)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <p style={styles.footNote}>
            Butuh berkas resminya? Buka <Link href="/claim">Ekspor Klaim</Link> untuk mengunduh
            berkas Excel per bulan.
          </p>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--primary-light)',
    borderTop: '3px solid var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-muted)',
    maxWidth: '760px',
  },
  emptyState: {
    backgroundColor: 'var(--card-bg)',
    border: '1px dashed var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '60px 24px',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  linkBtn: {
    marginTop: '16px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--primary)',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  filterLabel: {
    fontSize: '15px',
    fontWeight: 600,
  },
  select: {
    padding: '9px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--card-bg)',
    fontSize: '15px',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
  },
  grandCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(20px, 4vw, 32px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  grandLabel: {
    fontSize: '14px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
  },
  grandValue: {
    fontSize: 'clamp(30px, 6vw, 42px)',
    fontWeight: 700,
    letterSpacing: '-1.5px',
    color: 'var(--foreground)',
    lineHeight: 1.15,
  },
  grandNote: {
    fontSize: '15px',
    color: 'var(--text-muted)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  cardLabel: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  tableSection: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
  },
  sectionNote: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginBottom: '10px',
  },
  tableContainer: {
    overflowX: 'auto' as const,
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '720px',
  },
  th: {
    padding: '12px 14px',
    borderBottom: '2px solid var(--card-border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '14px',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  thRight: {
    padding: '12px 14px',
    borderBottom: '2px solid var(--card-border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '14px',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    borderBottom: '1px solid var(--card-border)',
  },
  tdMonth: {
    padding: '13px 14px',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  tdNum: {
    padding: '13px 14px',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  tdTotal: {
    padding: '13px 14px',
    textAlign: 'right' as const,
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  tfLabel: {
    padding: '14px',
    fontWeight: 700,
    borderTop: '2px solid var(--card-border)',
  },
  tfNum: {
    padding: '14px',
    textAlign: 'right' as const,
    fontWeight: 700,
    borderTop: '2px solid var(--card-border)',
    whiteSpace: 'nowrap' as const,
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  monthCard: {
    backgroundColor: 'var(--card-bg-alt)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
  },
  monthCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '10px',
  },
  monthCardTitle: {
    fontSize: '16px',
    fontWeight: 700,
  },
  monthCardTotal: {
    fontSize: '16px',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  monthCardMeta: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  monthCardStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid var(--card-border)',
  },
  monthCardStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  monthCardStatLabel: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    color: 'var(--text-faint)',
  },
  monthCardStatValue: {
    fontSize: '15px',
    fontWeight: 700,
    overflowWrap: 'anywhere' as const,
  },
  footNote: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
};
