import { useEffect, useMemo, useState } from 'react';
import { banningAPI, barsAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Search, UserX, Shield, ShieldOff, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Banning() {
  const [customers, setCustomers] = useState([]);
  const [barBans, setBarBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global');
  const [banModal, setBanModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [banReason, setBanReason] = useState('');
  const [barBanModal, setBarBanModal] = useState(null);
  const [barBanReason, setBarBanReason] = useState('');
  const [barAccessModal, setBarAccessModal] = useState(null);
  const [barAccessReason, setBarAccessReason] = useState('');
  const [expandedBars, setExpandedBars] = useState({});

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'global') fetchGlobalBans();
    else fetchBarBans();
  }, [activeTab, statusFilter]);

  const fetchGlobalBans = async () => {
    try {
      const params = { status: statusFilter };
      if (searchTerm) params.q = searchTerm;
      const res = await banningAPI.getGlobalBans(params);
      if (res.data.success) setCustomers(res.data.data || []);
    } catch (e) { console.error('Fetch global bans error:', e); }
    finally { setLoading(false); }
  };

  const fetchBarBans = async () => {
    try {
      const params = { status: statusFilter };
      if (searchTerm) params.q = searchTerm;
      const res = await banningAPI.getBarBans(params);
      if (res.data.success) setBarBans(res.data.data || []);
    } catch (e) { console.error('Fetch bar bans error:', e); }
    finally { setLoading(false); }
  };

  const handleGlobalBan = async (customerId) => {
    try {
      const res = await banningAPI.banGlobal(customerId, { reason: banReason });
      if (res.data.success) { toast.success('Customer banned from platform'); setBanModal(null); setBanReason(''); fetchGlobalBans(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to ban'); }
  };

  const handleGlobalUnban = async (customerId) => {
    try {
      const res = await banningAPI.unbanGlobal(customerId);
      if (res.data.success) { toast.success('Customer unbanned'); setBanModal(null); setBanReason(''); fetchGlobalBans(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to unban'); }
  };

  const handleBarBan = async (barId, customerId, reason = '') => {
    try {
      const payload = { reason: String(reason || '').trim() || null };
      const res = await banningAPI.banAtBar(barId, customerId, payload);
      if (res.data.success) {
        toast.success('Customer banned from bar');
        setBarBanModal(null);
        setBarBanReason('');
        fetchBarBans();
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to ban'); }
  };

  const handleBarUnban = async (barId, customerId) => {
    try {
      const res = await banningAPI.unbanAtBar(barId, customerId);
      if (res.data.success) { toast.success('Customer unbanned from bar'); fetchBarBans(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to unban'); }
  };

  const handleSuspendBarAccess = async (barId, reason) => {
    if (!String(reason || '').trim()) {
      toast.error('Reason is required to ban a bar');
      return;
    }
    try {
      const res = await barsAPI.suspend(barId, { reason: String(reason).trim() });
      if (res.data.success) {
        toast.success('Bar banned. Owner and staff under this bar are now blocked from login.');
        setBarAccessModal(null);
        setBarAccessReason('');
        fetchBarBans();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to ban bar');
    }
  };

  const handleReactivateBarAccess = async (barId) => {
    try {
      const res = await barsAPI.reactivate(barId);
      if (res.data.success) {
        toast.success('Bar reactivated');
        setBarAccessModal(null);
        setBarAccessReason('');
        fetchBarBans();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reactivate bar');
    }
  };

  const isBanned = (c) => Number(c.is_banned) === 1;
  const bannedCount = customers.filter(isBanned).length;
  const activeCount = customers.filter(c => !isBanned(c)).length;

  const isBarSuspended = (entry) => {
    const barStatus = String(entry?.bar_status || '').toLowerCase();
    const lifecycleStatus = String(entry?.bar_lifecycle_status || '').toLowerCase();
    return barStatus === 'inactive' || lifecycleStatus === 'suspended';
  };

  const groupedBarBans = useMemo(() => {
    const grouped = new Map();

    barBans.forEach((entry) => {
      const groupId = entry.bar_id != null ? String(entry.bar_id) : `unknown-${entry.bar_name || 'bar'}`;

      if (!grouped.has(groupId)) {
        grouped.set(groupId, {
          groupId,
          barId: entry.bar_id,
          barName: entry.bar_name || 'Unknown bar',
          barStatus: entry.bar_status,
          barLifecycleStatus: entry.bar_lifecycle_status,
          customers: [],
          bannedCustomers: 0,
          activeCustomers: 0,
          latestActionAt: null,
        });
      }

      const group = grouped.get(groupId);
      group.customers.push(entry);

      if (Number(entry.is_banned) === 1) group.bannedCustomers += 1;
      else group.activeCustomers += 1;

      const actionTimestamp = entry.banned_at || entry.bar_banned_at || null;
      if (actionTimestamp) {
        if (!group.latestActionAt || new Date(actionTimestamp).getTime() > new Date(group.latestActionAt).getTime()) {
          group.latestActionAt = actionTimestamp;
        }
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.barName.localeCompare(b.barName));
  }, [barBans]);

  const barSummary = useMemo(() => {
    const totalBars = groupedBarBans.length;
    const suspendedBars = groupedBarBans.filter(isBarSuspended).length;
    const bannedCustomersAtBars = groupedBarBans.reduce((sum, bar) => sum + bar.bannedCustomers, 0);

    return {
      totalBars,
      suspendedBars,
      activeBars: totalBars - suspendedBars,
      bannedCustomersAtBars,
    };
  }, [groupedBarBans]);

  useEffect(() => {
    if (activeTab !== 'bar') return;

    setExpandedBars((previous) => {
      if (Object.keys(previous).length > 0 || groupedBarBans.length === 0) {
        return previous;
      }
      return { [groupedBarBans[0].groupId]: true };
    });
  }, [activeTab, groupedBarBans]);

  const toggleBarExpanded = (groupId) => {
    setExpandedBars((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Banning</h1>
        <p className="text-white/40 text-sm mt-1">Manage global and per-bar customer bans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10 text-red-400"><ShieldOff className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Global Bans</p><p className="text-lg font-bold text-white">{bannedCount}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Shield className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Active Customers</p><p className="text-lg font-bold text-white">{activeCount}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><UserX className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Bar-Level Bans</p><p className="text-lg font-bold text-white">{barBans.filter(b => Number(b.is_banned) === 1).length}</p></div></div></div>
      </div>

      <div className="glass-table">
        <div className="flex border-b border-white/[0.06]">
          {['global','bar'].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition ${activeTab===tab?'text-red-400 border-b-2 border-red-500':'text-white/40 hover:text-white/60'}`}>
              {tab === 'global' ? 'Global Bans' : 'Per-Bar Bans'}
            </button>
          ))}
        </div>

        {activeTab === 'bar' && (
          <div className="px-4 pt-3 text-[11px] text-amber-300/80">
            Per-Bar Bans are customer-only. To block bar owners/staff, deactivate the bar from Bars Management.
          </div>
        )}

        <div className="p-4 border-b border-white/[0.06] flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="glass-input w-full pl-9 text-sm" placeholder="Search customers..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(activeTab==='global'?fetchGlobalBans():fetchBarBans())}/>
          </div>
          <select className="glass-input text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="banned">Banned</option>
            <option value="active">Active</option>
          </select>
          <button onClick={()=>activeTab==='global'?fetchGlobalBans():fetchBarBans()} className="btn-red text-xs px-4">Search</button>
        </div>

        {activeTab === 'global' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Customer</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Banned By</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Message</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Banned At</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Bar Bans</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/30 uppercase">Actions</th>
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">No customers found</td></tr>
                ) : customers.map(c => (
                  <tr key={c.customer_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-sm font-medium text-white">{c.first_name} {c.last_name}</td>
                    <td className="px-5 py-3 text-sm text-white/50">{c.email}</td>
                    <td className="px-5 py-3">
                      {isBanned(c) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">BANNED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">ACTIVE</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">{c.banned_by_name || '-'}</td>
                    <td className="px-5 py-3 text-xs text-white/40 max-w-[220px] truncate" title={c.ban_reason || ''}>{c.ban_reason || '-'}</td>
                    <td className="px-5 py-3 text-xs text-white/40">{c.banned_at ? formatDateTime(c.banned_at) : '-'}</td>
                    <td className="px-5 py-3 text-xs text-white/40">{c.bar_ban_count || 0}</td>
                    <td className="px-5 py-3 text-right">
                      {isBanned(c) ? (
                        <button onClick={()=>setBanModal({action:'unban',customer:c})} className="text-xs font-medium px-3 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">
                          Unban
                        </button>
                      ) : (
                        <button onClick={()=>setBanModal({action:'ban',customer:c})} className="text-xs font-medium px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                          Ban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="py-12 text-center text-white/30">Loading...</div>
            ) : groupedBarBans.length === 0 ? (
              <div className="py-12 text-center text-white/30">No bar bans found</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Bars Shown</p>
                    <p className="text-lg font-bold text-white mt-1">{barSummary.totalBars}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Active Bars</p>
                    <p className="text-lg font-bold text-green-400 mt-1">{barSummary.activeBars}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Banned Bars</p>
                    <p className="text-lg font-bold text-red-400 mt-1">{barSummary.suspendedBars}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Bar-Level Bans</p>
                    <p className="text-lg font-bold text-white mt-1">{barSummary.bannedCustomersAtBars}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {groupedBarBans.map((group) => {
                    const barIsSuspended = isBarSuspended(group);
                    const isExpanded = Boolean(expandedBars[group.groupId]);

                    return (
                      <div key={group.groupId} className="rounded-xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
                        <div className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center">
                          <button
                            onClick={() => toggleBarExpanded(group.groupId)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-white/50" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-white/50" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">{group.barName}</p>
                              <p className="text-[11px] text-white/40 mt-0.5">
                                {group.bannedCustomers} banned • {group.activeCustomers} active
                                {group.latestActionAt ? ` • Last update ${formatDateTime(group.latestActionAt)}` : ''}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-2">
                            {barIsSuspended ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">BAR BANNED</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">BAR ACTIVE</span>
                            )}

                            {barIsSuspended ? (
                              <button
                                onClick={() => setBarAccessModal({ type: 'reactivate', bar_id: group.barId, bar_name: group.barName })}
                                className="text-xs font-medium px-3 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
                              >
                                Reactivate Bar
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setBarAccessReason('');
                                  setBarAccessModal({ type: 'suspend', bar_id: group.barId, bar_name: group.barName });
                                }}
                                className="text-xs font-medium px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                              >
                                Ban Bar
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/[0.06] overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-white/[0.06]">
                                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Customer</th>
                                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Status</th>
                                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Reason</th>
                                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">Banned At</th>
                                  <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/30 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.customers.map((customer) => (
                                  <tr key={`${group.groupId}-${customer.customer_id}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                    <td className="px-5 py-3 text-sm text-white">
                                      <div>{customer.first_name} {customer.last_name}</div>
                                      <div className="text-[11px] text-white/40">{customer.email || '-'}</div>
                                    </td>
                                    <td className="px-5 py-3">
                                      {Number(customer.is_banned) === 1 ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">BANNED</span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">ACTIVE</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-white/40 max-w-[280px] truncate" title={customer.ban_reason || customer.bar_ban_reason || ''}>
                                      {customer.ban_reason || customer.bar_ban_reason || '-'}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-white/40">
                                      {(customer.banned_at || customer.bar_banned_at)
                                        ? formatDateTime(customer.banned_at || customer.bar_banned_at)
                                        : '-'}
                                    </td>
                                    <td className="px-5 py-3 text-right space-x-2">
                                      {Number(customer.is_banned) === 1 ? (
                                        <button
                                          onClick={() => handleBarUnban(customer.bar_id, customer.customer_id)}
                                          className="text-xs font-medium px-3 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
                                        >
                                          Unban
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setBarBanReason('');
                                            setBarBanModal(customer);
                                          }}
                                          className="text-xs font-medium px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                                        >
                                          Ban Customer
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {banModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              {banModal.action === 'ban' ? 'Ban Customer' : 'Unban Customer'}
            </h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <p className="text-sm text-white/70">
                {banModal.action === 'ban' 
                  ? <>Are you sure you want to <strong className="text-red-400">ban</strong> <strong>{banModal.customer.first_name} {banModal.customer.last_name}</strong> from the platform?</>
                  : <>Are you sure you want to <strong className="text-green-400">unban</strong> <strong>{banModal.customer.first_name} {banModal.customer.last_name}</strong>?</>
                }
              </p>
              <p className="text-xs text-white/40 mt-2">
                {banModal.action === 'ban' ? 'They will no longer be able to access the platform.' : 'They will be able to access the platform again.'}
              </p>
              {banModal.action === 'ban' && (
                <div className="mt-3">
                  <label className="block text-[11px] text-white/50 mb-1">Message shown to customer on login</label>
                  <textarea
                    rows="3"
                    className="glass-input w-full text-sm"
                    value={banReason}
                    onChange={(e)=>setBanReason(e.target.value)}
                    placeholder="Example: Your account was banned due to repeated policy violations."
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setBanModal(null); setBanReason('');}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button
                onClick={()=> banModal.action === 'ban' ? handleGlobalBan(banModal.customer.customer_id) : handleGlobalUnban(banModal.customer.customer_id)}
                className={`flex-1 text-sm rounded-lg py-2 font-medium text-white ${banModal.action === 'ban' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {banModal.action === 'ban' ? 'Confirm Ban' : 'Confirm Unban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {barBanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Ban Customer From Bar</h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <p className="text-sm text-white/70">
                Ban <strong className="text-white">{barBanModal.first_name} {barBanModal.last_name}</strong> from <strong className="text-white">{barBanModal.bar_name}</strong>?
              </p>
              <p className="text-xs text-white/40 mt-2">This reason will be shown to the customer when they log in.</p>
              <div className="mt-3">
                <label className="block text-[11px] text-white/50 mb-1">Ban reason</label>
                <textarea
                  rows="3"
                  className="glass-input w-full text-sm"
                  value={barBanReason}
                  onChange={(e)=>setBarBanReason(e.target.value)}
                  placeholder="Example: You were banned from this bar due to repeated no-show reservations."
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setBarBanModal(null); setBarBanReason('');}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button
                onClick={()=>handleBarBan(barBanModal.bar_id, barBanModal.customer_id, barBanReason)}
                className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {barAccessModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              {barAccessModal.type === 'suspend' ? 'Ban Bar Access' : 'Reactivate Bar Access'}
            </h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <p className="text-sm text-white/70">
                {barAccessModal.type === 'suspend'
                  ? <>Ban <strong className="text-white">{barAccessModal.bar_name}</strong>? This will block owner and all staff under this bar from logging in to baroperations.</>
                  : <>Reactivate <strong className="text-white">{barAccessModal.bar_name}</strong>? Owner and staff will be able to log in again.</>
                }
              </p>
              {barAccessModal.type === 'suspend' && (
                <div className="mt-3">
                  <label className="block text-[11px] text-white/50 mb-1">Reason required</label>
                  <textarea
                    rows="3"
                    className="glass-input w-full text-sm"
                    value={barAccessReason}
                    onChange={(e)=>setBarAccessReason(e.target.value)}
                    placeholder="Example: This bar was suspended due to policy violations."
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setBarAccessModal(null); setBarAccessReason('');}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button
                onClick={()=> barAccessModal.type === 'suspend' ? handleSuspendBarAccess(barAccessModal.bar_id, barAccessReason) : handleReactivateBarAccess(barAccessModal.bar_id)}
                className={`flex-1 text-sm rounded-lg py-2 font-medium text-white ${barAccessModal.type === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {barAccessModal.type === 'suspend' ? 'Confirm Ban Bar' : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
