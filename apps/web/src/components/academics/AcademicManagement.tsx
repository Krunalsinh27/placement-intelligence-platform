import { useState, useEffect, useCallback } from 'react';
import type { DepartmentResponse, AcademicBatchResponse } from '@placement-platform/contracts';
import { listDepartments, listBatches, ApiError } from '../../api/academics.js';
import { useAuth } from '../../context/AuthContext.js';
import { canManageAcademics } from '../../utils/permissions.js';
import { DepartmentModal } from './DepartmentModal.js';
import { BatchModal } from './BatchModal.js';

export function AcademicManagement() {
  const { user } = useAuth();
  const canManage = canManageAcademics(user?.role);

  const [activeTab, setActiveTab] = useState<'departments' | 'batches'>('departments');

  // Department State
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentResponse | null>(null);

  // Batch State
  const [batches, setBatches] = useState<AcademicBatchResponse[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<AcademicBatchResponse | null>(null);

  // Fetch Departments
  const fetchDepartments = useCallback(async () => {
    setLoadingDepts(true);
    setDeptError(null);
    try {
      const data = await listDepartments();
      setDepartments(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setDeptError(err.message);
      } else {
        setDeptError('Failed to load academic departments. Please try again.');
      }
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  // Fetch Batches
  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    setBatchError(null);
    try {
      const data = await listBatches();
      setBatches(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setBatchError(err.message);
      } else {
        setBatchError('Failed to load academic batches. Please try again.');
      }
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    void fetchDepartments();
    void fetchBatches();
  }, [fetchDepartments, fetchBatches]);

  return (
    <div className="management-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Academic Structure</h1>
          <p className="page-subtitle">
            Manage degree departments and graduating batches for tenant-wide placement operations.
          </p>
        </div>

        {canManage && (
          <div className="header-actions">
            {activeTab === 'departments' ? (
              <button
                type="button"
                className="btn-primary"
                id="add-department-btn"
                onClick={() => {
                  setEditingDept(null);
                  setDeptModalOpen(true);
                }}
              >
                <span aria-hidden="true">➕</span> Add Department
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                id="add-batch-btn"
                onClick={() => {
                  setEditingBatch(null);
                  setBatchModalOpen(true);
                }}
              >
                <span aria-hidden="true">➕</span> Add Batch
              </button>
            )}
          </div>
        )}
      </div>

      {!canManage && (
        <div className="scope-banner read-only-banner" role="status">
          <span className="scope-icon" aria-hidden="true">ℹ️</span>
          <span>
            Read-only Access: Academic departments and batches can only be modified by College
            Placement Administrators (TPO / College Admin).
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'departments'}
          className={`tab-btn${activeTab === 'departments' ? ' active' : ''}`}
          id="tab-departments"
          onClick={() => setActiveTab('departments')}
        >
          🏢 Departments ({departments.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'batches'}
          className={`tab-btn${activeTab === 'batches' ? ' active' : ''}`}
          id="tab-batches"
          onClick={() => setActiveTab('batches')}
        >
          📅 Batches ({batches.length})
        </button>
      </div>

      {/* Tab: Departments */}
      {activeTab === 'departments' && (
        <section className="tab-content" aria-labelledby="tab-departments">
          {loadingDepts ? (
            <div className="table-loading-container" role="status">
              <span className="spinner-dot" aria-hidden="true" />
              <span>Loading academic departments…</span>
            </div>
          ) : deptError ? (
            <div className="table-error-container" role="alert">
              <p className="table-error-message">⚠️ {deptError}</p>
              <button type="button" className="btn-secondary" onClick={fetchDepartments}>
                Retry
              </button>
            </div>
          ) : departments.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon" aria-hidden="true">🏢</div>
              <h3 className="empty-state-title">No Departments Found</h3>
              <p className="empty-state-desc">
                {canManage
                  ? 'No departments have been added yet. Create your college departments to get started.'
                  : 'No academic departments are currently registered in this college.'}
              </p>
              {canManage && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditingDept(null);
                    setDeptModalOpen(true);
                  }}
                >
                  Create First Department
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table" id="departments-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Department Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    {canManage && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id} id={`dept-row-${dept.id}`}>
                      <td>
                        <span className="code-pill">{dept.code}</span>
                      </td>
                      <td className="font-medium text-primary">{dept.name}</td>
                      <td>
                        <span className={`status-pill ${dept.status === 'active' ? 'ok' : 'error'}`}>
                          <span className="status-dot" aria-hidden="true" />
                          {dept.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-muted">
                        {new Date(dept.createdAt).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn-action"
                            id={`edit-dept-${dept.id}`}
                            onClick={() => {
                              setEditingDept(dept);
                              setDeptModalOpen(true);
                            }}
                            aria-label={`Edit ${dept.name}`}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab: Batches */}
      {activeTab === 'batches' && (
        <section className="tab-content" aria-labelledby="tab-batches">
          {loadingBatches ? (
            <div className="table-loading-container" role="status">
              <span className="spinner-dot" aria-hidden="true" />
              <span>Loading academic batches…</span>
            </div>
          ) : batchError ? (
            <div className="table-error-container" role="alert">
              <p className="table-error-message">⚠️ {batchError}</p>
              <button type="button" className="btn-secondary" onClick={fetchBatches}>
                Retry
              </button>
            </div>
          ) : batches.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-icon" aria-hidden="true">📅</div>
              <h3 className="empty-state-title">No Batches Found</h3>
              <p className="empty-state-desc">
                {canManage
                  ? 'No academic batches have been configured yet. Create a batch cohort for your students.'
                  : 'No academic batches are currently registered in this college.'}
              </p>
              {canManage && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setEditingBatch(null);
                    setBatchModalOpen(true);
                  }}
                >
                  Create First Batch
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table" id="batches-table">
                <thead>
                  <tr>
                    <th>Batch Name</th>
                    <th>Cohort Years</th>
                    <th>Status</th>
                    <th>Created</th>
                    {canManage && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} id={`batch-row-${batch.id}`}>
                      <td className="font-medium text-primary">{batch.name}</td>
                      <td>
                        <span className="year-pill">
                          {batch.startYear} – {batch.graduationYear}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            batch.status === 'active'
                              ? 'ok'
                              : batch.status === 'graduated'
                              ? 'warning'
                              : 'error'
                          }`}
                        >
                          <span className="status-dot" aria-hidden="true" />
                          {batch.status === 'active'
                            ? 'Active (Enrolled)'
                            : batch.status === 'graduated'
                            ? 'Graduated'
                            : 'Archived'}
                        </span>
                      </td>
                      <td className="text-muted">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn-action"
                            id={`edit-batch-${batch.id}`}
                            onClick={() => {
                              setEditingBatch(batch);
                              setBatchModalOpen(true);
                            }}
                            aria-label={`Edit ${batch.name}`}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Department Modal */}
      {deptModalOpen && (
        <DepartmentModal
          department={editingDept}
          isOpen={deptModalOpen}
          onClose={() => {
            setDeptModalOpen(false);
            setEditingDept(null);
          }}
          onSuccess={() => {
            void fetchDepartments();
          }}
        />
      )}

      {/* Batch Modal */}
      {batchModalOpen && (
        <BatchModal
          batch={editingBatch}
          isOpen={batchModalOpen}
          onClose={() => {
            setBatchModalOpen(false);
            setEditingBatch(null);
          }}
          onSuccess={() => {
            void fetchBatches();
          }}
        />
      )}
    </div>
  );
}
