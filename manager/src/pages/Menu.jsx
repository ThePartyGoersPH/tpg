import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, X, Loader2, UtensilsCrossed, Camera } from 'lucide-react';
import { menuApi } from '../api/menuApi';
import { inventoryApi } from '../api/inventoryApi';
import { getUploadUrl } from '../api/apiClient';
import { usePermission } from '../hooks/usePermission';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

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
    if (packs < 1) return `${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)}`;
    return `${trimStockNum(packs)} ${pluralizeUnit(pack, packs)} (${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)} remaining)`;
  }
  return `${trimStockNum(total)} ${pluralizeUnit(base || 'units', total)}`;
};

const Menu = () => {  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(
    () => new URLSearchParams(window.location.search).get('action') === 'new'
  );
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ inventory_item_id: '', menu_name: '', menu_description: '', selling_price: '', category: '', is_available: 1, sort_order: 0 });
  const { can } = usePermission();
  const [uploadingImageId, setUploadingImageId] = useState(null);
  const imgInputRef = useRef(null);
  const [imgTargetId, setImgTargetId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  useEffect(() => { load(); }, []);

  // Deep link from the customer-site owner preview (/menu?action=new) opens
  // the existing "Add to Menu" modal instead of requiring a second click.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'new') return;
    params.delete('action');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const handleImageUpload = (inventoryItemId) => {
    setImgTargetId(inventoryItemId);
    imgInputRef.current?.click();
  };

  const onImageFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !imgTargetId) return;
    setUploadingImageId(imgTargetId);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await inventoryApi.uploadImage(imgTargetId, fd);
      toast.success('Image updated!');
      load();
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImageId(null);
      setImgTargetId(null);
    }
  };

  const load = async () => {
    try {
      const menuRes = await menuApi.list();
      setItems(menuRes.data.data || menuRes.data || []);
    } catch {} 
    try {
      const invRes = await inventoryApi.list();
      setInventory(invRes.data.data || invRes.data || []);
    } catch {}
    setLoading(false);
  };

  const filtered = items.filter((i) =>
    (i.menu_name || i.inventory_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ inventory_item_id: '', menu_name: '', menu_description: '', selling_price: '', category: '', is_available: 1, sort_order: 0, sell_unit_type: 'single', units_per_sale: '1' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      inventory_item_id: item.inventory_item_id,
      menu_name: item.menu_name || '',
      menu_description: item.menu_description || '',
      selling_price: item.selling_price || '',
      category: item.category || '',
      is_available: item.is_available ? 1 : 0,
      sort_order: item.sort_order || 0,
      sell_unit_type: item.sell_unit_type || 'single',
      units_per_sale: item.units_per_sale ?? '1',
    });
    setShowModal(true);
  };

  // Selected inventory row drives the pack-size default for "Full pack".
  const selectedInventory = inventory.find((inv) => String(inv.id) === String(form.inventory_item_id));
  const selectedRatio = selectedInventory && Number(selectedInventory.units_per_pack) > 0
    ? Number(selectedInventory.units_per_pack) : 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const perSale = Number(form.units_per_sale);
      if (!Number.isFinite(perSale) || perSale <= 0) {
        toast.error('Portion per sale must be greater than 0');
        setSaving(false);
        return;
      }
      const payload = { ...form, selling_price: Number(form.selling_price) || 0, sort_order: Number(form.sort_order) || 0, units_per_sale: perSale };
      if (editing) {
        await menuApi.update(editing.id, payload);
        toast.success('Menu item updated!');
      } else {
        await menuApi.create(payload);
        toast.success('Menu item added!');
      }
      setShowModal(false);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await menuApi.remove(confirmModal.id);
      toast.success('Removed from menu');
      load();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to remove menu item';
      toast.error(message);
    }
  };

  const toggleAvailability = async (item) => {
    try {
      await menuApi.update(item.id, { is_available: item.is_available ? 0 : 1 });
      toast.success(item.is_available ? 'Marked unavailable' : 'Marked available');
      load();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search className="w-4 h-4" style={{ color: '#555' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
        </div>
        {can('menu_update') && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add to Menu
          </button>
        )}
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className="card p-0 overflow-hidden transition-all duration-200"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(204,0,0,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
            <div className="h-36 relative group" style={{ background: '#1a1a1a' }}>
              {item.inventory_image ? (
                <img src={getUploadUrl(item.inventory_image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UtensilsCrossed className="w-8 h-8" style={{ color: '#333' }} />
                </div>
              )}
              <span className={`absolute top-2 right-2 ${item.is_available ? 'badge-success' : 'badge-gray'}`}>
                {item.is_available ? 'Available' : 'Unavailable'}
              </span>
              {can('menu_update') && (
                <button
                  onClick={() => handleImageUpload(item.inventory_item_id)}
                  disabled={uploadingImageId === item.inventory_item_id}
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', backdropFilter: 'blur(4px)' }}
                >
                  {uploadingImageId === item.inventory_item_id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Camera className="w-3 h-3" />}
                  {uploadingImageId === item.inventory_item_id ? 'Uploading…' : 'Change Photo'}
                </button>
              )}
            </div>
            <div className="p-4">
              <h4 className="font-bold text-white text-sm">{item.menu_name || item.inventory_name}</h4>
              {item.menu_description && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#888' }}>{item.menu_description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-extrabold" style={{ color: '#CC0000' }}>₱{Number(item.selling_price || 0).toLocaleString()}</span>
                {item.category && <span className="badge-gray text-xs">{item.category}</span>}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs" style={{ color: '#666' }}>Stock: {formatAtomicStock(item)}{item.sell_unit_type === 'pack' ? ` · sells by the pack (${item.units_per_sale} per order)` : ''}</span>
                {can('menu_update') && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleAvailability(item)} className="text-xs font-medium" style={{ color: '#CC0000' }}>
                      {item.is_available ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-1 rounded transition-colors" style={{ color: '#666' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                    ><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 rounded transition-colors" style={{ color: '#666' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6666'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12" style={{ color: '#555' }}>No menu items found.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Menu Item' : 'Add to Menu'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}
              ><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editing && (
                <div>
                  <label className="label">Inventory Item *</label>
                  <select value={form.inventory_item_id} onChange={(e) => {
                    const nextId = e.target.value;
                    const inv = inventory.find((row) => String(row.id) === String(nextId));
                    const ratio = inv && Number(inv.units_per_pack) > 0 ? Number(inv.units_per_pack) : 1;
                    setForm({ ...form, inventory_item_id: nextId, ...(form.sell_unit_type === 'pack' ? { units_per_sale: String(ratio) } : {}) });
                  }} className="input-field" required>
                    <option value="">Select item...</option>
                    {inventory.filter(inv => inv.is_active).map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({formatAtomicStock(inv)})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Sell Unit Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'single', label: `Single Unit${selectedInventory ? ` (${selectedInventory.base_unit || selectedInventory.unit || 'unit'})` : ''}` },
                    { value: 'pack', label: `Full Pack${selectedInventory && selectedRatio > 1 ? ` (${selectedRatio} ${selectedInventory.base_unit || 'units'})` : ''}` },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        sell_unit_type: opt.value,
                        units_per_sale: String(opt.value === 'pack' ? selectedRatio : 1),
                      })}
                      className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                      style={form.sell_unit_type === opt.value
                        ? { background: 'rgba(204,0,0,0.15)', color: '#fff', border: '1px solid rgba(204,0,0,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Portion Deducted per Sale (base units)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={form.units_per_sale}
                  onChange={(e) => setForm({ ...form, units_per_sale: e.target.value })}
                  className="input-field"
                  placeholder="1"
                />
                <p className="text-xs mt-1" style={{ color: '#666' }}>
                  One order deducts this many base units from inventory{selectedInventory && selectedRatio > 1 ? ` (1 pack = ${selectedRatio})` : ''}.
                </p>
              </div>
              <div><label className="label">Menu Name</label><input value={form.menu_name} onChange={(e) => setForm({ ...form, menu_name: e.target.value })} className="input-field" placeholder="Display name on menu" /></div>
              <div><label className="label">Description</label><textarea value={form.menu_description} onChange={(e) => setForm({ ...form, menu_description: e.target.value })} className="input-field h-16 resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Selling Price *</label><input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="input-field" required /></div>
                <div><label className="label">Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="e.g. Cocktails" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Update' : 'Add'}
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
        title="Remove Menu Item?"
        message="This item will be removed from the menu. This action cannot be undone."
        confirmText="Remove"
        type="danger"
      />
      {/* Hidden image file input */}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onImageFileSelected}
      />
    </div>
  );
};

export default Menu;
