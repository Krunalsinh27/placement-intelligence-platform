import { useState, useEffect, useCallback } from 'react';
import type {
  StudentProfileResponse,
  PaginatedStudentListResponse,
  DepartmentResponse,
  AcademicBatchResponse,
  StudentStatus,
  StudentQueryFilters,
} from '@placement-platform/contracts';
import { listStudents, ApiError } from '../../api/students.js';
import { listDepartments, listBatches } from '../../api/academics.js';
import { useAuth } from '../../context/AuthContext.js';
import { canCreateOrEditStudents, isCoordinatorScoped } from '../../utils/permissions.js';
import { StudentDetailModal } from './StudentDetailModal.js';
import { StudentCreateModal } from './StudentCreateModal.js';

export function StudentManagement() {
  const { user } = useAuth();
  const canCreate = canCreateOrEditStudents(user?.role);
  const isCoordinator = isCoordinatorScoped(user?.role);

  // Reference data
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [batches, setBatches] = useState<AcademicBatchResponse[]>([]);

  // Query filter state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [status, setStatus] = useState<string>(''); // '' = all
  const [isVerified, setIsVerified] = useState<string>(''); // '' = all, 'true', 'false'
  const [minCgpa, setMinCgpa] = useState<string>('');
  const [maxActiveBacklogs, setMaxActiveBacklogs] = useState<string>('');
  const [sortBy, setSortBy] = useState<StudentQueryFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<StudentQueryFilters['sortOrder']>('desc');

  // List data state
  const [data, setData] = useState<PaginatedStudentListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedStudent, setSelectedStudent] = useState<StudentProfileResponse | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);

  // Load department & batch references
  useEffect(() => {
    let cancelled = false;
    async function loadRefs() {
      try {
        const [depts, bts] = await Promise.all([listDepartments(), listBatches()]);
        if (!cancelled) {
          setDepartments(depts);
          setBatches(bts);
        }
      } catch {
        // Non-blocking: filters will still work without populated names
      }
    }
    void loadRefs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch students function
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: Partial<StudentQueryFilters> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (search.trim()) filters.search = search.trim();
    if (departmentId) filters.departmentId = departmentId;
    if (batchId) filters.batchId = batchId;
    if (status) filters.status = status as StudentStatus;
    if (isVerified === 'true') filters.isVerified = true;
    if (isVerified === 'false') filters.isVerified = false;
    if (minCgpa !== '') filters.minCgpa = parseFloat(minCgpa);
    if (maxActiveBacklogs !== '') filters.maxActiveBacklogs = parseInt(maxActiveBacklogs, 10);

    try {
      const res = await listStudents(filters);
      setData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load student directory. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    departmentId,
    batchId,
    status,
    isVerified,
    minCgpa,
    maxActiveBacklogs,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  const handleResetFilters = () => {
    setSearch('');
    setDepartmentId('');
    setBatchId('');
    setStatus('');
    setIsVerified('');
    setMinCgpa('');
    setMaxActiveBacklogs('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const getDepartmentName = (id: string) => {
    const d = departments.find((dept) => dept.id === id);
    return d ? d.code : id.slice(-6);
  };

  const getBatchName = (id: string) => {
    const b = batches.find((batch) => batch.id === id);
    return b ? b.name : id.slice(-6);
  };

  return (
    <div className="management-page">
      {/* Header Row */}
      <div className="page-header-row">
        <div>
          <div className="title-count-row">
            <h1 className="page-title">Student Management</h1>
            {data && <span className="counter-badge">{data.total} Students</span>}
          </div>
          <p className="page-subtitle">
            Search, filter, verify academic credentials, and manage placement statuses.
          </p>
        </div>

        {canCreate && (
          <div className="header-actions">
            <button
              type="button"
              className="btn-primary"
              id="add-student-btn"
              onClick={() => setCreateModalOpen(true)}
            >
              <span aria-hidden="true">➕</span> Add Student Profile
            </button>
          </div>
        )}
      </div>

      {/* Coordinator Scope Indicator */}
      {isCoordinator && (
        <div className="scope-banner" role="status" id="coordinator-scope-banner">
          <span className="scope-icon" aria-hidden="true">
            🛡️
          </span>
          <div>
            <strong>Department Coordinator Scope Active:</strong> Displaying only students
            registered in your assigned department. You have authorization to inspect records and
            verify academic credentials.
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <section className="filter-card" aria-label="Student Directory Filters">
        <div className="filter-grid">
          {/* Search */}
          <div className="filter-item filter-search">
            <label htmlFor="filter-search" className="filter-label">
              Search Directory
            </label>
            <div className="search-input-wrap">
              <span className="search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                id="filter-search"
                type="text"
                className="form-input search-input"
                placeholder="Search name, enrollment #, email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Department Filter (hidden/disabled if coordinator) */}
          {!isCoordinator && (
            <div className="filter-item">
              <label htmlFor="filter-department" className="filter-label">
                Department
              </label>
              <select
                id="filter-department"
                className="form-input form-select"
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Batch Filter */}
          <div className="filter-item">
            <label htmlFor="filter-batch" className="filter-label">
              Graduating Batch
            </label>
            <select
              id="filter-batch"
              className="form-input form-select"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.graduationYear})
                </option>
              ))}
            </select>
          </div>

          {/* Placement Status Filter */}
          <div className="filter-item">
            <label htmlFor="filter-status" className="filter-label">
              Placement Status
            </label>
            <select
              id="filter-status"
              className="form-input form-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="unplaced">Unplaced</option>
              <option value="placed">Placed</option>
              <option value="opted_out">Opted Out</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="filter-item">
            <label htmlFor="filter-verified" className="filter-label">
              Verification
            </label>
            <select
              id="filter-verified"
              className="form-input form-select"
              value={isVerified}
              onChange={(e) => {
                setIsVerified(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Profiles</option>
              <option value="true">✅ Verified Only</option>
              <option value="false">⚠️ Unverified Only</option>
            </select>
          </div>

          {/* Min CGPA */}
          <div className="filter-item" style={{ maxWidth: '120px' }}>
            <label htmlFor="filter-min-cgpa" className="filter-label">
              Min CGPA
            </label>
            <input
              id="filter-min-cgpa"
              type="number"
              step="0.1"
              min="0"
              max="10"
              placeholder="e.g. 7.5"
              className="form-input"
              value={minCgpa}
              onChange={(e) => {
                setMinCgpa(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Max Backlogs */}
          <div className="filter-item" style={{ maxWidth: '120px' }}>
            <label htmlFor="filter-max-backlogs" className="filter-label">
              Max Backlogs
            </label>
            <input
              id="filter-max-backlogs"
              type="number"
              min="0"
              placeholder="e.g. 0"
              className="form-input"
              value={maxActiveBacklogs}
              onChange={(e) => {
                setMaxActiveBacklogs(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Sort By */}
          <div className="filter-item">
            <label htmlFor="filter-sort-by" className="filter-label">
              Sort By
            </label>
            <select
              id="filter-sort-by"
              className="form-input form-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-') as [
                  StudentQueryFilters['sortBy'],
                  StudentQueryFilters['sortOrder'],
                ];
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
            >
              <option value="createdAt-desc">Newest Added</option>
              <option value="createdAt-asc">Oldest Added</option>
              <option value="currentCgpa-desc">Highest CGPA</option>
              <option value="currentCgpa-asc">Lowest CGPA</option>
              <option value="name-asc">Student Name (A–Z)</option>
              <option value="enrollmentNumber-asc">Enrollment # (Asc)</option>
            </select>
          </div>

          {/* Reset Action */}
          <div className="filter-item filter-reset-col">
            <button
              type="button"
              className="btn-secondary filter-reset-btn"
              id="reset-filters-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Main Table Content */}
      <section className="table-section" aria-label="Students Directory">
        {loading ? (
          <div className="table-loading-container" role="status">
            <span className="spinner-dot" aria-hidden="true" />
            <span>Loading student directory…</span>
          </div>
        ) : error ? (
          <div className="table-error-container" role="alert">
            <p className="table-error-message">⚠️ {error}</p>
            <button type="button" className="btn-secondary" onClick={fetchStudents}>
              Retry
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon" aria-hidden="true">
              🎓
            </div>
            <h3 className="empty-state-title">No Students Found</h3>
            <p className="empty-state-desc">
              No student profiles match your search criteria. Try adjusting or resetting your
              filters.
            </p>
            <button type="button" className="btn-secondary" onClick={handleResetFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table" id="students-table">
                <thead>
                  <tr>
                    <th>Enrollment #</th>
                    <th>Student Name</th>
                    <th>Dept / Batch</th>
                    <th>CGPA</th>
                    <th>Backlogs</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((student) => (
                    <tr key={student.id} id={`student-row-${student.id}`}>
                      <td>
                        <span className="code-pill">{student.enrollmentNumber}</span>
                      </td>
                      <td>
                        <div className="student-name-col">
                          <span className="font-medium text-primary">
                            {student.personalDetails.firstName} {student.personalDetails.lastName}
                          </span>
                          <span className="text-muted" style={{ fontSize: '11px' }}>
                            {student.personalDetails.email}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="dept-batch-col">
                          <span className="dept-tag">
                            {getDepartmentName(student.departmentId)}
                          </span>
                          <span className="batch-tag">{getBatchName(student.batchId)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cgpa-pill">
                          {student.academicRecords.currentCgpa.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`backlog-pill ${
                            student.academicRecords.activeBacklogs > 0 ? 'active' : 'clear'
                          }`}
                        >
                          {student.academicRecords.activeBacklogs === 0
                            ? '0 Active'
                            : `${student.academicRecords.activeBacklogs} Active`}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge-verification ${
                            student.isVerified ? 'verified' : 'unverified'
                          }`}
                        >
                          {student.isVerified ? '✅ Verified' : '⚠️ Unverified'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            student.status === 'placed'
                              ? 'ok'
                              : student.status === 'unplaced'
                                ? ''
                                : student.status === 'opted_out'
                                  ? 'warning'
                                  : 'error'
                          }`}
                        >
                          <span className="status-dot" aria-hidden="true" />
                          {student.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn-action"
                          id={`view-student-${student.id}`}
                          onClick={() => setSelectedStudent(student)}
                          aria-label={`View profile of ${student.personalDetails.firstName}`}
                        >
                          🔍 View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar" aria-label="Table pagination">
              <div className="pagination-info">
                Showing{' '}
                <strong>
                  {data.total === 0 ? 0 : (data.page - 1) * data.limit + 1}–
                  {Math.min(data.page * data.limit, data.total)}
                </strong>{' '}
                of <strong>{data.total}</strong> students
              </div>

              <div className="pagination-controls">
                <div className="page-size-selector">
                  <label htmlFor="page-size-select" className="filter-label" style={{ margin: 0 }}>
                    Per page:
                  </label>
                  <select
                    id="page-size-select"
                    className="form-input form-select"
                    style={{ width: '70px', height: '32px' }}
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="page-nav-btns">
                  <button
                    type="button"
                    className="btn-secondary btn-pagination"
                    id="pagination-prev-btn"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    ‹ Previous
                  </button>
                  <span className="page-number-indicator">
                    Page {data.page} of {Math.max(1, data.totalPages)}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-pagination"
                    id="pagination-next-btn"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          departments={departments}
          batches={batches}
          isOpen={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          onStudentUpdated={(updated) => {
            setSelectedStudent(updated);
            void fetchStudents();
          }}
        />
      )}

      {/* Student Create Modal */}
      {createModalOpen && (
        <StudentCreateModal
          isOpen={createModalOpen}
          departments={departments}
          batches={batches}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            void fetchStudents();
          }}
        />
      )}
    </div>
  );
}
