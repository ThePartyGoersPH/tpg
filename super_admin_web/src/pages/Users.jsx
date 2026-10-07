import { useEffect, useState } from 'react';
import { usersAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Search, Users as UsersIcon, UserCheck, UserX, Key, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [filters, setFilters] = useState({ role: '', search: '', status: '' });
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => { fetchUsers(); }, [filters.role, filters.status, pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (filters.role) params.role = filters.role;
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      const res = await usersAPI.list(params);
      if (res.data.success) { setUsers(res.data.data?.users || []); setPagination(p => ({ ...p, ...res.data.data?.pagination })); }
    } catch (e) { console.error('Fetch users error:', e); }
    finally { setLoading(false); }
  };

  const handleToggleStatus = async (userId) => {
    try { const r = await usersAPI.toggleStatus(userId); if (r.data.success) { toast.success(r.data.message); fetchUsers(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    try {
      const r = await usersAPI.resetPassword(resetModal.id, { new_password: newPassword });
      if (r.data.success) {
        toast.success('Password reset successfully');
        setResetModal(null);
        setNewPassword('');
        setConfirmPassword('');
        setNewEmail('');
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to reset password'); }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.trim()) { toast.error('Enter a new email'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) { toast.error('Invalid email format'); return; }
    if (newEmail.trim().toLowerCase() === resetModal.email?.toLowerCase()) { toast.error('New email is the same as current'); return; }
    setChangingEmail(true);
    try {
      const r = await usersAPI.update(resetModal.id, { email: newEmail.trim().toLowerCase() });
      if (r.data.success) {
        toast.success('Email updated successfully');
        setResetModal({ ...resetModal, email: newEmail.trim().toLowerCase() });
        setNewEmail('');
        fetchUsers();
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update email'); }
    finally { setChangingEmail(false); }
  };

  const roleColors = { super_admin:'bg-purple-500/20 text-purple-400', bar_owner:'bg-blue-500/20 text-blue-400', manager:'bg-green-500/20 text-green-400', hr:'bg-orange-500/20 text-orange-400', staff:'bg-gray-500/20 text-gray-400', cashier:'bg-yellow-500/20 text-yellow-400', customer:'bg-pink-500/20 text-pink-400' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-white/40 text-sm mt-1">Manage all platform users</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-red-400"><UsersIcon className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Total Users</p><p className="text-lg font-bold text-white">{pagination.total}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-green-400"><UserCheck className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Showing</p><p className="text-lg font-bold text-green-400">{users.length}</p></div></div></div>
        <div className="stat-card"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-white/[0.06] text-blue-400"><UsersIcon className="h-5 w-5"/></div><div><p className="text-[11px] text-white/40 uppercase">Pages</p><p className="text-lg font-bold text-blue-400">{pagination.page}/{pagination.total_pages}</p></div></div></div>
      </div>

      <div className="glass-table">
        <div className="p-4 border-b border-white/[0.06] flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="glass-input w-full pl-9 text-sm" placeholder="Search name, email, phone..." value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} onKeyDown={e=>e.key==='Enter'&&fetchUsers()}/>
          </div>
          <select className="glass-input text-sm" value={filters.role} onChange={e=>setFilters({...filters,role:e.target.value})}>
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="bar_owner">Bar Owner</option>
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
            <option value="staff">Staff</option>
            <option value="cashier">Cashier</option>
            <option value="customer">Customer</option>
          </select>
          <select className="glass-input text-sm" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button onClick={fetchUsers} className="btn-red text-xs px-4">Search</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['Name','Email','Role','Bar','Status','Joined','Actions'].map(h=>(
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-white/30">No users found</td></tr>
              ) : users.map(u=>(
                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-white">{u.first_name} {u.last_name}</div>
                    {u.is_banned && <span className="text-[10px] text-red-400 flex items-center gap-1"><UserX className="h-3 w-3"/>Banned</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/50">{u.email}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColors[u.role?.toLowerCase()]||'bg-gray-500/20 text-gray-400'}`}>{u.role?.replace(/_/g,' ')}</span></td>
                  <td className="px-5 py-3 text-xs text-white/50">{u.bar_name||'N/A'}</td>
                  <td className="px-5 py-3">
                    {u.is_active ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">ACTIVE</span>
                    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">INACTIVE</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={()=>{setResetModal(u);setNewPassword('');setConfirmPassword('');setNewEmail('');}} className="text-xs font-medium px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition flex items-center gap-1">
                        <Key className="h-3 w-3"/>Reset
                      </button>
                      <button onClick={()=>handleToggleStatus(u.id)} className={`text-xs font-medium px-3 py-1 rounded transition ${u.is_active?'bg-red-500/10 text-red-400 hover:bg-red-500/20':'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                        {u.is_active?'Deactivate':'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.total_pages > 1 && (
        <div className="glass-card px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-white/40">Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)</p>
          <div className="flex gap-2">
            <button disabled={pagination.page<=1} onClick={()=>setPagination(p=>({...p,page:p.page-1}))} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Prev</button>
            <button disabled={pagination.page>=pagination.total_pages} onClick={()=>setPagination(p=>({...p,page:p.page+1}))} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Next</button>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Manage User</h3>
              <button onClick={()=>{setResetModal(null);setNewPassword('');setConfirmPassword('');setNewEmail('')}} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">User</span><span className="text-white/80">{resetModal.first_name} {resetModal.last_name}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Email</span><span className="text-white/80">{resetModal.email}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Role</span><span className="text-white/80 capitalize">{resetModal.role?.replace(/_/g,' ')}</span></div>
            </div>

            {/* Change Email */}
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <label className="block text-xs font-medium text-white/50 mb-2 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5"/> Change Email
              </label>
              <div className="flex gap-2">
                <input type="email" className="glass-input flex-1 text-sm" placeholder="New email address..." value={newEmail} onChange={e=>setNewEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChangeEmail()}/>
                <button onClick={handleChangeEmail} disabled={changingEmail || !newEmail.trim() || newEmail.trim().toLowerCase() === resetModal.email?.toLowerCase()} className="text-xs font-medium px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 whitespace-nowrap">
                  {changingEmail ? 'Saving...' : 'Update Email'}
                </button>
              </div>
              {newEmail && newEmail.trim().toLowerCase() === resetModal.email?.toLowerCase() && (
                <p className="text-[11px] text-yellow-400 mt-1">Same as current email</p>
              )}
            </div>

            {/* Reset Password */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/50 mb-2">New Password (min 8 characters)</label>
              <input type="password" className="glass-input w-full text-sm" placeholder="Enter new password..." value={newPassword} onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleResetPassword()}/>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/50 mb-2">Confirm Password</label>
              <input type="password" className="glass-input w-full text-sm" placeholder="Re-enter new password..." value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleResetPassword()}/>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setResetModal(null);setNewPassword('');setConfirmPassword('');setNewEmail('')}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword} className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
