import React, { useState, useEffect } from 'react';
import {
  Crown, Check, X, Clock, Eye, Loader2, CreditCard,
  AlertTriangle, RefreshCw, Filter, ChevronDown,
} from 'lucide-react';
import { subscriptionApi } from '../api/subscriptionApi';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const STATUS_BADGE = {
  pending: 'badge-warning',
  active: 'badge-success',
  cancelled: 'badge-gray',
  expired: 'badge-danger',
  rejected: 'badge-danger',
  past_due: 'badge-warning',
};

const PAYMENT_LABELS = {
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
  manual: 'Bank Transfer',
};

const SubscriptionApprovals = () => {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('pending');
  const [historyFilter, setHistoryFilter] = useState('');
  const [processing, setProcessing] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        subscriptionApi.getPending(),
        subscriptionApi.getAll(),
      ]);
      setPending(pendingRes.data.data || []);
      setHistory(allRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      const { data } = await subscriptionApi.approve(id);
      toast.success(data.message || 'Subscription approved');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessing(rejectModal.id);
    try {
      const { data } = await subscriptionApi.reject(rejectModal.id, rejectReason);
      toast.success(data.message || 'Subscription rejected');
      setRejectModal(null);
      setRejectReason('');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const filteredHistory = historyFilter
    ? history.filter((s) => s.status === historyFilter)
    : history;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Subscription Approvals</h2>
          <p className="text-sm mt-0.5" style={{ color: '#888' }}>
            Review and approve subscription payment requests from bar owners.
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setTab('pending')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={tab === 'pending' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Pending
          {pending.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#fbbf24', color: '#000' }}>
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={tab === 'history' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
        >
          <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
          All Subscriptions
        </button>
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div className="card text-center py-12">
              <Check className="w-12 h-12 mx-auto mb-3" style={{ color: '#4ade80' }} />
              <h3 className="font-semibold text-white text-lg">All caught up!</h3>
              <p className="text-sm mt-1" style={{ color: '#888' }}>No pending subscription requests to review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((sub) => (
                <div key={sub.id} className="card" style={{ borderLeft: '4px solid #fbbf24' }}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
                          <Crown className="w-4 h-4" style={{ color: '#fbbf24' }} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {sub.first_name} {sub.last_name}
                          </p>
                          <p className="text-xs" style={{ color: '#888' }}>{sub.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3">
                        <div>
                          <p className="text-xs" style={{ color: '#666' }}>Plan</p>
                          <p className="font-semibold text-white">{sub.plan_display_name}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#666' }}>Amount</p>
                          <p className="font-semibold text-white">₱{Number(sub.amount_paid || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#666' }}>Payment</p>
                          <p className="font-semibold text-white">{PAYMENT_LABELS[sub.payment_method] || sub.payment_method}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: '#666' }}>Reference</p>
                          <p className="font-semibold text-white break-all">{sub.payment_reference || '—'}</p>
                        </div>
                      </div>

                      <p className="text-xs mt-2" style={{ color: '#555' }}>
                        Submitted {new Date(sub.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={processing === sub.id}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                      >
                        {processing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => { setRejectModal(sub); setRejectReason(''); }}
                        disabled={processing === sub.id}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(204,0,0,0.1)', color: '#ff6666', border: '1px solid rgba(204,0,0,0.3)' }}
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {/* Filter */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              className="input-field w-auto text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm" style={{ color: '#888' }}>No subscriptions found.</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#161616' }}>
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Owner</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Plan</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Amount</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Payment</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Reference</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Status</th>
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: '#888' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((sub) => (
                      <tr key={sub.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{sub.first_name} {sub.last_name}</p>
                          <p className="text-xs" style={{ color: '#666' }}>{sub.email}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{sub.plan_display_name}</td>
                        <td className="px-4 py-3" style={{ color: '#ccc' }}>₱{Number(sub.amount_paid || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 capitalize" style={{ color: '#ccc' }}>{PAYMENT_LABELS[sub.payment_method] || sub.payment_method || '—'}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate" style={{ color: '#ccc' }}>{sub.payment_reference || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`capitalize ${STATUS_BADGE[sub.status] || 'badge-gray'}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#666' }}>
                          {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !processing && setRejectModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(204,0,0,0.12)' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: '#ff6666' }} />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Reject Subscription?</h3>
            <p className="text-sm text-center mb-4" style={{ color: '#888' }}>
              Reject <strong className="text-white">{rejectModal.first_name} {rejectModal.last_name}</strong>'s {rejectModal.plan_display_name} plan request
              (₱{Number(rejectModal.amount_paid || 0).toLocaleString()})?
            </p>
            <div className="mb-4">
              <label className="label">Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="e.g. Invalid reference number, payment not found..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                disabled={processing}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionApprovals;
