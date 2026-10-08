import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Calendar, Clock, 
  RefreshCw, Loader2, Ban, CheckCheck, Eye, FileText
} from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { format } from 'date-fns';

const PermitMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [bars, setBars] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // all, expiring_soon, expired
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
      const [barsRes, statsRes] = await Promise.allSettled([
        apiClient.get('/permit-monitoring/expiring', { params }),
        apiClient.get('/permit-monitoring/stats')
      ]);
      
      if (barsRes.status === 'fulfilled') {
        setBars(barsRes.value.data.data.bars || []);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.data || null);
      }
      if (barsRes.status === 'rejected' && statsRes.status === 'rejected') {
        toast.error('Failed to load permit data');
      }
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
      const { data } = await apiClient.post('/permit-monitoring/run-check');
      toast.success(`Check completed: ${data.data.expiringSoonCount} expiring, ${data.data.expiredCount} expired`);
      await loadData();
    } catch (err) {
      toast.error('Failed to run permit check');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedBar) return;
    
    setProcessing(true);
    try {
      await apiClient.post(`/permit-monitoring/deactivate/${selectedBar.id}`, {
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
      await apiClient.post(`/permit-monitoring/reactivate/${selectedBar.id}`, {
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
        <span className="badge-danger flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Expired
        </span>
      );
    }
    if (status === 'expiring_soon') {
      return (
        <span className="badge-warning flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Expiring in {daysUntilExpiry} days
        </span>
      );
    }
    return (
      <span className="badge-success flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Valid
      </span>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Permit Expiry Monitoring</h2>
          <p className="text-sm mt-1" style={{ color: '#888' }}>
            Monitor and manage bar business permit expiry dates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunCheck}
            disabled={runningCheck}
            className="btn-secondary flex items-center gap-2"
          >
            {runningCheck ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Run Check Now
          </button>
          <button onClick={loadData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-5 h-5" style={{ color: '#4ade80' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#888' }}>Valid Permits</p>
                <p className="text-2xl font-bold text-white">{stats.overview.valid_permits}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#888' }}>Expiring Soon</p>
                <p className="text-2xl font-bold text-white">{stats.overview.expiring_soon}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#888' }}>Expired</p>
                <p className="text-2xl font-bold text-white">{stats.overview.expired_permits}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(156,163,175,0.15)' }}>
                <FileText className="w-5 h-5" style={{ color: '#9ca3af' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#888' }}>No Date Set</p>
                <p className="text-2xl font-bold text-white">{stats.overview.no_expiry_date}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 rounded-xl p-1 w-fit" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
        <button
          onClick={() => setFilter('all')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={filter === 'all' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
        >
          All Issues
        </button>
        <button
          onClick={() => setFilter('expiring_soon')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={filter === 'expiring_soon' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
          Expiring Soon
        </button>
        <button
          onClick={() => setFilter('expired')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={filter === 'expired' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
        >
          <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
          Expired
        </button>
      </div>

      {/* Bars List */}
      {bars.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#4ade80' }} />
          <h3 className="font-semibold text-white text-lg">All Clear!</h3>
          <p className="text-sm mt-1" style={{ color: '#888' }}>
            {filter === 'all' ? 'No permit issues found' : `No ${filter.replace('_', ' ')} permits`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bars.map((bar) => (
            <div
              key={bar.id}
              className="card"
              style={{
                borderLeft: `4px solid ${
                  bar.permit_status === 'expired' ? '#ef4444' :
                  bar.permit_status === 'expiring_soon' ? '#fbbf24' : '#4ade80'
                }`
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
                      <p className="text-xs" style={{ color: '#666' }}>
                        {bar.address}, {bar.city}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3">
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Owner</p>
                      <p className="font-medium text-white">
                        {bar.owner_first_name} {bar.owner_last_name}
                      </p>
                      <p className="text-xs" style={{ color: '#888' }}>{bar.owner_email}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Expiry Date</p>
                      <p className="font-medium text-white">
                        {bar.permit_expiry_date ? format(new Date(bar.permit_expiry_date), 'MMM d, yyyy') : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Days Until Expiry</p>
                      <p className="font-medium" style={{
                        color: bar.days_until_expiry < 0 ? '#ef4444' :
                               bar.days_until_expiry <= 30 ? '#fbbf24' : '#4ade80'
                      }}>
                        {bar.days_until_expiry < 0 ? `${Math.abs(bar.days_until_expiry)} days ago` : `${bar.days_until_expiry} days`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Bar Status</p>
                      <p className="font-medium text-white capitalize">{bar.bar_status}</p>
                    </div>
                  </div>

                  {bar.permit_expiry_notified_at && (
                    <p className="text-xs mt-2" style={{ color: '#555' }}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      Notified: {format(new Date(bar.permit_expiry_notified_at), 'MMM d, yyyy h:mm a')}
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
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
        <div className="modal-overlay" onClick={() => setShowDeactivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Deactivate Bar</h3>
            <p className="text-sm mb-4" style={{ color: '#ccc' }}>
              Are you sure you want to deactivate <strong>{selectedBar.name}</strong> due to expired permit?
            </p>
            <div className="mb-4">
              <label className="label">Reason (optional)</label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Enter deactivation reason..."
                className="input-field"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={processing}
                className="btn-danger flex items-center gap-2"
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
        <div className="modal-overlay" onClick={() => setShowReactivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Reactivate Bar</h3>
            <p className="text-sm mb-4" style={{ color: '#ccc' }}>
              Reactivate <strong>{selectedBar.name}</strong> with a new permit expiry date.
            </p>
            <div className="mb-4">
              <label className="label">New Permit Expiry Date *</label>
              <input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReactivateModal(false)}
                className="btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>
              <button
                onClick={handleReactivate}
                disabled={processing || !newExpiryDate}
                className="btn-primary flex items-center gap-2"
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
