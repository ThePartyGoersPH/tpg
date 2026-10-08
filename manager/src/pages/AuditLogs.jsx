import React, { useState, useEffect } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { auditApi } from '../api/auditApi';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await auditApi.list();
      setLogs(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = logs.filter((l) =>
    `${l.action || ''} ${l.entity || ''} ${l.details || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const toTitleCase = (text = '') =>
    String(text)
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());

  const actionMap = {
    SUPER_ADMIN_APPROVE_BAR: 'Super Admin approved a bar',
    DELETE_EVENT_COMMENT: 'Deleted an event comment',
    FLAG_EVENT_COMMENT: 'Flagged an event comment',
    ARCHIVE_EVENT: 'Archived an event',
    TRANSFER_OWNERSHIP: 'Transferred bar ownership',
    RESET_PASSWORD: 'Reset a staff password',
    LOGIN: 'User logged in',
    LOGOUT: 'User logged out',
    CREATE_EVENT: 'Created an event',
    UPDATE_EVENT: 'Updated an event',
    CANCEL_EVENT: 'Cancelled an event',
    LIKE_EVENT: 'Liked an event',
    UNLIKE_EVENT: 'Unliked an event',
    CREATE_RESERVATION: 'Made a reservation',
    UPDATE_RESERVATION: 'Updated a reservation',
    CANCEL_RESERVATION: 'Cancelled a reservation',
    CREATE_REVIEW: 'Left a review',
    UPDATE_REVIEW: 'Updated a review',
    DELETE_REVIEW: 'Deleted a review',
    FOLLOW_BAR: 'Followed the bar',
    UNFOLLOW_BAR: 'Unfollowed the bar',
    CREATE_POST: 'Created a post',
    UPDATE_POST: 'Updated a post',
    DELETE_POST: 'Deleted a post',
    CREATE_COMMENT: 'Added a comment',
    UPDATE_COMMENT: 'Updated a comment',
    DELETE_COMMENT: 'Deleted a comment',
    UPLOAD_BAR_IMAGE: 'Uploaded a bar image',
    UPDATE_BAR_DETAILS: 'Updated bar details',
    UPDATE_BAR_SETTINGS: 'Updated bar settings',
    UPDATE_USER_ROLE: 'Changed user role',
    UPDATE_USER_PERMISSIONS: 'Updated user permissions',
    CREATE_ORDER: 'Created an order',
    COMPLETE_ORDER: 'Completed an order',
    VOID_ORDER: 'Voided an order',
    REFUND_ORDER: 'Refunded an order',
    CLOCK_IN: 'Clocked in',
    CLOCK_OUT: 'Clocked out',
    APPLY_LEAVE: 'Applied for leave',
    APPROVE_LEAVE: 'Approved leave',
    REJECT_LEAVE: 'Rejected leave',
    RUN_PAYROLL: 'Processed payroll',
    UPLOAD_DOCUMENT: 'Uploaded a document',
    APPROVE_DOCUMENT: 'Approved a document',
    DELETE_BAR: 'Deleted a bar',
    TOGGLE_BAR_STATUS: 'Changed bar status',
    CREATE_PROMOTION: 'Created a promotion',
    UPDATE_PROMOTION: 'Updated a promotion',
    DELETE_PROMOTION: 'Deleted a promotion',
    CREATE_BRANCH: 'Created a new branch',
    UPDATE_BRANCH: 'Updated branch details',
    SWITCH_BRANCH: 'Switched active branch',
  };

  const formatAction = (action) => actionMap[action] || toTitleCase(action || 'Unknown Action');
  const formatEntity = (entity, entityId) => `${toTitleCase(entity || 'Record')}${entityId ? ` #${entityId}` : ''}`;

  const formatDetails = (details) => {
    if (!details) return '—';
    let parsed = details;
    if (typeof details === 'string') {
      try { parsed = JSON.parse(details); } catch { return details; }
    }
    if (typeof parsed !== 'object') return String(parsed);
    return Object.entries(parsed)
      .map(([k, v]) => `${toTitleCase(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' • ');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Search className="w-4 h-4" style={{ color: '#555' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}><tr>
              <th className="table-header">Date</th>
              <th className="table-header">User</th>
              <th className="table-header">Action</th>
              <th className="table-header">Entity</th>
              <th className="table-header">Details</th>
            </tr></thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id || i} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="table-cell text-xs">{l.created_at ? format(parseUTC(l.created_at), 'MMM d, yyyy h:mm a') : '—'}</td>
                  <td className="table-cell">{l.first_name ? `${l.first_name} ${l.last_name}` : `User #${l.user_id}`}</td>
                  <td className="table-cell"><span className="badge-info">{formatAction(l.action)}</span></td>
                  <td className="table-cell">{formatEntity(l.entity, l.entity_id)}</td>
                  <td className="table-cell text-xs max-w-[300px] truncate" style={{ color: '#666' }}>
                    {formatDetails(l.details)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="5" className="text-center py-8" style={{ color: '#555' }}>No audit logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
