import { useState, type FormEvent } from 'react';
import { LoginRequestSchema } from '@placement-platform/contracts';
import { useAuth } from '../../context/AuthContext.js';

export function LoginPage() {
  const { login, loginError, isSubmitting, clearLoginError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const isDev = import.meta.env.DEV;

  const handleFillDemo = () => {
    setEmail('tpo.demo@example.com');
    setPassword('Password123!');
    setFieldErrors({});
    clearLoginError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearLoginError();

    // Client-side validation using shared Zod contracts
    const validation = LoginRequestSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0] === 'email') {
          errors.email = issue.message;
        } else if (issue.path[0] === 'password') {
          errors.password = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    await login({ email, password });
  };

  return (
    <div className="login-container">
      <div className="login-card" id="login-card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo-icon" aria-hidden="true">
            🎯
          </div>
          <div className="login-brand-text">
            <h1 className="login-title">PlaceIQ</h1>
            <p className="login-subtitle">Placement Intelligence Platform</p>
          </div>
        </div>

        <div className="login-card-header">
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-instruction">
            Sign in to manage collegiate placement operations
          </p>
        </div>

        {/* Global Error Banner */}
        {loginError && (
          <div className="login-error-alert" role="alert" id="login-error-message">
            <span className="error-icon" aria-hidden="true">
              ⚠️
            </span>
            <div className="error-content">
              <span>{loginError}</span>
            </div>
            <button
              type="button"
              className="error-dismiss"
              onClick={clearLoginError}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              College Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              className={`form-input${fieldErrors.email ? ' input-error' : ''}`}
              placeholder="e.g. tpo@college.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              disabled={isSubmitting}
              required
            />
            {fieldErrors.email && (
              <span className="form-field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
            </div>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`form-input password-input${
                  fieldErrors.password ? ' input-error' : ''
                }`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="form-field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-submit-btn"
            id="login-submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <span className="spinner-dot" aria-hidden="true" />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Development Demo Credentials Helper (DEV ONLY) */}
        {isDev && (
          <div className="demo-credentials-box">
            <div className="demo-credentials-header">
              <span className="demo-tag">Development Helper</span>
              <button
                type="button"
                className="demo-autofill-btn"
                onClick={handleFillDemo}
              >
                Auto-fill Demo TPO
              </button>
            </div>
            <p className="demo-credentials-text">
              <strong>Email:</strong> tpo.demo@example.com <br />
              <strong>Password:</strong> Password123!
            </p>
          </div>
        )}

        <div className="login-footer">
          <p className="security-notice">
            🔒 Protected by PlaceIQ Enterprise Security & HttpOnly Session Cookies.
          </p>
        </div>
      </div>
    </div>
  );
}
