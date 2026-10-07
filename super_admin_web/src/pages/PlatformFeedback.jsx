import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { feedbackAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Star, MessageSquare, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlatformFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '' });
  const [replyModal, setReplyModal] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => { fetchAll(); }, [filters.status]);

  // Deep-link from notifications: /feedback?review=<id> scrolls to and
  // highlights that specific review.
  useEffect(() => {
    const rid = searchParams.get('review');
    if (rid) {
      setHighlightId(rid);
      searchParams.delete('review');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (highlightId && feedbacks.length) {
      const el = document.querySelector(`[data-review-id="${highlightId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const t = setTimeout(() => setHighlightId(null), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [highlightId, feedbacks]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [feedRes, statsRes] = await Promise.allSettled([
        feedbackAPI.getAll({ status: filters.status || undefined }),
        feedbackAPI.getStats()
      ]);
      if (feedRes.status === 'fulfilled' && feedRes.value.data.success) setFeedbacks(feedRes.value.data.data || []);
      if (statsRes.status === 'fulfilled' && statsRes.value.data.success) setStats(statsRes.value.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim()) { toast.error('Reply text is required'); return; }
    try {
      const r = await feedbackAPI.reply(replyModal.id, { reply: replyText });
      if (r.data.success) { toast.success('Reply posted'); setReplyModal(null); setReplyText(''); fetchAll(); }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const r = await feedbackAPI.updateStatus(id, { status });
      if (r.data.success) { toast.success('Status updated'); fetchAll(); }
    } catch (e) { toast.error('Failed'); }
  };

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    reviewed: 'bg-blue-500/20 text-blue-400',
    resolved: 'bg-green-500/20 text-green-400'
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`} />
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Feedback</h1>
        <p className="text-white/40 text-sm mt-1">Customer feedback and ratings</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-400"/>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Average Rating</p>
                <p className="text-lg font-bold text-white">{stats.average_rating || '0.00'}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-400"/>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Total Feedback</p>
                <p className="text-lg font-bold text-white">{stats.total_feedback || 0}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Filter className="h-5 w-5 text-green-400"/>
              </div>
              <div>
                <p className="text-[11px] text-white/40 uppercase">Distribution</p>
                <div className="flex gap-1">
                  {stats.rating_distribution?.map(r => (
                    <span key={r.rating} className="text-[10px] text-white/50">{r.rating}★:{r.count}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4">
        <select className="glass-input text-sm w-full md:w-48" value={filters.status} onChange={e=>setFilters({status:e.target.value})}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-white/30">Loading...</div>
        ) : feedbacks.length === 0 ? (
          <div className="glass-card p-8 text-center text-white/30">No feedback found</div>
        ) : feedbacks.map(f => (
          <div
            key={f.id}
            data-review-id={f.id}
            className={`glass-card p-5 space-y-3 transition ${String(f.id) === String(highlightId) ? 'ring-2 ring-red-500/70' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex gap-0.5">{renderStars(f.rating)}</div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[f.status]||'bg-gray-500/20 text-gray-400'}`}>
                    {f.status?.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-white/80 mb-1">{f.first_name} {f.last_name} • {f.email}</div>
                <div className="text-xs text-white/40 mb-2">{formatDateTime(f.created_at)} • {f.category}</div>
                <div className="text-sm text-white/70 bg-white/[0.03] p-3 rounded-lg">{f.comment || 'No comment'}</div>
                {f.admin_reply && (
                  <div className="mt-3 pl-4 border-l-2 border-blue-500/30">
                    <div className="text-[10px] text-blue-400 uppercase mb-1">Admin Reply</div>
                    <div className="text-sm text-white/70">{f.admin_reply}</div>
                    <div className="text-[10px] text-white/40 mt-1">{formatDateTime(f.replied_at)}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {!f.admin_reply && (
                  <button onClick={()=>{setReplyModal(f);setReplyText('');}} className="text-xs font-medium px-3 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                    Reply
                  </button>
                )}
                {f.status !== 'resolved' && (
                  <button onClick={()=>handleStatusChange(f.id, 'resolved')} className="text-xs font-medium px-3 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {replyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Reply to Feedback</h3>
              <button onClick={()=>setReplyModal(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex gap-1">{renderStars(replyModal.rating)}</div>
              <div className="text-white/60">{replyModal.first_name} {replyModal.last_name}</div>
              <div className="text-white/80 mt-2">{replyModal.comment || 'No comment'}</div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/50 mb-2">Your Reply</label>
              <textarea className="glass-input w-full text-sm min-h-[100px]" placeholder="Type your reply..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setReplyModal(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleReply} className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-blue-600 hover:bg-blue-700">Send Reply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
