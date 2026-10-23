import { useState, type FormEvent } from 'react';
import type {
  CollegeCompanyProfileResponse,
  CompanyTier,
} from '@placement-platform/contracts';
import { updateCompanyTier, ApiError } from '../../api/companies.js';

interface CompanyTierModalProps {
  isOpen: boolean;
  company: CollegeCompanyProfileResponse | null;
  onClose: () => void;
  onSuccess: (updated: CollegeCompanyProfileResponse) => void;
}

export function CompanyTierModal({
  isOpen,
  company,
  onClose,
  onSuccess,
}: CompanyTierModalProps) {
  if (!isOpen || !company) return null;

  const [targetTier, setTargetTier] = useState<CompanyTier>(company.tier);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (targetTier === company.tier) {
      setFormError('Please select a tier different from the current tier.');
      return;
    }

    if (reason.trim().length < 5) {
      setFormError('A meaningful reason (minimum 5 characters) is required for tier updates.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateCompanyTier(company.id, {
        tier: targetTier,
        reason: reason.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('An unexpected error occurred while updating the company tier.');
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
      aria-labelledby="tier-company-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="tier-company-title">
              Update Tier: {company.company.name}
            </h2>
            <p className="modal-subtitle">
              Current tier: <strong style={{ textTransform: 'capitalize' }}>{company.tier.replace('_', ' ')}</strong>
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
              <label htmlFor="tier-select" className="form-label">
                Target Recruiter Tier <span className="required-star">*</span>
              </label>
              <select
                id="tier-select"
                className="form-input form-select"
                value={targetTier}
                onChange={(e) => setTargetTier(e.target.value as CompanyTier)}
                disabled={isSubmitting}
              >
                <option value="tier_1">Tier 1 (Dream / Marquee)</option>
                <option value="tier_2">Tier 2 (High Potential)</option>
                <option value="tier_3">Tier 3 (Standard)</option>
                <option value="mass_recruiter">Mass Recruiter</option>
                <option value="startup">Startup</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tier-reason" className="form-label">
                Justification / Reason <span className="required-star">*</span>
              </label>
              <textarea
                id="tier-reason"
                className="form-input"
                rows={3}
                placeholder="Enter justification for tier reassignment (minimum 5 characters)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                required
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
              className="btn-primary"
              id="submit-tier-company"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Save New Tier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
