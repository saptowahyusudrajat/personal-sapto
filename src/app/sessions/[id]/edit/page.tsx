'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  BookOpen,
  MapPin,
  Users,
  Clock,
  FileText,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { calculateFeedbackFee, FEEDBACK_FEE, FEEDBACK_MIN_SCORE } from '@/lib/feeCalculator';

interface FeedbackForm {
  score_materi: string;
  score_instruktur: string;
  score_fasilitas: string;
  score_pelayanan: string;
  score_konsumsi: string;
  notes_berkesan: string;
  notes_saran: string;
  notes_topik: string;
}

const EMPTY_FEEDBACK: FeedbackForm = {
  score_materi: '',
  score_instruktur: '',
  score_fasilitas: '',
  score_pelayanan: '',
  score_konsumsi: '',
  notes_berkesan: '',
  notes_saran: '',
  notes_topik: ''
};

/** String kosong disimpan sebagai NULL, bukan 0, supaya nilai "belum diisi" tidak terbaca sebagai nilai 0. */
const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const toTextOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

export default function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Field sesi
  const [materi, setMateri] = useState('');
  const [instansi, setInstansi] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [ioType, setIoType] = useState<'In' | 'Out'>('In');
  const [teachingHours, setTeachingHours] = useState<number>(0);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [feedbackScore, setFeedbackScore] = useState<number>(0);

  // Nilai turunan: dihitung ulang tiap render, bukan disimpan sebagai state.
  // Total jam mengikuti multiplier 1.3 untuk kelas luar kota.
  const totalHours =
    ioType === 'Out' ? Number((Number(teachingHours || 0) * 1.3).toFixed(1)) : Number(teachingHours || 0);
  const feedbackFee = calculateFeedbackFee(feedbackScore);

  // Field feedback rinci
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(EMPTY_FEEDBACK);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setErrorMsg(error?.message || 'Sesi mengajar tidak ditemukan.');
        setLoading(false);
        return;
      }

      setMateri(data.materi || '');
      setInstansi(data.instansi || '');
      setDateStart(data.date_start || '');
      setDateEnd(data.date_end || '');
      setIoType((data.io_type as 'In' | 'Out') || 'In');
      setTeachingHours(Number(data.teaching_hours || 0));
      setParticipantCount(Number(data.participant_count || 1));
      setFeedbackScore(Number(data.feedback_score || 0));

      const { data: fb } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('session_id', id)
        .maybeSingle();

      if (fb) {
        setFeedbackId(fb.id);
        setFeedbackForm({
          score_materi: fb.score_materi?.toString() ?? '',
          score_instruktur: fb.score_instruktur?.toString() ?? '',
          score_fasilitas: fb.score_fasilitas?.toString() ?? '',
          score_pelayanan: fb.score_pelayanan?.toString() ?? '',
          score_konsumsi: fb.score_konsumsi?.toString() ?? '',
          notes_berkesan: fb.notes_berkesan ?? '',
          notes_saran: fb.notes_saran ?? '',
          notes_topik: fb.notes_topik ?? ''
        });
      }

      setLoading(false);
    }

    fetchDetail();
  }, [id]);

  const updateFeedbackField = (field: keyof FeedbackForm, value: string) => {
    setFeedbackForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!materi || !dateStart || !dateEnd) {
      setErrorMsg('Harap isi kolom Materi, Tanggal Mulai, dan Tanggal Selesai.');
      return;
    }
    if (dateEnd < dateStart) {
      setErrorMsg('Tanggal Selesai tidak boleh lebih awal daripada Tanggal Mulai.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          materi,
          instansi,
          date_start: dateStart,
          date_end: dateEnd,
          io_type: ioType,
          teaching_hours: teachingHours,
          total_hours: totalHours,
          participant_count: participantCount,
          feedback_score: feedbackScore,
          feedback_fee: feedbackFee
        })
        .eq('id', id);

      if (error) throw new Error(error.message);

      const feedbackPayload = {
        score_materi: toNumberOrNull(feedbackForm.score_materi),
        score_instruktur: toNumberOrNull(feedbackForm.score_instruktur),
        score_fasilitas: toNumberOrNull(feedbackForm.score_fasilitas),
        score_pelayanan: toNumberOrNull(feedbackForm.score_pelayanan),
        score_konsumsi: toNumberOrNull(feedbackForm.score_konsumsi),
        notes_berkesan: toTextOrNull(feedbackForm.notes_berkesan),
        notes_saran: toTextOrNull(feedbackForm.notes_saran),
        notes_topik: toTextOrNull(feedbackForm.notes_topik)
      };

      const hasFeedbackContent = Object.values(feedbackPayload).some(v => v !== null);

      if (feedbackId) {
        const { error: fbError } = await supabase
          .from('feedbacks')
          .update(feedbackPayload)
          .eq('id', feedbackId);
        if (fbError) throw new Error(fbError.message);
      } else if (hasFeedbackContent) {
        // Sesi lama (mis. hasil impor CSV) belum punya baris feedback
        const { error: fbError } = await supabase
          .from('feedbacks')
          .insert([{ session_id: id, ...feedbackPayload }]);
        if (fbError) throw new Error(fbError.message);
      }

      router.push(`/sessions/${id}`);
      router.refresh();
    } catch (err) {
      setErrorMsg(`Gagal menyimpan: ${err instanceof Error ? err.message : 'kesalahan tidak diketahui'}`);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat data sesi...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={styles.emptyState}>
        <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
        <h3>Sesi Tidak Ditemukan</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{errorMsg}</p>
        <Link href="/" style={styles.backLinkBtn}>Kembali ke Dashboard</Link>
      </div>
    );
  }

  const scoreFields: { key: keyof FeedbackForm; label: string }[] = [
    { key: 'score_materi', label: 'A. Nilai Materi' },
    { key: 'score_instruktur', label: 'B. Nilai Instruktur' },
    { key: 'score_fasilitas', label: 'C. Nilai Fasilitas' },
    { key: 'score_pelayanan', label: 'D. Nilai Pelayanan' },
    { key: 'score_konsumsi', label: 'E. Nilai Konsumsi' }
  ];

  const noteFields: { key: keyof FeedbackForm; label: string }[] = [
    { key: 'notes_berkesan', label: 'Pengalaman Berkesan' },
    { key: 'notes_saran', label: 'Saran Peserta' },
    { key: 'notes_topik', label: 'Topik Lanjutan yang Diminati' }
  ];

  return (
    <div style={styles.container}>
      <Link href={`/sessions/${id}`} style={styles.backLink}>
        <ArrowLeft size={16} /> Kembali ke Detail Sesi
      </Link>

      <div style={styles.header}>
        <h2 style={styles.title}>Edit Sesi Mengajar</h2>
        <p style={styles.subtitle}>
          Perubahan jam mengajar langsung memengaruhi perhitungan extra fee pada klaim bulan terkait.
        </p>
      </div>

      {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.cardHeader}>
          <FileText size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={styles.cardTitle}>Detail Sesi</h3>
        </div>

        <div style={styles.formGrid}>
          <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
            <label style={styles.label}>Materi / Judul Kelas</label>
            <div style={styles.inputWrapper}>
              <BookOpen size={16} style={styles.inputIcon} />
              <input
                type="text"
                value={materi}
                onChange={e => setMateri(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Instansi</label>
            <div style={styles.inputWrapper}>
              <MapPin size={16} style={styles.inputIcon} />
              <input
                type="text"
                value={instansi}
                onChange={e => setInstansi(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tanggal Mulai</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              style={styles.inputPlain}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tanggal Selesai</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              style={styles.inputPlain}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>I/O (In / Out Kota)</label>
            <select
              value={ioType}
              onChange={e => setIoType(e.target.value as 'In' | 'Out')}
              style={styles.select}
            >
              <option value="In">In (Mengajar Tidak Menginap)</option>
              <option value="Out">Out (Luar Kota - Multiplier 1.3)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Jam Mengajar (Tatap Muka)</label>
            <div style={styles.inputWrapper}>
              <Clock size={16} style={styles.inputIcon} />
              <input
                type="number"
                step="0.5"
                value={teachingHours}
                onChange={e => setTeachingHours(Number(e.target.value))}
                style={styles.input}
                min={0}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Total Jam (Dihitung Otomatis)</label>
            <input type="text" value={`${totalHours} Jam`} disabled style={styles.disabledInput} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Jumlah Peserta</label>
            <div style={styles.inputWrapper}>
              <Users size={16} style={styles.inputIcon} />
              <input
                type="number"
                value={participantCount}
                onChange={e => setParticipantCount(Number(e.target.value))}
                style={styles.input}
                min={0}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Nilai Feedback Instruktur</label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={4}
              value={feedbackScore}
              onChange={e => setFeedbackScore(Number(e.target.value))}
              style={styles.inputPlain}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Feedback Fee (otomatis: &ge; {FEEDBACK_MIN_SCORE} dapat Rp {FEEDBACK_FEE.toLocaleString('id-ID')})
            </label>
            <input
              type="text"
              value={`Rp ${feedbackFee.toLocaleString('id-ID')}`}
              disabled
              style={styles.disabledInput}
            />
          </div>
        </div>

        <div style={{ ...styles.cardHeader, marginTop: '16px', paddingTop: '20px', borderTop: '1px solid var(--card-border)' }}>
          <MessageSquare size={20} style={{ color: 'var(--accent)' }} />
          <h3 style={styles.cardTitle}>Rincian Feedback (Opsional)</h3>
        </div>

        <div style={styles.scoreGrid}>
          {scoreFields.map(field => (
            <div key={field.key} style={styles.formGroup}>
              <label style={styles.label}>{field.label}</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={4}
                placeholder="-"
                value={feedbackForm[field.key]}
                onChange={e => updateFeedbackField(field.key, e.target.value)}
                style={styles.inputPlain}
              />
            </div>
          ))}
        </div>

        <div style={styles.notesGrid}>
          {noteFields.map(field => (
            <div key={field.key} style={styles.formGroup}>
              <label style={styles.label}>{field.label}</label>
              <textarea
                value={feedbackForm[field.key]}
                onChange={e => updateFeedbackField(field.key, e.target.value)}
                style={styles.textarea}
                rows={3}
              />
            </div>
          ))}
        </div>

        <div style={styles.btnRow}>
          <button type="button" onClick={() => router.push(`/sessions/${id}`)} style={styles.cancelBtn}>
            Batal
          </button>
          <button type="submit" disabled={saving} style={styles.submitBtn}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    maxWidth: '800px',
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
    backgroundColor: '#ffffff',
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
    fontSize: '13px',
    color: 'var(--text-muted)',
    width: 'fit-content',
  },
  backLinkBtn: {
    marginTop: '16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--primary)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--foreground)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  errorAlert: {
    backgroundColor: '#fdf3f3',
    color: 'var(--error)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid #f9dede',
    fontSize: '13px',
    fontWeight: 500,
  },
  formCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  scoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
  },
  notesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '12px',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  inputPlain: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  disabledInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    outline: 'none',
    resize: 'vertical' as const,
    lineHeight: 1.6,
    fontSize: '13px',
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    borderTop: '1px solid var(--card-border)',
    paddingTop: '20px',
  },
  cancelBtn: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  submitBtn: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
