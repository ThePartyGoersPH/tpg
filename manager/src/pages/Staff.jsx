import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, UserX, RotateCcw, Key, ToggleLeft, ToggleRight, X, Loader2, Shield, Clock, LayoutGrid, List } from 'lucide-react';
import { staffApi } from '../api/staffApi';
import { attendanceApi } from '../api/attendanceApi';
import { usePermission } from '../hooks/usePermission';
import { PERMISSION_PRESETS, PRESET_ORDER, PRESET_LABELS, PRESET_COLORS, ALL_SENTINEL, CLEAR_SENTINEL } from '../utils/permissionPresets';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const POS_WEB_PERMISSION_CODES = ['menu_view', 'reservation_view', 'reservation_manage'];

const WEEK_DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const createDefaultScheduleState = () => {
  const next = {};
  WEEK_DAY_OPTIONS.forEach(({ value }) => {
    const isWeekend = value === 0 || value === 6;
    next[value] = {
      day_of_week: value,
      shift_start: '09:00',
      shift_end: '18:00',
      break_minutes: 60,
      overtime_multiplier: 1.25,
      undertime_penalty_multiplier: 1,
      is_rest_day: isWeekend ? 1 : 0,
      is_active: 1,
    };
  });
  return next;
};

const toTimeInputValue = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const match = raw.match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

const toScheduleTimeValue = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw.length === 5 ? `${raw}:00` : raw;
};

const Staff = () => {
  const [users, setUsers] = useState([]);
  const [archived, setArchived] = useState([]);
  const [fullyDeactivated, setFullyDeactivated] = useState([]);
  const [staffTypes, setStaffTypes] = useState([]);
  const [supportsStaffType, setSupportsStaffType] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active');
  const [view, setView] = useState(() => localStorage.getItem('staff_view') || 'list');
  const [showModal, setShowModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(createDefaultScheduleState());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, staff: null });
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', phone_number: '', role: 'staff', staff_type: '', daily_rate: '' });
  const [permTarget, setPermTarget] = useState(null);
  const [userPerms, setUserPerms] = useState([]);
  const [posWebAccessByUser, setPosWebAccessByUser] = useState({});
  const [posWebToggleLoadingByUser, setPosWebToggleLoadingByUser] = useState({});
  const [createPermissionPreset, setCreatePermissionPreset] = useState('employee');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const { can, isOwner, isHR, user } = usePermission();
  const canEditDailyRate = isOwner || isHR;
  const canViewDailyRate = canEditDailyRate;
  // The API only ships the unmasked staff ID to HR / Bar Owner accounts, so the
  // rendered value is simply whichever field the server sent for this viewer.
  const staffIdOf = (u) => u?.staff_id_number || u?.staff_id_masked || '';
  const canManagePerms = can('staff_edit_permissions');
  const canManageSchedules = can('attendance_view_all');
  const isSelfStaffTarget = (target) => Boolean(
    target
      && Number(target.id) === Number(user?.id)
      && String(user?.role || '').toLowerCase() === 'staff'
  );
  const isSelfStaffEdit = Boolean(
    editing
      && Number(editing.id) === Number(user?.id)
      && String(user?.role || '').toLowerCase() === 'staff'
  );

  useEffect(() => { load(); }, []);

  useEffect(() => { localStorage.setItem('staff_view', view); }, [view]);

  const hasPosWebAccessFromPermissions = (permissionRows) => {
    const grantedCodes = new Set(
      (permissionRows || [])
        .filter((perm) => Number(perm?.granted ?? 1) !== 0)
        .map((perm) => String(perm?.name || '').toLowerCase())
    );

    return POS_WEB_PERMISSION_CODES.every((code) => grantedCodes.has(code));
  };

  const hydratePosWebAccess = async (staffRows) => {
    if (!canManagePerms) return;

    const targets = (staffRows || []).filter((u) => u.role !== 'bar_owner');
    if (!targets.length) {
      setPosWebAccessByUser({});
      return;
    }

    const results = await Promise.all(
      targets.map(async (user) => {
        try {
          const { data } = await staffApi.getUserPermissions(user.id);
          const permissionRows = data?.data || data || [];
          return [user.id, hasPosWebAccessFromPermissions(permissionRows)];
        } catch {
          return [user.id, false];
        }
      })
    );

    setPosWebAccessByUser(Object.fromEntries(results));
  };

  const load = async () => {
    try {
      const [usersRes, rolesRes, permsRes, metaRes] = await Promise.all([
        staffApi.list(),
        canManagePerms ? staffApi.getRoles().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canManagePerms ? staffApi.getPermissions().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        staffApi.getMeta().catch(() => ({ data: { data: { staff_types: [], supports_staff_type: false } } })),
      ]);
      const nextUsers = usersRes.data.data || usersRes.data || [];
      setUsers(nextUsers);
      setRoles(rolesRes.data.data || rolesRes.data || []);
      setPermissions(permsRes.data.data || permsRes.data || []);
      const meta = metaRes.data.data || metaRes.data || {};
      setStaffTypes(Array.isArray(meta.staff_types) ? meta.staff_types : []);
      setSupportsStaffType(Boolean(meta.supports_staff_type));
      try { const archRes = await staffApi.listArchived(); setArchived(archRes.data.data || archRes.data || []); } catch { setArchived([]); }
      try { const fdRes = await staffApi.listFullyDeactivated(); setFullyDeactivated(fdRes.data.data || fdRes.data || []); } catch { setFullyDeactivated([]); }
      if (canManagePerms) {
        await hydratePosWebAccess(nextUsers);
      } else {
        setPosWebAccessByUser({});
      }
    } catch {} finally { setLoading(false); }
  };

  const handleQuickTogglePosWeb = async (targetUser) => {
    if (!canManagePerms || !targetUser?.id) return;
    if (targetUser.role === 'bar_owner') {
      toast.error('POS access toggle is not applicable to bar owner accounts.');
      return;
    }

    const posPermissionIds = permissions
      .filter((perm) => POS_WEB_PERMISSION_CODES.includes(String(perm.name || '').toLowerCase()))
      .map((perm) => perm.id);

    if (posPermissionIds.length !== POS_WEB_PERMISSION_CODES.length) {
      toast.error("POS access isn't set up for this account yet.");
      return;
    }

    setPosWebToggleLoadingByUser((prev) => ({ ...prev, [targetUser.id]: true }));

    try {
      const { data } = await staffApi.getUserPermissions(targetUser.id);
      const currentRows = data?.data || data || [];
      const currentPermissionIds = currentRows.map((perm) => Number(perm.id)).filter(Boolean);
      const currentlyEnabled = hasPosWebAccessFromPermissions(currentRows);

      const nextPermissionIds = currentlyEnabled
        ? currentPermissionIds.filter((id) => !posPermissionIds.includes(id))
        : Array.from(new Set([...currentPermissionIds, ...posPermissionIds]));

      await staffApi.updateUserPermissions(targetUser.id, nextPermissionIds);

      setPosWebAccessByUser((prev) => ({
        ...prev,
        [targetUser.id]: !currentlyEnabled,
      }));

      toast.success(!currentlyEnabled ? 'POS web access enabled.' : 'POS web access disabled.');
    } catch {
      toast.error('Failed to update POS web access.');
    } finally {
      setPosWebToggleLoadingByUser((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const tierSource = tab === 'active' ? users : tab === 'archived' ? archived : fullyDeactivated;
  const filtered = tierSource.filter((u) => {
    if (String(u.role || '').toLowerCase() === 'bar_owner') return false;
    return `${u.first_name} ${u.last_name} ${u.email} ${staffIdOf(u)}`.toLowerCase().includes(search.toLowerCase());
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', phone_number: '', role: 'staff', staff_type: '', daily_rate: '' });
    setCreatePermissionPreset('employee');
    setShowModal(true);
  };

  const openEdit = (u) => {
    const nonOperationalRoles = ['finance', 'hr', 'manager'];
    const staffTypeValue = nonOperationalRoles.includes(u.role) ? '' : (u.staff_type || '');
    setEditing(u);
    setForm({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      password: '',
      phone_number: u.phone_number || '',
      role: u.role,
      staff_type: staffTypeValue,
      daily_rate: canViewDailyRate ? (u.daily_rate ?? '') : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let normalizedDailyRate;
      if (canEditDailyRate) {
        normalizedDailyRate = form.daily_rate === '' || form.daily_rate === null
          ? 0
          : Number(form.daily_rate);

        if (!Number.isFinite(normalizedDailyRate) || normalizedDailyRate < 0) {
          toast.error('Daily salary must be a non-negative number');
          setSaving(false);
          return;
        }
      }

      // For non-operational roles (Finance, HR, Manager), staff_type should be null
      const nonOperationalRoles = ['finance', 'hr', 'manager'];
      const staffTypeValue = nonOperationalRoles.includes(form.role) ? null : (form.staff_type || null);

      if (editing) {
        const payload = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone_number: form.phone_number,
        };
        if (!isSelfStaffEdit) {
          payload.role = form.role;
          payload.staff_type = staffTypeValue;
        }
        if (canEditDailyRate) payload.daily_rate = normalizedDailyRate;
        await staffApi.update(editing.id, payload);
        toast.success('User updated!');
      } else {
        const createPayload = { ...form, staff_type: staffTypeValue };
        if (canEditDailyRate) createPayload.daily_rate = normalizedDailyRate;
        const createRes = await staffApi.create(createPayload);
        const createdUserId = createRes?.data?.data?.user_id;
        const createdMessage = createRes?.data?.message;
        if (can('staff_edit_permissions') && createdUserId) {
          const presetIds = resolvePresetIds(createPermissionPreset);
          if (presetIds.length > 0) {
            try {
              await staffApi.updateUserPermissions(createdUserId, presetIds);
            } catch {
              toast.error('User created, but failed to apply initial permission preset');
            }
          }
        }
        toast.success(createdMessage || 'User created!');
      }
      setShowModal(false);
      load();
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to save staff details';
      toast.error(message);
    } finally { setSaving(false); }
  };

  const staffTypeOptions = Array.from(new Set([...(staffTypes || []), ...(form.staff_type ? [form.staff_type] : [])]));
  const nonOperationalRoles = ['finance', 'hr', 'manager'];
  const showStaffTypeField = !nonOperationalRoles.includes(form.role);
  const showStaffTypeColumn = supportsStaffType || users.some((u) => u.staff_type) || archived.some((u) => u.staff_type) || fullyDeactivated.some((u) => u.staff_type);

  const handleToggle = async (id) => {
    const target = users.find((u) => u.id === id);
    if (isSelfStaffTarget(target)) {
      toast.error('Staff accounts cannot change their own account status.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      action: 'toggle',
      staff: target,
      title: 'Deactivate Staff?',
      message: `${target.first_name} ${target.last_name} will be archived and unable to log in. Their records are preserved and they can be restored later.`,
      type: 'warning'
    });
  };

  const executeToggle = async () => {
    if (!confirmModal.staff) return;
    try {
      await staffApi.update(confirmModal.staff.id, { is_active: confirmModal.staff.is_active ? 0 : 1 });
      toast.success(confirmModal.staff.is_active ? 'Staff deactivated' : 'Staff activated');
      setConfirmModal({ isOpen: false, action: null, staff: null });
      load();
    } catch {
      toast.error('Failed to update staff');
    }
  };

  const handleConfirm = () => {
    if (confirmModal.action === 'fully-deactivate') executeFullyDeactivate();
    else if (confirmModal.action === 'toggle') executeToggle();
  };

  const handleRestore = async (id) => {
    try {
      const { data } = await staffApi.restore(id);
      toast.success(data?.message || 'User restored');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to restore staff');
    }
  };

  const handleFullyDeactivate = (staff) => {
    setConfirmModal({
      isOpen: true,
      action: 'fully-deactivate',
      staff,
      title: 'Fully Deactivate Staff?',
      message: `${staff.first_name} ${staff.last_name} will be permanently locked out. Their payroll, attendance, and sales history is preserved 100% for auditing — nothing is deleted. They can still be reactivated if rehired.`,
      type: 'danger'
    });
  };

  const executeFullyDeactivate = async () => {
    if (!confirmModal.staff) return;
    // Close the confirmation immediately so a slow request never leaves a
    // stuck modal; the outcome is reported via toast either way.
    const target = confirmModal.staff;
    setConfirmModal({ isOpen: false, action: null, staff: null });
    try {
      const { data } = await staffApi.fullyDeactivate(target.id);
      toast.success(data?.message || 'Staff account fully deactivated');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to fully deactivate staff');
    }
  };

  const openPermissions = async (u) => {
    setPermTarget(u);
    try {
      const { data } = await staffApi.getUserPermissions(u.id);
      const permIds = (data.data || data || []).map((p) => p.id);
      setUserPerms(permIds);
    } catch { setUserPerms([]); }
    setShowPermModal(true);
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await staffApi.updateUserPermissions(permTarget.id, userPerms);
      toast.success('Permissions updated!');
      setShowPermModal(false);
    } catch {} finally { setSaving(false); }
  };

  const togglePerm = (pid) => {
    setUserPerms((prev) => prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]);
  };

  // Resolve a preset's permission IDs from the central config (src/utils/permissionPresets.js)
  const resolvePresetIds = (presetName) => {
    if (presetName === 'all' || PERMISSION_PRESETS[presetName] === ALL_SENTINEL) {
      return permissions.map((p) => p.id);
    }
    if (presetName === 'clear' || PERMISSION_PRESETS[presetName] === CLEAR_SENTINEL) {
      return [];
    }
    const codes = PERMISSION_PRESETS[presetName];
    if (!Array.isArray(codes)) return [];
    const codeSet = new Set(codes);
    return permissions.filter((p) => codeSet.has(p.name)).map((p) => p.id);
  };

  const sameIdSet = (a, b) => {
    if (a.length !== b.length) return false;
    const sb = new Set(b);
    return a.every((id) => sb.has(id));
  };

  // Which preset (if any) exactly matches the current checkbox state?
  // null means the current selection is a "custom" set (no preset highlighted).
  const activePreset = (() => {
    for (const key of ['employee', 'hr', 'finance', 'manager', 'all']) {
      if (sameIdSet(userPerms, resolvePresetIds(key))) return key;
    }
    return null;
  })();

  // Clicking a preset REPLACES the current checkbox state entirely with that
  // preset's full permission set (predictable, clean result each time).
  const applyPreset = (presetName) => {
    setUserPerms(resolvePresetIds(presetName));
    const label = PRESET_LABELS[presetName] || presetName;
    if (presetName === 'all') toast.success('All permissions selected');
    else if (presetName === 'clear') toast.success('All permissions cleared');
    else toast.success(`${label} preset applied`);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await staffApi.resetPassword(resetTarget.id, newPassword);
      toast.success('Password reset!');
      setShowResetModal(false);
      setNewPassword('');
    } catch {} finally { setSaving(false); }
  };

  const openScheduleEditor = async (targetUser) => {
    if (!canManageSchedules || !targetUser?.id) return;

    const defaults = createDefaultScheduleState();
    setScheduleTarget(targetUser);
    setScheduleForm(defaults);
    setShowScheduleModal(true);
    setScheduleLoading(true);

    try {
      const { data } = await attendanceApi.listSchedules({ employee_user_id: targetUser.id });
      const rows = data?.data || data || [];
      const merged = { ...defaults };

      rows.forEach((row) => {
        const day = Number(row.day_of_week);
        if (!Object.prototype.hasOwnProperty.call(merged, day)) return;
        merged[day] = {
          ...merged[day],
          shift_start: toTimeInputValue(row.shift_start, merged[day].shift_start),
          shift_end: toTimeInputValue(row.shift_end, merged[day].shift_end),
          break_minutes: Number(row.break_minutes ?? merged[day].break_minutes),
          overtime_multiplier: Number(row.overtime_multiplier ?? merged[day].overtime_multiplier),
          undertime_penalty_multiplier: Number(row.undertime_penalty_multiplier ?? merged[day].undertime_penalty_multiplier),
          is_rest_day: Number(row.is_rest_day ?? merged[day].is_rest_day),
          is_active: Number(row.is_active ?? merged[day].is_active),
        };
      });

      setScheduleForm(merged);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load working hours');
    } finally {
      setScheduleLoading(false);
    }
  };

  const updateScheduleField = (day, field, value) => {
    setScheduleForm((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const applyMondayTemplate = () => {
    const monday = scheduleForm[1];
    if (!monday) return;

    setScheduleForm((prev) => {
      const next = { ...prev };
      [2, 3, 4, 5].forEach((day) => {
        next[day] = {
          ...next[day],
          shift_start: monday.shift_start,
          shift_end: monday.shift_end,
          break_minutes: monday.break_minutes,
          overtime_multiplier: monday.overtime_multiplier,
          undertime_penalty_multiplier: monday.undertime_penalty_multiplier,
          is_rest_day: 0,
          is_active: 1,
        };
      });
      return next;
    });

    toast.success('Monday settings copied to Tuesday-Friday');
  };

  const saveSchedule = async () => {
    if (!scheduleTarget?.id) return;

    setScheduleSaving(true);
    try {
      for (const { value: day } of WEEK_DAY_OPTIONS) {
        const row = scheduleForm[day];
        if (!row) continue;

        await attendanceApi.saveSchedule({
          employee_user_id: scheduleTarget.id,
          day_of_week: day,
          shift_start: toScheduleTimeValue(row.shift_start, '09:00:00'),
          shift_end: toScheduleTimeValue(row.shift_end, '18:00:00'),
          break_minutes: Math.max(0, Number(row.break_minutes || 0)),
          overtime_multiplier: Math.max(1, Number(row.overtime_multiplier || 1)),
          undertime_penalty_multiplier: Math.max(0, Number(row.undertime_penalty_multiplier || 0)),
          is_rest_day: Number(Boolean(row.is_rest_day)),
          is_active: Number(Boolean(row.is_active)),
        });
      }

      toast.success('Working hours saved. Late, undertime, and overtime will use this schedule.');
      setShowScheduleModal(false);
      setScheduleTarget(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save working hours');
    } finally {
      setScheduleSaving(false);
    }
  };

  const roleColor = (r) => {
    const map = { bar_owner: 'badge-danger', manager: 'badge-info', hr: 'badge-purple', staff: 'badge-gray', cashier: 'badge-success' };
    return map[r] || 'badge-gray';
  };

  // 3-tier account status: active (login OK) → archived (suspended, no login)
  // → fully_deactivated (locked, records preserved, no login).
  const statusOf = (u) => String(u?.status || (u?.is_active ? 'active' : 'archived')).toLowerCase();
  const statusBadge = (u) => {
    const s = statusOf(u);
    if (s === 'fully_deactivated') return 'badge-danger';
    if (s === 'archived') return 'badge-warning';
    return 'badge-success';
  };
  const statusLabel = (u) => {
    const s = statusOf(u);
    if (s === 'fully_deactivated') return 'Fully Deactivated';
    if (s === 'archived') return 'Archived';
    return 'Active';
  };

  const toRoleLabel = (role) => {
    const map = {
      bar_owner: 'Bar Owner',
      manager: 'Manager',
      hr: 'HR',
      staff: 'Staff',
      cashier: 'Cashier',
    };
    return map[role] || role;
  };

  const toPermissionLabel = (perm) => {
    if (perm?.display_name) return perm.display_name;
    return String(perm?.name || perm?.code || '')
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-64" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search className="w-4 h-4" style={{ color: '#555' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." data-testid="staff-search" className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
          </div>
          <div className="flex rounded-lg p-1" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setTab('active')} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={tab === 'active' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Active</button>
            <button onClick={() => setTab('archived')} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={tab === 'archived' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Archived</button>
            <button onClick={() => setTab('fully_deactivated')} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors" style={tab === 'fully_deactivated' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Fully Deactivated</button>
          </div>
          <div className="flex items-center rounded-lg p-1 gap-1" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setView('list')} className={`p-2 rounded-md transition-colors ${view === 'list' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`} style={view === 'list' ? { background: 'rgba(255,255,255,0.08)' } : {}} title="List view" aria-label="List view" aria-pressed={view === 'list'}><List className="w-4 h-4" /></button>
            <button onClick={() => setView('grid')} className={`p-2 rounded-md transition-colors ${view === 'grid' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`} style={view === 'grid' ? { background: 'rgba(255,255,255,0.08)' } : {}} title="Grid view" aria-label="Grid view" aria-pressed={view === 'grid'}><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Staff</button>
      </div>

      {view === 'list' ? (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header" data-testid="staff-id-header">ID Number</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Daily Salary</th>
                  {canManagePerms && <th className="table-header">POS Web</th>}
                  {showStaffTypeColumn && <th className="table-header">Staff Type</th>}
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'rgba(204,0,0,0.3)' }}>
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <span className="font-medium text-white">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: '#888' }}>{u.email}</td>
                    <td className="table-cell whitespace-nowrap" style={{ color: '#ccc' }} data-testid={`staff-id-${u.id}`}>
                      {staffIdOf(u) || '—'}
                    </td>
                    <td className="table-cell"><span className={roleColor(u.role)}>{toRoleLabel(u.role)}</span></td>
                    <td className="table-cell" style={{ color: '#ccc' }}>
                      {canViewDailyRate ? `PHP ${Number(u.daily_rate || 0).toFixed(2)}` : '*****'}
                    </td>
                    {canManagePerms && (
                      <td className="table-cell">
                        {tab !== 'active' ? (
                          <span style={{ color: '#666' }}>—</span>
                        ) : u.role === 'bar_owner' ? (
                          <span className="badge-info">Always On</span>
                        ) : (
                          <button
                            onClick={() => handleQuickTogglePosWeb(u)}
                            disabled={Boolean(posWebToggleLoadingByUser[u.id])}
                            className="p-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                            style={{ color: '#666' }}
                            title={posWebAccessByUser[u.id] ? 'Disable POS web access' : 'Enable POS web access'}
                          >
                            {posWebToggleLoadingByUser[u.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : posWebAccessByUser[u.id] ? (
                              <ToggleRight className="w-4 h-4" style={{ color: '#4ade80' }} />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                            <span style={{ color: posWebAccessByUser[u.id] ? '#4ade80' : '#888', fontSize: '12px', fontWeight: 600 }}>
                              {posWebAccessByUser[u.id] ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        )}
                      </td>
                    )}
                    {showStaffTypeColumn && <td className="table-cell" style={{ color: '#ccc' }}>{u.staff_type || '—'}</td>}
                    <td className="table-cell">
                      <span className={statusBadge(u)}>
                        {statusLabel(u)}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tab === 'active' ? (
                          <>
                            {canManageSchedules && (
                              <button
                                onClick={() => openScheduleEditor(u)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#666' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#60a5fa'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                                title="Working Hours"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }} title="Edit"><Edit2 className="w-4 h-4" /></button>
                            {canManagePerms && <button onClick={() => openPermissions(u)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }} title="Permissions"><Shield className="w-4 h-4" /></button>}
                            <button onClick={() => { setResetTarget(u); setNewPassword(''); setShowResetModal(true); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fbbf24'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }} title="Reset Password"><Key className="w-4 h-4" /></button>
                            <button
                              onClick={() => handleToggle(u.id)}
                              disabled={isSelfStaffTarget(u)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: '#666', opacity: isSelfStaffTarget(u) ? 0.5 : 1, cursor: isSelfStaffTarget(u) ? 'not-allowed' : 'pointer' }}
                              title={isSelfStaffTarget(u) ? 'You cannot change your own account status' : 'Toggle Active'}
                            >
                              {u.is_active ? <ToggleRight className="w-4 h-4" style={{ color: '#4ade80' }} /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                          </>
                        ) : tab === 'archived' ? (
                          <>
                            <button onClick={() => handleRestore(u.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} title="Restore / Reactivate"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => handleFullyDeactivate(u)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#fbbf24' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} title="Deactivate Fully (records preserved)"><UserX className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleRestore(u.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }} title="Reactivate (restore access)"><RotateCcw className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {filtered.length === 0 && <tr><td colSpan={showStaffTypeColumn ? (canManagePerms ? 9 : 8) : (canManagePerms ? 8 : 7)} className="text-center py-8" style={{ color: '#555' }}>No staff found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        filtered.length === 0 ? (
          <div className="text-center py-12 rounded-xl" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>No staff found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: 'rgba(204,0,0,0.3)' }}>
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm truncate">{u.first_name} {u.last_name}</div>
                      <div className="text-xs truncate" style={{ color: '#888' }}>{u.email}</div>
                      <div className="text-xs truncate" style={{ color: '#888' }} data-testid={`staff-id-${u.id}`}>{staffIdOf(u) || '—'}</div>
                    </div>
                  </div>
                  <span className={`${roleColor(u.role)} text-xs shrink-0`}>{toRoleLabel(u.role)}</span>
                </div>
                <div className="space-y-1.5 text-xs" style={{ color: '#aaa' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{canViewDailyRate ? `PHP ${Number(u.daily_rate || 0).toFixed(2)}/day` : '•••••'}</span>
                    <span className={statusBadge(u)}>{statusLabel(u)}</span>
                  </div>
                  {showStaffTypeColumn && <div style={{ color: '#888' }}>{u.staff_type ? `Type: ${u.staff_type}` : '—'}</div>}
                  {canManagePerms && (
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: '#888' }}>POS Web:</span>
                      {tab !== 'active' ? <span style={{ color: '#666' }}>—</span>
                        : u.role === 'bar_owner' ? <span className="badge-info text-xs">Always On</span>
                        : (
                          <button onClick={() => handleQuickTogglePosWeb(u)} disabled={Boolean(posWebToggleLoadingByUser[u.id])} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: posWebAccessByUser[u.id] ? '#4ade80' : '#888' }}>
                            {posWebToggleLoadingByUser[u.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : posWebAccessByUser[u.id] ? <ToggleRight className="w-3.5 h-3.5" style={{ color: '#4ade80' }} /> : <ToggleLeft className="w-3.5 h-3.5" />}
                            {posWebAccessByUser[u.id] ? 'ON' : 'OFF'}
                          </button>
                        )}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1 flex-wrap pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {tab === 'active' ? (
                    <>
                      {canManageSchedules && <button onClick={() => openScheduleEditor(u)} className="p-1.5 rounded-lg" style={{ color: '#666' }} title="Working Hours"><Clock className="w-4 h-4" /></button>}
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg" style={{ color: '#666' }} title="Edit"><Edit2 className="w-4 h-4" /></button>
                      {canManagePerms && <button onClick={() => openPermissions(u)} className="p-1.5 rounded-lg" style={{ color: '#666' }} title="Permissions"><Shield className="w-4 h-4" /></button>}
                      <button onClick={() => { setResetTarget(u); setNewPassword(''); setShowResetModal(true); }} className="p-1.5 rounded-lg" style={{ color: '#666' }} title="Reset Password"><Key className="w-4 h-4" /></button>
                      <button onClick={() => handleToggle(u.id)} disabled={isSelfStaffTarget(u)} className="p-1.5 rounded-lg" style={{ color: '#666', opacity: isSelfStaffTarget(u) ? 0.5 : 1 }} title={isSelfStaffTarget(u) ? 'You cannot change your own account status' : 'Toggle Active'}>{u.is_active ? <ToggleRight className="w-4 h-4" style={{ color: '#4ade80' }} /> : <ToggleLeft className="w-4 h-4" />}</button>
                    </>
                  ) : tab === 'archived' ? (
                    <>
                      <button onClick={() => handleRestore(u.id)} className="p-1.5 rounded-lg" style={{ color: '#4ade80' }} title="Restore / Reactivate"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => handleFullyDeactivate(u)} className="p-1.5 rounded-lg" style={{ color: '#fbbf24' }} title="Deactivate Fully (records preserved)"><UserX className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleRestore(u.id)} className="p-1.5 rounded-lg" style={{ color: '#4ade80' }} title="Reactivate (restore access)"><RotateCcw className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto my-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Staff' : 'Add Staff'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">First Name *</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input-field" autoComplete="off" required /></div>
                <div><label className="label">Last Name *</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input-field" autoComplete="off" required /></div>
              </div>
              <div><label className="label">Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" autoComplete="off" required /></div>
              {!editing && (
                <div>
                  <p className="text-xs mb-2" style={{ color: '#4ade80' }}>
                    Default Password will be automatically generated as: [barname]@surname (lowercase, spaces stripped)
                  </p>
                  <p className="text-xs" style={{ color: '#888' }}>
                    Example: Bar "The Party Goers", Last Name "Batumbakal" → <code className="text-white">thepartygoers@batumbakal</code>
                  </p>
                </div>
              )}
              <div><label className="label">Phone</label><input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="input-field" autoComplete="off" /></div>
              <div>
                <label className="label">Daily Salary (PHP)</label>
                {canEditDailyRate ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.daily_rate}
                    onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                    className="input-field"
                    autoComplete="off"
                    placeholder="0.00"
                  />
                ) : (
                  <div className="input-field" style={{ display: 'flex', alignItems: 'center', color: '#888' }}>
                    *****
                  </div>
                )}
                {!canEditDailyRate && (
                  <p className="text-xs mt-1" style={{ color: '#666' }}>
                    Only Bar Owner or HR can view and change daily salary.
                  </p>
                )}
              </div>
              {editing && staffIdOf(editing) && (
                <div>
                  <label className="label">ID Number</label>
                  <div className="input-field" style={{ display: 'flex', alignItems: 'center', color: '#888' }} data-testid="staff-id-field">
                    {staffIdOf(editing)}
                  </div>
                </div>
              )}
              <div>
                <label className="label">Role * (change here)</label>
<select
                  value={form.role}
                  disabled={isSelfStaffEdit}
onChange={(e) => {
                      const nextRole = e.target.value;
                      setForm({ ...form, role: nextRole, staff_type: '' });
                      if (!editing) {
                        const inferredPreset =
                          nextRole === 'hr' ? 'hr'
                          : nextRole === 'finance' ? 'finance'
                          : nextRole === 'manager' ? 'manager'
                          : nextRole === 'cashier' ? 'cashier'
                          : 'employee';
                        setCreatePermissionPreset(inferredPreset);
                      }
                    }}
                  className="input-field"
                >
                  <option value="staff">Staff</option>
                  <option value="hr">HR</option>
                  <option value="finance">Finance</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
                {isSelfStaffEdit && (
                  <p className="text-xs mt-1" style={{ color: '#666' }}>
                    Staff accounts cannot change their own role.
                  </p>
                )}
              </div>
              {!editing && canManagePerms && (
                <div>
                  <label className="label">Initial Permission Preset</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESET_ORDER.filter((k) => k !== 'all' && k !== 'clear').map((key) => {
                      const color = PRESET_COLORS[key];
                      const label = PRESET_LABELS[key];
                      return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setCreatePermissionPreset(key);
                          // Keep the Role dropdown in sync with the preset
                          // (backend enums are lowercase: staff/cashier/hr/finance/manager).
                          if (['cashier', 'hr', 'finance', 'manager'].includes(key)) {
                            setForm((f) => ({ ...f, role: key, staff_type: '' }));
                          } else if (key === 'employee') {
                            setForm((f) => ({ ...f, role: 'staff' }));
                          }
                        }}
                        className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={
                          createPermissionPreset === key
                            ? { background: `${color}22`, color, border: `1px solid ${color}66` }
                            : { background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                         {label}
                       </button>
                      );
                    })}
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#666' }}>
                    Applies preset permissions immediately after account creation.
                  </p>
                </div>
              )}
              {showStaffTypeField && (
                <div>
                  <label className="label">Staff Type Label</label>
                  <select
                    value={form.staff_type || ''}
                    onChange={(e) => setForm({ ...form, staff_type: e.target.value })}
                    className="input-field"
                    disabled={staffTypeOptions.length === 0 || isSelfStaffEdit}
                  >
                    <option value="">{staffTypeOptions.length === 0 ? 'No staff types saved in Bar Management yet' : 'Select staff type...'}</option>
                    {staffTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  {form.staff_type && staffTypes.length > 0 && !staffTypes.some((t) => t.toLowerCase() === String(form.staff_type).toLowerCase()) && (
                    <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>
                      “{form.staff_type}” is no longer enabled in Bar Settings — kept on this record, but only active types can be assigned going forward.
                    </p>
                  )}
                  {isSelfStaffEdit && (
                    <p className="text-xs mt-1" style={{ color: '#666' }}>
                      Staff accounts cannot change their own staff type.
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermModal && permTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPermModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <h3 className="font-bold text-white">Permissions: {permTarget.first_name} {permTarget.last_name}</h3>
              <button onClick={() => setShowPermModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-4" style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#888' }}>Quick Presets:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_ORDER.map((key) => {
                  const color = PRESET_COLORS[key];
                  const isActive = activePreset === key;
                  return (
                    <button key={key} onClick={() => applyPreset(key)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                      style={{
                        background: isActive ? `${color}22` : 'rgba(255,255,255,0.06)',
                        color: isActive ? color : '#aaa',
                        border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >{PRESET_LABELS[key]}</button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 space-y-1">
              {permissions.map((p) => (
                <label key={p.id} className="flex items-center gap-3 py-1.5 cursor-pointer rounded px-2 transition-colors" style={{ borderRadius: '6px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <input type="checkbox" checked={userPerms.includes(p.id)} onChange={() => togglePerm(p.id)} className="w-4 h-4 rounded" style={{ accentColor: '#CC0000' }} />
                  <div>
                    <span className="text-sm font-medium text-white">{toPermissionLabel(p)}</span>
                    {(p.friendly_description || p.description) && (
                      <p className="text-xs" style={{ color: '#666' }}>{p.friendly_description || p.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="px-6 py-4 sticky bottom-0 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <button onClick={() => setShowPermModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={savePermissions} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowResetModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">Reset Password</h3>
              <button onClick={() => setShowResetModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: '#888' }}>Reset password for <strong className="text-white">{resetTarget.first_name} {resetTarget.last_name}</strong></p>
              <div><label className="label">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" autoComplete="new-password" minLength={6} /></div>
              <div className="flex gap-3">
                <button onClick={() => setShowResetModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleResetPassword} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Working Hours Modal */}
      {showScheduleModal && scheduleTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !scheduleSaving && setShowScheduleModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <div>
                <h3 className="font-bold text-white">Working Hours Setup</h3>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {scheduleTarget.first_name} {scheduleTarget.last_name} • Schedule used to compute late, undertime, and overtime.
                </p>
              </div>
              <button onClick={() => !scheduleSaving && setShowScheduleModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {scheduleLoading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#CC0000' }} />
              </div>
            ) : (
              <>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={applyMondayTemplate}
                    className="px-3 py-2 text-xs rounded-lg"
                    style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.35)' }}
                  >
                    Copy Monday Settings to Tue-Fri
                  </button>
                </div>

                <div className="p-6 overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <tr>
                        <th className="table-header text-left">Day</th>
                        <th className="table-header">Active</th>
                        <th className="table-header">Rest Day</th>
                        <th className="table-header">Shift Start</th>
                        <th className="table-header">Shift End</th>
                        <th className="table-header">Break (min)</th>
                        <th className="table-header">OT Multiplier</th>
                        <th className="table-header">UT Penalty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {WEEK_DAY_OPTIONS.map(({ value, label }) => {
                        const row = scheduleForm[value] || createDefaultScheduleState()[value];
                        const disabled = !row.is_active || row.is_rest_day;

                        return (
                          <tr key={value} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td className="table-cell font-medium text-white">{label}</td>
                            <td className="table-cell text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(row.is_active)}
                                onChange={(e) => updateScheduleField(value, 'is_active', e.target.checked ? 1 : 0)}
                                className="w-4 h-4"
                                style={{ accentColor: '#CC0000' }}
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(row.is_rest_day)}
                                onChange={(e) => updateScheduleField(value, 'is_rest_day', e.target.checked ? 1 : 0)}
                                className="w-4 h-4"
                                style={{ accentColor: '#CC0000' }}
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="time"
                                value={row.shift_start}
                                disabled={disabled}
                                onChange={(e) => updateScheduleField(value, 'shift_start', e.target.value)}
                                className="input-field w-32 mx-auto"
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="time"
                                value={row.shift_end}
                                disabled={disabled}
                                onChange={(e) => updateScheduleField(value, 'shift_end', e.target.value)}
                                className="input-field w-32 mx-auto"
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.break_minutes}
                                disabled={disabled}
                                onChange={(e) => updateScheduleField(value, 'break_minutes', e.target.value)}
                                className="input-field w-28 mx-auto"
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={row.overtime_multiplier}
                                disabled={disabled}
                                onChange={(e) => updateScheduleField(value, 'overtime_multiplier', e.target.value)}
                                className="input-field w-28 mx-auto"
                              />
                            </td>
                            <td className="table-cell text-center">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.undertime_penalty_multiplier}
                                disabled={disabled}
                                onChange={(e) => updateScheduleField(value, 'undertime_penalty_multiplier', e.target.value)}
                                className="input-field w-28 mx-auto"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs mt-3" style={{ color: '#666' }}>
                    Rest day means no late and no undertime for that day. Overtime is still computed from worked time on rest days.
                  </p>
                </div>

                <div className="px-6 py-4 sticky bottom-0 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
                  <button onClick={() => !scheduleSaving && setShowScheduleModal(false)} className="btn-secondary flex-1" disabled={scheduleSaving}>
                    Cancel
                  </button>
                  <button onClick={saveSchedule} disabled={scheduleSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {scheduleSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save Working Hours
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, staff: null })}
        onConfirm={handleConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.action === 'delete' ? 'Delete' : confirmModal.action === 'toggle' ? (confirmModal.staff?.is_active ? 'Deactivate' : 'Activate') : 'Confirm'}
      />
    </div>
  );
};

export default Staff;
