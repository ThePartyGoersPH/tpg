import { useEffect, useState } from 'react';
import { paymentsAPI } from '../api/services';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Search, CheckCircle, Banknote, DollarSign, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Payouts() {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayouts, setSelectedPayouts] = useState([]);
  const [filters, setFilters] = useState({ status: 'pending', search: '' });
  const [markSentModal, setMarkSentModal] = useState(null);
  const [formData, setFormData] = useState({ payout_reference: '', notes: '' });

  useEffect(() => { fetchPayouts(); }, [filters.status]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const res = await paymentsAPI.payouts(params);
      if (res.data.success) {
        setPayouts(res.data.data.payouts || []);
        setSummary(res.data.data.summary || null);
      }
    } catch (e) { console.error('Fetch payouts error:', e); }
    finally { setLoading(false); }
  };

  const handleMarkAsSent = async (payoutId) => {
    if (!formData.payout_reference.trim()) { toast.error('Enter a reference number'); return; }
    try {
      const res = await paymentsAPI.markPayoutSent(payoutId, formData);
      if (res.data.success) { toast.success('Payout marked as sent'); setMarkSentModal(null); setFormData({ payout_reference: '', notes: '' }); fetchPayouts(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to mark sent'); }
  };

  const handleComplete = async (payoutId) => {
    try {
      const res = await paymentsAPI.completePayout(payoutId);
      if (res.data.success) { toast.success('Payout completed — bar owner notified'); fetchPayouts(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to complete payout'); }
  };

  const handleBulkMarkAsSent = async () => {
    if (!selectedPayouts.length) { toast.error('Select payouts first'); return; }
    if (!formData.payout_reference.trim()) { toast.error('Enter a reference number'); return; }
    try {
      const res = await paymentsAPI.bulkMarkSent({ payout_ids: selectedPayouts, ...formData });
      if (res.data.success) { toast.success(`${res.data.data.processed_count} payouts processed`); setSelectedPayouts([]); setMarkSentModal(null); setFormData({ payout_reference: '', notes: '' }); fetchPayouts(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleBulkComplete = async () => {
    if (!selectedPayouts.length) { toast.error('Select payouts first'); return; }
    try {
      const res = await paymentsAPI.bulkComplete({ payout_ids: selectedPayouts });
      if (res.data.success) { toast.success(`${res.data.data.processed_count} payouts completed — bar owners notified`); setSelectedPayouts([]); fetchPayouts(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to complete payouts'); }
  };

  const toggle = (id) => setSelectedPayouts(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const sm = summary || {};
  const statusColors = { pending:'bg-amber-500/20 text-amber-400', processing:'bg-blue-500/20 text-blue-400', sent:'bg-purple-500/20 text-purple-400', completed:'bg-green-500/20 text-green-400', failed:'bg-red-500/20 text-red-400', cancelled:'bg-gray-500/20 text-gray-400' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payout Management</h1>
          <p className="text-white/40 text-sm mt-1">Process and track bar owner payouts</p>
        </div>
        {selectedPayouts.length > 0 && (() => {
          const sentPayouts = payouts.filter(p => selectedPayouts.includes(p.id) && p.status === 'sent');
          const pendingPayouts = payouts.filter(p => selectedPayouts.includes(p.id) && (p.status === 'pending' || p.status === 'processing'));
          return (
            <div className="flex items-center gap-2">
              {pendingPayouts.length > 0 && (
                <button onClick={()=>setMarkSentModal({type:'bulk'})} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                  <CheckCircle className="h-4 w-4"/> Mark {pendingPayouts.length} as Sent
                </button>
              )}
              {sentPayouts.length > 0 && (
                <button onClick={handleBulkComplete} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                  <CheckCircle className="h-4 w-4"/> Complete {sentPayouts.length} Payout{sentPayouts.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-red-400"><Banknote className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Total Payouts</p><p className="text-lg font-bold text-white">{sm.total_count ?? 0}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-white/60"><DollarSign className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Gross</p><p className="text-lg font-bold text-white">{formatCurrency(sm.total_gross ?? 0)}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-blue-400"><CreditCard className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Platform Fees</p><p className="text-lg font-bold text-blue-400">{formatCurrency(sm.total_fees ?? 0)}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-green-400"><DollarSign className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Net to Bars</p><p className="text-lg font-bold text-green-400">{formatCurrency(sm.total_net ?? 0)}</p></div></div></div>
      </div>

      <div className="glass-table">
        <div className="p-4 border-b border-white/[0.06] flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="glass-input w-full pl-9 text-sm" placeholder="Search bar, GCash, reference..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} onKeyDown={e=>e.key==='Enter'&&fetchPayouts()}/>
          </div>
          <select className="glass-input text-sm" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={fetchPayouts} className="btn-red text-xs px-4">Search</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left w-10"><input type="checkbox" className="rounded accent-red-500" onChange={e=>{if(e.target.checked){setSelectedPayouts(payouts.filter(p=>p.status==='pending'||p.status==='processing'||p.status==='sent').map(p=>p.id))}else{setSelectedPayouts([])}}}/></th>
              {['Bar','Owner','GCash','Gross','Fee','Net','Status','Date',''].map(h=>(
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-white/30 uppercase ${h===''?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="px-4 py-12 text-center text-white/30">Loading...</td></tr>
              ) : payouts.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-12 text-center text-white/30">No payouts found</td></tr>
              ) : payouts.map(p=>(
                <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{(p.status==='pending'||p.status==='processing'||p.status==='sent')&&<input type="checkbox" className="rounded accent-red-500" checked={selectedPayouts.includes(p.id)} onChange={()=>toggle(p.id)}/>}</td>
                  <td className="px-4 py-3 text-xs font-medium text-white">{p.bar_name}</td>
                  <td className="px-4 py-3 text-xs text-white/60">{p.owner_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{p.bar_gcash_number || p.gcash_number || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{formatCurrency(p.gross_amount)}</td>
                  <td className="px-4 py-3 text-xs text-blue-400">{formatCurrency(p.platform_fee_amount)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-green-400">{formatCurrency(p.net_amount)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[p.status]||'bg-gray-500/20 text-gray-400'}`}>{p.status?.toUpperCase()}</span></td>
                  <td className="px-4 py-3 text-xs text-white/40">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(p.status==='pending'||p.status==='processing')&&(
                        <button onClick={()=>setMarkSentModal({type:'single',payout:p})} className="text-xs font-medium px-3 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">Mark Sent</button>
                      )}
                      {p.status==='sent'&&(
                        <button onClick={()=>handleComplete(p.id)} className="text-xs font-medium px-3 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition">Complete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {markSentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              {markSentModal.type==='bulk'?`Mark ${selectedPayouts.length} Payouts as Sent`:'Mark Payout as Sent'}
            </h3>
            {markSentModal.type==='single'&&markSentModal.payout&&(
              <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
                <div className="flex justify-between"><span className="text-white/40">Bar</span><span className="text-white/80">{markSentModal.payout.bar_name}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Net Amount</span><span className="text-green-400 font-bold">{formatCurrency(markSentModal.payout.net_amount)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">GCash</span><span className="text-white/80">{markSentModal.payout.bar_gcash_number||markSentModal.payout.gcash_number||'N/A'}</span></div>
              </div>
            )}
            {markSentModal.type==='bulk'&&(() => {
              const batchPayouts = payouts.filter(p => selectedPayouts.includes(p.id));
              const totalGross = batchPayouts.reduce((sum, p) => sum + Number(p.gross_amount || 0), 0);
              const totalFees = batchPayouts.reduce((sum, p) => sum + Number(p.platform_fee_amount || 0), 0);
              const totalNet = batchPayouts.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
              const avgFeePercent = totalGross > 0 ? (totalFees / totalGross * 100).toFixed(2) : 0;
              return (
                <div className="mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                      <p className="text-[10px] text-white/40 uppercase mb-1">Total Gross</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(totalGross)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                      <p className="text-[10px] text-white/40 uppercase mb-1">Platform Fees ({avgFeePercent}%)</p>
                      <p className="text-xl font-bold text-blue-400">{formatCurrency(totalFees)}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-[10px] text-green-400 uppercase mb-1">Total Net to Transfer</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(totalNet)}</p>
                    <p className="text-[10px] text-white/40 mt-2">{selectedPayouts.length} payout{selectedPayouts.length !== 1 ? 's' : ''} • {batchPayouts.length} bar{batchPayouts.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded bg-white/[0.02]">
                    {batchPayouts.map(p => (
                      <div key={p.id} className="flex justify-between text-[10px] py-1 border-b border-white/[0.03]">
                        <span className="text-white/60">{p.bar_name}</span>
                        <span className="text-green-400 font-medium">{formatCurrency(p.net_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Reference Number *</label>
                <input className="glass-input w-full text-sm" placeholder="GC-2024-03-18-XXXXX" value={formData.payout_reference} onChange={e=>setFormData({...formData,payout_reference:e.target.value})}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Notes (Optional)</label>
                <textarea rows="2" className="glass-input w-full text-sm" placeholder="Notes..." value={formData.notes} onChange={e=>setFormData({...formData,notes:e.target.value})}/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setMarkSentModal(null);setFormData({payout_reference:'',notes:''})}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={()=>markSentModal.type==='bulk'?handleBulkMarkAsSent():handleMarkAsSent(markSentModal.payout.id)} className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-green-600 hover:bg-green-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
