import { useState, type FormEvent } from 'react';
import {
  StudentProfileCreateSchema,
  type StudentProfileResponse,
  type StudentGender,
  type DepartmentResponse,
  type AcademicBatchResponse,
} from '@placement-platform/contracts';
import { createStudent, ApiError } from '../../api/students.js';

interface StudentCreateModalProps {
  isOpen: boolean;
  departments: DepartmentResponse[];
  batches: AcademicBatchResponse[];
  onClose: () => void;
  onSuccess: (student: StudentProfileResponse) => void;
}

export function StudentCreateModal({
  isOpen,
  departments,
  batches,
  onClose,
  onSuccess,
}: StudentCreateModalProps) {
  // Form fields
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');

  // Personal details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<StudentGender>('male');
  const [dob, setDob] = useState('');

  // Academic records
  const [currentCgpa, setCurrentCgpa] = useState<string>('8.0');
  const [tenthPercentage, setTenthPercentage] = useState<string>('85.0');
  const [twelfthPercentage, setTwelfthPercentage] = useState<string>('85.0');
  const [diplomaPercentage, setDiplomaPercentage] = useState<string>('');
  const [activeBacklogs, setActiveBacklogs] = useState<string>('0');
  const [historyBacklogs, setHistoryBacklogs] = useState<string>('0');
  const [gapYears, setGapYears] = useState<string>('0');

  // Skills
  const [skillsRaw, setSkillsRaw] = useState('');

  // State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Parse skills from comma-separated string
    const skills = skillsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Build create input
    const rawInput = {
      enrollmentNumber: enrollmentNumber.trim().toUpperCase(),
      departmentId,
      batchId,
      personalDetails: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        gender,
        dob: dob ? new Date(dob).toISOString() : null,
      },
      academicRecords: {
        tenthPercentage: parseFloat(tenthPercentage) || 0,
        twelfthPercentage: twelfthPercentage ? parseFloat(twelfthPercentage) : null,
        diplomaPercentage: diplomaPercentage ? parseFloat(diplomaPercentage) : null,
        currentCgpa: parseFloat(currentCgpa) || 0,
        activeBacklogs: parseInt(activeBacklogs, 10) || 0,
        historyBacklogs: parseInt(historyBacklogs, 10) || 0,
        gapYears: parseInt(gapYears, 10) || 0,
      },
      skills,
    };

    const validation = StudentProfileCreateSchema.safeParse(rawInput);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createStudent(validation.data);
      onSuccess(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create student profile. Please check the values and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-student-title">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="create-student-title">
              Create Student Profile
            </h2>
            <p className="modal-subtitle">
              Register a student profile with college academic records and personal details.
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
            {/* Section 1: Academic Association & Enrollment */}
            <h3 className="form-section-title">1. College Enrollment & Academic Department</h3>
            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="create-enrollment" className="form-label">
                  Enrollment Number <span className="required-star">*</span>
                </label>
                <input
                  id="create-enrollment"
                  type="text"
                  className={`form-input${fieldErrors.enrollmentNumber ? ' input-error' : ''}`}
                  placeholder="e.g. EN2026001"
                  value={enrollmentNumber}
                  onChange={(e) => {
                    setEnrollmentNumber(e.target.value.toUpperCase());
                    if (fieldErrors.enrollmentNumber) {
                      setFieldErrors((prev) => ({ ...prev, enrollmentNumber: '' }));
                    }
                  }}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.enrollmentNumber && (
                  <span className="form-field-error" role="alert">{fieldErrors.enrollmentNumber}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-dept" className="form-label">
                  Department <span className="required-star">*</span>
                </label>
                <select
                  id="create-dept"
                  className="form-input form-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {fieldErrors.departmentId && (
                  <span className="form-field-error" role="alert">{fieldErrors.departmentId}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-batch" className="form-label">
                  Graduating Batch <span className="required-star">*</span>
                </label>
                <select
                  id="create-batch"
                  className="form-input form-select"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name} ({batch.startYear}–{batch.graduationYear})
                    </option>
                  ))}
                </select>
                {fieldErrors.batchId && (
                  <span className="form-field-error" role="alert">{fieldErrors.batchId}</span>
                )}
              </div>
            </div>

            {/* Section 2: Personal Details */}
            <h3 className="form-section-title">2. Personal Details</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="create-firstname" className="form-label">
                  First Name <span className="required-star">*</span>
                </label>
                <input
                  id="create-firstname"
                  type="text"
                  className={`form-input${fieldErrors['personalDetails.firstName'] ? ' input-error' : ''}`}
                  placeholder="e.g. Rahul"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.firstName'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['personalDetails.firstName']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-lastname" className="form-label">
                  Last Name <span className="required-star">*</span>
                </label>
                <input
                  id="create-lastname"
                  type="text"
                  className={`form-input${fieldErrors['personalDetails.lastName'] ? ' input-error' : ''}`}
                  placeholder="e.g. Sharma"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.lastName'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['personalDetails.lastName']}</span>
                )}
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="create-email" className="form-label">
                  Email Address <span className="required-star">*</span>
                </label>
                <input
                  id="create-email"
                  type="email"
                  className={`form-input${fieldErrors['personalDetails.email'] ? ' input-error' : ''}`}
                  placeholder="e.g. student@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.email'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['personalDetails.email']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-phone" className="form-label">
                  Phone Number <span className="required-star">*</span>
                </label>
                <input
                  id="create-phone"
                  type="tel"
                  className={`form-input${fieldErrors['personalDetails.phone'] ? ' input-error' : ''}`}
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.phone'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['personalDetails.phone']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-gender" className="form-label">
                  Gender
                </label>
                <select
                  id="create-gender"
                  className="form-input form-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as StudentGender)}
                  disabled={isSubmitting}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label htmlFor="create-dob" className="form-label">
                Date of Birth
              </label>
              <input
                id="create-dob"
                type="date"
                className="form-input"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Section 3: Academic Records */}
            <h3 className="form-section-title">3. Academic Performance & Backlogs</h3>
            <div className="form-row-4">
              <div className="form-group">
                <label htmlFor="create-cgpa" className="form-label">
                  Current CGPA (0–10) <span className="required-star">*</span>
                </label>
                <input
                  id="create-cgpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  className={`form-input${fieldErrors['academicRecords.currentCgpa'] ? ' input-error' : ''}`}
                  value={currentCgpa}
                  onChange={(e) => setCurrentCgpa(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['academicRecords.currentCgpa'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['academicRecords.currentCgpa']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-tenth" className="form-label">
                  10th Percentage (%) <span className="required-star">*</span>
                </label>
                <input
                  id="create-tenth"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className={`form-input${fieldErrors['academicRecords.tenthPercentage'] ? ' input-error' : ''}`}
                  value={tenthPercentage}
                  onChange={(e) => setTenthPercentage(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['academicRecords.tenthPercentage'] && (
                  <span className="form-field-error" role="alert">{fieldErrors['academicRecords.tenthPercentage']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="create-twelfth" className="form-label">
                  12th Percentage (%)
                </label>
                <input
                  id="create-twelfth"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="form-input"
                  placeholder="Optional"
                  value={twelfthPercentage}
                  onChange={(e) => setTwelfthPercentage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-diploma" className="form-label">
                  Diploma Percentage (%)
                </label>
                <input
                  id="create-diploma"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="form-input"
                  placeholder="Optional"
                  value={diplomaPercentage}
                  onChange={(e) => setDiplomaPercentage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="create-active-backlogs" className="form-label">
                  Active Backlogs
                </label>
                <input
                  id="create-active-backlogs"
                  type="number"
                  min="0"
                  className="form-input"
                  value={activeBacklogs}
                  onChange={(e) => setActiveBacklogs(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-history-backlogs" className="form-label">
                  Historical Backlogs
                </label>
                <input
                  id="create-history-backlogs"
                  type="number"
                  min="0"
                  className="form-input"
                  value={historyBacklogs}
                  onChange={(e) => setHistoryBacklogs(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-gap-years" className="form-label">
                  Academic Gap Years
                </label>
                <input
                  id="create-gap-years"
                  type="number"
                  min="0"
                  className="form-input"
                  value={gapYears}
                  onChange={(e) => setGapYears(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Section 4: Skills */}
            <h3 className="form-section-title">4. Technical Skills</h3>
            <div className="form-group">
              <label htmlFor="create-skills" className="form-label">
                Skills (comma-separated)
              </label>
              <input
                id="create-skills"
                type="text"
                className="form-input"
                placeholder="e.g. JavaScript, Python, React, SQL, AWS"
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
                disabled={isSubmitting}
              />
              <span className="form-field-hint">Enter comma-separated technical proficiencies.</span>
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
              id="submit-student-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="spinner-dot" aria-hidden="true" />
                  Creating Profile…
                </span>
              ) : (
                'Create Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
