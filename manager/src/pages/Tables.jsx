import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Upload, X, Loader2, Grid3x3, Trash2 } from 'lucide-react';
import { tableApi } from '../api/tableApi';
import { getUploadUrl } from '../api/apiClient';
import { usePermission } from '../hooks/usePermission';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const FLOOR_PRESETS = ['Ground Floor', '2nd Floor', '3rd Floor', 'Custom'];
const TABLE_SIZES = ['Small', 'Medium', 'Large'];

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(
    () => new URLSearchParams(window.location.search).get('action') === 'new'
  );
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ table_number: '', floor_preset: 'Ground Floor', floor_custom: '', capacity: '', table_size: 'Small', price: '' });
  const todayStr = new Date().toISOString().split('T')[0];
  const [statusDate, setStatusDate] = useState(todayStr);
  const [statusData, setStatusData] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, table: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, table: null });
  const { can } = usePermission();

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStatus(); }, [statusDate]);

  // Deep link from the customer-site owner preview (/tables?action=new) opens
  // the existing "Add Table" modal instead of requiring a second click.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;
    params.delete('action');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const load = async () => {
    try {
      const { data } = await tableApi.list();
      setTables(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const loadStatus = async () => {
    try {
      const { data } = await tableApi.getStatus(statusDate);
      setStatusData(data.tables || data.data?.tables || []);
    } catch { setStatusData([]); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ table_number: '', floor_preset: 'Ground Floor', floor_custom: '', capacity: '', table_size: 'Small', price: '' });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    const preset = FLOOR_PRESETS.includes(t.floor_assignment) ? t.floor_assignment : 'Custom';
    setForm({
      table_number: t.table_number,
      floor_preset: preset,
      floor_custom: preset === 'Custom' ? (t.floor_assignment || '') : '',
      capacity: t.capacity,
      table_size: t.table_size || 'Small',
      price: t.price || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const floorAssignment = form.floor_preset === 'Custom' ? form.floor_custom : form.floor_preset;
      const payload = {
        table_number: form.table_number,
        floor_assignment: floorAssignment || null,
        capacity: Number(form.capacity),
        table_size: form.table_size,
        price: form.price === '' ? null : Number(form.price) || 0,
      };
      if (editing) {
        await tableApi.update(editing.id, payload);
        toast.success('Table updated!');
      } else {
        await tableApi.create(payload);
        toast.success('Table created!');
      }
      setShowModal(false);
      load();
      loadStatus();
    } catch {} finally { setSaving(false); }
  };

  const handleImageUpload = (table) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      await tableApi.uploadImage(table.id, fd);
      toast.success('Table image uploaded!');
      load();
    };
    input.click();
  };

  const toggleActive = (table) => {
    setConfirmModal({ isOpen: true, table });
  };

  const executeToggle = async () => {
    const table = confirmModal.table;
    if (!table) return;
    try {
      await tableApi.update(table.id, { is_active: table.is_active ? 0 : 1 });
      toast.success(table.is_active ? 'Table deactivated' : 'Table activated');
      setConfirmModal({ isOpen: false, table: null });
      load();
      loadStatus();
    } catch {
      toast.error('Failed to update table');
    }
  };

  const handleManualStatusChange = async (table, nextStatus) => {
    try {
      await tableApi.update(table.id, {
        manual_status: nextStatus,
        is_active: nextStatus === 'unavailable' ? 0 : 1,
      });
      toast.success(`Table ${table.table_number} set to ${nextStatus}`);
      load();
      loadStatus();
    } catch {
      toast.error('Failed to update table status');
    }
  };

  const executeDelete = async () => {
    const table = deleteModal.table;
    if (!table) return;
    try {
      await tableApi.remove(table.id);
      toast.success('Table deleted');
      setDeleteModal({ isOpen: false, table: null });
      load();
      loadStatus();
    } catch {
      toast.error('Failed to delete table');
    }
  };

  const statusBorderColor = (s) => {
    if (s === 'unavailable') return 'rgba(107,114,128,0.4)';
    if (s === 'occupied') return 'rgba(204,0,0,0.5)';
    if (s === 'reserved') return 'rgba(245,158,11,0.5)';
    return 'rgba(34,197,94,0.5)';
  };

  const statusBadge = (s) => {
    if (s === 'unavailable') return 'badge-gray';
    if (s === 'occupied') return 'badge-danger';
    if (s === 'reserved') return 'badge-warning';
    return 'badge-success';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: '#888' }}>Status Date:</label>
          <input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} className="input-field w-auto" />
        </div>
        {can('table_update') && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Table
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h3 className="text-lg font-bold text-white">Table Management</h3>
            <p className="text-sm mt-0.5" style={{ color: '#888' }}>
              Manage your tables, floors, sizes, and availability.
            </p>
          </div>
          <div className="flex gap-4">
            {[
              { label: 'Available', color: '#4ade80' },
              { label: 'Reserved', color: '#fbbf24' },
              { label: 'Unavailable', color: '#6b7280' },
              { label: 'Occupied', color: '#ff6666' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs" style={{ color: '#888' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} /> {l.label}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0f0f0f' }}>
                <th className="text-left px-5 py-3" style={{ color: '#888' }}>Table</th>
                <th className="text-left px-5 py-3" style={{ color: '#888' }}>Floor</th>
                <th className="text-left px-5 py-3" style={{ color: '#888' }}>Size</th>
                <th className="text-left px-5 py-3" style={{ color: '#888' }}>Max Capacity</th>
                <th className="text-left px-5 py-3" style={{ color: '#888' }}>Status</th>
                <th className="text-right px-5 py-3" style={{ color: '#888' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(statusData.length > 0 ? statusData : tables).map((table) => (
                <tr key={table.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {table.image_path ? (
                          <img src={getUploadUrl(table.image_path)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Grid3x3 className="w-5 h-5" style={{ color: '#333' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{table.table_number}</p>
                        {table.price > 0 && (
                          <p className="text-xs font-semibold" style={{ color: '#CC0000' }}>₱{Number(table.price).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4" style={{ color: '#bbb' }}>{table.floor_assignment || '—'}</td>
                  <td className="px-5 py-4" style={{ color: '#bbb' }}>{table.table_size || '—'}</td>
                  <td className="px-5 py-4" style={{ color: '#bbb' }}>{table.capacity}</td>
                  <td className="px-5 py-4">
                    <span className={`${statusBadge(table.status || 'available')}`}>{table.status || 'available'}</span>
                    {can('table_update') && (
                      <div className="mt-2">
                        {table.status === 'reserved' && (table.manual_status || 'available') !== 'reserved' && statusDate > todayStr ? (
                          <div className="w-full rounded-md px-2 py-1.5 text-xs"
                            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                            Reserved (future booking)
                          </div>
                        ) : (
                          <select
                            value={table.manual_status || (table.is_active ? 'available' : 'unavailable')}
                            onChange={(e) => handleManualStatusChange(table, e.target.value)}
                            className="rounded-md px-2 py-1 text-xs text-white outline-none"
                            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            <option value="available">Available</option>
                            <option value="reserved">Reserved</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {can('table_update') ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleImageUpload(table)}
                          className="p-2 rounded-lg"
                          style={{ background: '#CC0000', color: '#fff' }}
                          title="Upload image"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(table)}
                          className="p-2 rounded-lg"
                          style={{ background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(table)}
                          className="px-3 py-2 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: table.is_active ? '#ff6666' : '#4ade80' }}
                          title={table.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {table.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, table })}
                          className="p-2 rounded-lg"
                          style={{ background: 'rgba(204,0,0,0.12)', color: '#ff6666', border: '1px solid rgba(204,0,0,0.22)' }}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {tables.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12" style={{ color: '#888' }}>No tables found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Table' : 'Add Table'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="label">Table Name / Number *</label><input value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} className="input-field" required /></div>
              <div>
                <label className="label">Floor Assignment *</label>
                <select value={form.floor_preset} onChange={(e) => setForm({ ...form, floor_preset: e.target.value, floor_custom: e.target.value === 'Custom' ? form.floor_custom : '' })} className="input-field" required>
                  {FLOOR_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {form.floor_preset === 'Custom' && (
                  <input value={form.floor_custom} onChange={(e) => setForm({ ...form, floor_custom: e.target.value })} className="input-field mt-2" placeholder="Enter floor name" required />
                )}
              </div>
              <div><label className="label">Maximum Capacity *</label><input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="input-field" required /></div>
              <div>
                <label className="label">Table Size *</label>
                <select value={form.table_size} onChange={(e) => setForm({ ...form, table_size: e.target.value })} className="input-field" required>
                  {TABLE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Price</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" /></div>
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, table: null })}
        onConfirm={executeToggle}
        title={confirmModal.table?.is_active ? 'Deactivate Table?' : 'Activate Table?'}
        message={confirmModal.table?.is_active 
          ? `Table ${confirmModal.table?.table_number} will be deactivated and unavailable for reservations.`
          : `Table ${confirmModal.table?.table_number} will be activated and available for reservations.`
        }
        type={confirmModal.table?.is_active ? 'warning' : 'info'}
        confirmText={confirmModal.table?.is_active ? 'Deactivate' : 'Activate'}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, table: null })}
        onConfirm={executeDelete}
        title="Delete Table?"
        message={`Table ${deleteModal.table?.table_number} will be removed from your active tables list. This action is reversible only via database restore.`}
        type="danger"
        confirmText="Delete"
      />
    </div>
  );
};

export default Tables;
