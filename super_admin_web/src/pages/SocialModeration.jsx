import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { socialAPI } from '../api/services';
import { formatDateTime, formatCurrency } from '../utils/formatters';
import { MessageSquare, ThumbsUp, Trash2, Eye, AlertTriangle, Calendar, Users, DollarSign, XCircle, User } from 'lucide-react';
import { confirmDestructive, swalSuccess, swalError } from '../utils/swal';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.thepartygoers.fun';

export default function SocialModeration() {
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [takenDownItems, setTakenDownItems] = useState([]);
  const [commentReports, setCommentReports] = useState([]);
  const [eventComments, setEventComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventCommentsByEvent, setEventCommentsByEvent] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link from notifications: /social?tab=<tab> jumps straight to the
  // relevant moderation queue (e.g. reported-comments).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['posts', 'events', 'taken-down', 'reported-comments', 'event-comments'].includes(tab)) {
      setActiveTab(tab);
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => { 
    if (activeTab === 'posts') fetchPosts(); 
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'taken-down') fetchTakenDown();
    else if (activeTab === 'reported-comments') fetchCommentReports();
    else fetchEventComments(); 
  }, [activeTab]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getPosts({ status: 'active', limit: 100 });
      if (res.data.success) setPosts(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getEvents({ status: 'active', limit: 100 });
      if (res.data.success) setEvents(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchEventComments = async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getEventComments({ status: 'active', limit: 200 });
      if (res.data.success) setEventComments(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchCommentReports = async () => {
    setLoading(true);
    try {
      const res = await socialAPI.getCommentReports({ status: 'pending', limit: 200 });
      if (res.data.success) setCommentReports(res.data.data || []);
    } catch (e) {
      console.error(e);
      swalError('Failed to load reported comments');
    }
    finally { setLoading(false); }
  };

  const fetchTakenDown = async () => {
    setLoading(true);
    try {
      const [postsRes, eventsRes] = await Promise.all([
        socialAPI.getPosts({ status: 'deleted', limit: 100 }),
        socialAPI.getEvents({ status: 'cancelled', limit: 100 }),
      ]);

      const removedPosts = (postsRes.data?.data || []).map((post) => ({
        type: 'post',
        id: post.id,
        title: post.content,
        bar_name: post.bar_name,
        author_name: post.author_name,
        status: post.status,
        created_at: post.created_at,
      }));

      const removedEvents = (eventsRes.data?.data || []).map((event) => ({
        type: 'event',
        id: event.id,
        title: event.title,
        bar_name: event.bar_name,
        author_name: null,
        status: event.status,
        created_at: event.created_at,
      }));

      const merged = [...removedPosts, ...removedEvents].sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );

      setTakenDownItems(merged);
    } catch (e) {
      console.error(e);
      swalError('Failed to load taken down content');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeDownPost = async (postId) => {
    const ok = await confirmDestructive({
      title: 'Take down this post?',
      text: 'It will be hidden from all users.',
      confirmText: 'Take Down',
    });
    if (!ok) return;
    try {
      const r = await socialAPI.updatePostStatus(postId, { status: 'deleted' });
      if (r.data.success) { swalSuccess(r.data.message || 'Post taken down'); fetchPosts(); }
    } catch (e) { swalError(e.response?.data?.message || 'Failed to take down post'); }
  };

  const handleViewComments = async (post) => {
    try {
      const res = await socialAPI.getPostComments(post.id);
      if (res.data.success) {
        setPostComments(res.data.data || []);
        setSelectedPost(post);
      }
    } catch (e) { swalError('Failed to load comments'); }
  };

  const handleViewEventComments = async (event) => {
    try {
      const res = await socialAPI.getEventCommentsByEvent(event.id);
      if (res.data.success) {
        setEventCommentsByEvent(res.data.data || []);
        setSelectedEvent(event);
      }
    } catch (e) { swalError('Failed to load event comments'); }
  };

  const handleDeleteComment = async (commentId, isEventComment = false) => {
    const ok = await confirmDestructive({
      title: 'Delete this comment?',
      text: 'This action is permanent and cannot be undone.',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      let res;
      if (isEventComment) {
        res = await socialAPI.updateEventCommentStatus(commentId, { status: 'deleted' });
      } else {
        res = await socialAPI.deleteComment(commentId);
      }
      swalSuccess(res.data?.message || 'Comment deleted');
      if (isEventComment) {
        fetchEventComments();
        if (selectedEvent) handleViewEventComments(selectedEvent);
      }
      else if (selectedPost) handleViewComments(selectedPost);
    } catch (e) { swalError(e.response?.data?.message || 'Failed to delete comment'); }
  };

  const handleTakeDownEvent = async (eventId) => {
    const ok = await confirmDestructive({
      title: 'Take down this event?',
      text: 'It will be removed from the customer feed.',
      confirmText: 'Take Down',
    });
    if (!ok) return;
    try {
      const r = await socialAPI.updateEventStatus(eventId, { status: 'cancelled' });
      if (r.data.success) {
        swalSuccess(r.data.message || 'Event taken down');
        fetchEvents();
      }
    } catch (e) { swalError(e.response?.data?.message || 'Failed to take down event'); }
  };

  const handleFlagEventComment = async (commentId) => {
    try {
      const r = await socialAPI.updateEventCommentStatus(commentId, { status: 'flagged' });
      swalSuccess(r.data?.message || 'Comment flagged');
      fetchEventComments();
    } catch (e) { swalError(e.response?.data?.message || 'Failed to flag comment'); }
  };

  const handleDismissReport = async (reportId) => {
    const ok = await confirmDestructive({
      title: 'Dismiss this report?',
      text: 'The report will be marked as reviewed.',
      confirmText: 'Dismiss',
    });
    if (!ok) return;
    try {
      const r = await socialAPI.updateCommentReport(reportId, { action: 'dismiss' });
      swalSuccess(r.data?.message || 'Report dismissed');
      fetchCommentReports();
    } catch (e) {
      swalError(e.response?.data?.message || 'Failed to dismiss report');
    }
  };

  const handleRemoveReportedComment = async (report) => {
    const ok = await confirmDestructive({
      title: 'Remove this comment?',
      text: 'The comment will be deleted and related reports marked as reviewed. This cannot be undone.',
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      const r = await socialAPI.updateCommentReport(report.id, { action: 'remove_comment' });
      swalSuccess(r.data?.message || 'Comment removed');
      fetchCommentReports();
      if (selectedPost) handleViewComments(selectedPost);
      if (selectedEvent) handleViewEventComments(selectedEvent);
    } catch (e) {
      swalError(e.response?.data?.message || 'Failed to remove reported comment');
    }
  };

  const labelCommentType = (type) => {
    if (type === 'post_comment') return 'Post Comment';
    if (type === 'event_comment') return 'Event Comment';
    if (type === 'post_reply') return 'Post Reply';
    if (type === 'event_reply') return 'Event Reply';
    return type || '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Social Moderation</h1>
        <p className="text-white/40 text-sm mt-1">Moderate posts and comments across the platform</p>
      </div>

      <div className="flex gap-2 tab-pills-scroll">
        <button onClick={()=>setActiveTab('posts')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab==='posts'?'bg-red-600 text-white':'bg-white/5 text-white/60 hover:bg-white/10'}`}>
          Bar Posts
        </button>
        <button onClick={()=>setActiveTab('events')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab==='events'?'bg-red-600 text-white':'bg-white/5 text-white/60 hover:bg-white/10'}`}>
          Bar Events
        </button>
        <button onClick={()=>setActiveTab('taken-down')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab==='taken-down'?'bg-red-600 text-white':'bg-white/5 text-white/60 hover:bg-white/10'}`}>
          Taken Down
        </button>
        <button onClick={()=>setActiveTab('reported-comments')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab==='reported-comments'?'bg-red-600 text-white':'bg-white/5 text-white/60 hover:bg-white/10'}`}>
          Reported Comments
        </button>
        <button onClick={()=>setActiveTab('event-comments')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab==='event-comments'?'bg-red-600 text-white':'bg-white/5 text-white/60 hover:bg-white/10'}`}>
          Event Comments
        </button>
      </div>

      {activeTab === 'posts' && (
        <div className="space-y-3">
          {loading ? (
            <div className="glass-card p-8 text-center text-white/30">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="glass-card p-8 text-center text-white/30">No posts found</div>
          ) : posts.map(p => (
            <div key={p.id} className="glass-card p-5">
              <div className="flex items-start gap-4">
                {p.bar_logo ? (
                  <img src={`${API_URL}/${p.bar_logo.startsWith('/') ? p.bar_logo.slice(1) : p.bar_logo}`} alt="" className="w-12 h-12 rounded-lg object-cover"/>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/40 text-xs">No Logo</div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{p.bar_name}</span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/40">{formatDateTime(p.created_at)}</span>
                  </div>
                  <div className="text-xs text-white/50 mb-2">Posted by {p.author_name} ({p.author_email})</div>
                  <div className="text-sm text-white/80 mb-3">{p.content}</div>
                  {p.image_path && <img src={`${API_URL}${p.image_path}`} alt="" className="w-full max-w-md rounded-lg mb-3"/>}
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3"/>{p.like_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{p.comment_count || 0}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={()=>handleViewComments(p)} className="text-xs font-medium px-3 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center gap-1">
                    <Eye className="h-3 w-3"/>Comments
                  </button>
                  <button onClick={()=>handleTakeDownPost(p.id)} className="text-xs font-medium px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1">
                    <Trash2 className="h-3 w-3"/>Take Down
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-3">
          {loading ? (
            <div className="glass-card p-8 text-center text-white/30">Loading...</div>
          ) : events.length === 0 ? (
            <div className="glass-card p-8 text-center text-white/30">No events found</div>
          ) : events.map(e => (
            <div key={e.id} className="glass-card p-5">
              <div className="flex items-start gap-4">
                {e.bar_logo ? (
                  <img src={`${API_URL}/${e.bar_logo.startsWith('/') ? e.bar_logo.slice(1) : e.bar_logo}`} alt="" className="w-16 h-16 rounded-lg object-cover"/>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-white/40 text-xs">No Logo</div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-white">{e.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      e.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      e.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{e.status === 'cancelled' ? 'TAKEN DOWN' : e.status?.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-white/50 mb-2">{e.bar_name}</div>
                  <div className="text-sm text-white/70 mb-3">{e.description}</div>
                  {e.image_path && <img src={`${API_URL}${e.image_path}`} alt="" className="w-full max-w-md rounded-lg mb-3"/>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-white/50">
                      <Calendar className="h-4 w-4"/>
                      {new Date(e.event_date).toLocaleDateString()} {e.start_time}
                    </div>
                    <div className="flex items-center gap-2 text-white/50">
                      <Users className="h-4 w-4"/>
                      {e.current_bookings || 0}/{e.max_capacity} booked
                    </div>
                    {e.entry_price > 0 && (
                      <div className="flex items-center gap-2 text-white/50">
                        <DollarSign className="h-4 w-4"/>
                        {formatCurrency(e.entry_price)} entry
                      </div>
                    )}
                    <div className="text-white/40">
                      Posted {formatDateTime(e.created_at)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3"/>{e.like_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{e.comment_count || 0}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={()=>handleViewEventComments(e)} className="text-xs font-medium px-3 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center gap-1">
                    <Eye className="h-3 w-3"/>Comments
                  </button>
                  {e.status === 'active' && (
                    <button onClick={()=>handleTakeDownEvent(e.id)} className="text-xs font-medium px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1">
                      <XCircle className="h-3 w-3"/>Take Down Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'taken-down' && (
        <div className="glass-table">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-white/[0.06]">
                {['Type','Content','Bar','Author','Status','Taken Down At'].map(h=>(
                  <th key={h} className="px-5 py-3 text-[10px] font-semibold text-white/30 uppercase text-left">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
                ) : takenDownItems.length === 0 ? (
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">No taken down posts or events</td></tr>
                ) : takenDownItems.map(item => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-xs text-white/70 uppercase">{item.type}</td>
                    <td className="px-5 py-3 text-sm text-white/80 max-w-md truncate" title={item.title}>{item.title || '-'}</td>
                    <td className="px-5 py-3 text-xs text-white/60">{item.bar_name || '-'}</td>
                    <td className="px-5 py-3 text-xs text-white/60">{item.author_name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">TAKEN DOWN</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reported-comments' && (
        <div className="glass-table">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-white/[0.06]">
                {['When', 'Type', 'Comment', 'Commenter', 'Reported By', 'Reason', 'Context', 'Actions'].map(h=>(
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
                ) : commentReports.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">No pending reported comments</td></tr>
                ) : commentReports.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(r.reported_at)}</td>
                    <td className="px-5 py-3 text-xs text-white/70">{labelCommentType(r.comment_type)}</td>
                    <td className="px-5 py-3 text-xs text-white/70 max-w-xs" title={r.comment_text || 'Comment already removed'}>
                      <div className="truncate">{r.comment_text || 'Comment already removed'}</div>
                      {Number(r.pending_report_count || 0) > 1 && (
                        <div className="text-[10px] text-yellow-400 mt-1">{r.pending_report_count} pending reports</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-white/70">{r.comment_author_name || 'Unknown user'}</div>
                      <div className="text-[10px] text-white/40">{r.comment_author_email || '-'}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-white/70">{r.reporter_name}</div>
                      <div className="text-[10px] text-white/40">{r.reporter_email}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/70 max-w-[180px]" title={`${r.reason || '-'}${r.details ? `\n${r.details}` : ''}`}>
                      <div className="truncate">{r.reason || '-'}</div>
                      {r.details && <div className="text-[10px] text-white/40 truncate">{r.details}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50 max-w-[220px]" title={r.parent_content || r.event_title || r.bar_name || '-'}>
                      <div className="truncate">{r.bar_name || '-'}</div>
                      <div className="text-[10px] text-white/35 truncate">{r.event_title || r.parent_content || '-'}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDismissReport(r.id)}
                          className="text-xs font-medium px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleRemoveReportedComment(r)}
                          className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3"/>Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'event-comments' && (
        <div className="glass-table">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-white/[0.06]">
                {['Event','Bar','Commenter','Comment','Date','Actions'].map(h=>(
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
                ) : eventComments.length === 0 ? (
                  <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">No comments found</td></tr>
                ) : eventComments.map(c=>(
                  <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-sm text-white/80">{c.event_title}</td>
                    <td className="px-5 py-3 text-xs text-white/60">{c.bar_name}</td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-white/70">{c.commenter_name}</div>
                      <div className="text-[10px] text-white/40">{c.commenter_email}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/70 max-w-xs truncate">{c.comment}</td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(c.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === 'active' && (
                          <button onClick={()=>handleFlagEventComment(c.id)} className="text-xs font-medium px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">
                            <AlertTriangle className="h-3 w-3"/>
                          </button>
                        )}
                        <button onClick={()=>handleDeleteComment(c.id, true)} className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-3 w-3"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Post Comments</h3>
              <button onClick={()=>setSelectedPost(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <div className="text-sm font-bold text-white mb-1">{selectedPost.bar_name}</div>
              <div className="text-xs text-white/50 mb-2">{selectedPost.author_name}</div>
              <div className="text-sm text-white/70">{selectedPost.content}</div>
            </div>
            <div className="space-y-3">
              {postComments.length === 0 ? (
                <div className="text-center text-white/30 py-8">No comments on this post</div>
              ) : (() => {
                const topLevel = postComments.filter(c => !c.parent_comment_id);
                const buildThread = (parentId) => postComments.filter(c => c.parent_comment_id === parentId);
                
                return topLevel.map(c => (
                  <div key={c.id}>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {c.profile_picture ? (
                          <img src={`${API_URL}/${c.profile_picture}`} alt={c.commenter_name} className="w-8 h-8 rounded-full object-cover"/>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center">
                            <User className="h-4 w-4 text-white/40"/>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/80 mb-1">{c.commenter_name}</div>
                        <div className="text-sm text-white/70 mb-1">{c.comment}</div>
                        <div className="text-[10px] text-white/40">{formatDateTime(c.created_at)}</div>
                      </div>
                      <button onClick={()=>handleDeleteComment(c.id, false)} className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                        <Trash2 className="h-3 w-3"/>
                      </button>
                    </div>
                    {buildThread(c.id).map(reply => (
                      <div key={reply.id} className="ml-11 mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {reply.profile_picture ? (
                            <img src={`${API_URL}/${reply.profile_picture}`} alt={reply.commenter_name} className="w-7 h-7 rounded-full object-cover"/>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center">
                              <User className="h-3.5 w-3.5 text-white/30"/>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white/70 mb-1">{reply.commenter_name}</div>
                          <div className="text-sm text-white/60 mb-1">{reply.comment}</div>
                          <div className="text-[10px] text-white/30">{formatDateTime(reply.created_at)}</div>
                        </div>
                        <button onClick={()=>handleDeleteComment(reply.id, false)} className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-3 w-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Event Comments</h3>
              <button onClick={()=>setSelectedEvent(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <div className="text-sm font-bold text-white mb-1">{selectedEvent.title}</div>
              <div className="text-xs text-white/50 mb-2">{selectedEvent.bar_name}</div>
              <div className="text-sm text-white/70">{selectedEvent.description}</div>
            </div>
            <div className="space-y-3">
              {eventCommentsByEvent.length === 0 ? (
                <div className="text-center text-white/30 py-8">No comments on this event</div>
              ) : (() => {
                const topLevel = eventCommentsByEvent.filter(c => !c.parent_comment_id);
                const buildThread = (parentId) => eventCommentsByEvent.filter(c => c.parent_comment_id === parentId);
                
                return topLevel.map(c => (
                  <div key={c.id}>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {c.profile_picture ? (
                          <img src={`${API_URL}/${c.profile_picture}`} alt={c.commenter_name} className="w-8 h-8 rounded-full object-cover"/>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center">
                            <User className="h-4 w-4 text-white/40"/>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/80 mb-1">{c.commenter_name}</div>
                        <div className="text-sm text-white/70 mb-1">{c.comment}</div>
                        <div className="text-[10px] text-white/40">{formatDateTime(c.created_at)}</div>
                      </div>
                      <button onClick={()=>handleDeleteComment(c.id, true)} className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                        <Trash2 className="h-3 w-3"/>
                      </button>
                    </div>
                    {buildThread(c.id).map(reply => (
                      <div key={reply.id} className="ml-11 mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {reply.profile_picture ? (
                            <img src={`${API_URL}/${reply.profile_picture}`} alt={reply.commenter_name} className="w-7 h-7 rounded-full object-cover"/>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center">
                              <User className="h-3.5 w-3.5 text-white/30"/>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white/70 mb-1">{reply.commenter_name}</div>
                          <div className="text-sm text-white/60 mb-1">{reply.comment}</div>
                          <div className="text-[10px] text-white/30">{formatDateTime(reply.created_at)}</div>
                        </div>
                        <button onClick={()=>handleDeleteComment(reply.id, true)} className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-3 w-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
