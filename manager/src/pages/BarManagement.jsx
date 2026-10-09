import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, MapPin, Clock, Loader2, Receipt, FileText, Users, CreditCard, Video, Image, Star, Trash2, ChevronUp, ChevronDown, Play, Pencil, X, RefreshCw, Store, Bike } from 'lucide-react';
import { barApi } from '../api/barApi';
import { getUploadUrl } from '../api/apiClient';
import PayoutSetupCards from '../components/payouts/PayoutSetupCards';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const BAR_TYPE_OPTIONS = ['Restobar', 'Bar', 'Club', 'Comedy Bar', 'KTV'];
const DEFAULT_COORDS = { lat: 14.2456, lng: 120.8786 };

// Generate time options (12-hour format with 30-minute intervals)
const TIMES = (() => {
  const list = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      list.push(`${hour}:${m === 0 ? '00' : '30'} ${ampm}`);
    }
  }
  return list;
})();

// Cavite province bounding box
const CAVITE_BOUNDS = [[13.90, 120.50], [14.65, 121.25]];

const normalizeBarTypes = (rawBarTypes, fallbackCategory = '') => {
  let parsed = [];

  if (Array.isArray(rawBarTypes)) {
    parsed = rawBarTypes;
  } else if (typeof rawBarTypes === 'string' && rawBarTypes.trim()) {
    try {
      const json = JSON.parse(rawBarTypes);
      parsed = Array.isArray(json) ? json : [rawBarTypes];
    } catch {
      parsed = [rawBarTypes];
    }
  }

  const normalized = parsed.flatMap((value) => {
    const label = String(value || '').trim();
    if (!label) return [];

    const lower = label.toLowerCase();
    if (lower === 'bar / club' || lower === 'bar/club') return ['Bar', 'Club'];
    if (lower === 'restobar') return ['Restobar'];
    if (lower === 'club') return ['Club'];
    if (lower === 'comedy bar') return ['Comedy Bar'];
    if (lower === 'ktv') return ['KTV'];
    if (lower === 'bar') return ['Bar'];
    return [label];
  });

  const unique = [...new Set(normalized)];
  if (unique.length) return unique;

  const fallback = String(fallbackCategory || '').trim();
  if (!fallback) return [];

  const lowerFallback = fallback.toLowerCase();
  if (lowerFallback === 'restobar') return ['Restobar'];
  if (lowerFallback === 'club') return ['Club'];
  if (lowerFallback === 'comedy bar') return ['Comedy Bar'];
  if (lowerFallback === 'ktv') return ['KTV'];
  if (lowerFallback === 'bar') return ['Bar'];
  return [fallback];
};

const BarManagement = () => {
  const user = useAuthStore((s) => s.user);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const [bar, setBar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [barLoadError, setBarLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [dayHours, setDayHours] = useState(
    DAYS.reduce((acc, d) => ({ ...acc, [d]: { open: '', close: '' } }), {})
  );
  const [staffTypes, setStaffTypes] = useState([]);
  const [barTypes, setBarTypes] = useState([]);
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Tax configuration state
  const [taxConfig, setTaxConfig] = useState({
    tin: '',
    is_bir_registered: false,
    tax_type: 'NON_VAT',
    tax_rate: 0,
    tax_mode: 'EXCLUSIVE',
  });
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxSaving, setTaxSaving] = useState(false);

  // Video (Trailer & Clips) state
  const [videos, setVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editingVideoLabel, setEditingVideoLabel] = useState('');

  // Photo state
  const [photos, setPhotos] = useState([]);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [editingPhotoCaption, setEditingPhotoCaption] = useState('');

  useEffect(() => {
    loadBar();
    loadTaxConfig();
    loadVideos();
    loadPhotos();
  }, []);

  const loadBar = async () => {
    try {
      setBarLoadError(null);
      const { data } = await barApi.getDetails();
      const d = data.data || data;
      setBar(d);
      setForm({ ...d, email: d.email || user?.email || '' });
      // Parse day hours into separate open/close per day
      const parsedDayHours = {};
      DAYS.forEach(day => {
        const val = d[`${day}_hours`] || '';
        const hasSep = val.includes('\u2013') || val.includes('-');
        const parts = hasSep ? val.split(/[\u2013-]/).map(t => t.trim()) : [];
        parsedDayHours[day] = { open: parts[0] || '', close: parts[1] || '' };
      });
      setDayHours(parsedDayHours);
      // Parse staff_types from JSON
      if (d.staff_types) {
        try {
          const parsed = typeof d.staff_types === 'string' ? JSON.parse(d.staff_types) : d.staff_types;
          setStaffTypes(Array.isArray(parsed) ? parsed : []);
        } catch {
          setStaffTypes([]);
        }
      } else {
        setStaffTypes([]);
      }
      // Parse bar_types from JSON
      if (d.bar_types) {
        try {
          setBarTypes(normalizeBarTypes(d.bar_types, d.category));
        } catch {
          setBarTypes(normalizeBarTypes([], d.category));
        }
      } else {
        setBarTypes(normalizeBarTypes([], d.category));
      }
    } catch (err) {
      // Handle bar not found specifically
      if (err?.response?.status === 404) {
        setBarLoadError('BAR_NOT_FOUND');
      } else {
        setBarLoadError('LOAD_FAILED');
      }
      console.error('Load bar error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTaxConfig = async () => {
    try {
      const { data } = await barApi.getTaxConfig();
      const d = data.data || data;
      setTaxConfig({
        tin: d.tin || '',
        is_bir_registered: Boolean(d.is_bir_registered),
        tax_type: d.tax_type || 'NON_VAT',
        tax_rate: Number(d.tax_rate || 0),
        tax_mode: d.tax_mode || 'EXCLUSIVE',
      });
    } catch { /* may not exist yet */ } finally {
      setTaxLoading(false);
    }
  };

  const handleTaxSave = async () => {
    setTaxSaving(true);
    try {
      const payload = {
        tin: taxConfig.tin || null,
        is_bir_registered: taxConfig.is_bir_registered,
        tax_type: taxConfig.tax_type,
        tax_rate: Number(taxConfig.tax_rate),
        tax_mode: taxConfig.tax_mode,
      };
      await barApi.updateTaxConfig(payload);
      toast.success('Tax configuration updated!');
      loadTaxConfig();
    } catch { /* handled by interceptor */ } finally {
      setTaxSaving(false);
    }
  };

  const handleTaxChange = (field, value) => {
    setTaxConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Compute tax preview for display
  const computeTaxPreview = (rawSubtotal) => {
    const taxType = (taxConfig.tax_type || 'NON_VAT').toUpperCase();
    const taxRate = Number(taxConfig.tax_rate || 0);
    const taxMode = (taxConfig.tax_mode || 'EXCLUSIVE').toUpperCase();
    const s = Number(rawSubtotal);
    if (taxType === 'NON_VAT' || taxRate === 0) {
      return { net: s, tax: 0, total: s };
    }
    if (taxMode === 'EXCLUSIVE') {
      const tax = parseFloat((s * taxRate / 100).toFixed(2));
      return { net: s, tax, total: parseFloat((s + tax).toFixed(2)) };
    }
    const tax = parseFloat((s - s / (1 + taxRate / 100)).toFixed(2));
    return { net: parseFloat((s - tax).toFixed(2)), tax, total: s };
  };

  // ──── Video (Trailer & Clips) functions ────

  const loadVideos = async () => {
    try {
      const { data } = await barApi.getVideos();
      setVideos(data.data || []);
    } catch { /* empty */ } finally {
      setVideoLoading(false);
    }
  };

  const handleVideoUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,.webm,.mov';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Video must be under 100 MB');
        return;
      }
      const fd = new FormData();
      fd.append('video', file);
      setVideoUploading(true);
      setVideoUploadProgress(0);
      try {
        await barApi.uploadVideo(fd, (ProgressEvent) => {
          if (ProgressEvent.total) {
            setVideoUploadProgress(Math.round((ProgressEvent.loaded * 100) / ProgressEvent.total));
          }
        });
        toast.success('Video uploaded!');
        loadVideos();
      } catch { /* handled by interceptor */ } finally {
        setVideoUploading(false);
        setVideoUploadProgress(0);
      }
    };
    input.click();
  };

  const handleDeleteVideo = async (videoId) => {
    if (!confirm('Delete this video?')) return;
    try {
      await barApi.deleteVideo(videoId);
      toast.success('Video deleted');
      loadVideos();
    } catch { /* handled by interceptor */ }
  };

  const handleSetFeatured = async (videoId) => {
    try {
      await barApi.updateVideo(videoId, { is_featured: 1 });
      toast.success('Featured updated');
      loadVideos();
    } catch { /* handled by interceptor */ }
  };

  const handleReorderVideo = async (videoId, direction) => {
    const idx = videos.findIndex((v) => v.id === videoId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= videos.length) return;
    const current = videos[idx];
    const target = videos[targetIdx];
    try {
      await Promise.all([
        barApi.updateVideo(current.id, { sort_order: target.sort_order }),
        barApi.updateVideo(target.id, { sort_order: current.sort_order }),
      ]);
      loadVideos();
    } catch { /* handled by interceptor */ }
  };

  const handleSaveVideoLabel = async (videoId) => {
    try {
      await barApi.updateVideo(videoId, { label: editingVideoLabel });
      toast.success('Label updated');
      setEditingVideoId(null);
      loadVideos();
    } catch { /* handled by interceptor */ }
  };

  // ──── Photo functions ────

  const loadPhotos = async () => {
    try {
      const { data } = await barApi.getVideos();
      const allMedia = data.data || [];
      setPhotos(allMedia.filter(m => m.media_type === 'photo'));
    } catch (err) {
      console.error('Failed to load photos:', err);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.gif,.webp';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      setPhotoUploading(true);
      setPhotoUploadProgress(0);
      try {
        for (let i = 0; i < files.length; i++) {
          const fd = new FormData();
          fd.append('photo', files[i]);
          await barApi.uploadPhoto(fd, (ProgressEvent) => {
            if (ProgressEvent.total) {
              const fileProgress = Math.round((ProgressEvent.loaded * 100) / ProgressEvent.total);
              const overallProgress = Math.round(((i + fileProgress / 100) / files.length) * 100);
              setPhotoUploadProgress(overallProgress);
            }
          });
        }
        toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded!`);
        loadPhotos();
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Photo upload failed';
        toast.error(msg);
      } finally {
        setPhotoUploading(false);
        setPhotoUploadProgress(0);
      }
    };
    input.click();
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await barApi.deletePhoto(photoId);
      toast.success('Photo deleted');
      loadPhotos();
    } catch { /* handled by interceptor */ }
  };

  const handleReorderPhoto = async (photoId, direction) => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const current = photos[idx];
    const target = photos[targetIdx];
    try {
      await Promise.all([
        barApi.updatePhoto(current.id, { sort_order: target.sort_order }),
        barApi.updatePhoto(target.id, { sort_order: current.sort_order }),
      ]);
      loadPhotos();
    } catch { /* handled by interceptor */ }
  };

  const handleSavePhotoCaption = async (photoId) => {
    try {
      await barApi.updatePhoto(photoId, { caption: editingPhotoCaption });
      toast.success('Caption updated');
      setEditingPhotoId(null);
      loadPhotos();
    } catch { /* handled by interceptor */ }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (!res.ok) return null;
      const data = await res.json();
      const { address } = data;
      const city = address.city || address.town || address.village || address.municipality || address.county || '';
      const state = address.state || '';
      
      // Validate that location is in Cavite
      const isCavite = city.toLowerCase().includes('cavite') || state.toLowerCase().includes('cavite');
      
      return {
        full: data.display_name || '',
        city: isCavite ? 'Cavite' : city,
        state: address.state || address.county || '',
        zip: address.postcode || '',
        isCavite,
      };
    } catch {
      return null;
    }
  };

  const getCoords = () => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, isDefault: false };
    }
    return { ...DEFAULT_COORDS, isDefault: true };
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
      if (existing && window.L) {
        resolve();
        return;
      }
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

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
    if (!showMapPicker) return;

    let mounted = true;
    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (!mounted || !mapContainerRef.current) return;

        const { lat, lng, isDefault } = getCoords();

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          markerRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          maxBounds: CAVITE_BOUNDS,
          maxBoundsViscosity: 1.0,
          minZoom: 10,
          maxZoom: 18,
        }).setView([lat, lng], isDefault ? 10 : 13);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map);

        L.rectangle(CAVITE_BOUNDS, {
          color: '#CC0000', weight: 1.5, fill: false, dashArray: '6 4', opacity: 0.5,
        }).addTo(map);

        const markerIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        const marker = L.marker([lat, lng], { draggable: true, icon: markerIcon }).addTo(map);
        markerRef.current = marker;

        const isInsideCavite = (nlat, nlng) => {
          const [[swLat, swLng], [neLat, neLng]] = CAVITE_BOUNDS;
          return nlat >= swLat && nlat <= neLat && nlng >= swLng && nlng <= neLng;
        };

        let lastValidPos = { lat, lng };

        const updateCoords = async (nextLat, nextLng) => {
          if (!isInsideCavite(nextLat, nextLng)) {
            toast.error('Location must be inside Cavite province only.');
            marker.setLatLng([lastValidPos.lat, lastValidPos.lng]);
            return false;
          }
          lastValidPos = { lat: nextLat, lng: nextLng };
          handleChange('latitude', Number(nextLat).toFixed(7));
          handleChange('longitude', Number(nextLng).toFixed(7));
          const geo = await reverseGeocode(nextLat, nextLng);
          if (geo) {
            if (!geo.isCavite) {
              toast.error('This location is not in Cavite. Platform is for Cavite bars only.');
              marker.setLatLng([lastValidPos.lat, lastValidPos.lng]);
              return false;
            }
            handleChange('address', geo.full);
            handleChange('city', 'Cavite');
            handleChange('state', geo.state);
            handleChange('zip_code', geo.zip);
          }
          return true;
        };

        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          updateCoords(pos.lat, pos.lng);
        });

        map.on('click', (e) => {
          const { lat: nextLat, lng: nextLng } = e.latlng;
          if (isInsideCavite(nextLat, nextLng)) {
            marker.setLatLng([nextLat, nextLng]);
            updateCoords(nextLat, nextLng);
          } else {
            toast.error('Location must be inside Cavite province only.');
          }
        });

        setMapReady(true);
        setTimeout(() => map.invalidateSize(), 100);
      } catch {
        toast.error('Unable to load map picker.');
      }
    };

    setMapReady(false);
    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      setMapReady(false);
    };
  }, [showMapPicker, mapFullscreen]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { name, description, address, city, state, zip_code, phone, contact_number, email, website, category, price_range, latitude, longitude, accept_cash_payment, accept_online_payment, accept_gcash, minimum_reservation_deposit, gcash_number, gcash_account_name, allow_pickup, allow_delivery, delivery_fee, is_takeout_enabled } = form;
      const hours = {};
      DAYS.forEach((d) => {
        const { open, close } = dayHours[d] || {};
        hours[`${d}_hours`] = open && close ? `${open} \u2013 ${close}` : (open || close || '');
      });
      await barApi.updateDetails({ 
        name, description, address, city, state, zip_code, phone, contact_number, email, website, category, price_range, latitude, longitude, 
        accept_cash_payment, accept_online_payment, accept_gcash, 
        minimum_reservation_deposit: minimum_reservation_deposit ? Number(minimum_reservation_deposit) : 0, 
        gcash_number, gcash_account_name,
        allow_pickup: allow_pickup === undefined ? undefined : (allow_pickup ? 1 : 0),
        allow_delivery: allow_delivery === undefined ? undefined : (allow_delivery ? 1 : 0),
        is_takeout_enabled: is_takeout_enabled === undefined ? undefined : (is_takeout_enabled ? 1 : 0),
        delivery_fee: delivery_fee === '' || delivery_fee == null ? 0 : Math.max(0, Number(delivery_fee) || 0),
        staff_types: staffTypes,
        bar_types: normalizeBarTypes(barTypes, category),
        ...hours 
      });
      toast.success('Bar details updated!');
      loadBar();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  };

  const toggleStaffType = (type) => {
    setStaffTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const DEFAULT_STAFF_TYPES = ['DJ', 'Live Band', 'Host / Emcee', 'Security', 'Waitstaff'];

  // Takeout / pickup & delivery settings only apply to restobar venues.
  const isRestobarVenue =
    /restobar/i.test(String(form.category || '')) ||
    (barTypes || []).some((t) => /restobar/i.test(String(t || '')));

  const addCustomStaffType = () => {
    const name = customTypeInput.trim().slice(0, 40);
    if (!name) return;
    const exists = [...DEFAULT_STAFF_TYPES, ...staffTypes].some(
      (t) => t.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      toast.error('That staff type already exists');
      return;
    }
    setStaffTypes(prev => [...prev, name]);
    setCustomTypeInput('');
  };

  const removeCustomStaffType = (type) => {
    setStaffTypes(prev => prev.filter(t => t !== type));
  };

  const toggleBarType = (type) => {
    setBarTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleImageUpload = async (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'image' || type === 'icon') {
      input.accept = 'image/*';
    } else if (type === 'gif') {
      input.accept = '.gif,.mp4,.webm';
    }
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      if (type === 'image') { fd.append('image', file); await barApi.uploadImage(fd); }
      else if (type === 'icon') { fd.append('bar_icon', file); await barApi.uploadIcon(fd); }
      else if (type === 'gif') { fd.append('bar_gif', file); await barApi.uploadVideo(fd); }
      toast.success(`Bar ${type} uploaded!`);
      loadBar();
    };
    input.click();
  };

  const handleSettingsUpdate = async (reservation_mode) => {
    try {
      await barApi.updateSettings({ reservation_mode });
      toast.success('Reservation mode updated!');
    } catch { /* handled */ }
  };

  if (loading) return <LoadingSpinner />;
  if (barLoadError === 'BAR_NOT_FOUND') {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h3 className="text-xl font-bold text-white mb-2">Bar Not Found</h3>
        <p className="text-gray-400 mb-4 max-w-md mx-auto">
          No bar is associated with your account. This may happen if your bar was removed or if your account isn't linked to a bar yet.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={async () => {
              setBarLoadError(null);
              setLoading(true);
              await refreshSession();
              loadBar();
            }}
            className="btn-primary flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh & Retry
          </button>
          <button
            onClick={() => window.location.href = ((import.meta.env.BASE_URL || '/') === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')) + '/bar-registration'}
            className="btn-secondary flex-1"
          >
            Register New Bar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          If the problem persists, contact support or try logging out and back in.
        </p>
      </div>
    );
  }
  if (barLoadError === 'LOAD_FAILED') {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Bar Details</h3>
        <p className="text-gray-400 mb-4">Unable to connect to the server or load your bar information.</p>
        <button onClick={() => { setBarLoadError(null); setLoading(true); loadBar(); }} className="btn-primary">
          <RefreshCw className="w-4 h-4 mr-2" /> Try Again
        </button>
      </div>
    );
  }
  if (!bar) return <div className="card"><p style={{ color: '#888' }}>Unable to load bar details.</p></div>;

  return (
    <div className="space-y-6">
      {/* Header with Images */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            <div className="w-32 h-32 rounded-xl overflow-hidden relative group" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {bar.image_path ? (
                <img src={getUploadUrl(bar.image_path)} alt="Bar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs" style={{ background: '#1a1a1a', color: '#555' }}>No Image</div>
              )}
              <button onClick={() => handleImageUpload('image')} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </button>
            </div>
            <button onClick={() => handleImageUpload('icon')} className="mt-2 text-xs w-full text-center" style={{ color: '#CC0000' }}>Upload Logo</button>
            <button onClick={() => handleImageUpload('gif')} className="mt-1 text-xs w-full text-center" style={{ color: '#CC0000' }}>Upload GIF/Video</button>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{bar.name}</h2>
            <p className="text-sm mt-1" style={{ color: '#888' }}>{bar.address}, {bar.city}</p>
            <div className="flex gap-2 mt-3">
              <span className={bar.status === 'active' ? 'badge-success' : 'badge-gray'}>{bar.status}</span>
              <span className="badge-gray">{bar.category || 'Bar'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payouts & Payment Setup */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">Payouts &amp; Payment Setup</h3>
        <div className="space-y-4">
          <PayoutSetupCards variant="full" />
        </div>
      </div>

      {/* Edit Form */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Bar Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'Bar Name' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'address', label: 'Address' },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'zip_code', label: 'Zip Code' },
            { key: 'phone', label: 'Phone' },
            { key: 'contact_number', label: 'Contact Number' },
            { key: 'email', label: 'Email', disabled: true },
            { key: 'website', label: 'Website' },
            { key: 'category', label: 'Category' },
            { key: 'price_range', label: 'Price Range' },
            { key: 'latitude', label: 'Latitude' },
            { key: 'longitude', label: 'Longitude' },
          ].map(({ key, label, type, disabled }) => (
            <div key={key} className={type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="label">{label}</label>
              {type === 'textarea' ? (
                <textarea value={form[key] || ''} onChange={(e) => handleChange(key, e.target.value)} className="input-field h-20 resize-none" disabled={disabled} />
              ) : (
                <input value={form[key] || ''} onChange={(e) => handleChange(key, e.target.value)} className="input-field" disabled={disabled} />
              )}
            </div>
          ))}
          
          <div>
            <label className="label">Min Reservation Deposit (%)</label>
            <input 
              type="number" 
              min="0" 
              max="100" 
              step="1"
              value={form.minimum_reservation_deposit || ''} 
              onChange={(e) => handleChange('minimum_reservation_deposit', e.target.value)} 
              className="input-field" 
              placeholder="e.g., 50 for 50%"
            />
            <p className="text-xs mt-1" style={{ color: '#666' }}>Percentage of total order amount required as deposit (0-100%)</p>
          </div>

          <div className="md:col-span-2">
            <label className="label">Location Picker</label>
            <div className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm">
                <p className="font-medium text-white">Use map pin instead of manual coordinates</p>
                <p className="text-xs mt-1" style={{ color: '#888' }}>Pin must be within <span style={{ color: '#CC0000' }}>Cavite province</span>. Click or drag to set Latitude/Longitude automatically.</p>
              </div>
              <button type="button" onClick={() => setShowMapPicker(true)} className="btn-secondary flex items-center gap-2 w-fit">
                <MapPin className="w-4 h-4" /> Open Map Picker
              </button>
            </div>
          </div>
        </div>

        {/* GCash Payout Details */}
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            GCash Payout Details
          </h4>
          <p className="text-xs mb-3" style={{ color: '#888' }}>Add your GCash account for receiving payouts from the platform.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">GCash Number *</label>
              <input 
                value={form.gcash_number || ''} 
                onChange={(e) => handleChange('gcash_number', e.target.value)} 
                className="input-field" 
                placeholder="09XXXXXXXXX"
                pattern="09[0-9]{9}"
                maxLength={11}
              />
              <p className="text-xs mt-1" style={{ color: '#555' }}>Format: 09XXXXXXXXX (11 digits)</p>
            </div>
            <div>
              <label className="label">Account Name *</label>
              <input 
                value={form.gcash_account_name || ''} 
                onChange={(e) => handleChange('gcash_account_name', e.target.value)} 
                className="input-field" 
                placeholder="Juan Dela Cruz"
              />
              <p className="text-xs mt-1" style={{ color: '#555' }}>Name registered on GCash</p>
            </div>
          </div>
        </div>

        {/* Pickup & Delivery (restobars only) */}
        {isRestobarVenue && (
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Store className="w-5 h-5" style={{ color: '#4ade80' }} />
            Pickup & Delivery
          </h4>
          <p className="text-xs mb-3" style={{ color: '#888' }}>Takeout / Food Order appears for customers only while takeout is enabled and at least one fulfillment mode is on.</p>
          <label className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors mb-3" style={{ background: form.is_takeout_enabled ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              type="checkbox"
              checked={!!Number(form.is_takeout_enabled ?? 0)}
              onChange={(e) => handleChange('is_takeout_enabled', e.target.checked ? 1 : 0)}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#22c55e' }}
            />
            <span className="text-sm font-medium text-white">Enable Takeout Orders</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: form.allow_pickup ?? true ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                type="checkbox"
                checked={form.allow_pickup ?? true}
                onChange={(e) => handleChange('allow_pickup', e.target.checked ? 1 : 0)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#22c55e' }}
              />
              <span className="text-sm font-medium text-white">Allow Store Pickup</span>
            </label>
            <label className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: form.allow_delivery ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                type="checkbox"
                checked={!!form.allow_delivery}
                onChange={(e) => handleChange('allow_delivery', e.target.checked ? 1 : 0)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#22c55e' }}
              />
              <span className="text-sm font-medium text-white">Allow Delivery</span>
            </label>
          </div>
          <div className="mt-3 max-w-xs">
            <label className="label">Delivery Fee (₱)</label>
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 shrink-0" style={{ color: '#4ade80' }} />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.delivery_fee ?? ''}
                onChange={(e) => handleChange('delivery_fee', e.target.value)}
                className="input-field"
                placeholder="0.00"
                disabled={!form.allow_delivery}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: '#666' }}>Added to the order total when the customer chooses delivery.</p>
          </div>
        </div>
        )}

        {/* Bar Types Section */}
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.2)' }}>
          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Receipt className="w-5 h-5" style={{ color: '#CC0000' }} />
            Bar Types
          </h4>
          <p className="text-xs mb-3" style={{ color: '#888' }}>Select the type(s) that best describe your establishment. This determines what sections customers see.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {BAR_TYPE_OPTIONS.map((type) => (
              <label key={type} className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: barTypes.includes(type) ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.03)', border: barTypes.includes(type) ? '1px solid rgba(204,0,0,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                <input
                  type="checkbox"
                  checked={barTypes.includes(type)}
                  onChange={() => toggleBarType(type)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#CC0000' }}
                />
                <span className="text-sm font-medium" style={{ color: barTypes.includes(type) ? '#fff' : '#ccc' }}>{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Staff Types Section */}
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.2)' }}>
          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: '#CC0000' }} />
            Staff Types
          </h4>
          <p className="text-xs mb-3" style={{ color: '#888' }}>Select the types of staff present at your bar. This will be displayed to customers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...DEFAULT_STAFF_TYPES, ...staffTypes.filter(t => !DEFAULT_STAFF_TYPES.some(d => d.toLowerCase() === String(t).toLowerCase()))].map((type) => {
              const isCustom = !DEFAULT_STAFF_TYPES.some(d => d.toLowerCase() === String(type).toLowerCase());
              return (
              <label key={type} className="flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: staffTypes.includes(type) ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.03)', border: staffTypes.includes(type) ? '1px solid rgba(204,0,0,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                <input 
                  type="checkbox" 
                  checked={staffTypes.includes(type)} 
                  onChange={() => toggleStaffType(type)}
                  className="w-4 h-4 rounded" 
                  style={{ accentColor: '#CC0000' }} 
                />
                <span className="text-sm font-medium flex-1" style={{ color: staffTypes.includes(type) ? '#fff' : '#ccc' }}>{type}</span>
                {isCustom && (
                  <button
                    type="button"
                    title={`Remove custom type "${type}"`}
                    onClick={(e) => { e.preventDefault(); removeCustomStaffType(type); }}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: '#ff6666', background: 'rgba(204,0,0,0.12)' }}
                  >✕</button>
                )}
              </label>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={customTypeInput}
              onChange={(e) => setCustomTypeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomStaffType(); } }}
              placeholder="+ Add custom staff type (e.g. Bartender)"
              maxLength={40}
              className="input-field flex-1"
              style={{ fontSize: '0.8rem' }}
            />
            <button type="button" onClick={addCustomStaffType} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
              + Add Staff Type
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: '#666' }}>Custom types appear in the Add Staff dropdown after you save changes.</p>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary mt-6 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Operating Hours */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" style={{ color: '#CC0000' }} />
          <h3 className="text-lg font-bold text-white">Operating Hours</h3>
        </div>
        <div className="space-y-3">
          {DAYS.map((day) => {
            const { open: openTime, close: closeTime } = dayHours[day] || { open: '', close: '' };
            return (
              <div key={day} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                <label className="label capitalize mb-0">{day}</label>
                <select
                  value={openTime}
                  onChange={(e) => setDayHours(prev => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))}
                  className="input-field"
                >
                  <option value="">Opens...</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  value={closeTime}
                  onChange={(e) => setDayHours(prev => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))}
                  className="input-field"
                >
                  <option value="">Closes...</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: '#666' }}>Select opening and closing times for each day. Leave blank for days when the bar is closed.</p>
      </div>

      {/* Media Preview */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Media</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label text-xs text-gray-500">Main Image</label>
            <div className="relative group">
              {bar.image_path ? (
                <img src={getUploadUrl(bar.image_path)} alt="Bar" className="w-full h-32 object-cover rounded" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
              ) : (
                <div className="w-full h-32 rounded flex items-center justify-center text-xs" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}>No Image</div>
              )}
              <button onClick={() => handleImageUpload('image')} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <Upload className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div>
            <label className="label text-xs text-gray-500">Logo</label>
            <div className="relative group">
              {bar.logo_path ? (
                <img src={getUploadUrl(bar.logo_path)} alt="Logo" className="w-full h-32 object-contain rounded" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }} />
              ) : (
                <div className="w-full h-32 rounded flex items-center justify-center text-xs" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}>No Logo</div>
              )}
              <button onClick={() => handleImageUpload('icon')} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <Upload className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div>
            <label className="label text-xs text-gray-500">GIF/Video</label>
            <div className="relative group">
              {bar.video_path ? (
                bar.video_path.endsWith('.gif') ? (
                  <img src={getUploadUrl(bar.video_path)} alt="GIF" className="w-full h-32 object-cover rounded" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
                ) : (
                  <video src={getUploadUrl(bar.video_path)} className="w-full h-32 object-cover rounded" style={{ border: '1px solid rgba(255,255,255,0.08)' }} controls muted />
                )
              ) : (
                <div className="w-full h-32 rounded flex items-center justify-center text-xs" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#555' }}>No GIF/Video</div>
              )}
              <button onClick={() => handleImageUpload('gif')} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <Upload className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trailer & Clips */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5" style={{ color: '#CC0000' }} />
            <h3 className="text-lg font-bold text-white">Trailer & Clips</h3>
          </div>
          <button
            onClick={handleVideoUpload}
            disabled={videoUploading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
            style={{ background: '#CC0000', color: '#fff', opacity: videoUploading ? 0.6 : 1 }}
          >
            {videoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {videoUploading ? `Uploading ${videoUploadProgress}%` : 'Add Video'}
          </button>
        </div>

        {videoUploading && (
          <div className="mb-4">
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${videoUploadProgress}%`, background: '#CC0000' }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: '#888' }}>
              Uploading... {videoUploadProgress}% — Large files may take a while.
            </p>
          </div>
        )}

        {videoLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-8 rounded-xl" style={{ background: '#0d0d0d', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Video className="w-10 h-10 mx-auto mb-3" style={{ color: '#444' }} />
            <p className="text-sm font-medium" style={{ color: '#888' }}>No videos yet</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>Upload a trailer or clips to showcase your bar on the public profile.</p>
          </div>
        ) : (
          <p className="text-xs mb-3" style={{ color: '#666' }}>
            The <Star className="w-3 h-3 inline" style={{ color: '#f59e0b' }} /> featured video appears prominently on your public profile. Use arrows to reorder clips.
          </p>
        )}

        {!videoLoading && videos.length > 0 && (
          <div className="space-y-3">
            {videos.map((v, idx) => (
              <div
                key={v.id}
                className="flex items-center gap-4 p-3 rounded-xl transition-colors"
                style={{
                  background: v.is_featured ? 'rgba(204,0,0,0.06)' : '#111111',
                  border: v.is_featured ? '1px solid rgba(204,0,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden" style={{ background: '#000' }}>
                  <video
                    src={getUploadUrl(v.video_url)}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-6 h-6 text-white/80" />
                  </div>
                  {v.is_featured ? (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#CC0000', color: '#fff' }}>
                      FEATURED
                    </div>
                  ) : null}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingVideoId === v.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editingVideoLabel}
                        onChange={(e) => setEditingVideoLabel(e.target.value)}
                        className="input-field text-sm py-1 px-2"
                        placeholder="Label (optional)"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVideoLabel(v.id); if (e.key === 'Escape') setEditingVideoId(null); }}
                      />
                      <button onClick={() => handleSaveVideoLabel(v.id)} className="p-1 rounded" style={{ color: '#4ade80' }}>
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingVideoId(null)} className="p-1 rounded" style={{ color: '#888' }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-white truncate">
                      {v.label || v.video_url.split('/').pop()}
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                    #{idx + 1} · Uploaded {new Date(v.uploaded_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleReorderVideo(v.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: idx === 0 ? '#333' : '#888' }}
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReorderVideo(v.id, 'down')}
                    disabled={idx === videos.length - 1}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: idx === videos.length - 1 ? '#333' : '#888' }}
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSetFeatured(v.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: v.is_featured ? '#f59e0b' : '#888' }}
                    title={v.is_featured ? 'Currently featured' : 'Set as featured'}
                  >
                    <Star className="w-4 h-4" fill={v.is_featured ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => { setEditingVideoId(v.id); setEditingVideoLabel(v.label || ''); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#888' }}
                    title="Edit label"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteVideo(v.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#ff6666' }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!videoLoading && videos.length > 0 && (
          <p className="text-xs mt-4" style={{ color: '#555' }}>
            Accepted: MP4, WebM, MOV · Max 100 MB per video
          </p>
        )}
      </div>

      {/* Photos Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Image className="w-5 h-5" style={{ color: '#CC0000' }} />
          <h3 className="text-lg font-bold text-white">Photos</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: '#888' }}>
          Upload venue shots, drinks, and past events to show visitors what your bar looks like.
        </p>

        {/* Upload button + progress */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handlePhotoUpload}
            disabled={photoUploading}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {photoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {photoUploading ? `Uploading... ${photoUploadProgress}%` : '+ Upload Photo'}
          </button>
          {photoUploading && (
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${photoUploadProgress}%`, background: '#CC0000' }} />
            </div>
          )}
        </div>

        {/* Photo grid */}
        {photoLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#CC0000' }} />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#555' }}>
            <Image className="w-8 h-8 mx-auto mb-2" style={{ color: '#333' }} />
            <p className="text-sm">No photos uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p, idx) => (
              <div key={p.id} className="relative group rounded-xl overflow-hidden" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img
                  src={p.video_url.startsWith('http') ? p.video_url : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${p.video_url}`}
                  alt={p.caption || ''}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  {/* Caption */}
                  <div>
                    {editingPhotoId === p.id ? (
                      <div className="flex gap-1">
                        <input
                          value={editingPhotoCaption}
                          onChange={(e) => setEditingPhotoCaption(e.target.value)}
                          className="flex-1 text-xs px-2 py-1 rounded"
                          style={{ background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                          placeholder="Caption..."
                          onKeyDown={(e) => e.key === 'Enter' && handleSavePhotoCaption(p.id)}
                        />
                        <button onClick={() => handleSavePhotoCaption(p.id)} className="px-2 py-1 rounded text-xs" style={{ background: '#CC0000', color: '#fff' }}>Save</button>
                      </div>
                    ) : (
                      <p className="text-xs text-white truncate">{p.caption || 'No caption'}</p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleReorderPhoto(p.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded transition-colors"
                      style={{ color: idx === 0 ? '#333' : '#ccc' }}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleReorderPhoto(p.id, 'down')}
                      disabled={idx === photos.length - 1}
                      className="p-1 rounded transition-colors"
                      style={{ color: idx === photos.length - 1 ? '#333' : '#ccc' }}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditingPhotoId(p.id); setEditingPhotoCaption(p.caption || ''); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#ccc' }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(p.id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#ff6666' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!photoLoading && photos.length > 0 && (
          <p className="text-xs mt-4" style={{ color: '#555' }}>
            Accepted: JPG, PNG, GIF, WEBP · {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
          </p>
        )}
      </div>

      {/* Payment Acceptance Settings */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5" style={{ color: '#CC0000' }} />
          <h3 className="text-lg font-bold text-white">Payment Acceptance</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: '#888' }}>
          Configure which payment methods your bar accepts from customers for online reservations.
        </p>
        <div className="space-y-3">
          <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="font-medium text-white text-sm">Accept Online Payments</p>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>Allow customers to pay online via GCash or Card/PayMaya</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('accept_online_payment', form.accept_online_payment === 1 ? 0 : 1)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
              style={{ background: form.accept_online_payment === 1 ? '#CC0000' : '#333' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                style={{ transform: form.accept_online_payment === 1 ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          
          <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="font-medium text-white text-sm">Accept GCash</p>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>Enable GCash as a payment option for customers</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('accept_gcash', form.accept_gcash === 1 ? 0 : 1)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
              style={{ background: form.accept_gcash === 1 ? '#CC0000' : '#333' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                style={{ transform: form.accept_gcash === 1 ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Reservation Settings */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">Reservation Settings</h3>
        <div className="flex gap-3">
          <button onClick={() => handleSettingsUpdate('manual_approval')} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={bar.reservation_mode === 'manual_approval' ? { background: '#CC0000', color: '#fff' } : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
          >Manual Approval</button>
          <button onClick={() => handleSettingsUpdate('auto_accept')} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={bar.reservation_mode === 'auto_accept' ? { background: '#CC0000', color: '#fff' } : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
          >Auto Accept</button>
        </div>
      </div>

      {/* Tax Configuration (BIR Compliance) */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5" style={{ color: '#CC0000' }} />
          <h3 className="text-lg font-bold text-white">Tax Configuration</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: '#888' }}>
          Configure your bar's BIR tax settings. These affect how tax is computed on customer web orders and official receipts.
        </p>

        {taxLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#CC0000' }} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BIR Registration Toggle */}
              <div className="md:col-span-2">
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p className="font-medium text-white text-sm">BIR Registered</p>
                    <p className="text-xs mt-0.5" style={{ color: '#888' }}>Enable if your bar is registered with the Bureau of Internal Revenue</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTaxChange('is_bir_registered', !taxConfig.is_bir_registered)}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
                    style={{ background: taxConfig.is_bir_registered ? '#CC0000' : '#333' }}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      style={{ transform: taxConfig.is_bir_registered ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              </div>

              {/* TIN */}
              <div>
                <label className="label">TIN (Tax Identification Number)</label>
                <input
                  value={taxConfig.tin || ''}
                  onChange={(e) => handleTaxChange('tin', e.target.value)}
                  className="input-field"
                  placeholder="123-456-789-000"
                  maxLength={20}
                />
                <p className="text-xs mt-1" style={{ color: '#555' }}>Format: 123-456-789-000</p>
              </div>

              {/* Tax Type */}
              <div>
                <label className="label">Tax Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleTaxChange('tax_type', 'NON_VAT');
                      handleTaxChange('tax_rate', 0);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={taxConfig.tax_type === 'NON_VAT'
                      ? { background: '#CC0000', color: '#fff' }
                      : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    NON-VAT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleTaxChange('tax_type', 'VAT');
                      handleTaxChange('tax_rate', 12);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={taxConfig.tax_type === 'VAT'
                      ? { background: '#CC0000', color: '#fff' }
                      : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    VAT (12%)
                  </button>
                </div>
              </div>

              {/* Tax Rate */}
              <div>
                <label className="label">Tax Rate (%)</label>
                <input
                  type="number"
                  value={taxConfig.tax_rate}
                  onChange={(e) => handleTaxChange('tax_rate', e.target.value)}
                  className="input-field"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="12.00"
                />
                <p className="text-xs mt-1" style={{ color: '#555' }}>e.g. 12 for 12% VAT</p>
              </div>

              {/* Tax Mode */}
              <div>
                <label className="label">Tax Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTaxChange('tax_mode', 'EXCLUSIVE')}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={taxConfig.tax_mode === 'EXCLUSIVE'
                      ? { background: '#CC0000', color: '#fff' }
                      : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Exclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaxChange('tax_mode', 'INCLUSIVE')}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={taxConfig.tax_mode === 'INCLUSIVE'
                      ? { background: '#CC0000', color: '#fff' }
                      : { background: '#1a1a1a', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Inclusive
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: '#555' }}>
                  {taxConfig.tax_mode === 'EXCLUSIVE'
                    ? 'Tax is added on top of the price'
                    : 'Tax is already included in the price'}
                </p>
              </div>
            </div>

            {/* Tax Preview */}
            {taxConfig.tax_type === 'VAT' && Number(taxConfig.tax_rate) > 0 && (
              <div className="mt-4 rounded-xl p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" style={{ color: '#CC0000' }} />
                  <p className="text-sm font-medium text-white">Tax Preview (₱100 sample order)</p>
                </div>
                {(() => {
                  const preview = computeTaxPreview(100);
                  return (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg p-3" style={{ background: '#0d0d0d' }}>
                        <p className="text-xs" style={{ color: '#888' }}>Net Subtotal</p>
                        <p className="text-lg font-bold text-white">₱{preview.net.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg p-3" style={{ background: '#0d0d0d' }}>
                        <p className="text-xs" style={{ color: '#888' }}>Tax ({taxConfig.tax_rate}%)</p>
                        <p className="text-lg font-bold" style={{ color: '#CC0000' }}>₱{preview.tax.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg p-3" style={{ background: '#0d0d0d' }}>
                        <p className="text-xs" style={{ color: '#888' }}>Total</p>
                        <p className="text-lg font-bold text-white">₱{preview.total.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button onClick={handleTaxSave} disabled={taxSaving} className="btn-primary mt-4 flex items-center gap-2">
              {taxSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {taxSaving ? 'Saving...' : 'Save Tax Config'}
            </button>
          </>
        )}
      </div>

      {showMapPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={() => setShowMapPicker(false)}>
          <div
            className={`rounded-2xl shadow-2xl w-full ${mapFullscreen ? 'max-w-[98vw] h-[95vh]' : 'max-w-4xl h-[80vh]'} overflow-hidden flex flex-col`}
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h4 className="font-bold text-white">Pick Bar Location</h4>
                <p className="text-xs" style={{ color: '#888' }}>Click the map or drag the pin. Coordinates update automatically.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMapFullscreen((v) => !v)} className="btn-secondary text-xs px-3 py-1.5">
                  {mapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                <button type="button" onClick={() => setShowMapPicker(false)} className="btn-primary text-xs px-3 py-1.5">Done</button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d' }}>
              <div>
                <label className="label">Latitude</label>
                <input value={form.latitude || ''} onChange={(e) => handleChange('latitude', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input value={form.longitude || ''} onChange={(e) => handleChange('longitude', e.target.value)} className="input-field" />
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

export default BarManagement;
