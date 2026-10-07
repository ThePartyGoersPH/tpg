import { useEffect, useState } from 'react';
import { barsAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Search, MapPin, Eye, Building2, GitBranch, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Bars() {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '', type: '' });

  useEffect(() => { fetchBars(); }, [filters.status, filters.type]);

  const fetchBars = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.q = filters.search;
      const res = await barsAPI.list(params);
      if (res.data.success) setBars(res.data.data || []);
    } catch (e) { console.error('Fetch bars error:', e); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try { const r = await barsAPI.approve(id); if (r.data.success) { toast.success('Bar approved'); setActionModal(null); fetchBars(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };
  const handleSuspend = async (id) => {
    if (!actionReason.trim()) { toast.error('Provide a reason'); return; }
    try { const r = await barsAPI.suspend(id, { reason: actionReason }); if (r.data.success) { toast.success('Bar suspended'); setActionModal(null); setActionReason(''); fetchBars(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };
  const handleReactivate = async (id) => {
    try { const r = await barsAPI.reactivate(id); if (r.data.success) { toast.success('Bar reactivated'); setActionModal(null); fetchBars(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const isMainBar = (b) => !b.parent_bar_id && (b.is_main_branch === 1 || b.is_main_branch === true || !b.parent_bar_id);
  const isBranch = (b) => !!b.parent_bar_id;
  const filteredBars = filters.type === 'bar' ? bars.filter(b => isMainBar(b)) : filters.type === 'branch' ? bars.filter(b => isBranch(b)) : bars;

  const mainBars = bars.filter(b => isMainBar(b));
  const branches = bars.filter(b => isBranch(b));
  const statusColors = { pending:'bg-amber-500/20 text-amber-400', approved:'bg-green-500/20 text-green-400', active:'bg-green-500/20 text-green-400', inactive:'bg-red-500/20 text-red-400', suspended:'bg-red-500/20 text-red-400', rejected:'bg-gray-500/20 text-gray-400' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bars & Branches</h1>
        <p className="text-white/40 text-sm mt-1">Manage all bars and branches across the platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-red-400"><Store className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Total</p><p className="text-lg font-bold text-white">{bars.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-blue-400"><Building2 className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Main Bars</p><p className="text-lg font-bold text-blue-400">{mainBars.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-purple-400"><GitBranch className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Branches</p><p className="text-lg font-bold text-purple-400">{branches.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-amber-400"><MapPin className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Pending</p><p className="text-lg font-bold text-amber-400">{bars.filter(b=>b.status==='pending').length}</p></div></div></div>
      </div>

      <div className="glass-table">
        <div className="p-4 border-b border-white/[0.06] flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="glass-input w-full pl-9 text-sm" placeholder="Search bar name, owner..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} onKeyDown={e=>e.key==='Enter'&&fetchBars()}/>
          </div>
          <select className="glass-input text-sm" value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value})}>
            <option value="">All Types</option>
            <option value="bar">Main Bars Only</option>
            <option value="branch">Branches Only</option>
          </select>
          <select className="glass-input text-sm" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Deactivated</option>
          </select>
          <button onClick={fetchBars} className="btn-red text-xs px-4">Search</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['Name','Type','Owner','Location','Status','Payouts','Created','Actions'].map(h=>(
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : filteredBars.length === 0 ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">No bars found</td></tr>
              ) : filteredBars.map(bar=>(
                <tr key={bar.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-white">{bar.name}</div>
                    {bar.parent_bar_name && <div className="text-[10px] text-white/30">Parent: {bar.parent_bar_name}</div>}
                  </td>
                  <td className="px-5 py-3">
                    {isBranch(bar) ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 flex items-center gap-1 w-fit"><GitBranch className="h-3 w-3"/>Branch</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 flex items-center gap-1 w-fit"><Building2 className="h-3 w-3"/>Main Bar</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60">{bar.owner_name || 'N/A'}</td>
                  <td className="px-5 py-3 text-xs text-white/50">{bar.city || bar.address || 'N/A'}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[bar.status]||'bg-gray-500/20 text-gray-400'}`}>{bar.status === 'inactive' ? 'DEACTIVATED' : bar.status?.toUpperCase()}</span></td>
                  <td className="px-5 py-3">{
                    bar.stripe_onboarding_status === 'active'
                      ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300" title="Stripe Connect active">STRIPE</span>
                      : (bar.paymongo_mode === 'live'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400" title={`Live — child ${bar.paymongo_child_merchant_id || '?'}`}>LIVE</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400" title={bar.paymongo_test_connected ? 'Test Mode connected' : 'Test Mode — not connected'}>TEST</span>)
                  }</td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(bar.created_at)}</td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                    <button onClick={()=>setDetailModal(bar)} className="text-white/30 hover:text-white/70 p-1"><Eye className="h-3.5 w-3.5"/></button>
                    {bar.status==='pending'&&(
                      <button onClick={()=>setActionModal({type:'approve',bar})} className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">Approve</button>
                    )}
                    {(bar.status==='approved' || bar.status==='active')&&(
                      <button onClick={()=>setActionModal({type:'suspend',bar})} className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Deactivate</button>
                    )}
                    {bar.status==='inactive'&&(
                      <button onClick={()=>setActionModal({type:'reactivate',bar})} className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Bar Details</h3>
              <button onClick={()=>setDetailModal(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Name', detailModal.name],
                ['Type', isBranch(detailModal) ? 'Branch' : 'Main Bar'],
                ['Parent Bar', detailModal.parent_bar_name || '-'],
                ['Owner', detailModal.owner_name || '-'],
                ['Email', detailModal.email || '-'],
                ['Phone', detailModal.phone || '-'],
                ['Address', detailModal.address || '-'],
                ['City', detailModal.city || '-'],
                ['Status', detailModal.status],
                ['Business Type', detailModal.business_type || '-'],
                ['DTI/SEC #', detailModal.dti_sec_number || '-'],
                ['GCash #', detailModal.gcash_number || '-'],
                ['GCash Name', detailModal.gcash_name || '-'],
                ['Created', formatDateTime(detailModal.created_at)],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-white/40">{k}</span>
                  <span className="text-white/80 font-medium capitalize text-right">{v}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setDetailModal(null)} className="btn-ghost w-full mt-4 text-sm">Close</button>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              {actionModal.type === 'approve' && 'Approve Bar'}
              {actionModal.type === 'suspend' && 'Deactivate Bar'}
              {actionModal.type === 'reactivate' && 'Reactivate Bar'}
            </h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Bar</span><span className="text-white/80">{actionModal.bar.name}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Type</span><span className="text-white/80">{isBranch(actionModal.bar)?'Branch':'Main Bar'}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Owner</span><span className="text-white/80">{actionModal.bar.owner_name||'N/A'}</span></div>
            </div>
            {actionModal.type==='suspend'&&(
              <div className="mb-4"><label className="block text-xs font-medium text-white/50 mb-1">Reason *</label><textarea rows="3" className="glass-input w-full text-sm" placeholder="Reason shown to users under this bar when they log in..." value={actionReason} onChange={e=>setActionReason(e.target.value)}/></div>
            )}
            <div className="flex gap-3">
              <button onClick={()=>{setActionModal(null);setActionReason('')}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={()=>{
                if(actionModal.type==='approve') handleApprove(actionModal.bar.id);
                else if(actionModal.type==='suspend') handleSuspend(actionModal.bar.id);
                else if(actionModal.type==='reactivate') handleReactivate(actionModal.bar.id);
              }} className={`flex-1 text-sm rounded-lg py-2 font-medium text-white ${actionModal.type==='suspend'?'bg-red-600 hover:bg-red-700':'bg-green-600 hover:bg-green-700'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
