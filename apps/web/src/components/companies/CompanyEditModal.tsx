import { useState, type FormEvent } from 'react';
import type { CollegeCompanyProfileResponse } from '@placement-platform/contracts';
import { updateCompany, ApiError } from '../../api/companies.js';

interface CompanyEditModalProps {
  isOpen: boolean;
  company: CollegeCompanyProfileResponse | null;
  onClose: () => void;
  onSuccess: (updated: CollegeCompanyProfileResponse) => void;
}

export function CompanyEditModal({
  isOpen,
  company,
  onClose,
  onSuccess,
}: CompanyEditModalProps) {
  if (!isOpen || !company) return null;

  const [name, setName] = useState(company.primaryContact?.name ?? '');
  const [email, setEmail] = useState(company.primaryContact?.email ?? '');
  const [phone, setPhone] = useState(company.primaryContact?.phone ?? '');
  const [designation, setDesignation] = useState(company.primaryContact?.designation ?? '');
  const [notes, setNotes] = useState(company.notes ?? '');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const hasContact = name.trim() || email.trim();
    if (hasContact && (!name.trim() || !email.trim())) {
      setFormError('Both contact name and email are required if providing a primary contact.');
      return;
    }

    const payload = {
      primaryContact: hasContact
        ? {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            designation: designation.trim() || null,
          }
        : null,
      notes: notes.trim() || null,
    };

    setIsSubmitting(true);
    try {
      const updated = await updateCompany(company.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('An unexpected error occurred while updating the company.');
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
      aria-labelledby="edit-company-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="edit-company-title">
              Edit College Profile: {company.company.name}
            </h2>
            <p className="modal-subtitle">
              Modify college-specific primary contact and internal notes.
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

        {/* Informational banner about global vs college scope */}
        <div
          className="scope-banner read-only-banner"
          style={{ margin: '16px 24px 0', fontSize: '12px' }}
        >
          <span className="scope-icon" aria-hidden="true">
            ℹ️
          </span>
          <span>
            Global company master records (Name, Website, Industry) cannot be altered through
            ordinary college profile updates.
          </span>
        </div>

        {formError && (
          <div className="login-error-alert" role="alert" style={{ margin: '16px 24px 0' }}>
            <span aria-hidden="true">⚠️</span>
            <span className="error-content">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body modal-scrollable">
            <h3 className="form-section-title">Primary College Contact</h3>
            <div className="form-group">
              <label htmlFor="edit-contact-name" className="form-label">
                Contact Person Name
              </label>
              <input
                id="edit-contact-name"
                type="text"
                className="form-input"
                placeholder="e.g. Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-contact-email" className="form-label">
                Contact Email
              </label>
              <input
                id="edit-contact-email"
                type="email"
                className="form-input"
                placeholder="priya.sharma@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="edit-contact-phone" className="form-label">
                  Contact Phone
                </label>
                <input
                  id="edit-contact-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-contact-designation" className="form-label">
                  Designation
                </label>
                <input
                  id="edit-contact-designation"
                  type="text"
                  className="form-input"
                  placeholder="Campus Lead"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <h3 className="form-section-title">Internal College Notes</h3>
            <div className="form-group">
              <label htmlFor="edit-company-notes" className="form-label">
                Notes & Instructions
              </label>
              <textarea
                id="edit-company-notes"
                className="form-input"
                rows={3}
                placeholder="Add internal placement team notes or policy notes."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
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
              id="submit-update-company"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
