import { useEffect, useState } from 'react';
import { auditAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Search, FileText } from 'lucide-react';

const TABS = [
  { key: 'platform', label: 'Platform Logs' },
  { key: 'logins',   label: 'Logins' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'comments', label: 'Comments' },
  { key: 'bar',      label: 'Bar Logs' },
];

const ACTION_OPTIONS = {
  platform: [
    { value: 'APPROVE_BAR',          label: 'Approve Bar' },
    { value: 'SUSPEND_BAR',          label: 'Suspend Bar' },
    { value: 'REACTIVATE_BAR',       label: 'Reactivate Bar' },
    { value: 'BAN_CUSTOMER',         label: 'Ban Customer' },
    { value: 'UNBAN_CUSTOMER',       label: 'Unban Customer' },
    { value: 'MARK_PAYOUT_SENT',     label: 'Mark Payout Sent' },
    { value: 'COMPLETE_PAYOUT',      label: 'Complete Payout' },
    { value: 'UPDATE_MAINTENANCE',   label: 'Maintenance Mode' },
    { value: 'CREATE_ANNOUNCEMENT',  label: 'Create Announcement' },
  ],
  registrations: [
    { value: 'APPROVE_REGISTRATION', label: 'Approved' },
    { value: 'REJECT_REGISTRATION',  label: 'Rejected' },
  ],
  comments: [
    { value: 'DELETE_POST_COMMENT',  label: 'Delete Post Comment' },
    { value: 'DELETE_EVENT_COMMENT', label: 'Delete Event Comment' },
  ],
  bar: [],
  logins: [],
};

const ENTITY_OPTIONS = {
  platform: ['bar','user','subscription','payout','platform_setting','platform_announcement','role'],
  registrations: ['business_registration'],
  comments: ['post_comment','event_comment'],
  bar: ['user','bar','inventory_item','reservation','payroll_run'],
  logins: [],
};

const ENTITY_LABELS = {
  bar: 'Bar',
  user: 'User',
  subscription: 'Subscription',
  payout: 'Payout',
  platform_setting: 'Platform Setting',
  platform_announcement: 'Announcement',
  role: 'Role',
  business_registration: 'Registration',
  post_comment: 'Post Comment',
  event_comment: 'Event Comment',
  inventory_item: 'Inventory Item',
  reservation: 'Reservation',
  payroll_run: 'Payroll Run',
  bar_event: 'Event',
  bar_post: 'Post',
};

const DETAIL_LABELS = {
  scope: 'Scope',
  reason: 'Reason',
  status: 'Status',
  maintenance_mode: 'Maintenance Mode',
  maintenance_message: 'Maintenance Message',
  target_email: 'Target Email',
  target_role: 'Target Role',
  post_id: 'Post ID',
  event_id: 'Event ID',
  permission_count: 'Permission Count',
  payout_reference: 'Payout Reference',
  platform_fee_percentage: 'Platform Fee',
  fields: 'Updated Fields',
  title: 'Title',
};

function titleCase(input) {
  const text = String(input || '').replace(/_/g, ' ').trim();
  if (!text) return '-';
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatEntity(entity, entityId) {
  if (!entity) return '-';
  const base = ENTITY_LABELS[entity] || titleCase(entity);
  return entityId ? `${base} #${entityId}` : base;
}

function normalizeDetailValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => titleCase(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (key === 'status' && String(value).toLowerCase() === 'cancelled') return 'Taken down';
  if (key === 'maintenance_mode') return Number(value) === 1 ? 'Enabled' : 'Disabled';
  return String(value);
}

function formatDetails(details) {
  if (!details) return '-';

  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch (_) {
      return details;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return String(parsed || '-');
  }

  const parts = Object.entries(parsed)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const label = DETAIL_LABELS[key] || titleCase(key);
      return `${label}: ${normalizeDetailValue(key, value)}`;
    });

  return parts.length ? parts.join(' | ') : '-';
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('platform');
  const [filters, setFilters] = useState({ action: '', entity: '', from: '', to: '' });

  useEffect(() => {
    setFilters({ action: '', entity: '', from: '', to: '' });
  }, [activeTab]);

  useEffect(() => { fetchLogs(); }, [activeTab, filters.action, filters.entity, filters.from, filters.to]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.entity) params.entity = filters.entity;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      let res;
      if (activeTab === 'logins') {
        res = await auditAPI.getLoginActivity(params);
      } else if (activeTab === 'registrations') {
        params.entity = params.entity || 'business_registration';
        res = await auditAPI.getPlatformLogs(params);
      } else if (activeTab === 'comments') {
        if (!params.entity) params.entity_like = 'comment';
        res = await auditAPI.getPlatformLogs(params);
      } else if (activeTab === 'platform') {
        res = await auditAPI.getPlatformLogs(params);
      } else {
        res = await auditAPI.getBarLogs(params);
      }
      if (res.data.success) setLogs(res.data.data || []);
    } catch (e) { console.error('Fetch logs error:', e); }
    finally { setLoading(false); }
  };

  const actionColor = (a) => {
    if (!a) return 'text-white/60';
    const s = a.toLowerCase();
    if (s.includes('login') || s.includes('login_success')) return 'text-blue-400';
    if (s.includes('login_fail') || s.includes('failed')) return 'text-red-400';
    if (s.includes('approve') || s.includes('activate') || s.includes('unban') || s.includes('reactivate')) return 'text-green-400';
    if (s.includes('suspend') || s.includes('ban') || s.includes('reject') || s.includes('delete') || s.includes('cancel')) return 'text-red-400';
    if (s.includes('payout') || s.includes('process') || s.includes('complete')) return 'text-purple-400';
    if (s.includes('update') || s.includes('fee') || s.includes('maintenance')) return 'text-amber-400';
    if (s.includes('register') || s.includes('registration')) return 'text-cyan-400';
    if (s.includes('comment')) return 'text-orange-400';
    return 'text-white/60';
  };

  const actionLabel = (a) => (a || '').replace(/SUPER_ADMIN_/,'').replace(/_/g,' ');

  const actionOptions = ACTION_OPTIONS[activeTab] || ACTION_OPTIONS.platform;
  const entityOptions = ENTITY_OPTIONS[activeTab] || ENTITY_OPTIONS.platform;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-white/40 text-sm mt-1">Platform-wide activity logs</p>
      </div>

      <div className="glass-table">
        <div className="flex border-b border-white/[0.06] overflow-x-auto">
          {TABS.map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${activeTab===tab.key?'text-red-400 border-b-2 border-red-500':'text-white/40 hover:text-white/60'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-white/[0.06] grid grid-cols-2 md:grid-cols-5 gap-3">
          {actionOptions.length > 0 ? (
            <select className="glass-input text-sm" value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value})}>
              <option value="">All Actions</option>
              {actionOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : <div/>}
          {entityOptions.length > 0 ? (
            <select className="glass-input text-sm" value={filters.entity} onChange={e=>setFilters({...filters,entity:e.target.value})}>
              <option value="">All Entities</option>
              {entityOptions.map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
            </select>
          ) : <div/>}
          <input type="date" className="glass-input text-sm" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/>
          <input type="date" className="glass-input text-sm" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/>
          <button onClick={()=>setFilters({action:'',entity:'',from:'',to:''})} className="btn-ghost text-xs">Clear</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {activeTab === 'logins'
                ? ['Timestamp','User','Email','Action','Bar','IP'].map(h=><th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">{h}</th>)
                : ['Timestamp','Actor','Action','Entity','Details','IP'].map(h=><th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">{h}</th>)
              }
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">No logs found</td></tr>
              ) : activeTab === 'logins' ? logs.map(log=>(
                <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(log.created_at)}</td>
                  <td className="px-5 py-3 text-xs font-medium text-white/70">{log.first_name ? `${log.first_name} ${log.last_name}` : 'Unknown'}</td>
                  <td className="px-5 py-3 text-xs text-white/50">{log.email || '-'}</td>
                  <td className="px-5 py-3 text-xs"><span className={`font-medium ${actionColor(log.action)}`}>{actionLabel(log.action)}</span></td>
                  <td className="px-5 py-3 text-xs text-white/50">{log.bar_name || '-'}</td>
                  <td className="px-5 py-3 text-xs text-white/30 font-mono">{log.ip_address || '-'}</td>
                </tr>
              )) : logs.map(log=>(
                <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(log.created_at)}</td>
                  <td className="px-5 py-3 text-xs font-medium text-white/70">{log.admin_name || log.actor_name || 'System'}</td>
                  <td className="px-5 py-3 text-xs"><span className={`font-medium ${actionColor(log.action)}`}>{actionLabel(log.action)}</span></td>
                  <td className="px-5 py-3 text-xs text-white/50">{formatEntity(log.entity, log.entity_id)}</td>
                  <td className="px-5 py-3 text-xs text-white/40 max-w-xs truncate" title={formatDetails(log.details)}>{formatDetails(log.details)}</td>
                  <td className="px-5 py-3 text-xs text-white/30 font-mono">{log.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
