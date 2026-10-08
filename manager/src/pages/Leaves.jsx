import React, { useState, useEffect } from 'react';
import { Plus, Check, X as XIcon, Loader2, CalendarOff, Eye, Repeat, Coins } from 'lucide-react';
import { leaveApi } from '../api/leaveApi';
import { usePermission } from '../hooks/usePermission';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const LEAVE_TYPES = ['vacation', 'sick', 'emergency', 'maternity', 'paternity', 'special'];
// Capitalized label used for the dropdown, the Type column and the detail view.
const labelize = (type) => (type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : '');
// "Emergency" is reserved for supervisory roles — hidden from regular staff.
const EMERGENCY_ROLES = ['manager', 'supervisor'];
// Standard sub-reasons replace the old free-text Reason field. Every type has a
// dropdown so the field is always a required, concrete selection.
const SUB_REASONS = {
  vacation: [
    'Vacation / Personal',
    'Vacation / Out of Town',
    'Vacation / Out of Country',
    'Vacation / Birthday',
    'Vacation / Family Event',
    'Vacation / Holiday Travel',
  ],
  sick: [
    'Sick / Self',
    'Sick / Family Member',
    'Sick / Medical Appointment',
    'Sick / Recovery at Home',
  ],
  emergency: [
    'Emergency / Family Urgency',
    'Emergency / Medical Urgency',
    'Emergency / Personal Urgency',
  ],
  maternity: [
    'Maternity / Prenatal Care',
    'Maternity / Childbirth Recovery',
    'Maternity / Parental Leave',
  ],
  paternity: [
    'Paternity / Childbirth',
    'Paternity / Newborn Care',
  ],
  special: [
    'Special / Bereavement',
    'Special / Wedding',
    'Special / Religious Observance',
    'Special / Official Duty',
    'Special / Other',
  ],
};
// Leave may only start tomorrow (sick leave is the exception — see
// minStartISOFor). The boundary is derived from the REAL clock (new Date())
// on every render — never a hardcoded date — so it is re-derived every time
// the form opens and every time the leave type changes: for every type except
// sick, all dates up to and including today stay disabled/grayed out and
// tomorrow (today + 1) onward is selectable; for sick, only dates before the
// 1st of the current month stay disabled.
const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Returns tomorrow as a local Date so the `min` attribute and the hint text
// are both built from the same freshly computed value.
const nextDayDate = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
// First day of the current month (local clock).
const monthStartDate = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
// Earliest selectable start date for a leave type:
//  - sick leave may be filed after the fact, so anything from the 1st of the
//    current month onward is selectable (previous months stay disabled);
//  - every other type may only start tomorrow, no past dates at all.
const minStartISOFor = (type) => toISODate(type === 'sick' ? monthStartDate() : nextDayDate());

const statusColors = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger', cancelled: 'badge-gray' };

const Leaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type: 'vacation', start_date: '', end_date: '', reason: '' });
  // Leave balance summary (left card) + leave-to-cash conversions.
  const [balance, setBalance] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [viewUserId, setViewUserId] = useState(null); // null = my own balance
  const [conversions, setConversions] = useState([]);
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ leave_type: 'vacation', days: '' });
  const [converting, setConverting] = useState(false);
  // In-flight leave decision ({ id, action }) — drives the loading/disabled
  // state of the Approve/Reject icons so a double-click can't fire twice.
  const [deciding, setDeciding] = useState(null);
  const { can, user, isStaff } = usePermission();

  const canEmergency = EMERGENCY_ROLES.includes(String(user?.role || '').toLowerCase());
  // The Bar Owner is the business owner, not an employee who takes leave
  // through this system: they keep view/approve on the requests table and the
  // balance card, but the "Apply for Leave" form is theirs never to open.
  // Mirrored server-side in POST /api/leaves (403 BAR_OWNER_CANNOT_FILE).
  const isBarOwner = String(user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_') === 'bar_owner';
  const canFileLeave = can('leave_apply') && !isBarOwner;
  // Staff cannot self-file a sick leave — HR/Manager file it on their behalf —
  // so the "Sick" option is filtered out of the dropdown entirely for them.
  const canSick = !isStaff;
  const leaveTypes = LEAVE_TYPES
    .filter((t) => (canEmergency || t !== 'emergency'))
    .filter((t) => (canSick || t !== 'sick'));
  // Never let an option that this account cannot use reach the form.
  const selectedType = leaveTypes.includes(form.leave_type) ? form.leave_type : 'vacation';
  const reasonOptions = SUB_REASONS[selectedType] || [];
  // Fresh boundary for this render: the pickers' `min`, the submit guard and
  // the hint text all read from it. Sick may be backdated within the current
  // month, every other type may only start tomorrow.
  const tomorrowDate = nextDayDate();
  const isSick = selectedType === 'sick';
  const minStartISO = minStartISOFor(selectedType);

  // ── Balance summary helpers ───────────────────────────────────────────────
  const balances = balance?.balances || [];
  // Display-only: the summary card reports Vacation and Sick only. Emergency,
  // Maternity, Paternity and Special stay in the data, in the "Apply for
  // Leave" dropdown and in HR's approval queue — they are simply not listed
  // here, and TOTAL REMAINING never counts them.
  const CARD_LEAVE_TYPES = ['vacation', 'sick'];
  const cardBalances = balances.filter((b) => CARD_LEAVE_TYPES.includes(b.leave_type));
  // Accrual basis for vacation + sick: 1 day per completed month employed.
  const employment = balance?.employment || null;
  const windowInfo = balance?.conversion_window || null;
  const windowOpen = Boolean(windowInfo?.open);
  const dailyRate = Number(balance?.daily_rate || 0);
  const canViewAll = can('leave_view_all');
  const totalRemainingDays = cardBalances.reduce((sum, b) => sum + Number(b.remaining_days), 0);
  const totalRemainingHours = cardBalances.reduce((sum, b) => sum + Number(b.remaining_hours), 0);
  // Conversion to cash is SICK LEAVE ONLY (the API rejects every other type).
  const sickBalance = cardBalances.find((b) => b.leave_type === 'sick');
  const sickRemainingDays = Number(sickBalance?.remaining_days || 0);
  const sickRemainingHours = Number(sickBalance?.remaining_hours || 0);
  const convertDays = Number(convertForm.days);
  const convertAmount = convertDays > 0 && dailyRate > 0 ? convertDays * dailyRate : 0;
  // Disabled whenever sick leave runs out — unused vacation etc. never counts.
  const convertDisabled = !windowOpen || !can('leave_apply') || sickRemainingDays <= 0;
  const fmtNum = (n) => Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const fmtMoney = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Employee display name for the requests table: prefer the joined name from
  // the API, then the employee directory, then a stable fallback.
  const employeeName = (row) => {
    const joined = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    if (joined) return joined;
    const dir = employees.find((e) => Number(e.id) === Number(row.employee_user_id));
    if (dir) return `${dir.first_name || ''} ${dir.last_name || ''}`.trim();
    return row.employee_user_id ? `Employee #${row.employee_user_id}` : '—';
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  useEffect(() => { load(); loadConversions(); loadDirectory(); }, []);
  useEffect(() => { loadBalance(viewUserId); }, [viewUserId]);

  const load = async () => {
    try {
      // Always fetch every status: the All/Pending/Approved/Rejected tabs filter
      // client-side below, so switching tabs (or deciding) never leaves the table
      // showing a stale/empty result.
      const { data } = can('leave_approve') ? await leaveApi.list() : await leaveApi.myLeaves();
      setLeaves(data.data || data || []);
    } catch { /* apiClient already toasts the failure */ } finally { setLoading(false); }
  };

  const filteredLeaves = leaves.filter((l) => filter === 'all' || l.status === filter);

  // Balance summary for the selected employee (defaults to my own).
  const loadBalance = async (userId) => {
    try {
      const { data } = await leaveApi.getBalance(userId ? { user_id: userId } : {});
      setBalance(data.data || null);
    } catch { /* background GET — silently degrade to an empty card */ }
  };

  // Employee picker for anyone who may view other people's balances.
  const loadDirectory = async () => {
    if (!can('leave_view_all')) return;
    try {
      const { data } = await leaveApi.balanceEmployees();
      setEmployees(data.data || []);
    } catch { /* not permitted — the picker simply stays hidden */ }
  };

  const loadConversions = async () => {
    try {
      const { data } = await leaveApi.conversions(can('leave_approve') ? { scope: 'all' } : {});
      setConversions(data.data || []);
    } catch { /* not permitted — the section stays hidden */ }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!leaveTypes.includes(form.leave_type)) {
      toast.error(form.leave_type === 'sick'
        ? 'Sick leave is filed by HR or a manager on your behalf.'
        : 'Emergency leave is only available to supervisors and managers.');
      return;
    }
    if (!form.start_date || form.start_date < minStartISO) {
      toast.error(isSick
        ? `Sick leave can start from ${format(monthStartDate(), 'MMM d, yyyy')} onward.`
        : 'Start date must be from tomorrow onward.');
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      toast.error('End date must be on or after the start date.');
      return;
    }
    if (!form.reason) {
      toast.error('Please select a reason.');
      return;
    }
    setSaving(true);
    try {
      await leaveApi.apply({ ...form, leave_type: selectedType });
      toast.success('Leave request submitted!');
      setShowModal(false);
      load();
    } catch { /* apiClient already toasts the failure */ } finally { setSaving(false); }
  };

  const handleDecide = async (id, action) => {
    // Debugging aid: a missing id would PATCH /api/leaves/undefined/decision.
    if (!id) {
      toast.error('This request is missing its id — reload the page and try again.');
      return false;
    }
    // One decision at a time: the action icons disable while a call is in flight.
    if (deciding) return false;
    setDeciding({ id, action });
    try {
      await leaveApi.decide(id, action);
      toast.success(action === 'approve' ? 'Leave request approved!' : 'Leave request rejected!');
      // Refresh the requests table AND the Leave Balance card on the left —
      // approving posts the days into the employee's balance immediately.
      await Promise.all([load(), loadBalance(viewUserId)]);
      return true;
    } catch (err) {
      // The apiClient interceptor toasts every failure EXCEPT 409s (kept silent
      // globally because flows like Payroll render their own conflict copy).
      // Here a 409 is either the accrual-cap guard (approve more days than the
      // employee has accrued) or a stale row that is no longer pending — both
      // need visible feedback, otherwise the click looks like it did nothing.
      if (err?.response?.status === 409) {
        toast.error(err.response.data?.message || 'This leave request can no longer be decided.');
      }
      return false;
    } finally {
      setDeciding(null);
    }
  };

  // ── Leave-to-cash conversions ─────────────────────────────────────────────
  // Opens the conversion form pre-seeded with the first leave type that still
  // has remaining days.
  const openConvert = () => {
    setConvertForm({ leave_type: 'sick', days: '' });
    setShowConvert(true);
  };

  const handleConvert = async (e) => {
    e.preventDefault();
    if (!windowOpen) {
      toast.error(`Conversion opens on ${windowInfo?.opens_again_label || windowInfo?.opens}.`);
      return;
    }
    if (!(convertDays > 0)) {
      toast.error('Enter the number of sick leave days to convert.');
      return;
    }
    if (convertDays > sickRemainingDays) {
      toast.error(`Only ${fmtNum(sickRemainingDays)} day(s) of unused sick leave remain.`);
      return;
    }
    setConverting(true);
    try {
      const payload = { leave_type: convertForm.leave_type, days: convertDays };
      // Filing for someone else (HR / manager view) — the backend checks
      // leave_view_all for on-behalf requests.
      if (canViewAll && viewUserId) payload.employee_user_id = viewUserId;
      await leaveApi.createConversion(payload);
      toast.success('Conversion request submitted for approval.');
      setShowConvert(false);
      loadBalance(viewUserId);
      loadConversions();
    } catch { /* apiClient already toasts the failure */ } finally { setConverting(false); }
  };

  const handleDecideConversion = async (id, action) => {
    try {
      const { data } = await leaveApi.decideConversion(id, action);
      const payload = data?.data || {};
      if (action === 'approve' && payload.payroll?.applied) {
        toast.success(`Conversion approved — ${fmtMoney(payload.amount)} added to payroll run #${payload.payroll.run_id}`);
      } else if (action === 'approve') {
        toast.success(`Conversion approved — ${fmtMoney(payload.amount)} will be added to the payroll run covering this date`);
      } else {
        toast.success(`Conversion ${action}d!`);
      }
      loadConversions();
      loadBalance(viewUserId);
    } catch { /* apiClient already toasts the failure */ }
  };

  // Switching the summary between my balance and another employee's.
  const handleViewEmployeeChange = (value) => {
    const id = Number(value);
    setViewUserId(!id || id === user?.id ? null : id);
  };

  // Opening the form resets it and re-derives the date boundary for today.
  const handleOpen = () => {
    // Guard the entry point itself: the +Add button is hidden for the bar
    // owner, and nothing else (deep link, keyboard shortcut, console call)
    // may open the form for them either.
    if (!canFileLeave) return;
    setForm({ leave_type: 'vacation', start_date: '', end_date: '', reason: '' });
    setShowModal(true);
  };

  // Leave type changed: re-derive the boundary for the NEW type (tomorrow for
  // everything except sick, the 1st of the current month for sick) and drop any
  // previously picked date that it no longer allows — e.g. a backdated sick
  // date is cleared when switching to a type with no past dates allowed.
  const handleTypeChange = (value) => {
    setForm((f) => {
      const floor = minStartISOFor(value);
      const start = f.start_date >= floor ? f.start_date : '';
      const end = start ? (f.end_date && f.end_date >= start ? f.end_date : '') : '';
      return { ...f, leave_type: value, reason: '', start_date: start, end_date: end };
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Left column — balance summary + leave-to-cash requests */}
      <aside className="w-full lg:w-[320px] shrink-0 space-y-4">
        <div className="card" data-testid="balance-card">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4" style={{ color: '#f59e0b' }} /> Leave Balance
            </h3>
            <span className="text-[11px] font-semibold" style={{ color: '#666' }}>
              {balance?.year || new Date().getFullYear()}
            </span>
          </div>

          {/* Employee picker — same .input-field styling as every other input */}
          {canViewAll && (
            <div className="mb-4">
              <label className="label">Employee</label>
              <select
                value={viewUserId ?? user?.id ?? ''}
                onChange={(e) => handleViewEmployeeChange(e.target.value)}
                className="input-field"
                data-testid="balance-employee-select"
              >
                <option value={user?.id ?? ''}>
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Me'}
                </option>
                {employees
                  .filter((emp) => emp.id !== user?.id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
              </select>
            </div>
          )}

          <p className="text-[11px] mb-3" style={{ color: '#666' }} data-testid="balance-subtitle">
            {balance
              ? `${balance.employee?.first_name || ''} ${balance.employee?.last_name || ''} · ${fmtNum(totalRemainingDays)} days (${fmtNum(totalRemainingHours)} hrs) remaining`
              : 'Loading balance…'}
          </p>

          {/* Accrual basis — hire date vs today, recalculated on every load */}
          {employment && (
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: '#555' }} data-testid="balance-accrual-hint">
              {employment.hire_date
                ? `Hired ${employment.hire_date} · ${employment.months_employed} month${employment.months_employed === 1 ? '' : 's'} employed · +1 vacation & +1 sick day per month`
                : 'No hire date on file · 0 months accrued'}
            </p>
          )}

          {/* Leave type rows — separators + zebra shading so they scan cleanly */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--m-border)' }}>
            {cardBalances.map((b, i) => (
              <div
                key={b.leave_type_id}
                className="flex items-center gap-3 px-3"
                style={{
                  paddingTop: 12,
                  paddingBottom: 12,
                  background: i % 2 === 1 ? 'var(--m-active-bg)' : 'transparent',
                  borderBottom: i < cardBalances.length - 1 ? '1px solid var(--m-border)' : 'none',
                }}
                data-testid={`balance-row-${b.leave_type}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white leading-snug">{b.name}</p>
                  <p className="text-[11px] leading-snug mt-1" style={{ color: '#666' }}>
                    {fmtNum(b.used_days)} used of {fmtNum(Number(b.accrued_days ?? b.allocated_days) + Number(b.carryover_days))} accrued
                  </p>
                </div>
                {/* single line, optically centred against the two-line block */}
                <div className="shrink-0 whitespace-nowrap text-[13px] font-bold" style={{ color: '#f59e0b' }} data-testid={`balance-days-${b.leave_type}`}>
                  {fmtNum(b.remaining_days)} days <span className="font-semibold" style={{ color: '#fbbf24' }}>({fmtNum(b.remaining_hours)} hrs)</span>
                </div>
              </div>
            ))}
            {cardBalances.length === 0 && (
              <p className="text-[13px] py-4 text-center" style={{ color: '#555' }}>No balance on file.</p>
            )}
          </div>

          {/* Totals — separated from the list, orange accent, larger type */}
          <div className="mt-4 pt-3" style={{ borderTop: '2px solid rgba(245,158,11,0.4)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                Total Remaining
              </span>
              <span className="text-lg font-extrabold leading-none" style={{ color: '#f59e0b' }} data-testid="balance-total">
                {fmtNum(totalRemainingDays)} days
                <span className="text-[12px] font-semibold" style={{ color: '#fbbf24' }}> ({fmtNum(totalRemainingHours)} hrs)</span>
              </span>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: '#555' }}>Vacation and sick leave</p>
          </div>

          {/* Conversion action — sick leave only */}
          <button
            type="button"
            onClick={openConvert}
            disabled={convertDisabled}
            title={!windowOpen && windowInfo ? `Conversion opens on ${windowInfo.opens_again_label || windowInfo.opens}` : undefined}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-[13px]"
            data-testid="convert-btn"
          >
            <Repeat className="w-4 h-4 shrink-0" /> Convert Unused Sick Leave to Cash
          </button>
          {!windowOpen && windowInfo && (
            <div className="mt-2 space-y-1 text-center leading-relaxed" data-testid="convert-window-hint">
              <p className="text-[11px]" style={{ color: '#555' }}>
                Next conversion window: {windowInfo.next_label || `${windowInfo.opens} to ${windowInfo.closes}`}
              </p>
              <p className="text-[11px]" style={{ color: '#666' }}>
                Conversion opens again on {windowInfo.opens_again_label || windowInfo.opens}
              </p>
            </div>
          )}
          {windowOpen && windowInfo?.active_label && (
            <p className="text-[11px] mt-2 text-center leading-relaxed" style={{ color: '#666' }} data-testid="convert-active-window">
              Conversion window: {windowInfo.active_label}
            </p>
          )}
          {windowOpen && (
            sickRemainingDays > 0 ? (
              <p className="text-[11px] mt-2 text-center leading-relaxed" style={{ color: '#666' }} data-testid="convert-sick-hint">
                Sick leave only · {fmtNum(sickRemainingDays)} days ({fmtNum(sickRemainingHours)} hrs) available
              </p>
            ) : (
              <p className="text-[11px] mt-2 text-center leading-relaxed" style={{ color: '#666' }} data-testid="convert-empty-hint">
                No unused sick leave to convert.
              </p>
            )
          )}
        </div>

        <div className="card p-0 overflow-hidden" data-testid="conversions-card">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--m-border)', background: 'var(--m-surface-2)' }}>
            <h4 className="font-semibold text-white text-sm">Leave-to-Cash Requests</h4>
            <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>
              {can('leave_approve') ? 'Approve or reject pending requests' : 'Your conversion requests'}
            </p>
          </div>
          <div>
            {conversions.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#555' }} data-testid="conversions-empty">
                No conversion requests.
              </p>
            )}
            {conversions.map((c) => (
              <div key={c.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--m-border)' }} data-testid={`conversion-row-${c.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.first_name} {c.last_name} · {c.name}</p>
                    <p className="text-[11px]" style={{ color: '#666' }}>
                      {fmtNum(c.days)} day(s) × {fmtMoney(c.daily_rate)} = <span style={{ color: '#fbbf24' }}>{fmtMoney(c.amount)}</span>
                    </p>
                  </div>
                  <span className={statusColors[c.status] || 'badge-gray'}>{c.status}</span>
                </div>
                {(c.status === 'approved' || c.status === 'rejected') && (
                  <p className="text-[11px] mt-1.5" style={{ color: '#666' }} data-testid={`conversion-audit-${c.id}`}>
                    {c.status === 'approved'
                      ? `Approved by ${c.approved_by_name || '—'} · ${c.decided_at ? format(parseUTC(c.decided_at), 'MMM d, yyyy') : '—'} · ${fmtNum(c.hours)} hrs · ${fmtMoney(c.amount)}`
                      : `Rejected by ${c.approved_by_name || '—'} · ${c.decided_at ? format(parseUTC(c.decided_at), 'MMM d, yyyy') : '—'}`}
                    {c.status === 'approved' && (c.payroll_run_id
                      ? ` · Added to payroll run #${c.payroll_run_id}`
                      : ' · Waiting for payroll')}
                  </p>
                )}
                {can('leave_approve') && c.status === 'pending' && (
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button onClick={() => handleDecideConversion(c.id, 'approve')} data-testid={`conversion-approve-${c.id}`}
                      className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    ><Check className="w-4 h-4" /></button>
                    <button onClick={() => handleDecideConversion(c.id, 'reject')} data-testid={`conversion-reject-${c.id}`}
                      className="p-1.5 rounded-lg transition-colors" style={{ color: '#ff6666' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    ><XIcon className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Right column — filters + leave requests */}
      <div className="flex-1 min-w-0 w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
          {['all', 'pending', 'approved', 'rejected'].map((f) => (
            <button key={f} onClick={() => { setFilter(f); }} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={filter === f ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {canFileLeave && (
          <button onClick={handleOpen} className="btn-primary flex items-center gap-2" data-testid="add-leave-btn">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full leave-table">
            <thead style={{ borderBottom: '1px solid var(--m-border)' }}><tr>
              {can('leave_approve') && <th className="table-header">Employee</th>}
              <th className="table-header">Type</th>
              <th className="table-header">Start</th>
              <th className="table-header">End</th>
              <th className="table-header">Days</th>
              <th className="table-header">Reason</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">View</th>
              {can('leave_approve') && <th className="table-header text-right">Actions</th>}
            </tr></thead>
            <tbody>
              {filteredLeaves.map((l) => (
                <tr key={l.id} className="transition-colors" style={{ borderBottom: '1px solid var(--m-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {can('leave_approve') && <td className="table-cell font-medium text-white whitespace-nowrap">{employeeName(l)}</td>}
                  <td className="table-cell"><span className="badge-info whitespace-nowrap">{labelize(l.leave_type)}</span></td>
                  <td className="table-cell">{l.start_date ? format(parseUTC(l.start_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell">{l.end_date ? format(parseUTC(l.end_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell">{l.days || calculateDays(l.start_date, l.end_date) || '—'}</td>
                  <td className="table-cell max-w-[200px] truncate" style={{ color: '#888' }}>{l.reason || '—'}</td>
                  <td className="table-cell"><span className={`${statusColors[l.status] || 'badge-gray'} whitespace-nowrap`}>{l.status}</span></td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setDetailModal(l)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#CC0000' }}
                        aria-label="View leave request"
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  {can('leave_approve') && (
                    <td className="table-cell text-right">
                      {l.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDecide(l.id, 'approve'); }}
                            disabled={!!deciding}
                            data-testid={`leave-approve-${l.id}`}
                            aria-label="Confirm leave request"
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: '#4ade80' }}
                            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            {deciding?.id === l.id && deciding?.action === 'approve'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDecide(l.id, 'reject'); }}
                            disabled={!!deciding}
                            data-testid={`leave-reject-${l.id}`}
                            aria-label="Reject leave request"
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: '#ff6666' }}
                            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            {deciding?.id === l.id && deciding?.action === 'reject'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <XIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan="9" className="text-center py-8" style={{ color: '#555' }}>No leave requests found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {showModal && canFileLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <h3 className="font-bold text-white">Apply for Leave</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><XIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApply} className="p-6 space-y-4">
              <div>
                <label className="label">Leave Type</label>
                <select value={selectedType} onChange={(e) => handleTypeChange(e.target.value)} className="input-field" data-testid="leave-type-select">
                  {leaveTypes.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
                </select>
                {!canEmergency && <p className="text-[11px] mt-1" style={{ color: '#666' }}>Emergency leave is available to supervisors and managers.</p>}
                {!canSick && <p className="text-[11px] mt-1" style={{ color: '#666' }}>Sick leave is filed by HR or a manager on your behalf.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date *</label>
                  {/* key ties the native widget to the current boundary (leave
                      type + earliest date): when either changes React remounts
                      it, so no previous disabled range can stick. */}
                  <input key={`start-${selectedType}-${minStartISO}`} type="date" value={form.start_date} min={minStartISO} data-testid="leave-start-date"
                    onChange={(e) => {
                      const start = e.target.value;
                      setForm((f) => ({ ...f, start_date: start, end_date: f.end_date && f.end_date < start ? '' : f.end_date }));
                    }}
                    className="input-field" required />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input key={`end-${selectedType}-${minStartISO}`} type="date" value={form.end_date} min={form.start_date || minStartISO} data-testid="leave-end-date"
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="input-field" required />
                </div>
              </div>
              <p className="text-[11px] -mt-2" style={{ color: '#666' }}>
                {isSick
                  ? 'You can select any date from this month, including past dates, for sick leave.'
                  : `Past dates are disabled — leave can start ${format(tomorrowDate, 'MMM d, yyyy')} at the earliest.`}
              </p>
              <div>
                <label className="label" data-testid="leave-reason-label">{labelize(selectedType)} Reason *</label>
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input-field" required data-testid="leave-reason-select">
                  <option value="" disabled>{selectedType === 'vacation' ? 'Select a vacation reason' : `Select a ${labelize(selectedType).toLowerCase()} reason`}</option>
                  {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <h3 className="font-bold text-white">Leave Request Details</h3>
              <button onClick={() => setDetailModal(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><XIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {can('leave_approve') && detailModal.first_name && (
                <div>
                  <label className="label">Employee</label>
                  <p className="text-white font-medium">{detailModal.first_name} {detailModal.last_name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Leave Type</label>
                  <p className="text-white font-medium">{labelize(detailModal.leave_type)}</p>
                </div>
                <div>
                  <label className="label">Status</label>
                  <p><span className={statusColors[detailModal.status] || 'badge-gray'}>{detailModal.status}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <p className="text-white font-medium">{detailModal.start_date ? format(parseUTC(detailModal.start_date), 'MMM d, yyyy') : '—'}</p>
                </div>
                <div>
                  <label className="label">End Date</label>
                  <p className="text-white font-medium">{detailModal.end_date ? format(parseUTC(detailModal.end_date), 'MMM d, yyyy') : '—'}</p>
                </div>
              </div>
              <div>
                <label className="label">Total Days</label>
                <p className="text-white font-medium">{detailModal.days || calculateDays(detailModal.start_date, detailModal.end_date)} days</p>
              </div>
              <div>
                <label className="label">Reason</label>
                <p style={{ color: '#888' }}>{detailModal.reason || 'No reason provided'}</p>
              </div>
              {can('leave_approve') && detailModal.status === 'pending' && (
                <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--m-border)' }}>
                  <button
                    onClick={async () => { const ok = await handleDecide(detailModal.id, 'approve'); if (ok) setDetailModal(null); }}
                    disabled={!!deciding}
                    data-testid="detail-approve-btn"
                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deciding?.action === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                  </button>
                  <button
                    onClick={async () => { const ok = await handleDecide(detailModal.id, 'reject'); if (ok) setDetailModal(null); }}
                    disabled={!!deciding}
                    data-testid="detail-reject-btn"
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deciding?.action === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XIcon className="w-4 h-4" />} Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert Unused Sick Leave to Cash — sick leave only */}
      {showConvert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConvert(false)} data-testid="convert-modal">
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <div>
                <h3 className="font-bold text-white">Convert Unused Sick Leave to Cash</h3>
                <p className="text-[11px] mt-0.5" style={{ color: '#666' }}>Sick leave only · year-end window</p>
              </div>
              <button onClick={() => setShowConvert(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><XIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleConvert} className="p-6 space-y-4">
              <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Available Sick Leave</span>
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: '#f59e0b' }} data-testid="convert-available">
                  {fmtNum(sickRemainingDays)} days ({fmtNum(sickRemainingHours)} hrs)
                </span>
              </div>
              <div>
                <label className="label">Sick Leave Days to Convert *</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  max={sickRemainingDays}
                  value={convertForm.days}
                  onChange={(e) => setConvertForm((f) => ({ ...f, days: e.target.value }))}
                  className="input-field"
                  data-testid="convert-days"
                  required
                />
                <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#666' }}>
                  Vacation, emergency, maternity, paternity and special leave cannot be converted.
                </p>
              </div>
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Payout</span>
                <span className="text-base font-bold text-white" data-testid="convert-amount">{fmtMoney(convertAmount)}</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#666' }}>
                Conversion uses your daily rate ({fmtMoney(dailyRate)}) and is credited to payroll after approval.
                {' '}Window: {windowInfo?.active_label || `${windowInfo?.opens} to ${windowInfo?.closes}`}.
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={converting} className="btn-primary flex-1 flex items-center justify-center gap-2" data-testid="convert-submit">
                  {converting && <Loader2 className="w-4 h-4 animate-spin" />} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
