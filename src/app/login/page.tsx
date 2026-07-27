'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Pesan Supabase berbahasa Inggris; terjemahkan yang paling umum
      setErrorMsg(
        error.message.toLowerCase().includes('invalid login credentials')
          ? 'Email atau kata sandi salah.'
          : error.message
      );
      setLoading(false);
      return;
    }

    router.replace('/');
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.brand}>
        <span style={styles.logoBadge}>SW</span>
        <div>
          <h1 style={styles.brandTitle}>Teaching Portal</h1>
          <p style={styles.brandSubtitle}>Sapto Wahyu Sudrajat &bull; INIXINDO Surabaya</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.card}>
        <div>
          <h2 style={styles.title}>Masuk ke Portal</h2>
          <p style={styles.subtitle}>
            Portal ini memuat data honor dan klaim mengajar, sehingga hanya dapat diakses setelah login.
          </p>
        </div>

        {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="email">Email</label>
          <div style={styles.inputWrapper}>
            <Mail size={16} style={styles.inputIcon} />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="password">Kata Sandi</label>
          <div style={styles.inputWrapper}>
            <Lock size={16} style={styles.inputIcon} />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} style={styles.submitBtn}>
          <LogIn size={16} /> {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    width: '100%',
    maxWidth: '420px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'center',
  },
  logoBadge: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '18px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--card-border)',
  },
  brandTitle: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.3px',
  },
  brandSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(18px, 3.5vw, 28px)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.4px',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
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
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
