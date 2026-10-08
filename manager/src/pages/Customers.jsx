import React, { useState, useEffect } from 'react';
import { Search, Ban, ShieldCheck, LayoutGrid, List } from 'lucide-react';
import { customerApi } from '../api/customerApi';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('customers_view') || 'list');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, id: null });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    localStorage.setItem('customers_view', view);
  }, [view]);

  const load = async () => {
    try {
      const { data } = await customerApi.list();
      setCustomers(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const handleBan = (id) => setConfirmModal({ isOpen: true, action: 'ban', id });
  const handleUnban = (id) => setConfirmModal({ isOpen: true, action: 'unban', id });

  const executeAction = async () => {
    const { action, id } = confirmModal;
    try {
      if (action === 'ban') { await customerApi.ban(id); toast.success('Customer banned'); }
      else { await customerApi.unban(id); toast.success('Customer unbanned'); }
      setConfirmModal({ isOpen: false, action: null, id: null });
      load();
    } catch {}
  };

  const filtered = customers.filter((c) => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone_number || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search className="w-4 h-4" style={{ color: '#555' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
        </div>
        <div className="flex items-center rounded-lg p-1 gap-1" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-md transition-colors ${view === 'list' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            style={view === 'list' ? { background: 'rgba(255,255,255,0.08)' } : {}}
            title="List view"
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-md transition-colors ${view === 'grid' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            style={view === 'grid' ? { background: 'rgba(255,255,255,0.08)' } : {}}
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}><tr>
                <th className="table-header">Customer</th>
                <th className="table-header">Email</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Reservations</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id || c.user_id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'rgba(204,0,0,0.2)' }}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <span className="font-medium text-white">{c.first_name} {c.last_name}</span>
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: '#888' }}>{c.email || '—'}</td>
                    <td className="table-cell">{c.phone_number || '—'}</td>
                    <td className="table-cell">{c.reservation_count || 0}</td>
                    <td className="table-cell">
                      <span className={c.is_banned ? 'badge-danger' : 'badge-success'}>
                        {c.is_banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      {c.is_banned ? (
                        <button onClick={() => handleUnban(c.id || c.user_id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          title="Unban"><ShieldCheck className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => handleBan(c.id || c.user_id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#ff6666' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          title="Ban"><Ban className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="6" className="text-center py-8" style={{ color: '#555' }}>{debouncedSearch ? `No customers found for "${debouncedSearch}"` : 'No customers found.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
              {debouncedSearch ? `No customers found for "${debouncedSearch}"` : 'No customers found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((c) => (
                <div key={c.id || c.user_id} className="rounded-xl p-4 flex flex-col gap-3 transition-colors" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: 'rgba(204,0,0,0.2)' }}>
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white text-sm truncate">{c.first_name} {c.last_name}</div>
                        <div className="text-xs truncate" style={{ color: '#888' }}>{c.email || '—'}</div>
                      </div>
                    </div>
                    {c.is_banned ? (
                      <button onClick={() => handleUnban(c.id || c.user_id)} className="p-1.5 rounded-lg transition-colors shrink-0" style={{ color: '#4ade80' }} title="Unban"><ShieldCheck className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => handleBan(c.id || c.user_id)} className="p-1.5 rounded-lg transition-colors shrink-0" style={{ color: '#ff6666' }} title="Ban"><Ban className="w-4 h-4" /></button>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs" style={{ color: '#aaa' }}>
                    <div className="truncate">{c.phone_number || '—'}</div>
                    <div className="flex items-center justify-between">
                      <span>{c.reservation_count || 0} reservations</span>
                      <span className={c.is_banned ? 'badge-danger' : 'badge-success'}>{c.is_banned ? 'Banned' : 'Active'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, id: null })}
        onConfirm={executeAction}
        title={confirmModal.action === 'ban' ? 'Ban Customer?' : 'Unban Customer?'}
        message={confirmModal.action === 'ban'
          ? 'This customer will be banned from your bar and unable to make reservations.'
          : 'This customer will be unbanned and able to use your bar again.'}
        confirmText={confirmModal.action === 'ban' ? 'Ban' : 'Unban'}
        type={confirmModal.action === 'ban' ? 'danger' : 'info'}
      />
    </div>
  );
};

export default Customers;
