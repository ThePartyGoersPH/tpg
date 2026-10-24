import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Send, Loader2 } from 'lucide-react';
import { reviewApi } from '../api/reviewApi';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [revRes, statsRes] = await Promise.all([reviewApi.list(), reviewApi.stats()]);
      setReviews(revRes.data.data || revRes.data || []);
      setStats(statsRes.data.data || statsRes.data || null);
    } catch (err) {
      console.error('Failed to load reviews:', err);
      toast.error('Failed to load reviews');
      setReviews([]);
      setStats(null);
    } finally { setLoading(false); }
  };

  const handleRespond = async (id) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await reviewApi.respond(id, replyText);
      toast.success('Response sent!');
      setReplyingTo(null);
      setReplyText('');
      load();
    } catch {} finally { setSaving(false); }
  };

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? 'fill-amber-400 text-amber-400' : ''}`} style={s <= rating ? {} : { color: '#333' }} />
      ))}
    </div>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="card py-4 text-center">
            <p className="text-2xl font-extrabold text-white">{stats.total_reviews || 0}</p>
            <p className="text-xs" style={{ color: '#888' }}>Total Reviews</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-extrabold" style={{ color: '#fbbf24' }}>{Number(stats.avg_rating || 0).toFixed(1)}</p>
            <p className="text-xs" style={{ color: '#888' }}>Avg Rating</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-extrabold" style={{ color: '#4ade80' }}>{stats.five_star || 0}</p>
            <p className="text-xs" style={{ color: '#888' }}>5-Star</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-extrabold" style={{ color: '#CC0000' }}>{stats.responded_count || 0}</p>
            <p className="text-xs" style={{ color: '#888' }}>Responded</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-2xl font-extrabold" style={{ color: '#888' }}>{stats.unresponded_count || 0}</p>
            <p className="text-xs" style={{ color: '#888' }}>Unresponded</p>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'rgba(204,0,0,0.2)' }}>
                  {r.first_name?.[0]}{r.last_name?.[0]}
                </div>
                <div>
                  <p className="font-medium text-white">{r.first_name} {r.last_name}</p>
                  <p className="text-xs" style={{ color: '#666' }}>{r.review_date ? format(parseUTC(r.review_date), 'MMM d, yyyy') : ''}</p>
                </div>
              </div>
              {renderStars(r.rating)}
            </div>
            {r.review && <p className="mt-3 text-sm" style={{ color: '#ccc' }}>{r.review}</p>}

            {/* Existing Response */}
            {r.response && (
              <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(204,0,0,0.06)', borderLeft: '3px solid #CC0000' }}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold" style={{ color: '#CC0000' }}>Your Response</p>
                  {r.responder_role && String(r.responder_role).toLowerCase() === 'bar_owner' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#CC0000' }}>
                      Bar Owner
                    </span>
                  )}
                  {r.responder_name && (
                    <span className="text-xs" style={{ color: '#666' }}>• {r.responder_name}</span>
                  )}
                </div>
                <p className="text-sm" style={{ color: '#ccc' }}>{r.response}</p>
              </div>
            )}

            {/* Reply Action */}
            {replyingTo === r.id ? (
              <div className="mt-3 flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your response..." className="input-field flex-1" autoFocus />
                <button onClick={() => handleRespond(r.id)} disabled={saving} className="btn-primary flex items-center gap-1 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
                <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="btn-secondary text-sm">Cancel</button>
              </div>
            ) : (
              <button onClick={() => { setReplyingTo(r.id); setReplyText(r.response || ''); }} className="mt-3 text-sm flex items-center gap-1" style={{ color: '#CC0000' }}>
                <MessageCircle className="w-3.5 h-3.5" /> {r.response ? 'Edit Response' : 'Respond'}
              </button>
            )}
          </div>
        ))}
        {reviews.length === 0 && <div className="card text-center py-12" style={{ color: '#555' }}>No reviews yet.</div>}
      </div>
    </div>
  );
};

export default Reviews;
