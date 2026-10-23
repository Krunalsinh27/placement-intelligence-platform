import { useState } from 'react';
import type {
  StudentProfileResponse,
  DepartmentResponse,
  AcademicBatchResponse,
} from '@placement-platform/contracts';
import { useAuth } from '../../context/AuthContext.js';
import {
  canCreateOrEditStudents,
  canVerifyStudents,
  canUpdateStudentStatus,
} from '../../utils/permissions.js';
import { StudentEditModal } from './StudentEditModal.js';
import { StudentVerifyModal } from './StudentVerifyModal.js';
import { StudentStatusModal } from './StudentStatusModal.js';

interface StudentDetailModalProps {
  student: StudentProfileResponse;
  departments: DepartmentResponse[];
  batches: AcademicBatchResponse[];
  isOpen: boolean;
  onClose: () => void;
  onStudentUpdated: (updated: StudentProfileResponse) => void;
}

export function StudentDetailModal({
  student: initialStudent,
  departments,
  batches,
  isOpen,
  onClose,
  onStudentUpdated,
}: StudentDetailModalProps) {
  const { user } = useAuth();
  const [currentStudent, setCurrentStudent] = useState<StudentProfileResponse>(initialStudent);

  // Sub-modal states
  const [editOpen, setEditOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (!isOpen) return null;

  const canEdit = canCreateOrEditStudents(user?.role);
  const canVerify = canVerifyStudents(user?.role);
  const canChangeStatus = canUpdateStudentStatus(user?.role);

  const department = departments.find((d) => d.id === currentStudent.departmentId);
  const batch = batches.find((b) => b.id === currentStudent.batchId);

  const handleUpdate = (updated: StudentProfileResponse) => {
    setCurrentStudent(updated);
    onStudentUpdated(updated);
  };

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
        <div className="modal-card modal-large">
          <div className="modal-header">
            <div>
              <div className="detail-header-row">
                <h2 className="modal-title" id="detail-modal-title">
                  {currentStudent.personalDetails.firstName} {currentStudent.personalDetails.lastName}
                </h2>
                <span className="code-pill">{currentStudent.enrollmentNumber}</span>
                <span
                  className={`status-pill ${
                    currentStudent.status === 'placed'
                      ? 'ok'
                      : currentStudent.status === 'unplaced'
                      ? ''
                      : currentStudent.status === 'opted_out'
                      ? 'warning'
                      : 'error'
                  }`}
                >
                  <span className="status-dot" aria-hidden="true" />
                  {currentStudent.status.toUpperCase()}
                </span>
                <span
                  className={`badge-verification ${
                    currentStudent.isVerified ? 'verified' : 'unverified'
                  }`}
                >
                  {currentStudent.isVerified ? '✅ Verified' : '⚠️ Unverified'}
                </span>
              </div>
              <p className="modal-subtitle">
                {department ? department.name : 'Unknown Department'} ·{' '}
                {batch ? `${batch.name} (${batch.graduationYear})` : 'Unknown Batch'}
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

          <div className="modal-body modal-scrollable">
            {/* Quick Actions Bar */}
            <div className="detail-action-bar">
              {canVerify && (
                <button
                  type="button"
                  className="btn-action-primary"
                  id="action-verify-btn"
                  onClick={() => setVerifyOpen(true)}
                >
                  🛡️ {currentStudent.isVerified ? 'Change Verification' : 'Verify Student'}
                </button>
              )}
              {canChangeStatus && (
                <button
                  type="button"
                  className="btn-action-primary"
                  id="action-status-btn"
                  onClick={() => setStatusOpen(true)}
                >
                  📊 Change Status
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="btn-action"
                  id="action-edit-btn"
                  onClick={() => setEditOpen(true)}
                >
                  ✏️ Edit Profile
                </button>
              )}
            </div>

            {/* Academic Credentials Section */}
            <div className="detail-section">
              <h3 className="detail-section-title">Academic Metrics & Credentials</h3>
              <div className="metrics-grid">
                <div className="metric-box">
                  <span className="metric-val text-accent">
                    {currentStudent.academicRecords.currentCgpa.toFixed(2)}
                  </span>
                  <span className="metric-label">Current CGPA (out of 10)</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">
                    {currentStudent.academicRecords.tenthPercentage.toFixed(1)}%
                  </span>
                  <span className="metric-label">10th Standard</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">
                    {currentStudent.academicRecords.twelfthPercentage !== null &&
                    currentStudent.academicRecords.twelfthPercentage !== undefined
                      ? `${currentStudent.academicRecords.twelfthPercentage.toFixed(1)}%`
                      : '—'}
                  </span>
                  <span className="metric-label">12th Standard</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">
                    {currentStudent.academicRecords.diplomaPercentage !== null &&
                    currentStudent.academicRecords.diplomaPercentage !== undefined
                      ? `${currentStudent.academicRecords.diplomaPercentage.toFixed(1)}%`
                      : '—'}
                  </span>
                  <span className="metric-label">Diploma</span>
                </div>
              </div>

              <div className="metrics-grid" style={{ marginTop: '12px' }}>
                <div className="metric-box">
                  <span
                    className={`metric-val ${
                      currentStudent.academicRecords.activeBacklogs > 0 ? 'text-error' : 'text-success'
                    }`}
                  >
                    {currentStudent.academicRecords.activeBacklogs}
                  </span>
                  <span className="metric-label">Active Backlogs</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">
                    {currentStudent.academicRecords.historyBacklogs}
                  </span>
                  <span className="metric-label">Historical Backlogs</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">{currentStudent.academicRecords.gapYears}</span>
                  <span className="metric-label">Gap Years</span>
                </div>
              </div>
            </div>

            {/* Personal Details Section */}
            <div className="detail-section">
              <h3 className="detail-section-title">Personal Information</h3>
              <div className="detail-info-grid">
                <div className="info-row">
                  <span className="info-key">Full Name</span>
                  <span className="info-val">
                    {currentStudent.personalDetails.firstName}{' '}
                    {currentStudent.personalDetails.lastName}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">College Email</span>
                  <span className="info-val">{currentStudent.personalDetails.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Phone Number</span>
                  <span className="info-val">{currentStudent.personalDetails.phone}</span>
                </div>
                <div className="info-row">
                  <span className="info-key">Gender</span>
                  <span className="info-val" style={{ textTransform: 'capitalize' }}>
                    {currentStudent.personalDetails.gender.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Date of Birth</span>
                  <span className="info-val">
                    {currentStudent.personalDetails.dob
                      ? new Date(currentStudent.personalDetails.dob).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Department</span>
                  <span className="info-val">
                    {department ? `${department.name} (${department.code})` : '—'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-key">Batch</span>
                  <span className="info-val">
                    {batch
                      ? `${batch.name} (${batch.startYear}–${batch.graduationYear})`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Skills Section */}
            <div className="detail-section">
              <h3 className="detail-section-title">Technical Skills</h3>
              {currentStudent.skills.length > 0 ? (
                <div className="skills-chip-container">
                  {currentStudent.skills.map((skill, index) => (
                    <span key={index} className="skill-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: '13px' }}>
                  No technical skills listed for this student profile.
                </p>
              )}
            </div>

            {/* Verification Audit Section */}
            <div className="detail-section">
              <h3 className="detail-section-title">Academic Verification Audit</h3>
              {currentStudent.isVerified ? (
                <div className="verification-audit-box verified">
                  <div className="audit-header">
                    <span>✅ Verified Academic Record</span>
                    <span className="audit-date">
                      {currentStudent.verificationDetails?.verifiedAt
                        ? new Date(
                            currentStudent.verificationDetails.verifiedAt
                          ).toLocaleString()
                        : ''}
                    </span>
                  </div>
                  {currentStudent.verificationDetails?.remarks && (
                    <p className="audit-remarks">
                      "{currentStudent.verificationDetails.remarks}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="verification-audit-box unverified">
                  <span>
                    ⚠️ Unverified Profile: Student academic marks and backlogs have not yet been
                    authenticated against college records.
                  </span>
                </div>
              )}
            </div>

            {/* Audit Timestamps */}
            <div className="detail-timestamps">
              <span>Created: {new Date(currentStudent.createdAt).toLocaleString()}</span>
              <span>Last Modified: {new Date(currentStudent.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {editOpen && (
        <StudentEditModal
          student={currentStudent}
          departments={departments}
          batches={batches}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={handleUpdate}
        />
      )}

      {verifyOpen && (
        <StudentVerifyModal
          student={currentStudent}
          isOpen={verifyOpen}
          onClose={() => setVerifyOpen(false)}
          onSuccess={handleUpdate}
        />
      )}

      {statusOpen && (
        <StudentStatusModal
          student={currentStudent}
          isOpen={statusOpen}
          onClose={() => setStatusOpen(false)}
          onSuccess={handleUpdate}
        />
      )}
    </>
  );
}
