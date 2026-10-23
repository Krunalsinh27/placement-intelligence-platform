import { useState, type FormEvent } from 'react';
import {
  CompanyCreateSchema,
  type CollegeCompanyProfileResponse,
  type CompanyTier,
} from '@placement-platform/contracts';
import { createCompany, ApiError } from '../../api/companies.js';

interface CompanyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (company: CollegeCompanyProfileResponse) => void;
}

export function CompanyCreateModal({ isOpen, onClose, onSuccess }: CompanyCreateModalProps) {
  // Global company fields
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [addressLine, setAddressLine] = useState('');

  // College-specific relationship fields
  const [tier, setTier] = useState<CompanyTier>('tier_3');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [notes, setNotes] = useState('');

  // Form states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const rawPayload = {
      name: name.trim(),
      legalName: legalName.trim() || undefined,
      website: website.trim() || undefined,
      industry: industry.trim(),
      description: description.trim() || undefined,
      tier,
      location:
        city || state || addressLine
          ? {
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              country: country.trim() || undefined,
              addressLine: addressLine.trim() || undefined,
            }
          : undefined,
      primaryContact:
        contactName.trim() || contactEmail.trim()
          ? {
              name: contactName.trim(),
              email: contactEmail.trim(),
              phone: contactPhone.trim() || undefined,
              designation: contactDesignation.trim() || undefined,
            }
          : undefined,
      notes: notes.trim() || undefined,
    };

    const parsed = CompanyCreateSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      setFormError('Please resolve the errors highlighted below.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createCompany(parsed.data);
      onSuccess(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'COMPANY_DATA_CONFLICT') {
          setFormError(`Company Conflict: ${err.message}`);
        } else if (err.code === 'DUPLICATE_RESOURCE') {
          setFormError('This company is already registered in your college directory.');
        } else {
          setFormError(err.message);
        }
        if (err.details) {
          const errors: Record<string, string> = {};
          for (const d of err.details) {
            if (d.path) errors[d.path] = d.issue;
          }
          setFieldErrors(errors);
        }
      } else {
        setFormError('An unexpected error occurred while registering the company.');
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
      aria-labelledby="create-company-title"
    >
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="create-company-title">
              Register Company
            </h2>
            <p className="modal-subtitle">
              Add a recruiting partner to your college placement directory.
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
          <div className="modal-body modal-scrollable">
            {/* Section 1: Global Master Details */}
            <h3 className="form-section-title">1. Company Master Details</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="comp-name" className="form-label">
                  Company Name <span className="required-star">*</span>
                </label>
                <input
                  id="comp-name"
                  type="text"
                  className={`form-input${fieldErrors['name'] ? ' input-error' : ''}`}
                  placeholder="e.g. Infosys, Google"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['name'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['name']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="comp-website" className="form-label">
                  Website URL
                </label>
                <input
                  id="comp-website"
                  type="url"
                  className={`form-input${fieldErrors['website'] ? ' input-error' : ''}`}
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={isSubmitting}
                />
                {fieldErrors['website'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['website']}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="comp-industry" className="form-label">
                  Industry / Domain <span className="required-star">*</span>
                </label>
                <input
                  id="comp-industry"
                  type="text"
                  className={`form-input${fieldErrors['industry'] ? ' input-error' : ''}`}
                  placeholder="e.g. Software Engineering, FinTech"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['industry'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['industry']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="comp-legal-name" className="form-label">
                  Legal / Registered Name
                </label>
                <input
                  id="comp-legal-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Technologies India Pvt Ltd"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="comp-description" className="form-label">
                Company Description
              </label>
              <textarea
                id="comp-description"
                className="form-input"
                rows={2}
                placeholder="Brief summary of company focus, hiring patterns, or domain."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Location fields */}
            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="comp-city" className="form-label">
                  City
                </label>
                <input
                  id="comp-city"
                  type="text"
                  className="form-input"
                  placeholder="Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comp-state" className="form-label">
                  State
                </label>
                <input
                  id="comp-state"
                  type="text"
                  className="form-input"
                  placeholder="Karnataka"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comp-country" className="form-label">
                  Country
                </label>
                <input
                  id="comp-country"
                  type="text"
                  className="form-input"
                  placeholder="India"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label htmlFor="comp-address" className="form-label">
                Address / Street / Tech Park (Optional)
              </label>
              <input
                id="comp-address"
                type="text"
                className="form-input"
                placeholder="e.g. Manyata Embassy Business Park, Outer Ring Rd"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Section 2: College Partnership Profile */}
            <h3 className="form-section-title">2. College Placement Profile & Tier</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="comp-tier" className="form-label">
                  Recruiter Tier <span className="required-star">*</span>
                </label>
                <select
                  id="comp-tier"
                  className="form-input form-select"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as CompanyTier)}
                  disabled={isSubmitting}
                >
                  <option value="tier_1">Tier 1 (Dream / Top Compensation)</option>
                  <option value="tier_2">Tier 2 (High Potential)</option>
                  <option value="tier_3">Tier 3 (Standard Campus Recruiter)</option>
                  <option value="mass_recruiter">Mass Recruiter</option>
                  <option value="startup">Startup</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="comp-notes" className="form-label">
                  Internal College Notes
                </label>
                <input
                  id="comp-notes"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Visited in 2025, requires CGPA > 7.5"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Section 3: Primary Contact Person */}
            <h3 className="form-section-title">3. Primary Campus Contact (Optional)</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="comp-contact-name" className="form-label">
                  Contact Person Name
                </label>
                <input
                  id="comp-contact-name"
                  type="text"
                  className={`form-input${fieldErrors['primaryContact.name'] ? ' input-error' : ''}`}
                  placeholder="e.g. Priya Sharma"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={isSubmitting}
                />
                {fieldErrors['primaryContact.name'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['primaryContact.name']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="comp-contact-email" className="form-label">
                  Contact Email
                </label>
                <input
                  id="comp-contact-email"
                  type="email"
                  className={`form-input${fieldErrors['primaryContact.email'] ? ' input-error' : ''}`}
                  placeholder="priya.sharma@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isSubmitting}
                />
                {fieldErrors['primaryContact.email'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['primaryContact.email']}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="comp-contact-phone" className="form-label">
                  Contact Phone
                </label>
                <input
                  id="comp-contact-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="comp-contact-designation" className="form-label">
                  Designation / Role
                </label>
                <input
                  id="comp-contact-designation"
                  type="text"
                  className="form-input"
                  placeholder="Lead Campus Recruiter"
                  value={contactDesignation}
                  onChange={(e) => setContactDesignation(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
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
              id="submit-register-company"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
