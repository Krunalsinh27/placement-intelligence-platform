import { useState, useEffect, useCallback } from 'react';
import type {
  CollegeCompanyProfileResponse,
  PaginatedCompanyListResponse,
  CompanyStatus,
  CompanyTier,
  CompanyQueryFilters,
} from '@placement-platform/contracts';
import { listCompanies, ApiError } from '../../api/companies.js';
import { useAuth } from '../../context/AuthContext.js';
import { canManageCompanies, canVerifyOrTierCompany } from '../../utils/permissions.js';
import { CompanyCreateModal } from './CompanyCreateModal.js';
import { CompanyEditModal } from './CompanyEditModal.js';
import { CompanyVerifyModal } from './CompanyVerifyModal.js';
import { CompanyTierModal } from './CompanyTierModal.js';
import { CompanyDetailModal } from './CompanyDetailModal.js';
import { RecruiterManagementModal } from './RecruiterManagementModal.js';

export function CompanyManagement() {
  const { user } = useAuth();
  const canManage = canManageCompanies(user?.role);
  const canVerify = canVerifyOrTierCompany(user?.role);

  // Query filter states
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>(''); // '' = all
  const [tier, setTier] = useState<string>(''); // '' = all
  const [sortBy, setSortBy] = useState<CompanyQueryFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<CompanyQueryFilters['sortOrder']>('desc');

  // List data state
  const [data, setData] = useState<PaginatedCompanyListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CollegeCompanyProfileResponse | null>(
    null
  );
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [recruiterModalOpen, setRecruiterModalOpen] = useState(false);

  // Fetch companies function
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filters: Partial<CompanyQueryFilters> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (search.trim()) filters.search = search.trim();
    if (status) filters.status = status as CompanyStatus;
    if (tier) filters.tier = tier as CompanyTier;

    try {
      const res = await listCompanies(filters);
      setData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load company directory. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, tier, sortBy, sortOrder]);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  const handleCompanyUpdated = (updated: CollegeCompanyProfileResponse) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
    if (selectedCompany?.id === updated.id) {
      setSelectedCompany(updated);
    }
  };

  const handleCompanyCreated = (_created: CollegeCompanyProfileResponse) => {
    setPage(1);
    void fetchCompanies();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setTier('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <div className="management-page">
      {/* Header Row */}
      <div className="page-header-row">
        <div>
          <div className="title-count-row">
            <h2 className="page-title">Company Directory</h2>
            {data && <span className="counter-badge">{data.total} Registered</span>}
          </div>
          <p className="page-subtitle">
            Manage recruiting partners, tiering, verification status, and campus recruiter teams.
          </p>
        </div>

        {canManage && (
          <div className="header-actions">
            <button
              type="button"
              className="btn-primary"
              id="open-register-company-modal"
              onClick={() => setCreateModalOpen(true)}
            >
              + Register Company
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          {/* Search Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="company-search" className="form-label" style={{ fontSize: '12px' }}>
              Search Company / Industry
            </label>
            <input
              id="company-search"
              type="search"
              className="form-input"
              placeholder="e.g. Google, FinTech..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label
              htmlFor="company-status-filter"
              className="form-label"
              style={{ fontSize: '12px' }}
            >
              Verification Status
            </label>
            <select
              id="company-status-filter"
              className="form-input form-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="inactive">Inactive</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label
              htmlFor="company-tier-filter"
              className="form-label"
              style={{ fontSize: '12px' }}
            >
              Recruiter Tier
            </label>
            <select
              id="company-tier-filter"
              className="form-input form-select"
              value={tier}
              onChange={(e) => {
                setTier(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Tiers</option>
              <option value="tier_1">Tier 1 (Dream)</option>
              <option value="tier_2">Tier 2</option>
              <option value="tier_3">Tier 3 (Standard)</option>
              <option value="mass_recruiter">Mass Recruiter</option>
              <option value="startup">Startup</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="company-sort-by" className="form-label" style={{ fontSize: '12px' }}>
              Sort By
            </label>
            <select
              id="company-sort-by"
              className="form-input form-select"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':') as [
                  CompanyQueryFilters['sortBy'],
                  CompanyQueryFilters['sortOrder'],
                ];
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
            >
              <option value="createdAt:desc">Newest Added First</option>
              <option value="createdAt:asc">Oldest Added First</option>
              <option value="name:asc">Company Name (A–Z)</option>
              <option value="name:desc">Company Name (Z–A)</option>
              <option value="tier:asc">Tier (Ascending)</option>
            </select>
          </div>
        </div>

        {(search || status || tier) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={handleResetFilters}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content / Table */}
      {loading ? (
        <div className="table-loading-container">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading company directory...</p>
        </div>
      ) : error ? (
        <div className="table-error-container" role="alert">
          <span aria-hidden="true" style={{ fontSize: '24px' }}>
            ⚠️
          </span>
          <p className="table-error-message">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => void fetchCompanies()}>
            Retry
          </button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-icon" aria-hidden="true">
            🏢
          </div>
          <h3 className="empty-state-title">No companies found</h3>
          <p className="empty-state-desc">
            {search || status || tier
              ? 'No recruiting companies match your active filters. Try adjusting search criteria.'
              : 'Register your first partner company to start tracking recruiter relationships and hosting campus placement drives.'}
          </p>
          {canManage && (
            <button type="button" className="btn-primary" onClick={() => setCreateModalOpen(true)}>
              + Register Company
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table" aria-label="Company directory">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Industry</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Primary Contact</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => {
                const isVerified = item.status === 'verified';
                const isBlacklisted = item.status === 'blacklisted';
                const isPending = item.status === 'pending_verification';

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {item.company.name}
                      </div>
                      {item.company.website && (
                        <a
                          href={item.company.website}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-accent)',
                            textDecoration: 'none',
                          }}
                        >
                          {item.company.website} ↗
                        </a>
                      )}
                    </td>
                    <td>
                      <div>{item.company.industry}</div>
                      {item.company.location?.city && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {item.company.location.city}
                          {item.company.location.state ? `, ${item.company.location.state}` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="counter-badge"
                        style={{ textTransform: 'capitalize', fontSize: '11px' }}
                      >
                        {item.tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          background: isVerified
                            ? 'rgba(34, 197, 94, 0.15)'
                            : isBlacklisted
                              ? 'rgba(239, 68, 68, 0.15)'
                              : isPending
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                          color: isVerified
                            ? '#4ade80'
                            : isBlacklisted
                              ? '#f87171'
                              : isPending
                                ? '#fbbf24'
                                : '#94a3b8',
                        }}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {item.primaryContact ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{item.primaryContact.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {item.primaryContact.email}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => {
                            setSelectedCompany(item);
                            setDetailModalOpen(true);
                          }}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => {
                            setSelectedCompany(item);
                            setRecruiterModalOpen(true);
                          }}
                        >
                          👥 Recruiters
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setSelectedCompany(item);
                              setEditModalOpen(true);
                            }}
                            title="Edit College Profile"
                          >
                            Edit
                          </button>
                        )}
                        {canVerify && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setSelectedCompany(item);
                              setVerifyModalOpen(true);
                            }}
                            title="Update Status"
                          >
                            Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {data && data.totalPages > 1 && (
            <div className="pagination-bar">
              <span className="page-size-selector" style={{ fontSize: '12px' }}>
                Showing {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)} of {data.total} companies
              </span>

              <div className="page-nav-btns">
                <button
                  type="button"
                  className="btn-secondary btn-pagination"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="page-number-indicator" style={{ fontSize: '12px' }}>
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-pagination"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Child Modals */}
      <CompanyCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCompanyCreated}
      />

      <CompanyEditModal
        isOpen={editModalOpen}
        company={selectedCompany}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleCompanyUpdated}
      />

      <CompanyVerifyModal
        isOpen={verifyModalOpen}
        company={selectedCompany}
        onClose={() => setVerifyModalOpen(false)}
        onSuccess={handleCompanyUpdated}
      />

      <CompanyTierModal
        isOpen={tierModalOpen}
        company={selectedCompany}
        onClose={() => setTierModalOpen(false)}
        onSuccess={handleCompanyUpdated}
      />

      <CompanyDetailModal
        isOpen={detailModalOpen}
        company={selectedCompany}
        canManage={canManage}
        onClose={() => setDetailModalOpen(false)}
        onOpenEdit={() => {
          setDetailModalOpen(false);
          setEditModalOpen(true);
        }}
        onOpenVerify={() => {
          setDetailModalOpen(false);
          setVerifyModalOpen(true);
        }}
        onOpenTier={() => {
          setDetailModalOpen(false);
          setTierModalOpen(true);
        }}
        onOpenRecruiters={() => {
          setDetailModalOpen(false);
          setRecruiterModalOpen(true);
        }}
      />

      <RecruiterManagementModal
        isOpen={recruiterModalOpen}
        company={selectedCompany}
        onClose={() => setRecruiterModalOpen(false)}
      />
    </div>
  );
}
