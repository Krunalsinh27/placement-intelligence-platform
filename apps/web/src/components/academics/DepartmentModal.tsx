import { useState, type FormEvent } from 'react';
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  type DepartmentResponse,
  type DepartmentStatus,
} from '@placement-platform/contracts';
import { createDepartment, updateDepartment, ApiError } from '../../api/academics.js';

interface DepartmentModalProps {
  department?: DepartmentResponse | null; // If provided, edit mode; otherwise create mode
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dept: DepartmentResponse) => void;
}

export function DepartmentModal({ department, isOpen, onClose, onSuccess }: DepartmentModalProps) {
  const isEdit = Boolean(department);

  const [name, setName] = useState(department?.name ?? '');
  const [code, setCode] = useState(department?.code ?? '');
  const [status, setStatus] = useState<DepartmentStatus>(department?.status ?? 'active');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (isEdit && department) {
      // Validate update payload
      const validation = DepartmentUpdateSchema.safeParse({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        status,
      });

      if (!validation.success) {
        const errors: { name?: string; code?: string } = {};
        for (const issue of validation.error.issues) {
          if (issue.path[0] === 'name') errors.name = issue.message;
          if (issue.path[0] === 'code') errors.code = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        const updated = await updateDepartment(department.id, validation.data);
        onSuccess(updated);
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred while updating the department.');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Validate create payload
      const validation = DepartmentCreateSchema.safeParse({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        status,
      });

      if (!validation.success) {
        const errors: { name?: string; code?: string } = {};
        for (const issue of validation.error.issues) {
          if (issue.path[0] === 'name') errors.name = issue.message;
          if (issue.path[0] === 'code') errors.code = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        const created = await createDepartment(validation.data);
        onSuccess(created);
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred while creating the department.');
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
      aria-labelledby="dept-modal-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="dept-modal-title">
              {isEdit ? 'Edit Department' : 'Create Department'}
            </h2>
            <p className="modal-subtitle">
              {isEdit
                ? 'Update academic department information.'
                : 'Add a new academic department to your college.'}
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
              <label htmlFor="dept-name" className="form-label">
                Department Name <span className="required-star">*</span>
              </label>
              <input
                id="dept-name"
                type="text"
                className={`form-input${fieldErrors.name ? ' input-error' : ''}`}
                placeholder="e.g. Computer Science and Engineering"
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

            <div className="form-group">
              <label htmlFor="dept-code" className="form-label">
                Department Code <span className="required-star">*</span>
              </label>
              <input
                id="dept-code"
                type="text"
                className={`form-input${fieldErrors.code ? ' input-error' : ''}`}
                placeholder="e.g. CSE"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
                }}
                disabled={isSubmitting}
                maxLength={10}
                required
              />
              <span className="form-field-hint">2 to 10 uppercase alphanumeric characters.</span>
              {fieldErrors.code && (
                <span className="form-field-error" role="alert">
                  {fieldErrors.code}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="dept-status" className="form-label">
                Status
              </label>
              <select
                id="dept-status"
                className="form-input form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as DepartmentStatus)}
                disabled={isSubmitting}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
              id="submit-department-btn"
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
                'Create Department'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
