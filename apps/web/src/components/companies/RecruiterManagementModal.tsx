import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type {
  CollegeCompanyProfileResponse,
  RecruiterAssociationResponse,
  CompanyRecruiterRole,
  PaginatedRecruiterListResponse,
} from '@placement-platform/contracts';
import {
  listRecruiters,
  inviteRecruiter,
  resendRecruiterInvitation,
  revokeRecruiterInvitation,
  deactivateRecruiter,
  ApiError,
} from '../../api/companies.js';

interface RecruiterManagementModalProps {
  isOpen: boolean;
  company: CollegeCompanyProfileResponse | null;
  onClose: () => void;
}

export function RecruiterManagementModal({
  isOpen,
  company,
  onClose,
}: RecruiterManagementModalProps) {
  if (!isOpen || !company) return null;

  const [recruiters, setRecruiters] = useState<RecruiterAssociationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<CompanyRecruiterRole>('company_recruiter');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generated token display state (displayed securely on screen once)
  const [generatedToken, setGeneratedToken] = useState<{
    token: string;
    expiresAt?: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'deactivate';
    recruiter: RecruiterAssociationResponse;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch recruiters
  const loadRecruiters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedRecruiterListResponse = await listRecruiters(company.companyId, {
        limit: 50,
      });
      setRecruiters(res.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load recruiter roster.');
      }
    } finally {
      setLoading(false);
    }
  }, [company.companyId]);

  useEffect(() => {
    void loadRecruiters();
  }, [loadRecruiters]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (!name.trim() || !email.trim()) {
      setInviteError('Name and email are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await inviteRecruiter(company.companyId, {
        companyId: company.companyId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim() || undefined,
        designation: designation.trim() || undefined,
      });

      if (result.invitationToken) {
        setGeneratedToken({
          token: result.invitationToken,
          expiresAt: result.invitationExpiresAt,
          email: result.recruiter.email,
        });
      }

      setName('');
      setEmail('');
      setPhone('');
      setDesignation('');
      setRole('company_recruiter');
      setShowInviteForm(false);
      await loadRecruiters();
    } catch (err) {
      if (err instanceof ApiError) {
        setInviteError(err.message);
      } else {
        setInviteError('Failed to invite recruiter.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (recruiter: RecruiterAssociationResponse) => {
    try {
      const result = await resendRecruiterInvitation(company.companyId, recruiter.id);
      if (result.invitationToken) {
        setGeneratedToken({
          token: result.invitationToken,
          expiresAt: result.invitationExpiresAt,
          email: recruiter.email,
        });
      }
      await loadRecruiters();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to resend invitation.');
      }
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'revoke') {
        await revokeRecruiterInvitation(company.companyId, confirmAction.recruiter.id);
      } else {
        await deactivateRecruiter(company.companyId, confirmAction.recruiter.id);
      }
      setConfirmAction(null);
      await loadRecruiters();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(`Failed to ${confirmAction.type} recruiter.`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedToken) return;
    void navigator.clipboard.writeText(generatedToken.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recruiter-modal-title"
    >
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="recruiter-modal-title">
              Recruiters: {company.company.name}
            </h2>
            <p className="modal-subtitle">
              Manage authorized recruiters, interviewers, and pending invitations for this company.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body modal-scrollable" style={{ padding: '20px 24px' }}>
          {error && (
            <div className="login-error-alert" role="alert" style={{ marginBottom: '16px' }}>
              <span aria-hidden="true">⚠️</span>
              <span className="error-content">{error}</span>
            </div>
          )}

          {/* Secure one-time token display banner */}
          {generatedToken && (
            <div
              className="scope-banner"
              style={{
                marginBottom: '16px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
                color: '#86efac',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px',
              }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span aria-hidden="true">🎉</span>
                <strong>Invitation Generated for {generatedToken.email}</strong>
              </div>
              <p style={{ fontSize: '12px', color: '#bbf7d0', margin: 0 }}>
                Copy the 256-bit invitation token below. For security, this raw token is never
                logged or stored in persistent browser storage:
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  marginTop: '4px',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={generatedToken.token}
                  className="form-input"
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    background: '#0d1117',
                    color: '#4ade80',
                  }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '6px 14px', fontSize: '12px' }}
                  onClick={copyToClipboard}
                >
                  {copied ? '✓ Copied' : 'Copy Token'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  onClick={() => setGeneratedToken(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Confirmation dialog overlay */}
          {confirmAction && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ color: '#fca5a5', marginBottom: '6px', fontSize: '14px' }}>
                Confirm {confirmAction.type === 'revoke' ? 'Revocation' : 'Deactivation'}
              </h4>
              <p style={{ color: '#fecaca', fontSize: '13px', marginBottom: '12px' }}>
                Are you sure you want to {confirmAction.type} recruiter{' '}
                <strong>{confirmAction.recruiter.name}</strong> ({confirmAction.recruiter.email})?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-danger"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : `Yes, ${confirmAction.type}`}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => setConfirmAction(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {recruiters.length} recruiter{recruiters.length === 1 ? '' : 's'} registered
            </span>
            <button
              type="button"
              className="btn-primary"
              id="open-invite-form-btn"
              style={{ fontSize: '12px', padding: '6px 14px' }}
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              {showInviteForm ? 'Cancel Invitation' : '+ Invite Recruiter'}
            </button>
          </div>

          {/* Collapsible Invite Form */}
          {showInviteForm && (
            <form
              onSubmit={handleInvite}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                Send Recruiter Invitation
              </h4>

              {inviteError && (
                <div className="login-error-alert" style={{ marginBottom: '12px' }}>
                  <span aria-hidden="true">⚠️</span>
                  <span className="error-content">{inviteError}</span>
                </div>
              )}

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="rec-name" className="form-label">
                    Recruiter Full Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="rec-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rec-email" className="form-label">
                    Email Address <span className="required-star">*</span>
                  </label>
                  <input
                    id="rec-email"
                    type="email"
                    className="form-input"
                    placeholder="alex.mercer@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label htmlFor="rec-role" className="form-label">
                    Recruiter Role <span className="required-star">*</span>
                  </label>
                  <select
                    id="rec-role"
                    className="form-input form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as CompanyRecruiterRole)}
                    disabled={isSubmitting}
                  >
                    <option value="company_recruiter">Company Recruiter</option>
                    <option value="interviewer">Technical Interviewer</option>
                    <option value="company_admin">Company Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="rec-phone" className="form-label">
                    Phone (Optional)
                  </label>
                  <input
                    id="rec-phone"
                    type="tel"
                    className="form-input"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rec-desig" className="form-label">
                    Designation (Optional)
                  </label>
                  <input
                    id="rec-desig"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Talent Lead"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => setShowInviteForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  id="submit-send-invite"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Generate & Send Invitation'}
                </button>
              </div>
            </form>
          )}

          {/* Recruiter Roster Table */}
          {loading ? (
            <div className="table-loading-container" style={{ padding: '32px' }}>
              <div className="loading-spinner" aria-hidden="true" />
              <p>Loading recruiters...</p>
            </div>
          ) : recruiters.length === 0 ? (
            <div className="empty-state-card" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon" aria-hidden="true">
                👥
              </div>
              <h3 className="empty-state-title">No recruiters invited yet</h3>
              <p className="empty-state-desc">
                Invite campus coordinators or interviewers from {company.company.name} to manage
                drives and review applicant shortlists.
              </p>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table" aria-label="Recruiter roster">
                <thead>
                  <tr>
                    <th>Recruiter Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined / Invited</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiters.map((recruiter) => {
                    const isPending = recruiter.status === 'pending_invitation';
                    const isActive = recruiter.status === 'active';
                    const isInactive = recruiter.status === 'inactive';

                    return (
                      <tr key={recruiter.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{recruiter.name}</div>
                          {recruiter.designation && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {recruiter.designation}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px' }}>{recruiter.email}</td>
                        <td>
                          <span
                            className="counter-badge"
                            style={{
                              textTransform: 'capitalize',
                              background:
                                recruiter.role === 'company_admin'
                                  ? 'rgba(139, 92, 246, 0.15)'
                                  : 'rgba(99, 102, 241, 0.15)',
                              color:
                                recruiter.role === 'company_admin' ? '#c4b5fd' : '#a5b4fc',
                            }}
                          >
                            {recruiter.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              background: isActive
                                ? 'rgba(34, 197, 94, 0.15)'
                                : isPending
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(148, 163, 184, 0.15)',
                              color: isActive
                                ? '#4ade80'
                                : isPending
                                  ? '#fbbf24'
                                  : '#94a3b8',
                            }}
                          >
                            {recruiter.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {new Date(recruiter.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => void handleResend(recruiter)}
                                  title="Resend invitation token"
                                >
                                  Resend
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() =>
                                    setConfirmAction({ type: 'revoke', recruiter })
                                  }
                                  title="Revoke invitation"
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                            {isActive && (
                              <button
                                type="button"
                                className="btn-danger"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() =>
                                  setConfirmAction({ type: 'deactivate', recruiter })
                                }
                                title="Deactivate recruiter"
                              >
                                Deactivate
                              </button>
                            )}
                            {isInactive && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => void handleResend(recruiter)}
                                title="Re-issue invitation"
                              >
                                Re-invite
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
