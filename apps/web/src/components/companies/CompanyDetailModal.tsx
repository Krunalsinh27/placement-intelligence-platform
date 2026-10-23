import type { CollegeCompanyProfileResponse } from '@placement-platform/contracts';

interface CompanyDetailModalProps {
  isOpen: boolean;
  company: CollegeCompanyProfileResponse | null;
  canManage: boolean;
  onClose: () => void;
  onOpenEdit: () => void;
  onOpenVerify: () => void;
  onOpenTier: () => void;
  onOpenRecruiters: () => void;
}

export function CompanyDetailModal({
  isOpen,
  company,
  canManage,
  onClose,
  onOpenEdit,
  onOpenVerify,
  onOpenTier,
  onOpenRecruiters,
}: CompanyDetailModalProps) {
  if (!isOpen || !company) return null;

  const { company: master } = company;

  const isVerified = company.status === 'verified';
  const isBlacklisted = company.status === 'blacklisted';
  const isPending = company.status === 'pending_verification';

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-company-title"
    >
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="detail-company-title">
              {master.name}
            </h2>
            <p className="modal-subtitle">
              {master.industry} · Registered on {new Date(company.createdAt).toLocaleDateString()}
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
          {/* Status & Tier Header Banner */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Status:</span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  background: isVerified
                    ? 'rgba(34, 197, 94, 0.15)'
                    : isBlacklisted
                      ? 'rgba(239, 68, 68, 0.15)'
                      : isPending
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(148, 163, 184, 0.15)',
                  color: isVerified
                    ? '#4ade80'
                    : isBlacklisted
                      ? '#f87171'
                      : isPending
                        ? '#fbbf24'
                        : '#94a3b8',
                }}
              >
                {company.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Tier:</span>
              <span
                className="counter-badge"
                style={{ textTransform: 'capitalize', fontSize: '11px' }}
              >
                {company.tier.replace('_', ' ')}
              </span>
            </div>

            {master.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Website:</span>
                <a
                  href={master.website}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--color-accent)', fontSize: '12px', textDecoration: 'none' }}
                >
                  {master.website} ↗
                </a>
              </div>
            )}
          </div>

          {/* Section 1: Global Master Information */}
          <h3 className="form-section-title">1. Global Master Details</h3>
          <div
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '13px',
            }}
          >
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Legal Name
              </span>
              <strong>{master.legalName || '—'}</strong>
            </div>
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Industry
              </span>
              <strong>{master.industry}</strong>
            </div>
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Location
              </span>
              <strong>
                {[master.location?.city, master.location?.state, master.location?.country]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </strong>
            </div>
            {master.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span
                  style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
                >
                  Description
                </span>
                <p style={{ marginTop: '4px', lineHeight: 1.5, color: 'var(--color-text)' }}>
                  {master.description}
                </p>
              </div>
            )}
          </div>

          {/* Section 2: College Relationship & Primary Contact */}
          <h3 className="form-section-title">2. College Primary Contact & Notes</h3>
          <div
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '13px',
            }}
          >
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Contact Name
              </span>
              <strong>{company.primaryContact?.name || '—'}</strong>
            </div>
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Contact Email
              </span>
              <strong>{company.primaryContact?.email || '—'}</strong>
            </div>
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Contact Phone
              </span>
              <strong>{company.primaryContact?.phone || '—'}</strong>
            </div>
            <div>
              <span
                style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
              >
                Designation
              </span>
              <strong>{company.primaryContact?.designation || '—'}</strong>
            </div>
            {company.notes && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <span
                  style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}
                >
                  College Notes
                </span>
                <p style={{ marginTop: '4px', lineHeight: 1.5, color: 'var(--color-text)' }}>
                  {company.notes}
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Verification Audit */}
          {company.verificationDetails && (
            <>
              <h3 className="form-section-title">3. Verification & Governance Details</h3>
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                {company.verificationDetails.verifiedAt && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                      Verified On:{' '}
                    </span>
                    <strong>
                      {new Date(company.verificationDetails.verifiedAt).toLocaleDateString()}
                    </strong>
                  </div>
                )}
                {company.verificationDetails.remarks && (
                  <div>
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '11px',
                        display: 'block',
                      }}
                    >
                      Remarks:
                    </span>
                    <p
                      style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--color-text)' }}
                    >
                      "{company.verificationDetails.remarks}"
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              id="detail-manage-recruiters-btn"
              onClick={onOpenRecruiters}
            >
              👥 Manage Recruiters
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  id="detail-edit-profile-btn"
                  onClick={onOpenEdit}
                >
                  ✏️ Edit Profile
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  id="detail-verify-btn"
                  onClick={onOpenVerify}
                >
                  🛡️ Verify Status
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  id="detail-tier-btn"
                  onClick={onOpenTier}
                >
                  ⭐ Update Tier
                </button>
              </>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
