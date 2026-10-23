import { useState, type FormEvent } from 'react';
import type { StudentProfileResponse } from '@placement-platform/contracts';
import { verifyStudent, ApiError } from '../../api/students.js';

interface StudentVerifyModalProps {
  student: StudentProfileResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: StudentProfileResponse) => void;
}

export function StudentVerifyModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: StudentVerifyModalProps) {
  const [isVerified, setIsVerified] = useState<boolean>(!student.isVerified);
  const [remarks, setRemarks] = useState<string>(student.verificationDetails?.remarks ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const updated = await verifyStudent(student.id, {
        isVerified,
        remarks: remarks.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to update student verification status. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="verify-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="verify-modal-title">
              Verify Academic Records
            </h2>
            <p className="modal-subtitle">
              Verify student academic documents and credentials for placement drives.
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
          <div className="modal-body">
            <div className="verification-target-card">
              <span className="target-name">
                {student.personalDetails.firstName} {student.personalDetails.lastName}
              </span>
              <span className="target-enrollment">{student.enrollmentNumber}</span>
              <span className="target-cgpa">CGPA: {student.academicRecords.currentCgpa}</span>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Verification Status Action</label>
              <div className="radio-group-cards">
                <label className={`radio-card${isVerified ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="verification-status"
                    checked={isVerified}
                    onChange={() => setIsVerified(true)}
                  />
                  <div>
                    <span className="radio-card-title">✅ Verified</span>
                    <span className="radio-card-desc">
                      Marksheets and eligibility confirmed accurate.
                    </span>
                  </div>
                </label>

                <label className={`radio-card${!isVerified ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="verification-status"
                    checked={!isVerified}
                    onChange={() => setIsVerified(false)}
                  />
                  <div>
                    <span className="radio-card-title">⚠️ Unverified</span>
                    <span className="radio-card-desc">
                      Requires re-verification or pending documentation.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="verify-remarks" className="form-label">
                Remarks / Audit Note (Optional)
              </label>
              <textarea
                id="verify-remarks"
                className="form-input form-textarea"
                rows={3}
                placeholder="e.g. Verified against original semester marksheets."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={500}
                disabled={isSubmitting}
              />
              <span className="form-field-hint">Max 500 characters.</span>
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
              id="confirm-verify-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="spinner-dot" aria-hidden="true" />
                  Updating…
                </span>
              ) : isVerified ? (
                'Confirm Verification'
              ) : (
                'Unverify Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
