'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  BookOpen, 
  MapPin, 
  Users, 
  Clock, 
  CheckCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { parseFeedback } from '@/lib/parser';
import { parsePeriode } from '@/lib/dateParser';
import { calculateFeedbackFee, FEEDBACK_FEE, FEEDBACK_MIN_SCORE } from '@/lib/feeCalculator';

export default function AddSession() {
  const router = useRouter();
  const [magicText, setMagicText] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [materi, setMateri] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [ioType, setIoType] = useState<'In' | 'Out'>('In');
  const [instansi, setInstansi] = useState('');
  const [teachingHours, setTeachingHours] = useState<number>(20);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [feedbackScore, setFeedbackScore] = useState<number>(4);
  const [warningMsg, setWarningMsg] = useState('');

  // Nilai turunan: dihitung ulang tiap render, bukan disimpan sebagai state.
  // Total Hours mengikuti multiplier 1.3 untuk kelas luar kota (Out).
  const totalHours =
    ioType === 'Out' ? Number((Number(teachingHours || 0) * 1.3).toFixed(1)) : Number(teachingHours || 0);
  const feedbackFee = calculateFeedbackFee(feedbackScore);

  // Magic Paste Handler
  const handleMagicParse = () => {
    if (!magicText.trim()) {
      setErrorMsg('Harap tempelkan teks feedback terlebih dahulu.');
      return;
    }

    try {
      const parsed = parseFeedback(magicText);
      
      // Populate Form Fields
      if (parsed.materi) setMateri(parsed.materi);
      if (parsed.instansi) setInstansi(parsed.instansi);
      
      // Set the feedback score as the average of available scores, or specifically B. Nilai Instruktur as the core score
      // Generally feedback_score in claims is Nilai Instruktur or overall avg. Let's use Nilai Instruktur (score_instruktur)
      const coreScore = parsed.score_instruktur || parsed.score_materi || 0;
      if (coreScore > 0) {
        setFeedbackScore(coreScore);
      }

      // Populate dates if we can infer them from Periode.
      // Mendukung rentang dalam satu bulan, lintas bulan, lintas tahun, dan kelas satu hari.
      const period = parsePeriode(parsed.periode);
      if (period) {
        setDateStart(period.dateStart);
        setDateEnd(period.dateEnd);
        setWarningMsg('');
      } else {
        // Jangan gagal diam-diam: beri tahu agar tanggal diisi manual
        setWarningMsg(
          parsed.periode
            ? `Periode "${parsed.periode}" tidak dapat dibaca otomatis. Silakan isi Tanggal Mulai & Selesai secara manual.`
            : 'Baris "Periode" tidak ditemukan pada teks feedback. Silakan isi Tanggal Mulai & Selesai secara manual.'
        );
      }

      setSuccessMsg('Teks feedback berhasil di-parse! Kolom formulir di bawah telah terisi secara otomatis.');
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch {
      setErrorMsg('Gagal membaca format feedback. Silakan periksa kembali teks Anda.');
    }
  };

  // Submit form handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!materi || !dateStart || !dateEnd) {
      setErrorMsg('Harap isi kolom Materi, Tanggal Mulai, dan Tanggal Selesai.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          materi,
          date_start: dateStart,
          date_end: dateEnd,
          io_type: ioType,
          instansi,
          teaching_hours: teachingHours,
          total_hours: totalHours,
          participant_count: participantCount,
          feedback_score: feedbackScore,
          feedback_fee: feedbackFee
        }])
        .select();

      if (error) {
        throw new Error(error.message);
      }

      // If we have parsed feedback, let's save the feedback details too
      if (magicText.trim() && data && data[0]) {
        const parsed = parseFeedback(magicText);
        await supabase
          .from('feedbacks')
          .insert([{
            session_id: data[0].id,
            raw_content: magicText,
            score_materi: parsed.score_materi || null,
            score_instruktur: parsed.score_instruktur || null,
            score_fasilitas: parsed.score_fasilitas || null,
            score_pelayanan: parsed.score_pelayanan || null,
            score_konsumsi: parsed.score_konsumsi || null,
            notes_berkesan: parsed.notes_berkesan || null,
            notes_saran: parsed.notes_saran || null,
            notes_topik: parsed.notes_topik || null
          }]);
      }

      setSuccessMsg('Sesi mengajar dan feedback berhasil disimpan!');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      setErrorMsg(`Gagal menyimpan: ${err instanceof Error ? err.message : 'kesalahan tidak diketahui'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Title */}
      <div style={styles.header}>
        <h2 style={styles.title}>Input Kelas & Parsing Feedback</h2>
        <p style={styles.subtitle}>
          Gunakan fitur &quot;Magic Paste&quot; untuk memproses teks feedback secara instan, atau isi formulir secara manual.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={styles.successAlert}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={styles.errorAlert}>
          <span>{errorMsg}</span>
        </div>
      )}
      {warningMsg && (
        <div style={styles.warningAlert}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Magic Paste Area */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          <h3 style={styles.cardTitle}>1. Magic Paste (Teks Feedback)</h3>
        </div>
        <p style={styles.cardDesc}>
          Tempelkan teks feedback resmi yang Anda terima dari portal/peserta ke dalam kolom di bawah ini, lalu klik &quot;Parse Otomatis&quot;.
        </p>
        <textarea 
          placeholder={`Materi : Managing Campus Document for AI Knowledge using RAG
Periode : 21 - 23 Juli 2026
Instruktur : Sapto Wahyu
Instansi : UIN Syekh Wasil Kediri
A. Nilai Materi : 4
...`}
          value={magicText}
          onChange={e => setMagicText(e.target.value)}
          style={styles.textarea}
        />
        <button onClick={handleMagicParse} style={styles.parseBtn}>
          <Sparkles size={16} /> Parse Otomatis
        </button>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.cardHeader}>
          <FileText size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={styles.cardTitle}>2. Detail Sesi Mengajar</h3>
        </div>

        <div style={styles.formGrid}>
          {/* Row 1 */}
          <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
            <label style={styles.label}>Materi / Judul Kelas</label>
            <div style={styles.inputWrapper}>
              <BookOpen size={16} style={styles.inputIcon} />
              <input 
                type="text" 
                placeholder="cth: Deep Learning for NLP" 
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
                placeholder="cth: Bank Indonesia" 
                value={instansi}
                onChange={e => setInstansi(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          {/* Row 2 */}
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

          {/* Row 3 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Jam Mengajar (Tatap Muka)</label>
            <div style={styles.inputWrapper}>
              <Clock size={16} style={styles.inputIcon} />
              <input 
                type="number" 
                value={teachingHours}
                onChange={e => setTeachingHours(Number(e.target.value))}
                style={styles.input}
                min={0}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Total Jam (Dihitung Otomatis)</label>
            <input 
              type="text" 
              value={`${totalHours} Jam`}
              disabled
              style={styles.disabledInput}
            />
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
                min={1}
              />
            </div>
          </div>

          {/* Row 4 */}
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

        <div style={styles.btnRow}>
          <button 
            type="button" 
            onClick={() => router.push('/')} 
            style={styles.cancelBtn}
          >
            Batal
          </button>
          <button 
            type="submit" 
            disabled={loading} 
            style={styles.submitBtn}
          >
            {loading ? 'Menyimpan...' : 'Simpan Kelas & Feedback'}
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
    gap: '32px',
    maxWidth: '800px',
    margin: '0 auto',
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
  successAlert: {
    backgroundColor: '#ebf6ed',
    color: 'var(--success)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid #d4ebd9',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 500,
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
  warningAlert: {
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent)',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid #f2ddd1',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 500,
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--foreground)',
  },
  cardDesc: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  textarea: {
    width: '100%',
    height: '140px',
    padding: '12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical' as const,
    backgroundColor: 'var(--background)',
  },
  parseBtn: {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    alignSelf: 'flex-start',
    transition: 'opacity 0.2s',
  },
  formCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
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
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  inputWrapper: {
    position: 'relative' as const,
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    padding: '8px 12px 8px 36px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  inputPlain: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#ffffff',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#ffffff',
    color: 'var(--foreground)',
    cursor: 'pointer',
  },
  disabledInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: 600,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    borderTop: '1px solid var(--card-border)',
    paddingTop: '20px',
    marginTop: '10px',
  },
  cancelBtn: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    padding: '10px 20px',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  submitBtn: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    padding: '10px 24px',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
export type AddSessionStylesType = typeof styles;
