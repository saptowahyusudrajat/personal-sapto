'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Moon, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { useIsNarrow } from '@/components/useMediaQuery';

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
  const { theme, toggleTheme } = useTheme();
  const isNarrow = useIsNarrow();
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

  // Tandai halaman yang sedang dibuka supaya pengguna tahu posisinya
  const navLinkStyle = (href: string) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return active ? { ...styles.navLink, ...styles.navLinkActive } : styles.navLink;
  };

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      style={styles.themeBtn}
      title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {/* Di layar sempit cukup ikonnya, supaya menu tidak memakan tiga baris */}
      {!isNarrow && <span>{theme === 'dark' ? 'Terang' : 'Gelap'}</span>}
    </button>
  );

  // Halaman login tampil tanpa header/nav
  if (isPublicPath) {
    return (
      <main style={styles.plainMain}>
        <div style={styles.floatingToggle}>{themeToggle}</div>
        {children}
      </main>
    );
  }

  // Sedang dialihkan ke /login
  if (status === 'anonymous') {
    return <main style={styles.centered} />;
  }

  return (
    <>
      <header style={styles.header}>
        <div style={isNarrow ? { ...styles.headerContainer, ...styles.headerContainerNarrow } : styles.headerContainer}>
          <Link href="/" style={styles.logo}>
            <span style={isNarrow ? { ...styles.logoBadge, ...styles.logoBadgeNarrow } : styles.logoBadge}>
              SSW
            </span>
            <div style={styles.logoText}>
              <h1 style={styles.title}>Teaching Portal</h1>
              {/* Di ponsel baris nama disembunyikan supaya header tidak
                  memakan seperempat layar. */}
              {!isNarrow && <p style={styles.subtitle}>Sapto Wahyu Sudrajat</p>}
            </div>
          </Link>
          <nav style={styles.nav}>
            <Link href="/" style={navLinkStyle('/')}>Dashboard</Link>
            <Link href="/add" style={navLinkStyle('/add')}>
              {isNarrow ? '+ Input' : '+ Input Kelas & Feedback'}
            </Link>
            <Link href="/claim" style={navLinkStyle('/claim')}>
              {isNarrow ? 'Klaim' : 'Ekspor Klaim'}
            </Link>
            {/* Semua nominal rupiah dikumpulkan di sini, terpisah dari Dashboard */}
            <Link href="/fee" style={navLinkStyle('/fee')}>
              {isNarrow ? 'Fee' : 'Rekap Fee'}
            </Link>
            {themeToggle}
            <button type="button" onClick={handleLogout} style={styles.logoutBtn} title={email}>
              <LogOut size={18} />
              {!isNarrow && 'Keluar'}
            </button>
          </nav>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
      <footer style={styles.footer}>
        <div style={styles.footerContainer}>
          <p>&copy; 2026 Sapto Wahyu Sudrajat. All Rights Reserved.</p>
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
    padding: 'clamp(20px, 4vw, 40px) clamp(14px, 3vw, 24px)',
    position: 'relative' as const,
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
    backgroundColor: 'var(--card-bg)',
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
  headerContainerNarrow: {
    padding: '8px 12px',
    gap: '8px',
  },
  logoBadge: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '15px',
    letterSpacing: '-0.3px',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--card-border)',
    flexShrink: 0,
  },
  logoBadgeNarrow: {
    width: '34px',
    height: '34px',
    fontSize: '12px',
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  title: {
    fontSize: 'clamp(16px, 3vw, 20px)',
    fontWeight: 700,
    color: 'var(--foreground)',
    margin: 0,
    letterSpacing: '-0.3px',
    whiteSpace: 'nowrap' as const,
  },
  subtitle: {
    fontSize: '14px',
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
    fontSize: 'clamp(14px, 2.6vw, 16px)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    padding: '7px 10px',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  navLinkActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--foreground)',
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '8px 14px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  themeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius)',
    padding: '7px 10px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--foreground)',
    cursor: 'pointer',
  },
  floatingToggle: {
    position: 'absolute' as const,
    top: 'clamp(16px, 3vw, 24px)',
    right: 'clamp(16px, 3vw, 24px)',
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
    backgroundColor: 'var(--card-bg)',
    borderTop: '1px solid var(--card-border)',
    padding: 'clamp(16px, 3vw, 24px)',
    marginTop: 'auto',
  },
  footerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center' as const,
    fontSize: '15px',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  footerSub: {
    fontSize: '13px',
    color: 'var(--text-faint)',
  },
};
