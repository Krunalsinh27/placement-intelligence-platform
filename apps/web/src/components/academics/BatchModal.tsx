import { useState, type FormEvent } from 'react';
import {
  AcademicBatchCreateSchema,
  AcademicBatchUpdateSchema,
  type AcademicBatchResponse,
  type AcademicBatchStatus,
} from '@placement-platform/contracts';
import { createBatch, updateBatch, ApiError } from '../../api/academics.js';

interface BatchModalProps {
  batch?: AcademicBatchResponse | null; // If provided, edit mode; otherwise create mode
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batch: AcademicBatchResponse) => void;
}

export function BatchModal({ batch, isOpen, onClose, onSuccess }: BatchModalProps) {
  const isEdit = Boolean(batch);
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(batch?.name ?? '');
  const [startYear, setStartYear] = useState<number>(batch?.startYear ?? currentYear);
  const [graduationYear, setGraduationYear] = useState<number>(
    batch?.graduationYear ?? currentYear + 4
  );
  const [status, setStatus] = useState<AcademicBatchStatus>(batch?.status ?? 'active');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    startYear?: string;
    graduationYear?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (isEdit && batch) {
      const validation = AcademicBatchUpdateSchema.safeParse({
        name: name.trim(),
        startYear: Number(startYear),
        graduationYear: Number(graduationYear),
        status,
      });

      if (!validation.success) {
        const errors: { name?: string; startYear?: string; graduationYear?: string } = {};
        for (const issue of validation.error.issues) {
          if (issue.path[0] === 'name') errors.name = issue.message;
          if (issue.path[0] === 'startYear') errors.startYear = issue.message;
          if (issue.path[0] === 'graduationYear') errors.graduationYear = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        const updated = await updateBatch(batch.id, validation.data);
        onSuccess(updated);
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred while updating the batch.');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const validation = AcademicBatchCreateSchema.safeParse({
        name: name.trim(),
        startYear: Number(startYear),
        graduationYear: Number(graduationYear),
        status,
      });

      if (!validation.success) {
        const errors: { name?: string; startYear?: string; graduationYear?: string } = {};
        for (const issue of validation.error.issues) {
          if (issue.path[0] === 'name') errors.name = issue.message;
          if (issue.path[0] === 'startYear') errors.startYear = issue.message;
          if (issue.path[0] === 'graduationYear') errors.graduationYear = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        const created = await createBatch(validation.data);
        onSuccess(created);
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred while creating the batch.');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-modal-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="batch-modal-title">
              {isEdit ? 'Edit Academic Batch' : 'Create Academic Batch'}
            </h2>
            <p className="modal-subtitle">
              {isEdit
                ? 'Update academic graduating batch details.'
                : 'Define a new graduating cohort for placement operations.'}
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="batch-name" className="form-label">
                Batch Name <span className="required-star">*</span>
              </label>
              <input
                id="batch-name"
                type="text"
                className={`form-input${fieldErrors.name ? ' input-error' : ''}`}
                placeholder="e.g. Class of 2026"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                disabled={isSubmitting}
                required
              />
              {fieldErrors.name && (
                <span className="form-field-error" role="alert">
                  {fieldErrors.name}
                </span>
              )}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="batch-start-year" className="form-label">
                  Start Year <span className="required-star">*</span>
                </label>
                <input
                  id="batch-start-year"
                  type="number"
                  min={1990}
                  max={2100}
                  className={`form-input${fieldErrors.startYear ? ' input-error' : ''}`}
                  value={startYear}
                  onChange={(e) => {
                    setStartYear(parseInt(e.target.value, 10));
                    if (fieldErrors.startYear) {
                      setFieldErrors((prev) => ({ ...prev, startYear: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.startYear && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors.startYear}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="batch-grad-year" className="form-label">
                  Graduation Year <span className="required-star">*</span>
                </label>
                <input
                  id="batch-grad-year"
                  type="number"
                  min={1990}
                  max={2100}
                  className={`form-input${fieldErrors.graduationYear ? ' input-error' : ''}`}
                  value={graduationYear}
                  onChange={(e) => {
                    setGraduationYear(parseInt(e.target.value, 10));
                    if (fieldErrors.graduationYear) {
                      setFieldErrors((prev) => ({ ...prev, graduationYear: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.graduationYear && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors.graduationYear}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="batch-status" className="form-label">
                Batch Status
              </label>
              <select
                id="batch-status"
                className="form-input form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as AcademicBatchStatus)}
                disabled={isSubmitting}
              >
                <option value="active">Active (Currently Enrolled)</option>
                <option value="graduated">Graduated (Alumni)</option>
                <option value="archived">Archived</option>
              </select>
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
              id="submit-batch-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="spinner-dot" aria-hidden="true" />
                  Saving…
                </span>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Batch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
