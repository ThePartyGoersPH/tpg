import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fullName } from '../utils/dateHelpers';
import { imageUrl } from '../utils/imageUrl';

function ProfilePage() {
  const { user, updateProfile, changePassword, uploadProfilePicture } = useAuth();

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    date_of_birth: user?.date_of_birth || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const avatarUrl = useMemo(
    () => imageUrl(user?.profile_url || user?.profile_picture) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23161616' rx='60'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23444'%3E👤%3C/text%3E%3C/svg%3E`,
    [user]
  );

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await updateProfile(profileForm);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update profile.');
    }
  };

  const handlePasswordSave = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await changePassword(passwordForm);
      setMessage('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to change password.');
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setMessage('');

    try {
      await uploadProfilePicture(file);
      setMessage('Profile picture updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to upload profile picture.');
    }
  };

  const setProfileValue = (key, value) => setProfileForm((prev) => ({ ...prev, [key]: value }));
  const setPasswordValue = (key, value) => setPasswordForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid">
      <section className="card">
        <h1 className="section-title">Profile</h1>
        <p className="section-subtitle">Manage your account details and security settings.</p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <section className="grid two-col">
        <div className="card">
          <img className="avatar" src={avatarUrl} alt={fullName(user)} />
          <h3>{fullName(user)}</h3>
          <p className="section-subtitle">Role: {user?.role}</p>
          <label className="button ghost" htmlFor="avatar-upload">Upload profile picture</label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        </div>

        <form className="card" onSubmit={handleProfileSave}>
          <h3>Personal Information</h3>
          <div className="grid two-col">
            <input className="input" value={profileForm.first_name} onChange={(e) => setProfileValue('first_name', e.target.value)} placeholder="First name" />
            <input className="input" value={profileForm.last_name} onChange={(e) => setProfileValue('last_name', e.target.value)} placeholder="Last name" />
          </div>
          <input className="input" value={profileForm.email} onChange={(e) => setProfileValue('email', e.target.value)} placeholder="Email" type="email" />
          <input className="input" value={profileForm.phone_number} onChange={(e) => setProfileValue('phone_number', e.target.value)} placeholder="Phone number" />
          <input className="input" value={profileForm.date_of_birth || ''} onChange={(e) => setProfileValue('date_of_birth', e.target.value)} type="date" />
          <button className="button" type="submit">Save Profile</button>
        </form>
      </section>

      <form className="card" onSubmit={handlePasswordSave}>
        <h3>Change Password</h3>
        <div className="grid two-col">
          <input
            className="input"
            type="password"
            placeholder="Current password"
            value={passwordForm.current_password}
            onChange={(e) => setPasswordValue('current_password', e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            minLength={6}
            placeholder="New password"
            value={passwordForm.new_password}
            onChange={(e) => setPasswordValue('new_password', e.target.value)}
            required
          />
        </div>
        <button className="button" type="submit">Change Password</button>
      </form>
    </div>
  );
}

export default ProfilePage;
