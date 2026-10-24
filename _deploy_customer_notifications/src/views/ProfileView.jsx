import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { fullName, timeAgo } from '../utils/dateHelpers';
import { imageUrl } from '../utils/imageUrl';
import apiClient from '../api/client';
import { CheckCircle, ShieldAlert, Star, MessageCircle } from 'lucide-react';

const CATEGORIES = ['general', 'ui_ux', 'performance', 'features', 'support', 'other'];

function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-sm" style={{ fontSize: '1.8rem', lineHeight: 1 }}>
      {[1,2,3,4,5].map(star => (
        <span
          key={star}
          style={{ cursor: readonly ? 'default' : 'pointer', color: star <= (hover || value) ? '#f5a623' : 'rgba(255,255,255,0.2)', transition: 'color 0.15s' }}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange(star)}
        >★</span>
      ))}
    </div>
  );
}

function ProfileView() {
  const { user, updateProfile, changePassword, uploadProfilePicture, logout } = useAuth();
  const { navigate } = useView();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleLogout = () => {
    logout();
    navigate(VIEWS.LANDING);
  };

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    date_of_birth: user?.date_of_birth ? user.date_of_birth.slice(0, 10) : '',
  });

  // Sync form when user data loads/changes (e.g. after login with fresh /me data)
  useEffect(() => {
    if (!user) return;
    setProfileForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      date_of_birth: user.date_of_birth ? user.date_of_birth.slice(0, 10) : '',
    });
  }, [user?.id, user?.date_of_birth, user?.first_name, user?.last_name, user?.phone_number]);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Platform Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackErr, setFeedbackErr] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const loadFeedbackHistory = async () => {
    setFeedbackLoading(true);
    try {
      const res = await apiClient.get('/platform-feedback/my');
      setFeedbackHistory(res.data?.data || []);
    } catch (_) {}
    finally { setFeedbackLoading(false); }
  };

  useEffect(() => { loadFeedbackHistory(); }, []);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackRating) { setFeedbackErr('Please select a star rating.'); return; }
    setFeedbackSubmitting(true); setFeedbackErr(''); setFeedbackMsg('');
    try {
      await apiClient.post('/platform-feedback', {
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
        category: feedbackCategory,
      });
      setFeedbackMsg('Thank you for your feedback!');
      setFeedbackRating(0); setFeedbackComment(''); setFeedbackCategory('general');
      loadFeedbackHistory();
    } catch (e) {
      setFeedbackErr(e?.response?.data?.message || 'Failed to submit feedback.');
    } finally { setFeedbackSubmitting(false); }
  };

  const avatarUrl = useMemo(
    () => imageUrl(user?.profile_url || user?.profile_picture) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23161616' rx='60'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='52' fill='%23444'%3E👤%3C/text%3E%3C/svg%3E`,
    [user]
  );

  const handleProfileSave = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const { email, ...editableFields } = profileForm;
      await updateProfile(editableFields);
      setMsg('Profile updated successfully.');
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to update profile.'); }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      await changePassword(passwordForm);
      setMsg('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (e) { setErr(e?.response?.data?.message || 'Failed to change password.'); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(''); setMsg('');
    try { await uploadProfilePicture(file); setMsg('Profile picture updated.'); }
    catch (e) { setErr(e?.response?.data?.message || 'Failed to upload picture.'); }
  };

  const pv = (key, val) => setProfileForm(p => ({ ...p, [key]: val }));

  return (
    <div className="flex flex-col gap-xl">
      {/* ── Profile Banner Header ── */}
      <section className="prof-banner animate-in">
        <div className="prof-banner-glow" />
        <div className="prof-banner-content">
          <img className="prof-avatar" src={avatarUrl} alt={fullName(user)} />
          <div className="prof-banner-info">
            <h1 className="prof-banner-name">{fullName(user)}</h1>
            <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
              <span className="bcard-pill" style={{ textTransform: 'uppercase' }}>{user?.role || 'customer'}</span>
              {user?.is_verified === 1 || user?.is_verified === true ? (
                <span className="badge-success" style={{ fontSize: '0.68rem' }}><CheckCircle size={11} /> Verified</span>
              ) : user?.is_verified === 0 ? (
                <span className="badge-warn" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><ShieldAlert size={11} /> Unverified</span>
              ) : null}
            </div>
            <p className="prof-banner-email">{user?.email}</p>
            <label className="btn btn-ghost btn-sm" htmlFor="avatar-upload" style={{ cursor: 'pointer', marginTop: '0.5rem' }}>
              Upload Picture
            </label>
            <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </div>
        </div>
      </section>

      {err && <div className="alert alert-err">{err}</div>}
      {msg && <div className="alert alert-info">{msg}</div>}

      {/* ── Personal Information Section ── */}
      <form className="prof-section glass-card" onSubmit={handleProfileSave}>
        <div className="prof-section-head">
          <span className="home-eyebrow">PERSONAL INFORMATION</span>
        </div>
        <div className="prof-section-body flex flex-col gap-md">
          <div className="g g-2">
            <input className="glass-input" placeholder="First name" value={profileForm.first_name} onChange={e => pv('first_name', e.target.value)} style={{ textTransform: 'capitalize' }} />
            <input className="glass-input" placeholder="Last name" value={profileForm.last_name} onChange={e => pv('last_name', e.target.value)} style={{ textTransform: 'capitalize' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="glass-input"
              type="email"
              value={profileForm.email}
              readOnly
              style={{ opacity: 0.5, cursor: 'not-allowed', paddingRight: '2.5rem' }}
            />
            {(user?.is_verified === 1 || user?.is_verified === true || user?.is_verified === 0) && (
              <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: (user?.is_verified === 1 || user?.is_verified === true) ? '#22c55e' : '#f59e0b', whiteSpace: 'nowrap' }}>
                {(user?.is_verified === 1 || user?.is_verified === true) ? <CheckCircle size={11} /> : <ShieldAlert size={11} />}
                {(user?.is_verified === 1 || user?.is_verified === true) ? 'Verified' : 'Unverified'}
              </span>
            )}
          </div>
          <input className="glass-input" placeholder="Phone number" value={profileForm.phone_number} onChange={e => pv('phone_number', e.target.value)} />
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>Date of Birth</label>
            <input
              className="glass-input"
              type="date"
              value={profileForm.date_of_birth || ''}
              onChange={e => pv('date_of_birth', e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            />
          </div>
          <button className="btn btn-red" type="submit">Save Profile</button>
        </div>
      </form>

      {/* ── Change Password Section ── */}
      <form className="prof-section glass-card" onSubmit={handlePasswordSave}>
        <div className="prof-section-head">
          <span className="home-eyebrow">CHANGE PASSWORD</span>
        </div>
        <div className="prof-section-body flex flex-col gap-md">
        <div className="g g-2">
          <input className="glass-input" type="password" placeholder="Current password" value={passwordForm.current_password} onChange={e => setPasswordForm(p => ({ ...p, current_password: e.target.value }))} required />
          <input className="glass-input" type="password" placeholder="New password" minLength={6} value={passwordForm.new_password} onChange={e => setPasswordForm(p => ({ ...p, new_password: e.target.value }))} required />
        </div>
          <button className="btn btn-red" type="submit">Change Password</button>
        </div>
      </form>

      {/* ── Feedback Section ── */}
      <div className="prof-section glass-card">
        <div className="prof-section-head">
          <span className="home-eyebrow">RATE THE PLATFORM</span>
          <p className="home-section-sub" style={{ marginTop: '0.25rem' }}>Share your experience with the TPG Bar Platform.</p>
        </div>
        <div className="prof-section-body flex flex-col gap-md">

        {feedbackErr && <div className="alert alert-err">{feedbackErr}</div>}
        {feedbackMsg && <div className="alert alert-info">{feedbackMsg}</div>}

        <form className="flex flex-col gap-md" onSubmit={handleFeedbackSubmit}>
          <div>
            <p className="text-label mb-sm">Your Rating</p>
            <StarRating value={feedbackRating} onChange={setFeedbackRating} />
          </div>

          <div>
            <p className="text-label mb-sm">Category</p>
            <select
              className="glass-input"
              value={feedbackCategory}
              onChange={e => setFeedbackCategory(e.target.value)}
              style={{ textTransform: 'capitalize' }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c.replace('_', ' / ')}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-label mb-sm">Comment (optional)</p>
            <textarea
              className="glass-input"
              placeholder="Tell us what you think about the platform..."
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          <button className="btn btn-red" type="submit" disabled={feedbackSubmitting}>
            {feedbackSubmitting ? 'Submitting...' : <><Star size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />Submit Feedback</>}
          </button>
        </form>

        {/* Feedback History */}
        {feedbackLoading ? (
          <div className="loading-state" style={{ padding: '1rem 0' }}><div className="spinner" /><span>Loading history...</span></div>
        ) : feedbackHistory.length > 0 && (
          <div className="flex flex-col gap-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <p className="text-label">Your Previous Feedback</p>
            {feedbackHistory.map(fb => (
              <div key={fb.id} className="glass-card" style={{ padding: '0.75rem 1rem' }}>
                <div className="flex justify-between items-center flex-wrap gap-sm">
                  <StarRating value={fb.rating} readonly />
                  <div className="flex gap-sm items-center">
                    <span className="badge-glass" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>{fb.category?.replace('_', ' / ')}</span>
                    {fb.status === 'resolved' && (
                      <span className="payment-status paid" style={{ fontSize: '0.7rem' }}>Resolved</span>
                    )}
                    {fb.status === 'reviewed' && (
                      <span className="payment-status approved" style={{ fontSize: '0.7rem' }}>Reviewed</span>
                    )}
                  </div>
                </div>
                {fb.comment && <p className="text-body mt-sm" style={{ fontSize: '0.85rem' }}>{fb.comment}</p>}
                <p className="text-dim mt-sm" style={{ fontSize: '0.72rem' }}>{timeAgo(fb.created_at)}</p>

                {fb.admin_reply && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    borderLeft: '3px solid rgba(220,38,38,0.6)',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '0 6px 6px 0',
                  }}>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.3rem' }}>
                      <MessageCircle size={12} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />Reply from {fb.replied_by_name || 'Support'}
                      {fb.replied_at && <span style={{ marginLeft: '0.4rem' }}>· {timeAgo(fb.replied_at)}</span>}
                    </p>
                    <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.85)', margin: 0 }}>{fb.admin_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="prof-section glass-card" style={{ border: '1px solid rgba(204,0,0,0.2)' }}>
        <div className="prof-section-head">
          <span className="home-eyebrow" style={{ color: '#FF4444' }}>DANGER ZONE</span>
          <p className="home-section-sub" style={{ marginTop: '0.25rem' }}>These actions are permanent. Please proceed with caution.</p>
        </div>
        <div className="prof-section-body">
          <div className="g g-2">
            <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 className="text-h4" style={{ marginBottom: '0.4rem' }}>Logout</h4>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>Sign out of your account on this device.</p>
              {!confirmLogout ? (
                <button className="btn btn-ghost" style={{ borderColor: 'rgba(204,0,0,0.4)', color: '#FF4444', width: '100%' }} onClick={() => setConfirmLogout(true)}>
                  Logout
                </button>
              ) : (
                <div className="flex gap-sm">
                  <button className="btn btn-red" style={{ flex: 1 }} onClick={handleLogout}>Confirm Logout</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLogout(false)}>Cancel</button>
                </div>
              )}
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 className="text-h4" style={{ marginBottom: '0.4rem' }}>Delete Account</h4>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>Permanently delete your account and all data. This cannot be undone.</p>
              {!confirmDelete ? (
                <button className="btn btn-ghost" style={{ borderColor: 'rgba(204,0,0,0.4)', color: '#FF4444', width: '100%' }} onClick={() => setConfirmDelete(true)}>
                  Delete Account
                </button>
              ) : (
                <div className="flex gap-sm flex-wrap">
                  <span className="text-muted" style={{ fontSize: '0.78rem', width: '100%' }}>To delete your account, please contact support at info@thepartygoersph.com</span>
                  <button className="btn btn-ghost btn-sm w-full" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileView;
