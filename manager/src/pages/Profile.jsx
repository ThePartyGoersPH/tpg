import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Loader2, User, Mail, Phone, Calendar, Key, Pencil, X, Camera } from 'lucide-react';
import Cropper from 'react-easy-crop';
import useAuthStore from '../stores/authStore';
import { getUploadUrl } from '../api/apiClient';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { getCroppedImg } from '../utils/cropImage';

const Profile = () => {
  const { user, fetchUser } = useAuthStore();
  const [tab, setTab] = useState('info');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const fileInputRef = useRef(null);

  // Crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone_number: user?.phone_number || '',
    date_of_birth: user?.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
        date_of_birth: user.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
      });
    }
  }, [user?.first_name, user?.last_name, user?.phone_number, user?.date_of_birth]);

  useEffect(() => {
    return () => { if (cropImageSrc) URL.revokeObjectURL(cropImageSrc); };
  }, [cropImageSrc]);

  if (!user) return null;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      const response = await apiClient.post('/owner/change-password', { currentPassword, newPassword });
      if (response.data.success) {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleEdit = () => {
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      date_of_birth: user.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
    });
    setValidationErrors({});
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      date_of_birth: user.date_of_birth ? String(user.date_of_birth).slice(0, 10) : '',
    });
    setValidationErrors({});
  };

  const validatePhone = (phone) => {
    const trimmed = phone.trim();
    if (trimmed === '') return null;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) return 'Phone must be 10-11 digits';
    return null;
  };

  const validateDateOfBirth = (dob) => {
    if (!dob) return null;
    const date = new Date(dob);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (isNaN(date.getTime())) return 'Invalid date';
    if (date > today) return 'Date of birth must be in the past';
    const minAge = 18;
    const minDate = new Date();
    minDate.setHours(0,0,0,0);
    minDate.setFullYear(minDate.getFullYear() - minAge);
    if (date > minDate) return `You must be at least ${minAge} years old`;
    return null;
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!form.first_name.trim()) errors.first_name = 'First name is required';
    else if (form.first_name.trim().length > 50) errors.first_name = 'Max 50 characters';
    if (!form.last_name.trim()) errors.last_name = 'Last name is required';
    else if (form.last_name.trim().length > 50) errors.last_name = 'Max 50 characters';
    const phoneError = validatePhone(form.phone_number);
    if (phoneError) errors.phone_number = phoneError;
    const dobError = validateDateOfBirth(form.date_of_birth);
    if (dobError) errors.date_of_birth = dobError;
    if (Object.keys(errors).length) {
      setValidationErrors(errors);
      const first = Object.values(errors)[0];
      if (first) toast.error(first);
      return;
    }
    setValidationErrors({});
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: form.phone_number.trim() || null,
        date_of_birth: form.date_of_birth || null,
      };
      const response = await apiClient.patch('/auth/me/profile', payload);
      if (response.data.success !== false) {
        toast.success('Profile updated successfully');
        setEditing(false);
        await fetchUser();
      } else {
        toast.error(response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar crop flow ──
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    const url = URL.createObjectURL(file);
    setCropImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropModalOpen(true);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;
    setUploadingAvatar(true);
    try {
      const blob = await getCroppedImg(cropImageSrc, croppedAreaPixels, { width: croppedAreaPixels.width, height: croppedAreaPixels.height });
      const fd = new FormData();
      fd.append('profile_picture', blob, 'avatar.jpg');
      await apiClient.post('/auth/me/profile-picture', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile picture updated');
      setCropModalOpen(false);
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      await fetchUser();
    } catch (err) {
      toast.error('Failed to upload cropped image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    if (cropImageSrc) { URL.revokeObjectURL(cropImageSrc); setCropImageSrc(null); }
  };

  const displayAvatar = user.profile_picture ? getUploadUrl(user.profile_picture) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card flex flex-col sm:flex-row items-center gap-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden flex-shrink-0 relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
          style={{ background: '#CC0000' }}
          title="Change avatar"
          aria-label="Change avatar"
        >
          {displayAvatar ? (
            <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
          )}
          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <div>
          <h2 className="text-2xl font-bold text-white">{user.first_name} {user.last_name}</h2>
          <p className="capitalize" style={{ color: '#888' }}>{user.role?.replace('_', ' ')}</p>
          <p className="text-sm mt-1" style={{ color: '#666' }}>{user.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
        <button onClick={() => setTab('info')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'info' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Information</button>
        <button onClick={() => setTab('security')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'security' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Security</button>
      </div>

      {tab === 'info' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Personal Information</h3>
            {!editing ? (
              <button onClick={handleEdit} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)', color: '#fff' }}>
                <Pencil className="w-4 h-4" /> Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'transparent', border: '1px solid var(--m-border)', color: '#aaa' }}>
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#CC0000' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input-field" autoComplete="off" required maxLength={50} />
                  {validationErrors.first_name && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{validationErrors.first_name}</p>}
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input-field" autoComplete="off" required maxLength={50} />
                  {validationErrors.last_name && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{validationErrors.last_name}</p>}
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="input-field" autoComplete="off" placeholder="09xxxxxxxxx" />
                  {validationErrors.phone_number && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{validationErrors.phone_number}</p>}
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="input-field" max={new Date().toISOString().slice(0,10)} />
                  {validationErrors.date_of_birth && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{validationErrors.date_of_birth}</p>}
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={user.email} disabled className="input-field opacity-60 cursor-not-allowed" autoComplete="off" />
                  <p className="text-xs mt-1" style={{ color: '#666' }}>Contact support to change your email.</p>
                </div>
                <div>
                  <label className="label">Role</label>
                  <input value={user.role?.replace('_', ' ') || ''} disabled className="input-field opacity-60 cursor-not-allowed capitalize" />
                  <p className="text-xs mt-1" style={{ color: '#666' }}>Role changes via Staff Management only.</p>
                </div>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--m-surface-2)' }}>
                  <User className="w-5 h-5" style={{ color: '#555' }} />
                  <div>
                    <p className="text-xs" style={{ color: '#666' }}>Full Name</p>
                    <p className="text-sm font-medium text-white">{user.first_name} {user.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--m-surface-2)' }}>
                  <Mail className="w-5 h-5" style={{ color: '#555' }} />
                  <div>
                    <p className="text-xs" style={{ color: '#666' }}>Email</p>
                    <p className="text-sm font-medium text-white">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--m-surface-2)' }}>
                  <Phone className="w-5 h-5" style={{ color: '#555' }} />
                  <div>
                    <p className="text-xs" style={{ color: '#666' }}>Phone</p>
                    <p className="text-sm font-medium text-white">{user.phone_number || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--m-surface-2)' }}>
                  <Calendar className="w-5 h-5" style={{ color: '#555' }} />
                  <div>
                    <p className="text-xs" style={{ color: '#666' }}>Date of Birth</p>
                    <p className="text-sm font-medium text-white">{user.date_of_birth ? String(user.date_of_birth).slice(0,10) : '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--m-surface-2)' }}>
                <p className="text-xs" style={{ color: '#666' }}>Role</p>
                <p className="text-sm font-medium text-white capitalize">{user.role?.replace('_', ' ')}</p>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.1)' }}>
              <Key className="w-5 h-5" style={{ color: '#CC0000' }} />
            </div>
            <div>
              <h3 className="font-bold text-white">Change Password</h3>
              <p className="text-xs" style={{ color: '#666' }}>Update your account password</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" disabled={changingPassword} />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" disabled={changingPassword} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" disabled={changingPassword} />
            </div>
            <button type="submit" disabled={changingPassword} className="btn-primary flex items-center justify-center gap-2">
              {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* ── Crop Modal ── */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="bg-[var(--m-surface-2)] rounded-xl p-5 w-full max-w-lg mx-4" style={{ border: '1px solid var(--m-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Crop Profile Picture</h3>
              <button onClick={handleCropCancel} disabled={uploadingAvatar} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="relative w-full h-72 rounded-lg overflow-hidden mb-4" style={{ background: '#111' }}>
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
              />
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium" style={{ color: '#888' }}>Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full mt-1 accent-[#CC0000]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={handleCropCancel} disabled={uploadingAvatar} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'transparent', border: '1px solid var(--m-border)', color: '#aaa' }}>
                Cancel
              </button>
              <button onClick={handleCropSave} disabled={uploadingAvatar} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: '#CC0000' }}>
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {uploadingAvatar ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
