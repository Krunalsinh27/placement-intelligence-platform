import { useState, type FormEvent } from 'react';
import type { StudentProfileResponse, StudentStatus } from '@placement-platform/contracts';
import { updateStudentStatus, ApiError } from '../../api/students.js';

interface StudentStatusModalProps {
  student: StudentProfileResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: StudentProfileResponse) => void;
}

export function StudentStatusModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: StudentStatusModalProps) {
  const [status, setStatus] = useState<StudentStatus>(student.status);
  const [reason, setReason] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const updated = await updateStudentStatus(student.id, {
        status,
        reason: reason.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to update student placement status. Please try again.');
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
      aria-labelledby="status-modal-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="status-modal-title">
              Update Placement Status
            </h2>
            <p className="modal-subtitle">
              Update campus placement eligibility or employment status for this student.
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
              <span className="target-cgpa">Current: {student.status.toUpperCase()}</span>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="student-status-select" className="form-label">
                New Placement Status <span className="required-star">*</span>
              </label>
              <select
                id="student-status-select"
                className="form-input form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentStatus)}
                disabled={isSubmitting}
              >
                <option value="unplaced">Unplaced (Actively Seeking Placement)</option>
                <option value="placed">Placed (Received Job Offer)</option>
                <option value="opted_out">Opted Out (Higher Studies / Family Business)</option>
                <option value="blocked">Blocked (Disciplinary / Debarred)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status-reason" className="form-label">
                Reason / Company Note (Optional)
              </label>
              <textarea
                id="status-reason"
                className="form-input form-textarea"
                rows={3}
                placeholder="e.g. Placed at Microsoft with 32 LPA CTC package, or Opted out for MS abroad."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                disabled={isSubmitting}
              />
              <span className="form-field-hint">Max 500 characters. Recorded in audit log.</span>
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
              id="confirm-status-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="spinner-dot" aria-hidden="true" />
                  Updating…
                </span>
              ) : (
                'Save Status'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
