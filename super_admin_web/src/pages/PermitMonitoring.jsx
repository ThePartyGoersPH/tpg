import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Calendar, Clock, 
  RefreshCw, Loader2, Ban, CheckCheck, Eye, FileText
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime } from '../utils/formatters';

const PermitMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [bars, setBars] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedBar, setSelectedBar] = useState(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const [barsRes, statsRes] = await Promise.all([
        api.get('/permit-monitoring/expiring', { params }),
        api.get('/permit-monitoring/stats')
      ]);
      
      setBars(barsRes.data?.data?.bars || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      console.error('Failed to load permit monitoring data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      const { data } = await api.post('/permit-monitoring/run-check');
      toast.success(`Check completed: ${data.data?.expiringSoonCount ?? 0} expiring, ${data.data?.expiredCount ?? 0} expired`);
      await loadData();
    } catch {
      toast.error('Failed to run permit check');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedBar) return;
    
    setProcessing(true);
    try {
      await api.post(`/permit-monitoring/deactivate/${selectedBar.id}`, {
        reason: deactivateReason || 'Expired business permit'
      });
      toast.success(`Bar "${selectedBar.name}" has been deactivated`);
      setShowDeactivateModal(false);
      setSelectedBar(null);
      setDeactivateReason('');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate bar');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedBar || !newExpiryDate) return;
    
    setProcessing(true);
    try {
      await api.post(`/permit-monitoring/reactivate/${selectedBar.id}`, {
        newExpiryDate
      });
      toast.success(`Bar "${selectedBar.name}" has been reactivated`);
      setShowReactivateModal(false);
      setSelectedBar(null);
      setNewExpiryDate('');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reactivate bar');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status, daysUntilExpiry) => {
    if (status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
          <XCircle className="w-3 h-3" />
          Expired
        </span>
      );
    }
    if (status === 'expiring_soon') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
          <AlertTriangle className="w-3 h-3" />
          Expiring in {daysUntilExpiry} days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
        <CheckCircle className="w-3 h-3" />
        Valid
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Permit Expiry Monitoring</h1>
          <p className="text-sm text-white/40 mt-1">
            Monitor and manage bar business permit expiry dates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunCheck}
            disabled={runningCheck}
            className="btn-red inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {runningCheck ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Run Check Now
          </button>
          <button 
            onClick={loadData} 
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Valid Permits</p>
                <p className="text-2xl font-bold text-white">{stats.overview.valid_permits}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Expiring Soon</p>
                <p className="text-2xl font-bold text-white">{stats.overview.expiring_soon}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Expired</p>
                <p className="text-2xl font-bold text-white">{stats.overview.expired_permits}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <FileText className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">No Date Set</p>
                <p className="text-2xl font-bold text-white">{stats.overview.no_expiry_date}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="glass-card p-1 w-fit flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/90'
          }`}
        >
          All Issues
        </button>
        <button
          onClick={() => setFilter('expiring_soon')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'expiring_soon' ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/90'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
          Expiring Soon
        </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'expired' ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/90'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
            Expired
          </button>
          <button
            onClick={() => setFilter('documents')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'documents' ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/90'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" />
            Missing Documents
          </button>
      </div>

      {/* Bars List */}
      {bars.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <h3 className="font-semibold text-white text-lg">All Clear!</h3>
          <p className="text-sm text-white/40 mt-1">
            {filter === 'all' ? 'No permit issues found' : filter === 'documents' ? 'No bars with missing documents' : `No ${filter.replace('_', ' ')} permits`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bars.map((bar) => (
            <div
              key={bar.id}
              className="glass-card p-6 border-l-4"
              style={{
                borderLeftColor: bar.permit_status === 'expired' ? '#ef4444' :
                  bar.permit_status === 'expiring_soon' ? '#f59e0b' : '#10b981'
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{bar.name}</h3>
                        {getStatusBadge(bar.permit_status, bar.days_until_expiry)}
                      </div>
                      <p className="text-xs text-white/40">
                        {bar.address}, {bar.city}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3">
                    <div>
                      <p className="text-xs text-white/40">Owner</p>
                      <p className="font-medium text-white">
                        {bar.owner_first_name} {bar.owner_last_name}
                      </p>
                      <p className="text-xs text-white/40">{bar.owner_email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Expiry Date</p>
                      <p className="font-medium text-white">
                        {bar.permit_expiry_date ? formatDate(bar.permit_expiry_date) : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Days Until Expiry</p>
                      <p className="font-medium" style={{
                        color: bar.days_until_expiry < 0 ? '#ef4444' :
                               bar.days_until_expiry <= 30 ? '#f59e0b' : '#10b981'
                      }}>
                        {bar.days_until_expiry < 0 ? `${Math.abs(bar.days_until_expiry)} days ago` : `${bar.days_until_expiry} days`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Bar Status</p>
                      <p className="font-medium text-white capitalize">{bar.bar_status}</p>
                    </div>
                  </div>

                  {/* Required documents — resolved from the same registration
                      records the Bar Registration page and Permit Checking use. */}
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]" data-testid="bar-document-status">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-white/40">Required Documents</p>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bar.documents_complete ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}
                        data-testid="bar-documents-count"
                      >
                        {bar.documents_uploaded} / {bar.documents_required} uploaded
                      </span>
                    </div>
                    <p className="text-[11px] mt-1">
                      <span className="text-white/40">Compliance:</span>{' '}
                      <span className="font-semibold" style={{ color: bar.documents_complete ? '#10b981' : '#f59e0b' }}>
                        {(bar.compliance_status || 'incomplete').replaceAll('_', ' ').toUpperCase()}
                      </span>
                    </p>
                    {Array.isArray(bar.documents_missing) && bar.documents_missing.length > 0 && (
                      <p className="text-[11px] text-amber-300/80 mt-1" data-testid="bar-documents-missing">
                        Missing: {bar.documents_missing.join(', ')}
                      </p>
                    )}
                  </div>

                  {bar.permit_expiry_notified_at && (
                    <p className="text-xs text-white/35 mt-2">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Notified: {formatDateTime(bar.permit_expiry_notified_at)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {bar.bar_status === 'active' && bar.permit_status === 'expired' && (
                    <button
                      onClick={() => {
                        setSelectedBar(bar);
                        setShowDeactivateModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    >
                      <Ban className="w-4 h-4" />
                      Deactivate
                    </button>
                  )}
                  {bar.bar_status === 'inactive' && (
                    <button
                      onClick={() => {
                        setSelectedBar(bar);
                        setShowReactivateModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && selectedBar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeactivateModal(false)}>
          <div className="glass-modal p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Deactivate Bar</h3>
            <p className="text-sm text-white/60 mb-4">
              Are you sure you want to deactivate <strong className="text-white">{selectedBar.name}</strong> due to expired permit?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/50 mb-2">Reason (optional)</label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Enter deactivation reason..."
                className="glass-input w-full text-sm"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="btn-ghost"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Deactivate Bar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && selectedBar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReactivateModal(false)}>
          <div className="glass-modal p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Reactivate Bar</h3>
            <p className="text-sm text-white/60 mb-4">
              Reactivate <strong className="text-white">{selectedBar.name}</strong> with a new permit expiry date.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/50 mb-2">New Permit Expiry Date *</label>
              <input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="glass-input w-full text-sm"
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReactivateModal(false)}
                className="btn-ghost"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleReactivate}
                disabled={processing || !newExpiryDate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                Reactivate Bar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermitMonitoring;
