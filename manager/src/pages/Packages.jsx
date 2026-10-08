import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Loader2, Package as PackageIcon, Minus, Check } from 'lucide-react';
import { packageApi } from '../api/packageApi';
import { inventoryApi } from '../api/inventoryApi';
import { tableApi } from '../api/tableApi';
import { marketplaceApi } from '../api/marketplaceApi';
import PayoutSetupCards from '../components/payouts/PayoutSetupCards';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const Packages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [barTables, setBarTables] = useState([]);
  const [testMode, setTestMode] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    price: '',
    requires_table: true,
    table_ids: [],
    inclusions: [{ item_name: '', quantity: 1 }] 
  });

  useEffect(() => { load(); loadInventory(); loadTables(); loadPayoutMode(); }, []);

  // Bar payout mode drives the "Test" tag on package cards (test transactions only).
  const loadPayoutMode = async () => {
    try {
      const { data } = await marketplaceApi.status();
      setTestMode((data?.data?.paymongo_mode || 'test') !== 'live');
    } catch {
      setTestMode(false);
    }
  };

  const loadInventory = async () => {
    try {
      const { data } = await inventoryApi.list();
      setInventoryItems(data.data || data || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  };

  const loadTables = async () => {
    try {
      const { data } = await tableApi.list();
      setBarTables(data.data || data || []);
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  };

  const load = async () => {
    try {
      const { data } = await packageApi.list();
      setPackages(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      name: '', 
      description: '', 
      price: '',
      requires_table: true,
      table_ids: [],
      inclusions: [{ item_name: '', quantity: 1 }] 
    });
    setShowModal(true);
  };

  const openEdit = (pkg) => {
    setEditing(pkg);
    setForm({ 
      name: pkg.name, 
      description: pkg.description || '', 
      price: pkg.price || '',
      requires_table: pkg.requires_table !== 0,
      table_ids: Array.isArray(pkg.table_ids)
        ? pkg.table_ids.map(Number)
        : Array.isArray(pkg.tables) ? pkg.tables.map((t) => Number(t.id)) : [],
      inclusions: pkg.inclusions && pkg.inclusions.length > 0 
        ? pkg.inclusions.map(inc => ({ item_name: inc.item_name, quantity: inc.quantity }))
        : [{ item_name: '', quantity: 1 }]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        requires_table: form.requires_table,
        table_ids: form.requires_table ? (form.table_ids || []).map(Number) : [],
        inclusions: form.inclusions.filter(inc => inc.item_name.trim())
      };
      
      if (editing) {
        await packageApi.update(editing.id, payload);
        toast.success('Package updated!');
      } else {
        const { data } = await packageApi.create(payload);
        toast.success(data.message || 'Package created!');
      }
      setShowModal(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save package');
    } finally { setSaving(false); }
  };

  const handleToggle = async (pkg) => {
    try { 
      await packageApi.update(pkg.id, { is_active: !pkg.is_active }); 
      toast.success('Status toggled'); 
      load(); 
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await packageApi.remove(confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      toast.success('Package deleted');
      load();
    } catch {}
  };

  const addInclusion = () => {
    setForm({ ...form, inclusions: [...form.inclusions, { item_name: '', quantity: 1 }] });
  };

  const removeInclusion = (index) => {
    const newInclusions = form.inclusions.filter((_, i) => i !== index);
    setForm({ ...form, inclusions: newInclusions.length > 0 ? newInclusions : [{ item_name: '', quantity: 1 }] });
  };

  const updateInclusion = (index, field, value) => {
    const newInclusions = [...form.inclusions];
    newInclusions[index][field] = value;
    setForm({ ...form, inclusions: newInclusions });
  };

  const togglePackageTable = (tableId) => {
    const id = Number(tableId);
    setForm((prev) => ({
      ...prev,
      table_ids: (prev.table_ids || []).includes(id)
        ? (prev.table_ids || []).filter((t) => t !== id)
        : [...(prev.table_ids || []), id],
    }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Packages</h2>
          <p className="text-sm mt-1" style={{ color: '#888' }}>Manage your bar packages with inclusions</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Package
        </button>
      </div>

      <PayoutSetupCards variant="reminder" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <div key={pkg.id} className="card transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-bold text-white">{pkg.name}</h4>
                {pkg.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#888' }}>{pkg.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {pkg.requires_table ? (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,118,47,0.15)', color: '#C9762F', border: '1px solid rgba(201,118,47,0.3)' }}>Table Required</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>No Table</span>
                )}
                <span className={pkg.is_active ? 'badge-success' : 'badge-gray'}>{pkg.is_active ? 'Active' : 'Inactive'}</span>
                {testMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full" title="Test Mode — not a real transaction" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>Test</span>
                )}
              </div>
            </div>

            <div className="mb-3">
              <span className="text-2xl font-extrabold" style={{ color: '#CC0000' }}>
                ₱{Number(pkg.price || 0).toLocaleString()}
              </span>
            </div>

            {pkg.inclusions && pkg.inclusions.length > 0 && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#888' }}>Inclusions:</p>
                <ul className="space-y-1">
                  {pkg.inclusions.map((inc, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2" style={{ color: '#ccc' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#CC0000' }} />
                      <span>{inc.quantity}x {inc.item_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pkg.requires_table && Array.isArray(pkg.tables) && pkg.tables.length > 0 && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(201,118,47,0.06)', border: '1px solid rgba(201,118,47,0.2)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C9762F' }}>Assigned Table{ pkg.tables.length > 1 ? 's' : ''}:</p>
                <ul className="space-y-1">
                  {pkg.tables.map((t) => (
                    <li key={t.id} className="text-sm flex items-center gap-2" style={{ color: '#ccc' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C9762F' }} />
                      <span>{t.table_number}{t.floor_assignment ? ` · ${t.floor_assignment}` : ''}{t.capacity ? ` · ${t.capacity} pax` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pkg.requires_table && (!Array.isArray(pkg.tables) || pkg.tables.length === 0) && (
              <p className="text-xs mb-3" style={{ color: '#fbbf24' }}>No tables assigned yet — customers will pick manually.</p>
            )}

            <div className="flex items-center justify-end gap-1 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => handleToggle(pkg)} className="p-1 rounded transition-colors">
                {pkg.is_active ? <ToggleRight className="w-4 h-4" style={{ color: '#4ade80' }} /> : <ToggleLeft className="w-4 h-4" style={{ color: '#555' }} />}
              </button>
              <button onClick={() => openEdit(pkg)} className="p-1 rounded transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(pkg.id)} className="p-1 rounded transition-colors" style={{ color: '#ff6666' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {packages.length === 0 && (
          <div className="col-span-full text-center py-12" style={{ color: '#555' }}>
            No packages yet. Create your first package to get started.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Package' : 'Create Package'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Package Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required placeholder="e.g. VIP Package, Birthday Bundle" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-20 resize-none" placeholder="Describe what this package offers..." />
              </div>
              <div>
                <label className="label">Price (₱) *</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" required placeholder="0.00" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, requires_table: !form.requires_table, table_ids: !form.requires_table ? (form.table_ids || []) : [] })}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ background: form.requires_table ? '#C9762F' : '#333' }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{ transform: form.requires_table ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-white">Requires Table Reservation</p>
                  <p className="text-xs" style={{ color: '#888' }}>Enable if this package needs a reserved table</p>
                </div>
              </div>

              {form.requires_table && (
                <div>
                  <label className="label">Assigned Table{form.table_ids?.length > 1 ? 's' : ''} (auto-bound at booking)</label>
                  {barTables.length === 0 ? (
                    <p className="text-xs" style={{ color: '#888' }}>No tables found. Add tables first, or leave unassigned for manual picks.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {barTables.filter((t) => t.is_active !== 0).map((t) => {
                        const checked = (form.table_ids || []).includes(Number(t.id));
                        return (
                          <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors" style={{ background: checked ? 'rgba(201,118,47,0.15)' : 'rgba(255,255,255,0.03)', border: checked ? '1px solid rgba(201,118,47,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePackageTable(t.id)}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: '#C9762F' }}
                            />
                            <span className="text-sm font-medium text-white">{t.table_number}</span>
                            <span className="text-xs" style={{ color: '#888' }}>{t.floor_assignment || ''}{t.capacity ? ` · ${t.capacity} pax` : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs mt-2" style={{ color: '#555' }}>When a customer adds this package, the first available assigned table is auto-selected — no manual table pick needed.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Package Inclusions</label>
                  <button type="button" onClick={addInclusion} className="btn-secondary btn-sm flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Add Inclusion
                  </button>
                </div>
                <div className="space-y-2">
                  {form.inclusions.map((inc, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <select
                            value={inc.item_name}
                            onChange={(e) => updateInclusion(index, 'item_name', e.target.value)}
                            className="input-field"
                            required
                          >
                            <option value="">Select from inventory...</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.name}>
                                {item.name} {item.stock_qty > 0 ? `(${item.stock_qty} in stock)` : '(Out of stock)'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <input 
                            type="number" 
                            min="1" 
                            value={inc.quantity} 
                            onChange={(e) => updateInclusion(index, 'quantity', e.target.value)} 
                            className="input-field" 
                            placeholder="Qty"
                            required
                          />
                        </div>
                      </div>
                      {form.inclusions.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeInclusion(index)} 
                          className="p-2 rounded transition-colors flex-shrink-0" 
                          style={{ color: '#ff6666' }}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: '#555' }}>Select items from your inventory to include in this package</p>
              </div>

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
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={executeDelete}
        title="Delete Package?"
        message="This package will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default Packages;
