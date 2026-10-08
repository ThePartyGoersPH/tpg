import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, MapPin, Edit2, X, Loader2, Lock, Save, Crown } from 'lucide-react';
import { branchApi } from '../api/branchApi';
import useBranchStore from '../stores/branchStore';
import useAuthStore from '../stores/authStore';
import { getUploadUrl } from '../api/apiClient';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DEFAULT_COORDS = { lat: 14.5995, lng: 120.9842 };

const Branches = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { branches, fetchBranches, selectedBarId, switchBranch } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [subInfo, setSubInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  // Map state
  const [showMap, setShowMap] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    await fetchBranches();
    try {
      const { data } = await branchApi.getSubscriptionInfo();
      setSubInfo(data.data || data);
    } catch {}
    setLoading(false);
  };

  const openCreate = () => {
    if (subInfo && !subInfo.can_create) {
      toast.error(`Your ${subInfo.plan_name || 'Free'} plan allows up to ${subInfo.max_bars} branch${subInfo.max_bars > 1 ? 'es' : ''}. Please upgrade.`);
      return;
    }
    setForm({ name: '', address: '', city: '', state: '', zip_code: '', phone: '', email: '', category: '', latitude: '', longitude: '', description: '' });
    setEditBranch(null);
    setShowCreate(true);
  };

  const openEdit = (branch) => {
    setForm({
      name: branch.name || '',
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      zip_code: branch.zip_code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      category: branch.category || '',
      latitude: branch.latitude || '',
      longitude: branch.longitude || '',
      description: branch.description || '',
    });
    setEditBranch(branch);
    setShowCreate(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.address || !form.city) {
      toast.error('Name, address, and city are required.');
      return;
    }
    setSaving(true);
    try {
      if (editBranch) {
        await branchApi.updateBranch(editBranch.id, form);
        toast.success('Branch updated!');
      } else {
        await branchApi.createBranch(form);
        toast.success('Branch created!');
      }
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async (barId) => {
    const result = await switchBranch(barId);
    if (result.success) {
      toast.success(`Switched to ${result.bar_name}`);
      window.location.reload();
    } else {
      toast.error(result.message);
    }
  };

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // ── Leaflet Map ──
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (!res.ok) return null;
      const data = await res.json();
      const { address } = data;
      if (!address) return null;
      const parts = [address.house_number, address.road, address.neighbourhood, address.suburb, address.city || address.town || address.village, address.state || address.county, address.postcode].filter(Boolean);
      return { full: parts.join(', '), city: address.city || address.town || address.village || '', state: address.state || address.county || '', zip: address.postcode || '' };
    } catch { return null; }
  };

  const loadLeaflet = async () => {
    if (window.L) return window.L;
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    await new Promise((resolve, reject) => {
      const existing = document.getElementById('leaflet-cdn-js');
      if (existing && window.L) { resolve(); return; }
      if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
      const script = document.createElement('script');
      script.id = 'leaflet-cdn-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    return window.L;
  };

  useEffect(() => {
    if (!showMap) return;
    let mounted = true;
    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (!mounted || !mapContainerRef.current) return;
        const lat = Number(form.latitude) || DEFAULT_COORDS.lat;
        const lng = Number(form.longitude) || DEFAULT_COORDS.lng;
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markerRef.current = null; }
        const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
        mapInstanceRef.current = map;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        const updateCoords = async (nextLat, nextLng) => {
          handleChange('latitude', Number(nextLat).toFixed(7));
          handleChange('longitude', Number(nextLng).toFixed(7));
          const geo = await reverseGeocode(nextLat, nextLng);
          if (geo) {
            handleChange('address', geo.full);
            handleChange('city', geo.city);
            handleChange('state', geo.state);
            handleChange('zip_code', geo.zip);
          }
        };

        marker.on('dragend', (e) => { const pos = e.target.getLatLng(); updateCoords(pos.lat, pos.lng); });
        map.on('click', (e) => { marker.setLatLng([e.latlng.lat, e.latlng.lng]); updateCoords(e.latlng.lat, e.latlng.lng); });
        setMapReady(true);
        setTimeout(() => map.invalidateSize(), 100);
      } catch { toast.error('Unable to load map.'); }
    };
    setMapReady(false);
    initMap();
    return () => { mounted = false; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markerRef.current = null; } setMapReady(false); };
  }, [showMap, mapFullscreen]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Subscription Banner */}
      {subInfo && (
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(204,0,0,0.08), rgba(59,130,246,0.06))' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-white">{subInfo.plan_name || 'Free'} Plan</h3>
              <p className="text-sm mt-0.5" style={{ color: '#888' }}>
                {subInfo.current_bars} of {subInfo.max_bars} branch{subInfo.max_bars > 1 ? 'es' : ''} used
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (subInfo.current_bars / subInfo.max_bars) * 100)}%`, background: '#CC0000' }}
                />
              </div>
              {subInfo.can_create ? (
                <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add Branch
                </button>
              ) : (
                <button onClick={() => navigate('/subscription')} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold transition-colors" style={{ background: '#fbbf24', color: '#000' }}>
                  <Crown className="w-4 h-4" /> Upgrade Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <div key={b.id} className={`card relative overflow-hidden ${b.is_locked ? 'opacity-60' : ''}`}>
            {b.is_locked && (
              <div className="absolute top-3 right-3 z-10">
                <Lock className="w-4 h-4" style={{ color: '#fbbf24' }} />
              </div>
            )}
            <div className="h-32 -mx-4 -mt-4 mb-4 relative overflow-hidden" style={{ background: '#1a1a1a' }}>
              {b.image_path ? (
                <img src={getUploadUrl(b.image_path)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(204,0,0,0.1), rgba(59,130,246,0.05))' }}>
                  <GitBranch className="w-10 h-10" style={{ color: 'rgba(204,0,0,0.3)' }} />
                </div>
              )}
              <span className={`absolute top-2 left-2 ${
                b.status === 'active' ? 'badge-success' : b.status === 'pending' ? 'badge-warning' : 'badge-gray'
              }`}>
                {b.status === 'active' ? 'Active' : b.status === 'pending' ? 'Pending' : b.status}
              </span>
            </div>

            <h4 className="font-bold text-white">{b.name}</h4>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              <MapPin className="w-3 h-3 inline mr-1" />
              {b.address ? `${b.address}, ${b.city}` : b.city || 'No address'}
            </p>

            {b.latitude && b.longitude && (
              <p className="text-xs mt-1" style={{ color: '#555' }}>
                {Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}
              </p>
            )}

            <div className="flex items-center gap-2 mt-4">
              {b.id === selectedBarId ? (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(204,0,0,0.12)', color: '#CC0000' }}>
                  Currently Active
                </span>
              ) : !b.is_locked ? (
                <button onClick={() => handleSwitch(b.id)} className="btn-secondary text-xs px-3 py-1.5">
                  Switch to this branch
                </button>
              ) : (
                <span className="text-xs" style={{ color: '#fbbf24' }}>Upgrade to unlock</span>
              )}
              {!b.is_locked && (
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="col-span-full card text-center py-12" style={{ color: '#555' }}>
            <GitBranch className="w-10 h-10 mx-auto mb-3" style={{ color: '#333' }} />
            <p>No branches found.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowCreate(false); setShowMap(false); }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <h3 className="font-bold text-white">{editBranch ? 'Edit Branch' : 'Add New Branch'}</h3>
              <button onClick={() => { setShowCreate(false); setShowMap(false); }} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Branch Name *</label>
                <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} className="input-field" required placeholder="e.g. Club Neon Cavite" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className="input-field h-16 resize-none" placeholder="Short description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Address *</label><input value={form.address} onChange={(e) => handleChange('address', e.target.value)} className="input-field" required /></div>
                <div><label className="label">City *</label><input value={form.city} onChange={(e) => handleChange('city', e.target.value)} className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">State</label><input value={form.state} onChange={(e) => handleChange('state', e.target.value)} className="input-field" /></div>
                <div><label className="label">Zip Code</label><input value={form.zip_code} onChange={(e) => handleChange('zip_code', e.target.value)} className="input-field" /></div>
                <div><label className="label">Category</label><input value={form.category} onChange={(e) => handleChange('category', e.target.value)} className="input-field" placeholder="pub, lounge..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="input-field" /></div>
                <div><label className="label">Email</label><input value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="input-field" /></div>
              </div>

              {/* Map Picker */}
              <div className="rounded-xl p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">Location</p>
                    <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                      {form.latitude && form.longitude ? `${Number(form.latitude).toFixed(4)}, ${Number(form.longitude).toFixed(4)}` : 'Click map to set location'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowMap(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Pick Location
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setShowMap(false); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editBranch ? 'Update Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMap && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3" onClick={() => setShowMap(false)}>
          <div
            className={`rounded-2xl shadow-2xl w-full ${mapFullscreen ? 'max-w-[98vw] h-[95vh]' : 'max-w-4xl h-[80vh]'} overflow-hidden flex flex-col`}
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h4 className="font-bold text-white">Pick Branch Location</h4>
                <p className="text-xs" style={{ color: '#888' }}>Click the map or drag the pin.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMapFullscreen((v) => !v)} className="btn-secondary text-xs px-3 py-1.5">
                  {mapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                <button type="button" onClick={() => setShowMap(false)} className="btn-primary text-xs px-3 py-1.5">Done</button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d' }}>
              <div>
                <label className="label text-xs">Latitude</label>
                <input value={form.latitude || ''} onChange={(e) => handleChange('latitude', e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="label text-xs">Longitude</label>
                <input value={form.longitude || ''} onChange={(e) => handleChange('longitude', e.target.value)} className="input-field text-sm" />
              </div>
            </div>
            <div className="relative flex-1">
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#0d0d0d' }}>
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} />
                </div>
              )}
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
