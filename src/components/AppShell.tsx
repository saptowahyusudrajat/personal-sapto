'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

const PUBLIC_PATHS = ['/login'];

/**
 * Membungkus seluruh halaman: memasang header/nav dan menjaga agar isi portal
 * hanya bisa diakses setelah login. Portal ini berisi data honor, jadi
 * halaman-halamannya tidak boleh terbuka untuk publik.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string>('');

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStatus(data.session ? 'authenticated' : 'anonymous');
      setEmail(data.session?.user.email ?? '');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authenticated' : 'anonymous');
      setEmail(session?.user.email ?? '');
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === 'anonymous' && !isPublicPath) {
      router.replace('/login');
    }
    if (status === 'authenticated' && isPublicPath) {
      router.replace('/');
    }
  }, [status, isPublicPath, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (status === 'loading') {
    return (
      <main style={styles.centered}>
        <div style={styles.spinner} />
      </main>
    );
  }

  // Halaman login tampil tanpa header/nav
  if (isPublicPath) {
    return <main style={styles.plainMain}>{children}</main>;
  }

  // Sedang dialihkan ke /login
  if (status === 'anonymous') {
    return <main style={styles.centered} />;
  }

  return (
    <>
      <header style={styles.header}>
        <div style={styles.headerContainer}>
          <Link href="/" style={styles.logo}>
            <span style={styles.logoBadge}>SW</span>
            <div style={styles.logoText}>
              <h1 style={styles.title}>Teaching Portal</h1>
              <p style={styles.subtitle}>Sapto Wahyu Sudrajat</p>
            </div>
          </Link>
          <nav style={styles.nav}>
            <Link href="/" style={styles.navLink}>Dashboard</Link>
            <Link href="/add" style={styles.navLink}>+ Input Kelas & Feedback</Link>
            <Link href="/claim" style={styles.navLink}>Ekspor Klaim</Link>
            <button type="button" onClick={handleLogout} style={styles.logoutBtn} title={email}>
              <LogOut size={14} /> Keluar
            </button>
          </nav>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
      <footer style={styles.footer}>
        <div style={styles.footerContainer}>
          <p>&copy; 2026 Sapto Wahyu Sudrajat. All Rights Reserved.</p>
          <p style={styles.footerSub}>In partnership with INIXINDO Surabaya</p>
        </div>
      </footer>
    </>
  );
}

const styles = {
  centered: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
  },
  plainMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
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
    backgroundColor: '#ffffff',
    borderBottom: '1px solid var(--card-border)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    boxShadow: 'var(--shadow-sm)',
  },
  headerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: 'clamp(12px, 2.5vw, 16px) clamp(16px, 3vw, 24px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
    color: 'inherit',
  },
  logoBadge: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '18px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--card-border)',
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--foreground)',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    // Di layar sempit menu turun ke baris sendiri dan tetap bisa digulir
    // mendatar bila masih belum muat.
    maxWidth: '100%',
    overflowX: 'auto' as const,
  },
  navLink: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s',
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  main: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: 'clamp(20px, 4vw, 40px) clamp(14px, 3vw, 24px)',
    flex: 1,
    // Cegah isi yang lebih lebar dari layar mendorong seluruh halaman
    minWidth: 0,
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid var(--card-border)',
    padding: 'clamp(16px, 3vw, 24px)',
    marginTop: 'auto',
  },
  footerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center' as const,
    fontSize: '13px',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  footerSub: {
    fontSize: '11px',
    color: '#a0988f',
  },
};
