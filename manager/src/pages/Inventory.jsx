import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Loader2, Package, AlertTriangle, Biohazard, Clock3 } from 'lucide-react';
import { inventoryApi } from '../api/inventoryApi';
import { inventoryRequestApi } from '../api/inventoryRequestApi';
import { dssApi } from '../api/dssApi';
import { getUploadUrl } from '../api/apiClient';
import { usePermission } from '../hooks/usePermission';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const dssBadgeConfig = {
  critical: { label: 'Low Stock',    bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  warning:  { label: 'Not Selling',  bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  positive: { label: 'Top Seller',   bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  outstock: { label: 'Out of Stock', bg: 'rgba(239,68,68,0.1)',   color: '#ff6666', border: 'rgba(239,68,68,0.25)' },
};

const freshnessBadgeConfig = {
  normal: {
    label: 'Fresh',
    bg: 'rgba(34,197,94,0.15)',
    color: '#4ade80',
    border: 'rgba(34,197,94,0.35)',
  },
  near_expiry: {
    label: 'Near Expiry',
    bg: 'rgba(245,158,11,0.14)',
    color: '#fbbf24',
    border: 'rgba(245,158,11,0.35)',
  },
  spoiled: {
    label: 'Spoiled',
    bg: 'rgba(239,68,68,0.14)',
    color: '#f87171',
    border: 'rgba(239,68,68,0.35)',
  },
};

const emptyFormState = {
  name: '',
  unit: 'Piece',
  stock_qty: '',
  reorder_level: '',
  cost_price: '',
  is_perishable: false,
  expiry_date: '',
  shelf_life_days: '',
  date_added: '',
  spoilage_status: 'normal',
  pack_unit: '',
  base_unit: '',
  units_per_pack: '1',
};

// Human-readable atomic stock, e.g. "3 Cases (36 Bottles remaining)".
const trimStockNum = (n) => {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return String(Number.isInteger(v) ? v : v);
};
const pluralizeUnit = (word, n) => (Number(n) === 1 ? word : `${word}s`);
const formatAtomicStock = (item) => {
  const total = Number(item?.stock_qty || 0);
  const ratio = Number(item?.units_per_pack) > 0 ? Number(item.units_per_pack) : 1;
  const pack = String(item?.pack_unit || '').trim();
  const base = String(item?.base_unit || item?.unit || '').trim();
  if (ratio > 1 && pack) {
    const packs = Math.floor(total / ratio + 1e-9);
    if (packs < 1) return `${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)} available`;
    return `${trimStockNum(packs)} ${pluralizeUnit(pack, packs)} (${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)} remaining)`;
  }
  return `${trimStockNum(total)} ${pluralizeUnit(base || 'units', total)}`;
};

const emptyWasteFormState = {
  quantity: '',
  reason: '',
};

const toDateInputValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const toDateTimeLocalValue = (value) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString();
};

const formatMoney = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyFormState);
  const { can, isOwner } = usePermission();
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [dssRecs, setDssRecs] = useState([]);
  const [tooltipId, setTooltipId] = useState(null);
  const [nearExpiryItems, setNearExpiryItems] = useState([]);
  const [spoiledItems, setSpoiledItems] = useState([]);
  const [wastageSummary, setWastageSummary] = useState(null);
  const [spoilageLoading, setSpoilageLoading] = useState(true);
  const [spoilageError, setSpoilageError] = useState('');
  const [wasteModal, setWasteModal] = useState({ isOpen: false, item: null });
  const [wasteSaving, setWasteSaving] = useState(false);
  const [wasteForm, setWasteForm] = useState(emptyWasteFormState);

  useEffect(() => {
    load();
    loadDss(true);
    loadSpoilage();
    if (!isOwner) loadApprovedRequests();
  }, [isOwner]);

  const canAddItems = isOwner ? can('menu_update') : (can('menu_update') && approvedRequests.length > 0);

  const loadApprovedRequests = async () => {
    try {
      const { data } = await inventoryRequestApi.myRequests();
      const all = data.data || data || [];
      setApprovedRequests(all.filter(r => r.status === 'approved'));
    } catch (_) {}
  };

  const hasApprovedRequest = (itemName) => {
    if (isOwner) return true;
    return approvedRequests.some(r => r.item_name?.toLowerCase() === itemName?.toLowerCase());
  };

  const loadDss = async (force = false) => {
    try {
      const { data } = await dssApi.getRecommendations(force ? { force: 1 } : {});
      setDssRecs(data.recommendations || []);
    } catch (_) {}
  };

  const loadSpoilage = async () => {
    setSpoilageLoading(true);
    setSpoilageError('');
    try {
      const [nearRes, spoiledRes, summaryRes] = await Promise.all([
        inventoryApi.listNearExpiry(),
        inventoryApi.listSpoiled(),
        inventoryApi.getWastageSummary(),
      ]);

      setNearExpiryItems(nearRes?.data?.data || []);
      setSpoiledItems(spoiledRes?.data?.data || []);
      setWastageSummary(summaryRes?.data?.data || null);
    } catch (err) {
      setNearExpiryItems([]);
      setSpoiledItems([]);
      setWastageSummary(null);
      setSpoilageError(err.response?.data?.message || 'Unable to load spoilage insights right now.');
    } finally {
      setSpoilageLoading(false);
    }
  };

  const getDssBadge = (item) => {
    if (!item) return null;

    const itemId = Number(item.id);
    let match = dssRecs.find((r) => Number(r.inventory_item_id) === itemId);

    // Backward compatibility fallback for older recommendation payloads.
    if (!match) {
      const name = String(item.name || '').toLowerCase();
      if (!name) return null;
      match = dssRecs.find((r) =>
        r.message?.toLowerCase().includes(name) || r.title?.toLowerCase().includes(name)
      );
    }

    if (!match) return null;
    if (match.title === 'Out of Stock on Menu') return { ...dssBadgeConfig.outstock, message: match.message };
    if (match.severity === 'critical') return { ...dssBadgeConfig.critical, message: match.message };
    if (match.type === 'menu' && match.severity === 'positive') return { ...dssBadgeConfig.positive, message: match.message };
    if (match.severity === 'warning') return { ...dssBadgeConfig.warning, message: match.message };
    return null;
  };

  const load = async () => {
    try {
      const { data } = await inventoryApi.list();
      setItems(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = items.filter((i) =>
    i.name?.toLowerCase().includes(search.toLowerCase())
  );

  const showActionsColumn = items.some((item) => {
    const canManageItem = isOwner ? can('menu_update') : (can('menu_update') && hasApprovedRequest(item.name));
    const canMarkWaste = can('menu_update') && Number(item.is_perishable || 0) === 1 && Number(item.stock_qty || 0) > 0;
    return canManageItem || canMarkWaste;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyFormState });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      unit: item.unit || 'Piece',
      stock_qty: item.stock_qty ?? '',
      reorder_level: item.reorder_level ?? '',
      cost_price: item.cost_price ?? '',
      is_perishable: Number(item.is_perishable || 0) === 1,
      expiry_date: toDateInputValue(item.expiry_date),
      shelf_life_days: item.shelf_life_days ?? '',
      date_added: toDateTimeLocalValue(item.date_added),
      spoilage_status: item.status || 'normal',
      pack_unit: item.pack_unit || '',
      base_unit: item.base_unit || item.unit || 'Piece',
      units_per_pack: item.units_per_pack ?? '1',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isPerishable = Boolean(form.is_perishable);
      const ratio = Number(form.units_per_pack);
      const normalizedRatio = form.units_per_pack === '' ? 1 : ratio;
      if (!Number.isFinite(normalizedRatio) || normalizedRatio <= 0) {
        toast.error('Units per pack must be a number greater than 0');
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name,
        unit: form.unit,
        // Stock is locked on edit — only receiving, sales, or waste logs move it.
        ...(editing ? {} : { stock_qty: Number(form.stock_qty) }),
        reorder_level: Number(form.reorder_level) || 0,
        cost_price: Number(form.cost_price) || 0,
        pack_unit: form.pack_unit.trim() || null,
        base_unit: form.base_unit.trim() || form.unit,
        units_per_pack: normalizedRatio,
        is_perishable: isPerishable ? 1 : 0,
        expiry_date: isPerishable ? (form.expiry_date || null) : null,
        shelf_life_days: isPerishable
          ? (form.shelf_life_days === '' ? null : Number(form.shelf_life_days))
          : null,
        date_added: isPerishable ? (form.date_added || null) : null,
        status: isPerishable ? (form.spoilage_status || 'normal') : 'normal',
      };

      if (editing) {
        await inventoryApi.update(editing.id, payload);
        toast.success('Item updated!');
      } else {
        await inventoryApi.create(payload);
        toast.success('Item created!');
      }
      setShowModal(false);
      await Promise.all([load(), loadDss(true), loadSpoilage()]);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await inventoryApi.deactivate(confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      toast.success('Item deactivated');
      await Promise.all([load(), loadDss(true), loadSpoilage()]);
    } catch (err) {
      const message = err.response?.data?.message || 'This item is currently used in the system and cannot be deleted';
      toast.error(message);
    }
  };

  const handleImageUpload = (item) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        await inventoryApi.uploadImage(item.id, fd);
        toast.success('Image uploaded!');
        load();
      } catch (_) {}
    };
    input.click();
  };

  const openWasteModal = (item) => {
    setWasteModal({ isOpen: true, item });
    setWasteForm({ ...emptyWasteFormState });
  };

  const closeWasteModal = () => {
    setWasteModal({ isOpen: false, item: null });
    setWasteForm({ ...emptyWasteFormState });
    setWasteSaving(false);
  };

  const submitWaste = async (e) => {
    e.preventDefault();
    const targetItem = wasteModal.item;
    const qty = Number(wasteForm.quantity || 0);
    const reason = String(wasteForm.reason || '').trim();

    if (!targetItem) return;
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantity wasted must be greater than 0.');
      return;
    }
    if (qty > Number(targetItem.stock_qty || 0)) {
      toast.error('Wastage quantity cannot exceed current stock.');
      return;
    }
    if (!reason) {
      toast.error('Please provide a reason.');
      return;
    }

    setWasteSaving(true);
    try {
      await inventoryApi.markWasted({
        item_id: targetItem.id,
        quantity: qty,
        reason,
      });

      toast.success('Wastage recorded successfully.');
      closeWasteModal();
      await Promise.all([load(), loadDss(true), loadSpoilage()]);
    } catch {
      setWasteSaving(false);
    }
  };

  const statusColor = (s) => {
    if (s === 'critical') return 'badge-danger';
    if (s === 'low') return 'badge-warning';
    return 'badge-success';
  };

  const getFreshnessBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    return freshnessBadgeConfig[normalized] || freshnessBadgeConfig.normal;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search className="w-4 h-4" style={{ color: '#555' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
        </div>
        {canAddItems && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Total Items</p>
          <p className="text-xl font-bold text-white">{items.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Normal Stock</p>
          <p className="text-xl font-bold" style={{ color: '#4ade80' }}>{items.filter(i => i.stock_status === 'normal').length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Low Stock</p>
          <p className="text-xl font-bold" style={{ color: '#fbbf24' }}>{items.filter(i => i.stock_status === 'low').length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Critical</p>
          <p className="text-xl font-bold" style={{ color: '#ff6666' }}>{items.filter(i => i.stock_status === 'critical').length}</p>
        </div>
      </div>

      {/* Spoilage snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Perishable Items</p>
          <p className="text-xl font-bold text-white">{items.filter(i => Number(i.is_perishable || 0) === 1).length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Near Expiry</p>
          <p className="text-xl font-bold" style={{ color: '#fbbf24' }}>{nearExpiryItems.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Spoiled Items</p>
          <p className="text-xl font-bold" style={{ color: '#f87171' }}>{spoiledItems.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-xs" style={{ color: '#888' }}>Monthly Waste Loss</p>
          <p className="text-xl font-bold" style={{ color: '#ff9c66' }}>
            {formatMoney(wastageSummary?.monthly?.estimated_loss || 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <tr>
                <th className="table-header">Item</th>
                <th className="table-header">Unit</th>
                <th className="table-header">Stock</th>
                <th className="table-header">Reorder Level</th>
                <th className="table-header">Cost Price</th>
                <th className="table-header">Status</th>
                <th className="table-header">Freshness</th>
                {showActionsColumn && <th className="table-header text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: '#222' }} onClick={() => can('menu_update') && handleImageUpload(item)}>
                        {item.image_path ? (
                          <img src={getUploadUrl(item.image_path)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4" style={{ color: '#555' }} /></div>
                        )}
                      </div>
                      <span className="font-medium text-white">{item.name}</span>
                      {(() => {
                        const badge = getDssBadge(item);
                        if (!badge) return null;
                        return (
                          <div className="relative inline-block">
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-help"
                              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                              onMouseEnter={() => setTooltipId(item.id)}
                              onMouseLeave={() => setTooltipId(null)}
                            >
                              {badge.label}
                            </span>
                            {tooltipId === item.id && (
                              <div className="absolute left-0 top-6 z-50 w-56 rounded-lg p-2.5 text-xs shadow-xl pointer-events-none"
                                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc' }}>
                                {badge.message}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="table-cell">{item.unit || '—'}</td>
                  <td className="table-cell font-semibold">{formatAtomicStock(item)}</td>
                  <td className="table-cell">{item.reorder_level || '—'}</td>
                  <td className="table-cell">{item.cost_price ? `₱${Number(item.cost_price).toLocaleString()}` : '—'}</td>
                  <td className="table-cell">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(item.stock_status)}`}>
                      {item.stock_status}
                    </span>
                  </td>
                  <td className="table-cell">
                    {Number(item.is_perishable || 0) === 1 ? (
                      <div className="space-y-1">
                        <span
                          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: getFreshnessBadge(item.status).bg,
                            color: getFreshnessBadge(item.status).color,
                            border: `1px solid ${getFreshnessBadge(item.status).border}`,
                          }}
                        >
                          {getFreshnessBadge(item.status).label}
                        </span>
                        {item.expiry_date && (
                          <p className="text-[11px]" style={{ color: '#8b8b8b' }}>Exp: {formatDate(item.expiry_date)}</p>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  {showActionsColumn && (
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(isOwner ? can('menu_update') : (can('menu_update') && hasApprovedRequest(item.name))) && (
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                            title={!isOwner ? 'Approved request required to edit' : ''}
                          ><Edit2 className="w-4 h-4" /></button>
                        )}

                        {can('menu_update') && Number(item.is_perishable || 0) === 1 && Number(item.stock_qty || 0) > 0 && (
                          <button
                            onClick={() => openWasteModal(item)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#b88f1f' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.12)'; e.currentTarget.style.color = '#fbbf24'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b88f1f'; }}
                            title="Record spoilage/wastage"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}

                        {isOwner && (
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; e.currentTarget.style.color = '#ff6666'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                          ><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={showActionsColumn ? '8' : '7'} className="text-center py-8" style={{ color: '#555' }}>No inventory items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spoilage/Wastage monitor */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Biohazard className="w-4 h-4" style={{ color: '#ff9c66' }} />
              Spoilage and Wastage Monitor
            </h3>
            <p className="text-xs" style={{ color: '#888' }}>
              Track perishable inventory risks and record wasted stock.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSpoilage}
            className="btn-secondary text-xs"
            disabled={spoilageLoading}
          >
            {spoilageLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {spoilageLoading ? (
          <div className="py-8 flex items-center justify-center gap-2" style={{ color: '#999' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading spoilage data...
          </div>
        ) : spoilageError ? (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
            {spoilageError}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="rounded-lg px-3 py-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs" style={{ color: '#888' }}>Weekly Wasted Quantity</p>
                <p className="text-lg font-semibold text-white">{Math.round(Number(wastageSummary?.weekly?.total_wasted_quantity || 0))}</p>
              </div>
              <div className="rounded-lg px-3 py-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs" style={{ color: '#888' }}>Weekly Estimated Loss</p>
                <p className="text-lg font-semibold" style={{ color: '#ffb783' }}>{formatMoney(wastageSummary?.weekly?.estimated_loss || 0)}</p>
              </div>
              <div className="rounded-lg px-3 py-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs" style={{ color: '#888' }}>Monthly Estimated Loss</p>
                <p className="text-lg font-semibold" style={{ color: '#ff9c66' }}>{formatMoney(wastageSummary?.monthly?.estimated_loss || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-lg p-3" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm font-semibold mb-2 text-white flex items-center gap-2">
                  <Clock3 className="w-4 h-4" style={{ color: '#fbbf24' }} /> Near Expiry
                </p>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {nearExpiryItems.length === 0 && <p className="text-xs" style={{ color: '#777' }}>No near-expiry perishable items.</p>}
                  {nearExpiryItems.map((item) => (
                    <div key={`near-${item.id}`} className="rounded-md px-2 py-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs" style={{ color: '#d6a84f' }}>
                        {Math.round(Number(item.stock_qty || 0))} {item.unit || ''} left • Exp: {formatDate(item.expiry_date)}
                        {item.days_to_expiry !== null && item.days_to_expiry !== undefined && ` • ${item.days_to_expiry} day(s)`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm font-semibold mb-2 text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: '#f87171' }} /> Spoiled
                </p>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {spoiledItems.length === 0 && <p className="text-xs" style={{ color: '#777' }}>No spoiled items detected.</p>}
                  {spoiledItems.map((item) => (
                    <div key={`spoiled-${item.id}`} className="rounded-md px-2 py-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <p className="text-xs" style={{ color: '#fca5a5' }}>
                            {Math.round(Number(item.stock_qty || 0))} {item.unit || ''} remaining
                          </p>
                        </div>
                        {can('menu_update') && Number(item.stock_qty || 0) > 0 && (
                          <button
                            type="button"
                            className="text-[11px] px-2 py-1 rounded-md"
                            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                            onClick={() => openWasteModal(item)}
                          >
                            Mark Wasted
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm font-semibold mb-2 text-white">Top Wasted Items (30 days)</p>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {(wastageSummary?.top_wasted_items || []).length === 0 && (
                    <p className="text-xs" style={{ color: '#777' }}>No wastage records yet.</p>
                  )}
                  {(wastageSummary?.top_wasted_items || []).map((item) => (
                    <div key={`wasted-${item.item_id}`} className="rounded-md px-2 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs" style={{ color: '#aaa' }}>
                        {Math.round(Number(item.total_wasted_quantity || 0))} {item.unit || ''} wasted • {formatMoney(item.estimated_loss || 0)} estimated loss
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
              ><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Unit of Measurement *</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field" required>
                    <option value="Bottle">Bottle</option>
                    <option value="Bucket">Bucket</option>
                    <option value="Case (12 bottles)">Case (12 bottles)</option>
                    <option value="Glass">Glass</option>
                    <option value="Liter">Liter</option>
                    <option value="Kilogram">Kilogram</option>
                    <option value="Piece">Piece</option>
                  </select>
                </div>
                <div>
                  <label className="label">Stock Qty *</label>
                  {editing ? (
                    <>
                      <div className="input-field" style={{ display: 'flex', alignItems: 'center', color: '#888', background: 'rgba(255,255,255,0.03)' }}>
                        {formatAtomicStock({ ...editing, stock_qty: form.stock_qty })}
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#666' }}>Locked — stock moves only through receiving, sales, or waste logs.</p>
                    </>
                  ) : (
                    <input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} className="input-field" required />
                  )}
                </div>
              </div>
              <div className="rounded-lg p-3 space-y-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm font-medium text-white">Bulk → Unit Conversion</p>
                <p className="text-xs" style={{ color: '#666' }}>For items bought in bulk (e.g. cases) but sold per unit (e.g. bottles). Stock is tracked in base units.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Pack Unit</label>
                    <input value={form.pack_unit} onChange={(e) => setForm({ ...form, pack_unit: e.target.value })} className="input-field" placeholder="Case" maxLength={30} />
                  </div>
                  <div>
                    <label className="label">Base Unit</label>
                    <input value={form.base_unit} onChange={(e) => setForm({ ...form, base_unit: e.target.value })} className="input-field" placeholder="Bottle" maxLength={30} />
                  </div>
                  <div>
                    <label className="label">Units / Pack</label>
                    <input type="number" min="1" step="0.01" value={form.units_per_pack} onChange={(e) => setForm({ ...form, units_per_pack: e.target.value })} className="input-field" placeholder="1" />
                  </div>
                </div>
                {Number(form.units_per_pack) > 1 && (
                  <p className="text-xs" style={{ color: '#4ade80' }}>
                    1 {form.pack_unit || 'pack'} = {form.units_per_pack} {form.base_unit || form.unit || 'units'}
                    {editing && form.stock_qty !== '' && ` · current stock = ${formatAtomicStock({ ...editing, stock_qty: form.stock_qty, pack_unit: form.pack_unit || editing.pack_unit, base_unit: form.base_unit || editing.base_unit, units_per_pack: form.units_per_pack })}`}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Reorder Level</label><input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="input-field" /></div>
                <div><label className="label">Cost Price</label><input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="input-field" /></div>
              </div>

              <div className="rounded-lg p-3 space-y-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_perishable)}
                    onChange={(e) => setForm({ ...form, is_perishable: e.target.checked })}
                  />
                  Track as perishable item
                </label>

                {Boolean(form.is_perishable) && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Expiry Date</label>
                        <input
                          type="date"
                          value={form.expiry_date}
                          onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label">Shelf Life (days)</label>
                        <input
                          type="number"
                          min="1"
                          value={form.shelf_life_days}
                          onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Date Added</label>
                        <input
                          type="datetime-local"
                          value={form.date_added}
                          onChange={(e) => setForm({ ...form, date_added: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label">Freshness Status</label>
                        <select
                          value={form.spoilage_status}
                          onChange={(e) => setForm({ ...form, spoilage_status: e.target.value })}
                          className="input-field"
                        >
                          <option value="normal">Normal</option>
                          <option value="near_expiry">Near Expiry</option>
                          <option value="spoiled">Spoiled</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
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

      {wasteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeWasteModal}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">Record Wastage</h3>
              <button onClick={closeWasteModal} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
              ><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={submitWaste} className="p-6 space-y-4">
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-sm text-white font-medium">{wasteModal.item?.name}</p>
                <p className="text-xs" style={{ color: '#888' }}>
                  Current stock: {formatAtomicStock(wasteModal.item || {})}
                </p>
              </div>

              <div>
                <label className="label">Quantity Wasted (base units) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={wasteForm.quantity}
                  onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Reason *</label>
                <textarea
                  value={wasteForm.reason}
                  onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  className="input-field min-h-[96px]"
                  placeholder="e.g. spoiled due to broken chiller"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeWasteModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={wasteSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {wasteSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save Wastage
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
        title="Deactivate Item?"
        message="This inventory item will be deactivated. You can reactivate it later."
        confirmText="Deactivate"
        type="warning"
      />
    </div>
  );
};

export default Inventory;
