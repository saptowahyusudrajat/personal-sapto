'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Clock,
  Award,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { FEEDBACK_MIN_SCORE, EXTRA_HOUR_RATE } from '@/lib/feeCalculator';
import { countDays } from '@/lib/dateParser';

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

interface Feedback {
  id: string;
  session_id: string;
  raw_content: string | null;
  score_materi: number | null;
  score_instruktur: number | null;
  score_fasilitas: number | null;
  score_pelayanan: number | null;
  score_konsumsi: number | null;
  notes_berkesan: string | null;
  notes_saran: string | null;
  notes_topik: string | null;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message);
      } else if (!data) {
        setErrorMsg('Sesi mengajar tidak ditemukan. Mungkin sudah dihapus.');
      } else {
        setSession(data as Session);

        // Feedback bersifat opsional: sesi hasil impor CSV tidak punya baris feedback
        const { data: fb } = await supabase
          .from('feedbacks')
          .select('*')
          .eq('session_id', id)
          .maybeSingle();
        setFeedback((fb as Feedback) || null);
      }
      setLoading(false);
    }

    fetchDetail();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      // Hapus feedback lebih dulu supaya tidak meninggalkan baris yatim
      // bila foreign key tidak diset ON DELETE CASCADE.
      await supabase.from('feedbacks').delete().eq('session_id', id);

      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw new Error(error.message);

      router.push('/');
      router.refresh();
    } catch (err) {
      setErrorMsg(`Gagal menghapus: ${err instanceof Error ? err.message : 'kesalahan tidak diketahui'}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat detail sesi...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.emptyState}>
        <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>Sesi Tidak Ditemukan</h3>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>{errorMsg}</p>
        <Link href="/" style={styles.backLinkBtn}>Kembali ke Dashboard</Link>
      </div>
    );
  }

  const scoreRows = [
    { label: 'A. Nilai Materi', value: feedback?.score_materi },
    { label: 'B. Nilai Instruktur', value: feedback?.score_instruktur },
    { label: 'C. Nilai Fasilitas', value: feedback?.score_fasilitas },
    { label: 'D. Nilai Pelayanan', value: feedback?.score_pelayanan },
    { label: 'E. Nilai Konsumsi', value: feedback?.score_konsumsi }
  ].filter(row => row.value !== null && row.value !== undefined);

  const noteRows = [
    { label: 'Pengalaman Berkesan', value: feedback?.notes_berkesan },
    { label: 'Saran Peserta', value: feedback?.notes_saran },
    { label: 'Topik Lanjutan yang Diminati', value: feedback?.notes_topik }
  ].filter(row => row.value && row.value.trim().length > 0);

  const days = countDays(session.date_start, session.date_end);

  return (
    <div style={styles.container}>
      <Link href="/" style={styles.backLink}>
        <ArrowLeft size={16} /> Kembali ke Dashboard
      </Link>

      {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}

      {/* Header sesi */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <h2 style={styles.title}>{session.materi}</h2>
            <p style={styles.subtitle}>
              <MapPin size={14} /> {session.instansi || 'Tanpa instansi'}
              <span style={styles.dot}>&bull;</span>
              <Calendar size={14} /> {formatDate(session.date_start)} s/d {formatDate(session.date_end)}
              {days > 0 && <span style={styles.dayBadge}>{days} hari</span>}
            </p>
          </div>
          <div style={styles.actionRow}>
            <Link href={`/sessions/${session.id}/edit`} style={styles.editBtn}>
              <Pencil size={15} /> Edit
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={styles.deleteBtn}
              disabled={deleting}
            >
              <Trash2 size={15} /> Hapus
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div style={styles.confirmBox}>
            <span>
              Hapus sesi <strong>{session.materi}</strong> beserta feedback-nya? Tindakan ini tidak bisa dibatalkan.
            </span>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={styles.cancelBtn}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={styles.confirmDeleteBtn}
                disabled={deleting}
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ringkasan angka */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statHeader}><Clock size={16} style={{ color: 'var(--accent)' }} /> Total Jam</div>
          <div style={styles.statValue}>{Number(session.total_hours).toFixed(1)}</div>
          <div style={styles.statLabel}>
            {Number(session.teaching_hours).toFixed(1)} jam tatap muka
            {session.io_type === 'Out' && ' (Out ×1.3)'}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}><Users size={16} style={{ color: 'var(--primary)' }} /> Peserta</div>
          <div style={styles.statValue}>{session.participant_count}</div>
          <div style={styles.statLabel}>Kelas {session.io_type === 'Out' ? 'luar kota' : 'dalam kota'}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}><Award size={16} style={{ color: 'var(--success)' }} /> Nilai Instruktur</div>
          <div style={styles.statValue}>{Number(session.feedback_score) || '-'}</div>
          <div style={styles.statLabel}>
            {Number(session.feedback_score) >= FEEDBACK_MIN_SCORE
              ? `Memenuhi ambang ${FEEDBACK_MIN_SCORE}`
              : `Di bawah ambang ${FEEDBACK_MIN_SCORE}`}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>Feedback Fee</div>
          <div style={styles.statValue}>Rp {Number(session.feedback_fee || 0).toLocaleString('id-ID')}</div>
          <div style={styles.statLabel}>
            Jam sesi ini ikut menghitung extra fee Rp {EXTRA_HOUR_RATE.toLocaleString('id-ID')}/jam
          </div>
        </div>
      </div>

      {/* Feedback rinci */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={styles.cardTitle}>Rincian Feedback Peserta</h3>
        </div>

        {!feedback ? (
          <p style={styles.mutedText}>
            Sesi ini belum punya rincian feedback (biasanya karena diinput manual atau berasal dari impor CSV).
            Anda bisa menambahkannya lewat halaman Edit.
          </p>
        ) : (
          <>
            {scoreRows.length > 0 && (
              <div style={styles.scoreGrid}>
                {scoreRows.map(row => (
                  <div key={row.label} style={styles.scoreItem}>
                    <div style={styles.scoreLabel}>{row.label}</div>
                    <div style={styles.scoreValue}>{Number(row.value).toFixed(2)}</div>
                    <div style={styles.scoreTrack}>
                      <div
                        style={{
                          ...styles.scoreBar,
                          width: `${Math.min(100, (Number(row.value) / 4) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {noteRows.length > 0 ? (
              <div style={styles.notesWrapper}>
                {noteRows.map(row => (
                  <div key={row.label} style={styles.noteBlock}>
                    <h4 style={styles.noteTitle}>{row.label}</h4>
                    <p style={styles.noteBody}>{row.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.mutedText}>Tidak ada komentar tertulis pada feedback ini.</p>
            )}

            {feedback.raw_content && (
              <details style={styles.details}>
                <summary style={styles.summary}>Lihat teks feedback asli</summary>
                <pre style={styles.rawText}>{feedback.raw_content}</pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    maxWidth: '900px',
    margin: '0 auto',
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
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '15px',
    color: 'var(--text-muted)',
    width: 'fit-content',
  },
  backLinkBtn: {
    marginTop: '16px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--primary)',
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
  headerCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-0.4px',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  dot: {
    margin: '0 4px',
  },
  dayBadge: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    borderRadius: '999px',
    padding: '2px 10px',
    fontSize: '13px',
    fontWeight: 600,
    marginLeft: '4px',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
  },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--primary)',
    color: 'var(--on-accent)',
    borderRadius: 'var(--radius)',
    padding: '8px 16px',
    fontSize: '15px',
    fontWeight: 600,
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--error)',
    border: '1px solid var(--error-border)',
    borderRadius: 'var(--radius)',
    padding: '8px 16px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmBox: {
    backgroundColor: 'var(--error-bg)',
    border: '1px solid var(--error-border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    fontSize: '15px',
    color: 'var(--foreground)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '8px 16px',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    backgroundColor: 'var(--error)',
    color: 'var(--on-accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '8px 16px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  statCard: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-0.5px',
  },
  statLabel: {
    fontSize: '13px',
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
  mutedText: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
  },
  scoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
  },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  scoreLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  scoreValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  scoreTrack: {
    height: '6px',
    backgroundColor: 'var(--primary-light)',
    borderRadius: '999px',
    overflow: 'hidden' as const,
  },
  scoreBar: {
    height: '100%',
    backgroundColor: 'var(--success)',
    borderRadius: '999px',
  },
  notesWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    borderTop: '1px solid var(--card-border)',
    paddingTop: '16px',
  },
  noteBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  noteTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  noteBody: {
    fontSize: '15px',
    color: 'var(--foreground)',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: 1.7,
  },
  details: {
    borderTop: '1px solid var(--card-border)',
    paddingTop: '12px',
  },
  summary: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontWeight: 600,
  },
  rawText: {
    marginTop: '12px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
    fontSize: '14px',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'var(--text-muted)',
    maxHeight: '360px',
    overflowY: 'auto' as const,
  },
};
