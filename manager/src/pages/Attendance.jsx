import React, { useState, useEffect } from 'react';
import { Clock, Search, Plus, Edit2, X, Loader2, LogIn, LogOut } from 'lucide-react';
import { attendanceApi } from '../api/attendanceApi';
import { staffApi } from '../api/staffApi';
import { usePermission } from '../hooks/usePermission';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const extractDateParts = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
};

const formatWorkDate = (value) => {
  const extracted = extractDateParts(value);
  if (extracted) {
    return `${MONTHS_SHORT[extracted.month - 1]} ${extracted.day}, ${extracted.year}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'MMM d, yyyy');
};

const extractTimeParts = (value) => {
  if (!value) return null;
  const raw = String(value).trim();

  const dateTimeMatch = raw.match(/(?:T|\s)(\d{2}):(\d{2})(?::\d{2})?/);
  if (dateTimeMatch) {
    const hh = Number(dateTimeMatch[1]);
    const mm = Number(dateTimeMatch[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm)) return { hh, mm };
  }

  const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) {
    const hh = Number(timeOnlyMatch[1]);
    const mm = Number(timeOnlyMatch[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm)) return { hh, mm };
  }

  return null;
};

const formatTime = (value) => {
  if (!value) return '—';
  const parts = extractTimeParts(value);
  if (!parts) return String(value);

  let hh = parts.hh;
  const mm = String(parts.mm).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
};

const formatMinutesToHours = (value) => {
  const mins = Number(value || 0);
  if (!mins || mins < 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const Attendance = () => {
  const { can, isOwner } = usePermission();
  const canViewAll = can('attendance_view_all');
  const [records, setRecords] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(canViewAll ? 'all' : 'my');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_user_id: '', work_date: '', time_in: '', time_out: '' });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const showQuickClock = can('attendance_view_own') && !isOwner;
  const showMyAttendanceTab = !isOwner;

  const getDefaultRange = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(now, 'yyyy-MM-dd'),
    };
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showQuickClock) return undefined;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [showQuickClock]);

  useEffect(() => {
    if (isOwner && tab === 'my') {
      setTab(canViewAll ? 'all' : 'my');
    }
  }, [isOwner, tab, canViewAll]);

  const load = async () => {
    try {
      const defaults = getDefaultRange();
      const params = {
        from: dateFrom || defaults.from,
        to: dateTo || defaults.to,
      };

      if (canViewAll) {
        const { data } = await attendanceApi.hrList(params);
        setRecords(data.data || data || []);
      }

      const { data: myData } = await attendanceApi.getMyAttendance(params);
      setMyRecords(myData.data || myData || []);

      if (canViewAll) {
        try {
          const { data: empData } = await staffApi.list();
          setEmployees(empData.data || empData || []);
        } catch {}
      }
    } catch {} finally { setLoading(false); }
  };

  const formatClockTime = (value) => {
    if (!value) return null;
    const d = new Date(String(value).includes('T') ? value : `${value}`.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return null;
    let hours = d.getHours();
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
  };

  const handleClockIn = async () => {
    try {
      const { data } = await attendanceApi.clockInOut('clock_in');
      const at = formatClockTime(data?.data?.time_in);
      toast.success(at ? `Successfully clocked in at ${at}` : (data?.message || 'Clocked in!'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const { data } = await attendanceApi.clockInOut('clock_out');
      const at = formatClockTime(data?.data?.time_out);
      toast.success(at ? `Successfully clocked out at ${at}` : (data?.message || 'Clocked out!'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to clock out');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await attendanceApi.hrCreate(form);
      toast.success('Attendance record created!');
      setShowModal(false);
      load();
    } catch {} finally { setSaving(false); }
  };

  const displayRecords = isOwner
    ? records
    : (canViewAll && tab === 'all' ? records : myRecords);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Clock In/Out - For users with attendance_view_own permission */}
      {showQuickClock && (
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.12)' }}>
              <Clock className="w-6 h-6" style={{ color: '#CC0000' }} />
            </div>
            <div>
              <p className="font-bold text-white">Quick Clock</p>
              <p className="text-xs" style={{ color: '#888' }}>{format(currentTime, 'EEEE, MMMM d, yyyy - h:mm:ss a')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClockIn} className="btn-primary flex items-center gap-2"><LogIn className="w-4 h-4" /> Clock In</button>
            <button onClick={handleClockOut} className="btn-secondary flex items-center gap-2"><LogOut className="w-4 h-4" /> Clock Out</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <div className="flex rounded-lg p-1" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
            {canViewAll && <button onClick={() => setTab('all')} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={tab === 'all' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>All Staff</button>}
            {showMyAttendanceTab && (
              <button onClick={() => setTab('my')} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={tab === 'my' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>My Attendance</button>
            )}
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field w-auto text-xs" placeholder="From" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field w-auto text-xs" placeholder="To" />
          <button onClick={load} className="btn-secondary text-xs">Filter</button>
        </div>
        {canViewAll && (
          <button onClick={() => { setForm({ employee_user_id: '', work_date: '', time_in: '', time_out: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Record
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--m-border)' }}>
              <tr>
                {(isOwner || (canViewAll && tab === 'all')) && <th className="table-header">Employee</th>}
                <th className="table-header">Date</th>
                <th className="table-header">Time In</th>
                <th className="table-header">Time Out</th>
                <th className="table-header">Late (min)</th>
                <th className="table-header">Undertime (min)</th>
                <th className="table-header">Overtime (min)</th>
                <th className="table-header">Worked Time</th>
                <th className="table-header">Source</th>
              </tr>
            </thead>
            <tbody>
              {displayRecords.map((r, i) => (
                <tr key={r.id || i} className="transition-colors" style={{ borderBottom: '1px solid var(--m-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {(isOwner || (canViewAll && tab === 'all')) && <td className="table-cell font-medium">{r.first_name ? `${r.first_name} ${r.last_name}` : `User #${r.employee_user_id}`}</td>}
                  <td className="table-cell">{formatWorkDate(r.work_date)}</td>
                  <td className="table-cell">{formatTime(r.actual_clock_in || r.time_in)}</td>
                  <td className="table-cell">{formatTime(r.actual_clock_out || r.time_out)}</td>
                  <td className="table-cell">{r.minutes_late > 0 ? <span className="font-medium" style={{ color: '#fbbf24' }}>{r.minutes_late}</span> : '0'}</td>
                  <td className="table-cell">{r.minutes_undertime > 0 ? <span className="font-medium" style={{ color: '#fb7185' }}>{r.minutes_undertime}</span> : '0'}</td>
                  <td className="table-cell">{r.minutes_overtime > 0 ? <span className="font-medium" style={{ color: '#4ade80' }}>{r.minutes_overtime}</span> : '0'}</td>
                  <td className="table-cell">{formatMinutesToHours(r.total_work_minutes)}</td>
                  <td className="table-cell"><span className="badge-gray">{r.source || 'manual'}</span></td>
                </tr>
              ))}
              {displayRecords.length === 0 && <tr><td colSpan={(isOwner || (canViewAll && tab === 'all')) ? 9 : 8} className="text-center py-8" style={{ color: '#555' }}>No attendance records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <h3 className="font-bold text-white">Add Attendance Record</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Employee *</label>
                <select value={form.employee_user_id} onChange={(e) => setForm({ ...form, employee_user_id: e.target.value })} className="input-field" required>
                  <option value="">Select employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
              <div><label className="label">Work Date *</label><input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Time In</label><input type="time" value={form.time_in} onChange={(e) => setForm({ ...form, time_in: e.target.value })} className="input-field" /></div>
                <div><label className="label">Time Out</label><input type="time" value={form.time_out} onChange={(e) => setForm({ ...form, time_out: e.target.value })} className="input-field" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
