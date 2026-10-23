import { useState, type FormEvent } from 'react';
import {
  StudentProfileUpdateSchema,
  type StudentProfileResponse,
  type StudentGender,
  type DepartmentResponse,
  type AcademicBatchResponse,
} from '@placement-platform/contracts';
import { updateStudent, ApiError } from '../../api/students.js';

interface StudentEditModalProps {
  student: StudentProfileResponse;
  departments: DepartmentResponse[];
  batches: AcademicBatchResponse[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: StudentProfileResponse) => void;
}

export function StudentEditModal({
  student,
  departments,
  batches,
  isOpen,
  onClose,
  onSuccess,
}: StudentEditModalProps) {
  // Department and batch
  const [departmentId, setDepartmentId] = useState(student.departmentId);
  const [batchId, setBatchId] = useState(student.batchId);

  // Personal details
  const [firstName, setFirstName] = useState(student.personalDetails.firstName);
  const [lastName, setLastName] = useState(student.personalDetails.lastName);
  const [email, setEmail] = useState(student.personalDetails.email);
  const [phone, setPhone] = useState(student.personalDetails.phone);
  const [gender, setGender] = useState<StudentGender>(student.personalDetails.gender);
  const [dob, setDob] = useState(
    student.personalDetails.dob ? student.personalDetails.dob.slice(0, 10) : ''
  );

  // Academic records
  const [currentCgpa, setCurrentCgpa] = useState<string>(
    String(student.academicRecords.currentCgpa)
  );
  const [tenthPercentage, setTenthPercentage] = useState<string>(
    String(student.academicRecords.tenthPercentage)
  );
  const [twelfthPercentage, setTwelfthPercentage] = useState<string>(
    student.academicRecords.twelfthPercentage !== null &&
      student.academicRecords.twelfthPercentage !== undefined
      ? String(student.academicRecords.twelfthPercentage)
      : ''
  );
  const [diplomaPercentage, setDiplomaPercentage] = useState<string>(
    student.academicRecords.diplomaPercentage !== null &&
      student.academicRecords.diplomaPercentage !== undefined
      ? String(student.academicRecords.diplomaPercentage)
      : ''
  );
  const [activeBacklogs, setActiveBacklogs] = useState<string>(
    String(student.academicRecords.activeBacklogs)
  );
  const [historyBacklogs, setHistoryBacklogs] = useState<string>(
    String(student.academicRecords.historyBacklogs)
  );
  const [gapYears, setGapYears] = useState<string>(String(student.academicRecords.gapYears));

  // Skills
  const [skillsRaw, setSkillsRaw] = useState(student.skills.join(', '));

  // State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const skills = skillsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updatePayload = {
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

    const validation = StudentProfileUpdateSchema.safeParse(updatePayload);
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
      const updated = await updateStudent(student.id, validation.data);
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to update student profile. Please check the values and try again.');
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
      aria-labelledby="edit-student-title"
    >
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="edit-student-title">
              Edit Student Profile
            </h2>
            <p className="modal-subtitle">
              Modify personal details, academic metrics, or department assignment.
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
            {/* Enrollment info (immutable) */}
            <div className="immutable-field-banner">
              <span className="immutable-label">Enrollment Number (Immutable):</span>
              <span className="immutable-value">{student.enrollmentNumber}</span>
            </div>

            {/* Section 1: Department & Batch */}
            <h3 className="form-section-title">1. Academic Affiliation</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="edit-dept" className="form-label">
                  Department
                </label>
                <select
                  id="edit-dept"
                  className="form-input form-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={isSubmitting}
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-batch" className="form-label">
                  Graduating Batch
                </label>
                <select
                  id="edit-batch"
                  className="form-input form-select"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={isSubmitting}
                >
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name} ({batch.startYear}–{batch.graduationYear})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 2: Personal Details */}
            <h3 className="form-section-title">2. Personal Information</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="edit-firstname" className="form-label">
                  First Name <span className="required-star">*</span>
                </label>
                <input
                  id="edit-firstname"
                  type="text"
                  className={`form-input${fieldErrors['personalDetails.firstName'] ? ' input-error' : ''}`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.firstName'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['personalDetails.firstName']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-lastname" className="form-label">
                  Last Name <span className="required-star">*</span>
                </label>
                <input
                  id="edit-lastname"
                  type="text"
                  className={`form-input${fieldErrors['personalDetails.lastName'] ? ' input-error' : ''}`}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.lastName'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['personalDetails.lastName']}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="edit-email" className="form-label">
                  Email Address <span className="required-star">*</span>
                </label>
                <input
                  id="edit-email"
                  type="email"
                  className={`form-input${fieldErrors['personalDetails.email'] ? ' input-error' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.email'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['personalDetails.email']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-phone" className="form-label">
                  Phone Number <span className="required-star">*</span>
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  className={`form-input${fieldErrors['personalDetails.phone'] ? ' input-error' : ''}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors['personalDetails.phone'] && (
                  <span className="form-field-error" role="alert">
                    {fieldErrors['personalDetails.phone']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-gender" className="form-label">
                  Gender
                </label>
                <select
                  id="edit-gender"
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
              <label htmlFor="edit-dob" className="form-label">
                Date of Birth
              </label>
              <input
                id="edit-dob"
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
                <label htmlFor="edit-cgpa" className="form-label">
                  Current CGPA (0–10) <span className="required-star">*</span>
                </label>
                <input
                  id="edit-cgpa"
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
                  <span className="form-field-error" role="alert">
                    {fieldErrors['academicRecords.currentCgpa']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-tenth" className="form-label">
                  10th Percentage (%) <span className="required-star">*</span>
                </label>
                <input
                  id="edit-tenth"
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
                  <span className="form-field-error" role="alert">
                    {fieldErrors['academicRecords.tenthPercentage']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-twelfth" className="form-label">
                  12th Percentage (%)
                </label>
                <input
                  id="edit-twelfth"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="form-input"
                  value={twelfthPercentage}
                  onChange={(e) => setTwelfthPercentage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-diploma" className="form-label">
                  Diploma Percentage (%)
                </label>
                <input
                  id="edit-diploma"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="form-input"
                  value={diplomaPercentage}
                  onChange={(e) => setDiplomaPercentage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label htmlFor="edit-active-backlogs" className="form-label">
                  Active Backlogs
                </label>
                <input
                  id="edit-active-backlogs"
                  type="number"
                  min="0"
                  className="form-input"
                  value={activeBacklogs}
                  onChange={(e) => setActiveBacklogs(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-history-backlogs" className="form-label">
                  Historical Backlogs
                </label>
                <input
                  id="edit-history-backlogs"
                  type="number"
                  min="0"
                  className="form-input"
                  value={historyBacklogs}
                  onChange={(e) => setHistoryBacklogs(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-gap-years" className="form-label">
                  Gap Years
                </label>
                <input
                  id="edit-gap-years"
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
              <label htmlFor="edit-skills" className="form-label">
                Skills (comma-separated)
              </label>
              <input
                id="edit-skills"
                type="text"
                className="form-input"
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
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
              id="update-student-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="spinner-dot" aria-hidden="true" />
                  Updating Profile…
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
