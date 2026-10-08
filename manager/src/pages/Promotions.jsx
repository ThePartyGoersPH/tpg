import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Loader2, Percent } from 'lucide-react';
import { promotionApi } from '../api/promotionApi';
import { subscriptionApi } from '../api/subscriptionApi';
import { getUploadUrl } from '../api/apiClient';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const Promotions = () => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [form, setForm] = useState({ title: '', description: '', discount_type: 'percentage', discount_value: '', valid_from: '', valid_until: '', image: null });
  const [subInfo, setSubInfo] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [promoRes, subRes] = await Promise.allSettled([
        promotionApi.list(),
        subscriptionApi.getMySubscription(),
      ]);
      if (promoRes.status === 'fulfilled') {
        setPromos(promoRes.value.data.data || promoRes.value.data || []);
      }
      if (subRes.status === 'fulfilled') {
        setSubInfo(subRes.value.data?.data || subRes.value.data);
      }
    } catch {} finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', discount_type: 'percentage', discount_value: '', valid_from: '', valid_until: '', image: null });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description || '', discount_type: p.discount_type, discount_value: p.discount_value, valid_from: p.valid_from?.split('T')[0] || '', valid_until: p.valid_until?.split('T')[0] || '', image: null });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('discount_type', form.discount_type);
      fd.append('discount_value', form.discount_value);
      if (form.valid_from) fd.append('valid_from', form.valid_from);
      if (form.valid_until) fd.append('valid_until', form.valid_until);
      if (form.image) fd.append('image', form.image);
      if (editing) {
        await promotionApi.update(editing.id, fd);
        toast.success('Promotion updated!');
      } else {
        await promotionApi.create(fd);
        toast.success('Promotion created!');
      }
      setShowModal(false);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try { await promotionApi.toggle(id); toast.success('Status toggled'); load(); } catch {}
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const executeDelete = async () => {
    try {
      await promotionApi.remove(confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      toast.success('Promotion deleted');
      load();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-3">
        {subInfo && (() => {
          const maxPromos = subInfo.subscription?.max_promotions;
          const currentPromos = subInfo.usage?.promotions || 0;
          if (!maxPromos) return null;
          const atLimit = currentPromos >= maxPromos;
          return (
            <span className="text-xs font-medium" style={{ color: atLimit ? '#f87171' : '#888' }}>
              {currentPromos}/{maxPromos} promos used
              {atLimit && ' — upgrade to add more'}
            </span>
          );
        })()}
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Create Promotion</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {promos.map((p) => (
          <div key={p.id} className="card p-0 overflow-hidden transition-shadow">
            <div className="h-36 relative" style={{ background: 'linear-gradient(135deg, rgba(204,0,0,0.08), rgba(59,130,246,0.05))' }}>
              {p.image_path ? (
                <img src={getUploadUrl(p.image_path)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Percent className="w-10 h-10" style={{ color: 'rgba(204,0,0,0.3)' }} /></div>
              )}
              <span className={`absolute top-2 right-2 ${p.status === 'active' ? 'badge-success' : p.status === 'expired' ? 'badge-gray' : 'badge-warning'}`}>{p.status}</span>
            </div>
            <div className="p-4">
              <h4 className="font-bold text-white">{p.title}</h4>
              {p.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: '#888' }}>{p.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-lg font-extrabold" style={{ color: '#CC0000' }}>
                  {p.discount_type === 'percentage' ? `${p.discount_value}%` : `₱${Number(p.discount_value).toLocaleString()}`}
                </span>
                <span className="text-xs" style={{ color: '#555' }}>OFF</span>
              </div>
              {(p.valid_from || p.valid_until) && (
                <p className="text-xs mt-2" style={{ color: '#555' }}>
                  {p.valid_from && format(parseUTC(p.valid_from), 'MMM d')} — {p.valid_until && format(parseUTC(p.valid_until), 'MMM d, yyyy')}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--m-border)' }}>
                <span className="text-xs" style={{ color: '#555' }}>Redeemed: {p.redeemed_count || 0}{p.max_redemptions ? `/${p.max_redemptions}` : ''}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(p.id)} className="p-1 rounded transition-colors">
                    {p.status === 'active' ? <ToggleRight className="w-4 h-4" style={{ color: '#4ade80' }} /> : <ToggleLeft className="w-4 h-4" style={{ color: '#555' }} />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1 rounded transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 rounded transition-colors" style={{ color: '#ff6666' }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {promos.length === 0 && <div className="col-span-full text-center py-12" style={{ color: '#555' }}>No promotions yet.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--m-border)', background: 'var(--m-surface)' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Promotion' : 'Create Promotion'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="label">Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required /></div>
              <div><label className="label">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-16 resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Discount Type *</label>
                  <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="input-field">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div><label className="label">Value *</label><input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Valid From</label><input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="input-field" /></div>
                <div><label className="label">Valid Until</label><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="input-field" /></div>
              </div>
              <div><label className="label">Image</label><input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files[0] })} className="input-field" /></div>
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
        title="Delete Promotion?"
        message="This promotion will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default Promotions;
