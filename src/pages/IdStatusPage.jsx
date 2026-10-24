import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

export default function IdStatusPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiClient.get('/auth/id-status');
        setStatus(res.data?.data?.status || 'pending_review');
        setRejectionReason(res.data?.data?.rejection_reason || '');
      } catch (err) {
        if (err?.response?.status === 401) {
          navigate('/login');
          return;
        }
        setStatus('unknown');
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [navigate]);

  if (loading) return <div className="auth-page"><p>Loading...</p></div>;

  const isPending = status === 'pending_review' || status === 'email_unverified';
  const isRejected = status === 'rejected';
  const isApproved = status === 'approved';

  if (isApproved) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="section-title">Verification status</h1>

        {isPending && (
          <>
            <p className="badge">Under review</p>
            <p>Your ID is under review. We'll email you when it's done.</p>
            <p className="section-subtitle">This usually takes 1-2 business days.</p>
          </>
        )}

        {isRejected && (
          <>
            <p className="badge error">Rejected</p>
            <p>Your ID was rejected: <strong>{rejectionReason || 'No reason provided'}</strong></p>
            <p className="section-subtitle">
              You can resubmit a new ID (max 3 attempts).
            </p>
            <Link to="/register" className="button">Resubmit ID</Link>
          </>
        )}

        {status === 'unknown' && (
          <p className="error">Could not load status. Please try again.</p>
        )}

        <p className="section-subtitle">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}