import { useState, type FormEvent } from 'react';
import type {
  CollegeCompanyProfileResponse,
  CompanyStatus,
} from '@placement-platform/contracts';
import { verifyCompany, ApiError } from '../../api/companies.js';

interface CompanyVerifyModalProps {
  isOpen: boolean;
  company: CollegeCompanyProfileResponse | null;
  onClose: () => void;
  onSuccess: (updated: CollegeCompanyProfileResponse) => void;
}

export function CompanyVerifyModal({
  isOpen,
  company,
  onClose,
  onSuccess,
}: CompanyVerifyModalProps) {
  if (!isOpen || !company) return null;

  const [targetStatus, setTargetStatus] = useState<CompanyStatus>(
    company.status === 'verified' ? 'inactive' : 'verified'
  );
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (targetStatus === company.status) {
      setFormError('Please select a status different from the current status.');
      return;
    }

    if (
      (targetStatus === 'blacklisted' || company.status === 'blacklisted') &&
      remarks.trim().length < 5
    ) {
      setFormError('A meaningful remark (minimum 5 characters) is required for blacklist transitions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await verifyCompany(company.id, {
        status: targetStatus,
        remarks: remarks.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('An unexpected error occurred while updating verification status.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-company-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="verify-company-title">
              Verification Status: {company.company.name}
            </h2>
            <p className="modal-subtitle">
              Current status: <strong style={{ textTransform: 'capitalize' }}>{company.status.replace('_', ' ')}</strong>
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

        {formError && (
          <div className="login-error-alert" role="alert" style={{ margin: '16px 24px 0' }}>
            <span aria-hidden="true">⚠️</span>
            <span className="error-content">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body modal-scrollable">
            <div className="form-group">
              <label htmlFor="verify-status-select" className="form-label">
                Target Verification Status <span className="required-star">*</span>
              </label>
              <select
                id="verify-status-select"
                className="form-input form-select"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as CompanyStatus)}
                disabled={isSubmitting}
              >
                <option value="verified">Verified (Approved for Placement Drives)</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="inactive">Inactive (Suspended)</option>
                <option value="blacklisted">Blacklisted (Disbarred from Campus)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="verify-remarks" className="form-label">
                Verification Remarks / Justification{' '}
                {targetStatus === 'blacklisted' && <span className="required-star">*</span>}
              </label>
              <textarea
                id="verify-remarks"
                className="form-input"
                rows={3}
                placeholder={
                  targetStatus === 'blacklisted'
                    ? 'Enter detailed justification for blacklisting (min 5 characters required)...'
                    : 'Optional remarks or verification reference...'
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isSubmitting}
                required={targetStatus === 'blacklisted'}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={targetStatus === 'blacklisted' ? 'btn-danger' : 'btn-primary'}
              id="submit-verify-company"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : `Set as ${targetStatus.replace('_', ' ')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
