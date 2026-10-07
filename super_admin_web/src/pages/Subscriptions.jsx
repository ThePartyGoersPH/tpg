import { useEffect, useState } from 'react';
import { subscriptionsAPI } from '../api/services';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Package, CheckCircle, XCircle, Eye, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionModal, setActionModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [editPriceModal, setEditPriceModal] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [actionData, setActionData] = useState({ start_date: '', notes: '', reason: '' });

  useEffect(() => { fetchPlans(); fetchSubscriptions(); }, [activeTab]);

  const fetchPlans = async () => {
    try { const r = await subscriptionsAPI.getPlans(); if (r.data.success) setPlans(r.data.data || []); } catch (e) { console.error(e); }
  };

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const r = activeTab === 'pending' ? await subscriptionsAPI.getPending() : await subscriptionsAPI.listAll();
      if (r.data.success) setSubscriptions(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    if (!actionData.start_date) { toast.error('Select a start date'); return; }
    try {
      const r = await subscriptionsAPI.approve(id, { start_date: actionData.start_date, notes: actionData.notes });
      if (r.data.success) { toast.success('Subscription approved'); setActionModal(null); setActionData({ start_date: '', notes: '', reason: '' }); fetchSubscriptions(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to approve'); }
  };

  const handleReject = async (id) => {
    if (!actionData.reason.trim()) { toast.error('Provide a rejection reason'); return; }
    try {
      const r = await subscriptionsAPI.reject(id, { reason: actionData.reason });
      if (r.data.success) { toast.success('Subscription rejected'); setActionModal(null); setActionData({ start_date: '', notes: '', reason: '' }); fetchSubscriptions(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to reject'); }
  };

  const handleUpdatePrice = async (planId) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    try {
      const r = await subscriptionsAPI.updatePlanPrice(planId, { price });
      if (r.data.success) { toast.success('Plan price updated'); setEditPriceModal(null); setNewPrice(''); fetchPlans(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update price'); }
  };

  const statusColors = { pending:'bg-amber-500/20 text-amber-400', active:'bg-green-500/20 text-green-400', approved:'bg-green-500/20 text-green-400', rejected:'bg-red-500/20 text-red-400', cancelled:'bg-gray-500/20 text-gray-400', expired:'bg-gray-500/20 text-gray-400' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
        <p className="text-white/40 text-sm mt-1">Manage subscription plans and approvals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {plans.map(plan=>(
          <div key={plan.id} className="glass-card p-5">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-6 w-6 text-red-400"/>
              <div className="flex items-center gap-2">
                {plan.is_active ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">Active</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-400">Inactive</span>}
                <button onClick={()=>{setEditPriceModal(plan);setNewPrice(plan.price)}} className="p-1 hover:bg-white/[0.06] rounded transition" title="Edit Price">
                  <Edit2 className="h-3.5 w-3.5 text-white/40 hover:text-white/70"/>
                </button>
              </div>
            </div>
            <h3 className="text-sm font-bold text-white">{plan.display_name || plan.name}</h3>
            <p className="text-xl font-bold text-red-400 mt-1">{formatCurrency(plan.price)}<span className="text-xs text-white/30 ml-1">/{plan.billing_cycle}</span></p>
            <div className="mt-2 text-[11px] text-white/40 space-y-0.5">
              <p>Max Branches: {plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches}</p>
              <p>Active Subscribers: {plan.active_subscriptions || 0}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-table">
        <div className="flex border-b border-white/[0.06]">
          {['pending','all'].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${activeTab===tab?'text-red-400 border-b-2 border-red-500':'text-white/40 hover:text-white/60'}`}>
              {tab === 'pending' ? 'Pending Approvals' : 'All Subscriptions'}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['ID','Owner','Owner Email','Bar','Plan','Payment','Status','Date','Actions'].map(h=>(
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan="9" className="px-5 py-12 text-center text-white/30">No subscriptions found</td></tr>
              ) : subscriptions.map(sub=>(
                <tr key={sub.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-xs font-mono text-white/50">#{sub.id}</td>
                  <td className="px-5 py-3 text-xs font-medium text-white">{sub.owner_name || sub.first_name && `${sub.first_name} ${sub.last_name}` || 'N/A'}</td>
                  <td className="px-5 py-3 text-xs text-white/40">{sub.owner_email || sub.email || '-'}</td>
                  <td className="px-5 py-3 text-xs text-white/60">{sub.bar_name || sub.business_name || 'N/A'}</td>
                  <td className="px-5 py-3 text-xs text-white/70">{sub.plan_name || sub.display_name || '-'}</td>
                  <td className="px-5 py-3 text-xs text-white/50 capitalize">{sub.payment_method || '-'}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[sub.status]||'bg-gray-500/20 text-gray-400'}`}>{sub.status?.toUpperCase()}</span></td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(sub.created_at)}</td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                    <button onClick={()=>setDetailModal(sub)} className="text-white/30 hover:text-white/70 p-1"><Eye className="h-3.5 w-3.5"/></button>
                    {sub.status === 'pending' && (
                      <>
                        <button onClick={()=>setActionModal({type:'approve',subscription:sub})} className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">Approve</button>
                        <button onClick={()=>setActionModal({type:'reject',subscription:sub})} className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Reject</button>
                      </>
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
              <h3 className="text-lg font-bold text-white">Subscription Details</h3>
              <button onClick={()=>setDetailModal(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['ID', `#${detailModal.id}`],
                ['Owner', detailModal.owner_name || `${detailModal.first_name || ''} ${detailModal.last_name || ''}`],
                ['Owner Email', detailModal.owner_email || detailModal.email || '-'],
                ['Bar', detailModal.bar_name || detailModal.business_name || '-'],
                ['Plan', detailModal.plan_name || detailModal.display_name || '-'],
                ['Price', detailModal.price ? formatCurrency(detailModal.price) : '-'],
                ['Billing Cycle', detailModal.billing_cycle || '-'],
                ['Payment Method', detailModal.payment_method || '-'],
                ['Payment Reference', detailModal.payment_reference || '-'],
                ['Status', detailModal.status],
                ['Start Date', detailModal.start_date ? formatDateTime(detailModal.start_date) : '-'],
                ['Expires At', detailModal.expires_at ? formatDateTime(detailModal.expires_at) : '-'],
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

      {editPriceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Edit Plan Price</h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Plan</span><span className="text-white/80 font-medium">{editPriceModal.display_name || editPriceModal.name}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Current Price</span><span className="text-red-400 font-bold">{formatCurrency(editPriceModal.price)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Active Subscribers</span><span className="text-white/60">{editPriceModal.active_subscriptions || 0}</span></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/50 mb-1">New Price *</label>
              <input type="number" step="0.01" min="0" className="glass-input w-full text-sm" placeholder="0.00" value={newPrice} onChange={e=>setNewPrice(e.target.value)}/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setEditPriceModal(null);setNewPrice('')}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={()=>handleUpdatePrice(editPriceModal.id)} className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700">Update Price</button>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">{actionModal.type==='approve'?'Approve Subscription':'Reject Subscription'}</h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Owner</span><span className="text-white/80">{actionModal.subscription.owner_name || `${actionModal.subscription.first_name||''} ${actionModal.subscription.last_name||''}`}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Bar</span><span className="text-white/80">{actionModal.subscription.bar_name || actionModal.subscription.business_name || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Plan</span><span className="text-white/80">{actionModal.subscription.plan_name || actionModal.subscription.display_name}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Price</span><span className="text-red-400 font-bold">{formatCurrency(actionModal.subscription.price)}</span></div>
            </div>
            {actionModal.type==='approve'?(
              <div className="space-y-3">
                <div><label className="block text-xs font-medium text-white/50 mb-1">Start Date *</label><input type="date" className="glass-input w-full text-sm" value={actionData.start_date} onChange={e=>setActionData({...actionData,start_date:e.target.value})}/></div>
                <div><label className="block text-xs font-medium text-white/50 mb-1">Notes</label><textarea rows="2" className="glass-input w-full text-sm" value={actionData.notes} onChange={e=>setActionData({...actionData,notes:e.target.value})}/></div>
              </div>
            ):(
              <div><label className="block text-xs font-medium text-white/50 mb-1">Rejection Reason *</label><textarea rows="3" className="glass-input w-full text-sm" placeholder="Reason..." value={actionData.reason} onChange={e=>setActionData({...actionData,reason:e.target.value})}/></div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={()=>{setActionModal(null);setActionData({start_date:'',notes:'',reason:''})}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={()=>actionModal.type==='approve'?handleApprove(actionModal.subscription.id):handleReject(actionModal.subscription.id)} className={`flex-1 text-sm rounded-lg py-2 font-medium text-white ${actionModal.type==='approve'?'bg-green-600 hover:bg-green-700':'bg-red-600 hover:bg-red-700'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
