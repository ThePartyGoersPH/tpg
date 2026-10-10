import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { customerApprovalsAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Search, UserCheck, UserX, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDestructive, promptRejectReason, swalSuccess, swalError } from '../utils/swal';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const statusChip = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'bg-green-500/20 text-green-400';
  if (s === 'rejected') return 'bg-red-500/20 text-red-400';
  return 'bg-yellow-500/20 text-yellow-400';
};

const notifyChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent('customer-approvals-changed'));
  } catch {
    // non-browser-safe no-op
  }
};

function avatarFor(c, size = 'w-9 h-9 text-xs') {
  const src = c.profile_picture;
  const initials = `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || '?';
  if (src) {
    return <img src={src} alt={c.name || 'Customer'} className={`${size} rounded-full object-cover`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  }
  return (
    <div className={`${size} rounded-full bg-white/[0.08] flex items-center justify-center font-bold text-white/70`}>
      {initials}
    </div>
  );
}

export default function CustomerApprovals() {
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [tab, setTab] = useState('pending');
  const [verified, setVerified] = useState('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);

  const fetchList = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const params = {
        status: overrides.tab ?? 'pending',
        page: overrides.page ?? 1,
        limit: 20,
        ...(overrides.search ? { search: overrides.search } : {}),
        ...(overrides.verified && overrides.verified !== 'all' ? { verified: overrides.verified } : {}),
      };
      const res = await customerApprovalsAPI.list(params);
      if (res.data?.success) {
        setCustomers(res.data.data?.customers || []);
        setPagination((p) => ({ ...p, ...res.data.data?.pagination }));
        setSelected([]);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await customerApprovalsAPI.stats();
      if (res.data?.success) setStats(res.data.data || { pending: 0, approved: 0, rejected: 0 });
    } catch {
      // badge keeps last known value; page shows its own error on list load
    }
  }, []);

  const refresh = useCallback((t = tab, pg = 1, q = search, v = verified) => {
    fetchList({ tab: t, page: pg, search: q, verified: v });
    fetchStats();
    notifyChanged();
  }, [tab, search, verified, fetchList, fetchStats]);

  // Deep-link from notifications (?status=pending) applies once on mount.
  useEffect(() => {
    const initial = searchParams.get('status');
    const t = ['pending', 'approved', 'rejected', 'all'].includes(initial) ? initial : 'pending';
    setTab(t);
    setPagination((p) => ({ ...p, page: 1 }));
    fetchList({ tab: t, page: 1, verified });
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (t) => {
    setTab(t);
    setPagination((p) => ({ ...p, page: 1 }));
    fetchList({ tab: t, page: 1, search, verified });
  };

  const switchVerified = (v) => {
    setVerified(v);
    setPagination((p) => ({ ...p, page: 1 }));
    fetchList({ tab, page: 1, search, verified: v });
  };

  const doSearch = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    fetchList({ tab, page: 1, search, verified });
  };

  const changePage = (next) => {
    if (next < 1 || next > (pagination.total_pages || 1)) return;
    setPagination((p) => ({ ...p, page: next }));
    fetchList({ tab, page: next, search, verified });
  };

  const handleApprove = async (c) => {
    const ok = await confirmDestructive({
      title: `Approve ${c.name || 'this customer'}?`,
      text: 'They will be able to log in immediately.',
      confirmText: 'Approve',
    });
    if (!ok) return;
    setActing(true);
    try {
      const r = await customerApprovalsAPI.approve(c.id);
      swalSuccess(r.data?.message || 'Customer approved');
      refresh();
      setDetail(null);
    } catch (e) {
      swalError(e.response?.data?.message || 'Failed to approve customer');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (c) => {
    const reason = await promptRejectReason({ name: c.name ? `${c.name} (${c.email || 'no email'})` : '' });
    if (reason === null) return;
    setActing(true);
    try {
      const r = await customerApprovalsAPI.reject(c.id, { reason });
      swalSuccess(r.data?.message || 'Customer rejected');
      refresh();
      setDetail(null);
    } catch (e) {
      swalError(e.response?.data?.message || 'Failed to reject customer');
    } finally {
      setActing(false);
    }
  };

  const handleBulk = async (action) => {
    if (!selected.length) return;
    if (action === 'approve') {
      const ok = await confirmDestructive({
        title: `Approve ${selected.length} customer(s)?`,
        text: 'They will be able to log in immediately.',
        confirmText: 'Approve all',
      });
      if (!ok) return;
    } else {
      const reason = await promptRejectReason({ title: `Reject ${selected.length} customer(s)?` });
      if (reason === null) return;
      return bulkRun(action, reason);
    }
    return bulkRun(action);
  };

  const bulkRun = async (action, reason) => {
    setActing(true);
    try {
      const payload = action === 'reject' ? { action, ids: selected, reason } : { action, ids: selected };
      const r = await customerApprovalsAPI.bulk(payload);
      swalSuccess(r.data?.message || 'Bulk update complete');
      refresh();
    } catch (e) {
      swalError(e.response?.data?.message || 'Bulk update failed — no changes were applied');
    } finally {
      setActing(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.length === customers.length && customers.length ? [] : customers.map((c) => c.id)));
  };

  const ageBadge = (c) => {
    if (c.age === null || c.age === undefined) return <span className="text-white/30">—</span>;
    const underage = Number(c.age) < 18;
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-white/70">{c.age}</span>
        {underage && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 uppercase" title="Under 18 — review carefully">
            Under 18
          </span>
        )}
      </span>
    );
  };

  const canApprove = (c) => {
    const s = String(c.approval_status || '').toLowerCase();
    // Approved-but-unverified rows stay actionable so an admin can backfill
    // the missing verification flag instead of only seeing "Revoke".
    return s === 'pending' || s === 'rejected' || (s === 'approved' && !Number(c.is_verified));
  };

  const rowActions = (c) => {
    const s = String(c.approval_status || '').toLowerCase();
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setDetail(c)}
          className="text-xs font-medium px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20 flex items-center gap-1"
        >
          <Eye className="h-3 w-3" />View
        </button>
        {canApprove(c) && (
          <button
            onClick={() => handleApprove(c)}
            disabled={acting}
            className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center gap-1 disabled:opacity-50"
          >
            <UserCheck className="h-3 w-3" />{s === 'approved' ? 'Verify' : 'Approve'}
          </button>
        )}
        {(s === 'pending' || s === 'approved') && (
          <button
            onClick={() => handleReject(c)}
            disabled={acting}
            className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1 disabled:opacity-50"
          >
            <UserX className="h-3 w-3" />{s === 'approved' ? 'Revoke' : 'Reject'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Approvals</h1>
        <p className="text-white/40 text-sm mt-1">Review new customer registrations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => switchTab('pending')}
          className={`stat-card text-left transition ${tab === 'pending' ? 'ring-2 ring-red-500/60' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06]"><Clock className="h-5 w-5 text-yellow-400" /></div>
            <div>
              <p className="text-[11px] text-white/40 uppercase">Pending</p>
              <p className="text-lg font-bold text-yellow-400">{stats.pending ?? 0}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => switchTab('approved')}
          className={`stat-card text-left transition ${tab === 'approved' ? 'ring-2 ring-red-500/60' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06]"><CheckCircle2 className="h-5 w-5 text-green-400" /></div>
            <div>
              <p className="text-[11px] text-white/40 uppercase">Approved</p>
              <p className="text-lg font-bold text-green-400">{stats.approved ?? 0}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => switchTab('rejected')}
          className={`stat-card text-left transition ${tab === 'rejected' ? 'ring-2 ring-red-500/60' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06]"><XCircle className="h-5 w-5 text-red-400" /></div>
            <div>
              <p className="text-[11px] text-white/40 uppercase">Rejected</p>
              <p className="text-lg font-bold text-red-400">{stats.rejected ?? 0}</p>
            </div>
          </div>
        </button>
      </div>

      <div className="glass-table">
        <div className="p-4 border-b border-white/[0.06] flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                className="glass-input w-full pl-9 text-sm"
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              />
            </div>
            <select
              className="glass-input text-sm"
              value={verified}
              onChange={(e) => switchVerified(e.target.value)}
              aria-label="Filter by email verification"
            >
              <option value="all">All verification</option>
              <option value="verified">Verified only</option>
              <option value="unverified">Unverified only{stats.unverified > 0 ? ` (${stats.unverified})` : ''}</option>
            </select>
            <button onClick={doSearch} className="btn-red text-xs px-4">Search</button>
          </div>
          <div className="flex gap-2 tab-pills-scroll">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${tab === t.key ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/80 border border-white/[0.08]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span>{selected.length} selected</span>
              <button onClick={() => handleBulk('approve')} disabled={acting} className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50">
                Approve selected
              </button>
              <button onClick={() => handleBulk('reject')} disabled={acting} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                Reject selected
              </button>
              <button onClick={() => setSelected([])} className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white/80">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="px-5 py-3 text-left"><input type="checkbox" checked={customers.length > 0 && selected.length === customers.length} onChange={toggleSelectAll} aria-label="Select all" /></th>
              {['Customer', 'Email', 'Phone', 'Age', 'Verified', 'Registered', 'Status', 'Actions'].map((h) => (
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td colSpan="9" className="px-5 py-4"><div className="h-4 rounded bg-white/[0.06] animate-pulse" /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan="9" className="px-5 py-12 text-center text-white/30">No customers waiting for approval</td></tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3"><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {avatarFor(c)}
                      <span className="text-xs text-white/80">{c.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60 max-w-[220px] truncate" title={c.email}>{c.email || '—'}</td>
                  <td className="px-5 py-3 text-xs text-white/60">{c.phone_number || '—'}</td>
                  <td className="px-5 py-3 text-xs">{ageBadge(c)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${Number(c.is_verified) ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {Number(c.is_verified) ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(c.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusChip(c.approval_status)}`}>
                      {c.approval_status || 'approved'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{rowActions(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="md:hidden divide-y divide-white/[0.06]">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4"><div className="h-16 rounded-lg bg-white/[0.06] animate-pulse" /></div>
            ))
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No customers waiting for approval</div>
          ) : customers.map((c) => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} />
                {avatarFor(c, 'w-10 h-10 text-sm')}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/85 truncate">{c.name || '—'}</div>
                  <div className="text-xs text-white/40 truncate">{c.email || ''}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusChip(c.approval_status)}`}>
                  {c.approval_status || 'approved'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span className="text-white/35">Phone</span><span className="text-white/70 text-right truncate">{c.phone_number || '—'}</span>
                <span className="text-white/35">Age</span><span className="text-right">{ageBadge(c)}</span>
                <span className="text-white/35">Verified</span>
                <span className="text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${Number(c.is_verified) ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{Number(c.is_verified) ? 'VERIFIED' : 'UNVERIFIED'}</span></span>
                <span className="text-white/35">Registered</span><span className="text-white/50 text-right">{formatDateTime(c.created_at)}</span>
              </div>
              <div className="pt-1">{rowActions(c)}</div>
            </div>
          ))}
        </div>

        {pagination.total_pages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-white/[0.06]">
            <button
              disabled={pagination.page <= 1}
              onClick={() => changePage(pagination.page - 1)}
              className="px-4 py-2 rounded-lg text-xs bg-white/[0.06] text-white/60 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-white/40">Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)</span>
            <button
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => changePage(pagination.page + 1)}
              className="px-4 py-2 rounded-lg text-xs bg-white/[0.06] text-white/60 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-modal p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Customer details</h3>
              <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white text-xl" aria-label="Close">&times;</button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              {avatarFor(detail, 'w-12 h-12 text-base')}
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">{detail.name || '—'}</div>
                <div className="text-xs text-white/40 truncate">{detail.email || ''}</div>
              </div>
              <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusChip(detail.approval_status)}`}>
                {detail.approval_status || 'approved'}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              {[
                ['Phone', detail.phone_number || '—'],
                ['Date of birth', detail.date_of_birth ? formatDateTime(detail.date_of_birth) : '—'],
                ['Age', detail.age ?? '—'],
                ['Email verified', Number(detail.is_verified) ? 'Yes' : 'No'],
                ['Registered', formatDateTime(detail.created_at)],
                ['Reviewed by', detail.reviewed_by_name || '—'],
                ['Reviewed at', detail.reviewed_at ? formatDateTime(detail.reviewed_at) : '—'],
                ['Rejection reason', detail.rejection_reason || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="w-32 flex-shrink-0 text-white/35">{k}</span>
                  <span className="text-white/75 break-words">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              {canApprove(detail) && (
                <button
                  onClick={() => handleApprove(detail)}
                  disabled={acting}
                  className="text-xs font-medium px-3 py-2 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                >
                  {String(detail.approval_status || '').toLowerCase() === 'approved' ? 'Mark verified' : 'Approve'}
                </button>
              )}
              {(String(detail.approval_status || '').toLowerCase() === 'pending' ||
                String(detail.approval_status || '').toLowerCase() === 'approved') && (
                <button
                  onClick={() => handleReject(detail)}
                  disabled={acting}
                  className="text-xs font-medium px-3 py-2 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  {String(detail.approval_status || '').toLowerCase() === 'approved' ? 'Revoke' : 'Reject'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
