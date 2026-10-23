import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginPage } from './components/auth/LoginPage.js';
import { AcademicManagement } from './components/academics/AcademicManagement.js';
import { StudentManagement } from './components/students/StudentManagement.js';
import { CompanyManagement } from './components/companies/CompanyManagement.js';
import { canViewStudents, canViewAcademics, canViewCompanies } from './utils/permissions.js';
import type { AuthUser, UserRole } from '@placement-platform/contracts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardView = 'dashboard' | 'students' | 'companies' | 'academics';

interface HealthData {
  status: string;
  service: string;
  version: string;
  environment: string;
  database?: string;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

type BackendStatus = 'loading' | 'ok' | 'error';

// ─── Hook: useHealthCheck ─────────────────────────────────────────────────────

function useHealthCheck() {
  const [status, setStatus] = useState<BackendStatus>('loading');
  const [data, setData] = useState<HealthData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      setStatus('loading');
      try {
        const res = await fetch('/api/v1/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HealthData;
        if (!cancelled) {
          setData(json);
          setStatus('ok');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
          setStatus('error');
        }
      }
    }

    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, data, errorMsg };
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  userRole?: UserRole;
}

function Sidebar({ activeView, onSelectView, userRole }: SidebarProps) {
  const showStudents = canViewStudents(userRole);
  const showCompanies = canViewCompanies(userRole);
  const showAcademics = canViewAcademics(userRole);

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="logo-icon" aria-hidden="true">
            🎯
          </div>
          <div className="logo-text">
            <span className="logo-title">PlaceIQ</span>
            <span className="logo-subtitle">Placement Intelligence</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div>
          <div className="nav-section-label">Overview</div>
          <button
            type="button"
            className={`nav-item${activeView === 'dashboard' ? ' active' : ''}`}
            id="nav-dashboard"
            onClick={() => onSelectView('dashboard')}
            aria-current={activeView === 'dashboard' ? 'page' : undefined}
          >
            <span className="nav-item-icon" aria-hidden="true">
              🏠
            </span>
            Dashboard
          </button>
        </div>

        <div>
          <div className="nav-section-label">People & Organizations</div>
          {showStudents && (
            <button
              type="button"
              className={`nav-item${activeView === 'students' ? ' active' : ''}`}
              id="nav-students"
              onClick={() => onSelectView('students')}
              aria-current={activeView === 'students' ? 'page' : undefined}
            >
              <span className="nav-item-icon" aria-hidden="true">
                🎓
              </span>
              Students
            </button>
          )}
          {showCompanies ? (
            <button
              type="button"
              className={`nav-item${activeView === 'companies' ? ' active' : ''}`}
              id="nav-companies"
              onClick={() => onSelectView('companies')}
              aria-current={activeView === 'companies' ? 'page' : undefined}
            >
              <span className="nav-item-icon" aria-hidden="true">
                🏢
              </span>
              Companies
            </button>
          ) : (
            <button type="button" className="nav-item" id="nav-companies" disabled>
              <span className="nav-item-icon" aria-hidden="true">
                🏢
              </span>
              Companies
            </button>
          )}
        </div>

        {showAcademics && (
          <div>
            <div className="nav-section-label">Academics</div>
            <button
              type="button"
              className={`nav-item${activeView === 'academics' ? ' active' : ''}`}
              id="nav-academics"
              onClick={() => onSelectView('academics')}
              aria-current={activeView === 'academics' ? 'page' : undefined}
            >
              <span className="nav-item-icon" aria-hidden="true">
                🏛️
              </span>
              Academic Structure
            </button>
          </div>
        )}

        <div>
          <div className="nav-section-label">Operations</div>
          <button type="button" className="nav-item" id="nav-placement-drives" disabled>
            <span className="nav-item-icon" aria-hidden="true">
              📋
            </span>
            Placement Drives
            <span className="nav-item-badge">Soon</span>
          </button>
          <button type="button" className="nav-item" id="nav-applications" disabled>
            <span className="nav-item-icon" aria-hidden="true">
              📄
            </span>
            Applications
            <span className="nav-item-badge">Soon</span>
          </button>
        </div>

        <div>
          <div className="nav-section-label">System</div>
          <button type="button" className="nav-item" id="nav-settings" disabled>
            <span className="nav-item-icon" aria-hidden="true">
              ⚙️
            </span>
            Settings
            <span className="nav-item-badge">Soon</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-info">v0.1.0 · PlaceIQ Platform</div>
      </div>
    </aside>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: BackendStatus }) {
  const labels: Record<BackendStatus, string> = {
    loading: 'Connecting…',
    ok: 'API Online',
    error: 'API Offline',
  };

  return (
    <div
      className={`status-pill ${status}`}
      role="status"
      aria-live="polite"
      id="backend-status-indicator"
    >
      <span className={`status-dot${status === 'loading' ? ' pulse' : ''}`} aria-hidden="true" />
      {labels[status]}
    </div>
  );
}

// ─── Placeholder cards ────────────────────────────────────────────────────────

interface PlaceholderCardProps {
  icon: string;
  color: string;
  title: string;
  description: string;
}

function PlaceholderCard({ icon, color, title, description }: PlaceholderCardProps) {
  return (
    <article className="placeholder-card" id={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="card-header">
        <div className="card-icon-wrap" style={{ background: color }} aria-hidden="true">
          {icon}
        </div>
        <span className="card-placeholder-tag">Placeholder</span>
      </div>

      <div className="card-stat">
        <div className="card-stat-value">—</div>
        <div className="card-stat-label">{title}</div>
      </div>

      <div className="card-placeholder-notice">
        {description} Data will appear here once the backend modules are connected.
      </div>
    </article>
  );
}

const CARDS: PlaceholderCardProps[] = [
  {
    icon: '🎓',
    color: 'rgba(99,102,241,0.18)',
    title: 'Students',
    description: 'Total enrolled students across all departments.',
  },
  {
    icon: '🏢',
    color: 'rgba(139,92,246,0.18)',
    title: 'Companies',
    description: 'Companies registered for recruitment drives.',
  },
  {
    icon: '📋',
    color: 'rgba(34,197,94,0.18)',
    title: 'Placement Drives',
    description: 'Active and upcoming placement events.',
  },
  {
    icon: '📄',
    color: 'rgba(245,158,11,0.18)',
    title: 'Applications',
    description: 'Student applications submitted this season.',
  },
];

// ─── Health detail panel ──────────────────────────────────────────────────────

function HealthPanel({
  status,
  data,
  errorMsg,
}: {
  status: BackendStatus;
  data: HealthData | null;
  errorMsg: string;
}) {
  return (
    <section className="health-panel" aria-labelledby="health-panel-title">
      <h2 className="health-panel-title" id="health-panel-title">
        🩺 Backend Health — <code>/api/v1/health</code>
      </h2>

      {status === 'loading' && (
        <p className="health-key" style={{ fontSize: '13px' }}>
          Polling API…
        </p>
      )}

      {status === 'error' && (
        <div className="health-error-message" role="alert">
          ⚠️ Could not reach the API server. Make sure it is running on{' '}
          <strong>http://localhost:4000</strong>.<br />
          Error: {errorMsg}
        </div>
      )}

      {status === 'ok' && data && (
        <>
          <div className="health-row">
            <span className="health-key">Status</span>
            <span className="health-val" style={{ color: 'var(--color-success)' }}>
              ✅ {data.status}
            </span>
          </div>
          <div className="health-row">
            <span className="health-key">Database</span>
            <span className="health-val" style={{ color: 'var(--color-success)' }}>
              {data.database === 'connected' ? '✅ Connected' : (data.database ?? 'n/a')}
            </span>
          </div>
          <div className="health-row">
            <span className="health-key">Service</span>
            <span className="health-val">{data.service}</span>
          </div>
          <div className="health-row">
            <span className="health-key">Version</span>
            <span className="health-val">{data.version}</span>
          </div>
          <div className="health-row">
            <span className="health-key">Environment</span>
            <span className="health-val">{data.environment}</span>
          </div>
          <div className="health-row">
            <span className="health-key">Request ID</span>
            <span className="health-val mono">{data.meta.requestId}</span>
          </div>
          <div className="health-row">
            <span className="health-key">Timestamp</span>
            <span className="health-val mono">{data.meta.timestamp}</span>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Protected Dashboard Layout ───────────────────────────────────────────────

function DashboardLayout({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const { status, data, errorMsg } = useHealthCheck();

  const userInitials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const viewTitles: Record<DashboardView, string> = {
    dashboard: 'Dashboard',
    students: 'Student Management',
    companies: 'Company Directory',
    academics: 'Academic Structure',
  };

  return (
    <div className="layout">
      <Sidebar activeView={activeView} onSelectView={setActiveView} userRole={user.role} />

      <div className="main-content">
        {/* Top bar with authenticated user profile & logout */}
        <header className="topbar">
          <h1 className="topbar-title">{viewTitles[activeView]}</h1>
          <div className="topbar-right">
            <StatusPill status={status} />

            {/* Authenticated user pill */}
            <div className="user-profile-badge" id="authenticated-user-badge">
              <div className="user-avatar" aria-hidden="true">
                {userInitials}
              </div>
              <div className="user-info-col">
                <span className="user-name">{user.fullName}</span>
                <span className="user-role-tag">{user.role}</span>
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              className="logout-button"
              id="logout-button"
              onClick={() => void onLogout()}
              aria-label="Log out of application"
            >
              <span aria-hidden="true">🚪</span> Log Out
            </button>
          </div>
        </header>

        {/* Page body */}
        <main className="page-body" id="main-content">
          {activeView === 'students' && <StudentManagement />}
          {activeView === 'companies' && <CompanyManagement />}
          {activeView === 'academics' && <AcademicManagement />}
          {activeView === 'dashboard' && (
            <>
              {/* Welcome banner personalized to authenticated user */}
              <section className="welcome-banner" aria-labelledby="welcome-heading">
                <p className="welcome-eyebrow">Placement Intelligence Platform</p>
                <h2 className="welcome-heading" id="welcome-heading">
                  Welcome back, <span>{user.fullName}</span>
                </h2>
                <p className="welcome-sub">
                  Logged in as <strong>{user.email}</strong> ({user.role.toUpperCase()}). You have
                  authenticated access to your college placement operations.
                </p>
                <div className="phase-badge" role="note">
                  🛡️ Authenticated Session Active · HttpOnly Session Cookie Secured
                </div>
              </section>

              {/* Metric cards with quick navigation */}
              <div>
                <div className="section-header">
                  <h2 className="section-title">Overview & Modules</h2>
                  <span className="section-note">Phase 5 Academic & Student Management Ready</span>
                </div>
                <div className="card-grid">
                  {canViewStudents(user.role) && (
                    <article className="placeholder-card active-card" id="card-students">
                      <div className="card-header">
                        <div
                          className="card-icon-wrap"
                          style={{ background: 'rgba(99,102,241,0.18)' }}
                          aria-hidden="true"
                        >
                          🎓
                        </div>
                        <span className="status-pill ok">Active</span>
                      </div>
                      <div className="card-stat">
                        <div className="card-stat-value">Directory</div>
                        <div className="card-stat-label">Student Management</div>
                      </div>
                      <div className="card-placeholder-notice" style={{ marginBottom: '14px' }}>
                        Search, filter, inspect profiles, verify academic credentials, and manage
                        statuses.
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        id="open-students-btn"
                        onClick={() => setActiveView('students')}
                        style={{ width: '100%' }}
                      >
                        Open Students Directory ›
                      </button>
                    </article>
                  )}

                  {canViewCompanies(user.role) && (
                    <article className="placeholder-card active-card" id="card-companies">
                      <div className="card-header">
                        <div
                          className="card-icon-wrap"
                          style={{ background: 'rgba(56,189,248,0.18)' }}
                          aria-hidden="true"
                        >
                          🏢
                        </div>
                        <span className="status-pill ok">Active</span>
                      </div>
                      <div className="card-stat">
                        <div className="card-stat-value">Directory</div>
                        <div className="card-stat-label">Companies & Recruiters</div>
                      </div>
                      <div className="card-placeholder-notice" style={{ marginBottom: '14px' }}>
                        Browse campus employers, manage tiering and verification, and invite
                        recruiters.
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        id="open-companies-btn"
                        onClick={() => setActiveView('companies')}
                        style={{ width: '100%' }}
                      >
                        Manage Companies & Recruiters ›
                      </button>
                    </article>
                  )}

                  {canViewAcademics(user.role) && (
                    <article className="placeholder-card active-card" id="card-academics">
                      <div className="card-header">
                        <div
                          className="card-icon-wrap"
                          style={{ background: 'rgba(139,92,246,0.18)' }}
                          aria-hidden="true"
                        >
                          🏛️
                        </div>
                        <span className="status-pill ok">Active</span>
                      </div>
                      <div className="card-stat">
                        <div className="card-stat-value">Structure</div>
                        <div className="card-stat-label">Departments & Batches</div>
                      </div>
                      <div className="card-placeholder-notice" style={{ marginBottom: '14px' }}>
                        Configure degree departments and graduating cohorts for campus recruitment.
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        id="open-academics-btn"
                        onClick={() => setActiveView('academics')}
                        style={{ width: '100%' }}
                      >
                        Manage Academic Structure ›
                      </button>
                    </article>
                  )}

                  {CARDS.slice(2).map((card) => (
                    <PlaceholderCard key={card.title} {...card} />
                  ))}
                </div>
              </div>

              {/* Health check panel */}
              <HealthPanel status={status} data={data} errorMsg={errorMsg} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Full-screen Session Checking Splash ──────────────────────────────────────

function SessionCheckingScreen() {
  return (
    <div className="auth-splash-screen" role="status" aria-live="polite">
      <div className="splash-logo-mark">
        <div className="logo-icon" aria-hidden="true">
          🎯
        </div>
        <h1 className="splash-title">PlaceIQ</h1>
      </div>
      <p className="splash-text">Verifying secure session…</p>
    </div>
  );
}

// ─── Server Offline Error Screen (Requirement 1) ──────────────────────────────

function ServerOfflineScreen({
  serverError,
  onRetry,
}: {
  serverError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="auth-error-screen" role="alert">
      <div className="error-card">
        <div className="error-card-icon" aria-hidden="true">
          🔌
        </div>
        <h2 className="error-card-title">Backend Server Offline</h2>
        <p className="error-card-message">
          {serverError ||
            'Unable to connect to the Placement Platform API. Please verify the backend is running on http://localhost:4000.'}
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          Retry Connection
        </button>
      </div>
    </div>
  );
}

// ─── Main Content Controller ──────────────────────────────────────────────────

function AppContent() {
  const { user, status, serverError, retryCheck, logout } = useAuth();

  if (status === 'checking') {
    return <SessionCheckingScreen />;
  }

  if (status === 'error') {
    return <ServerOfflineScreen serverError={serverError} onRetry={retryCheck} />;
  }

  if (status === 'authenticated' && user) {
    return <DashboardLayout user={user} onLogout={logout} />;
  }

  return <LoginPage />;
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
