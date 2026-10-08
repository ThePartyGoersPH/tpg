import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Plus, Trash2, X, Image, Pencil, Reply, EyeOff, Eye, CalendarDays, Flag } from 'lucide-react';
import { barApi } from '../api/barApi';
import { eventApi } from '../api/eventApi';
import { getUploadUrl } from '../api/apiClient';
import useAuthStore from '../stores/authStore';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const Social = () => {
  const [followers, setFollowers] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [comments, setComments] = useState({ post_comments: [], event_comments: [], media_comments: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('followers');
  const { user } = useAuthStore();

  // Create / Edit post state
  const [showPostModal, setShowPostModal] = useState(false);
  const [postMode, setPostMode] = useState('create'); // 'create' | 'edit'
  const [editingPost, setEditingPost] = useState(null);
  const [postType, setPostType] = useState('post'); // 'post' | 'event'
  const [newPost, setNewPost] = useState('');
  const [postImageFile, setPostImageFile] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);

  // Event form state (when postType === 'event')
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventEntryType, setEventEntryType] = useState('free');
  const [eventPrice, setEventPrice] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);

  // Reply modal
  const [replyModal, setReplyModal] = useState({ open: false, commentId: null, type: null, commentText: '', replyText: '' });

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null, extra: null });

  // Media comment reply state
  const [replyingToMedia, setReplyingToMedia] = useState(null);
  const [replyMediaText, setReplyMediaText] = useState('');
  const [replyMediaMentionPrefix, setReplyMediaMentionPrefix] = useState('');
  const [replyMediaMentionUserId, setReplyMediaMentionUserId] = useState(null);
  const [replyMediaMentionName, setReplyMediaMentionName] = useState('');
  const [commentsError, setCommentsError] = useState('');

  useEffect(() => { load(); }, []);

  const toArray = (value, keys = []) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }
    return [];
  };

  const safeFormat = (dateValue, pattern) => {
    if (!dateValue) return '\u2014';
    const date = parseUTC(dateValue);
    if (!date || Number.isNaN(date.getTime())) return '\u2014';
    return format(date, pattern);
  };

  const load = async () => {
    setCommentsError('');
    try {
      const [fRes, pRes, eRes, cRes] = await Promise.allSettled([
        barApi.getFollowers(),
        barApi.getPosts(),
        eventApi.list().catch(() => ({ data: { data: [] } })),
        barApi.getComments().catch(() => ({ data: { data: { post_comments: [], event_comments: [], media_comments: [] } } })),
      ]);

      if (fRes.status === 'fulfilled') {
        const payload = fRes.value.data?.data || fRes.value.data;
        setFollowerCount(Number(payload?.follower_count || 0));
        setFollowers(toArray(payload, ['recent_followers', 'followers', 'data', 'items']));
      } else {
        setFollowerCount(0);
        setFollowers([]);
      }

      if (pRes.status === 'fulfilled') {
        const payload = pRes.value.data?.data || pRes.value.data;
        setPosts(toArray(payload, ['posts', 'data', 'items']));
      } else {
        setPosts([]);
      }

      if (eRes.status === 'fulfilled') {
        const payload = eRes.value.data?.data || eRes.value.data;
        setEvents(toArray(payload, ['data', 'items', 'events']).filter(e => !e.archived_at));
      } else {
        setEvents([]);
      }

      if (cRes.status === 'fulfilled') {
        const payload = cRes.value.data?.data || cRes.value.data || {};
        setComments({
          post_comments: toArray(payload, ['post_comments']),
          event_comments: toArray(payload, ['event_comments']),
          media_comments: toArray(payload, ['media_comments']),
        });
      } else {
        setComments({ post_comments: [], event_comments: [], media_comments: [] });
        const msg = cRes.reason?.response?.data?.message || cRes.reason?.message || 'Failed to load comments';
        setCommentsError(msg);
      }

      if (fRes.status === 'rejected' && pRes.status === 'rejected' && eRes.status === 'rejected' && cRes.status === 'rejected') {
        setLoadError('Social data is unavailable right now.');
      } else {
        setLoadError('');
      }
    } catch {}
    finally { setLoading(false); }
  };

  // ── Post: open create ──
  const openCreate = () => {
    setPostMode('create');
    setEditingPost(null);
    setEditingEvent(null);
    setPostType('post');
    setNewPost('');
    setPostImageFile(null); setPostImagePreview(null);
    setEventTitle(''); setEventDate(''); setEventStart(''); setEventEnd('');
    setEventEntryType('free'); setEventPrice(''); setEventDesc('');
    setShowPostModal(true);
  };

  // ── Post: open edit ──
  const openEditPost = (post) => {
    setPostMode('edit');
    setEditingPost(post);
    setEditingEvent(null);
    setPostType('post');
    setNewPost(post.content || '');
    setPostImageFile(null);
    setPostImagePreview(post.image_path ? getUploadUrl(post.image_path) : null);
    setShowPostModal(true);
  };

  // ── Event: open edit ──
  const openEditEvent = (ev) => {
    setPostMode('edit');
    setEditingEvent(ev);
    setEditingPost(null);
    setPostType('event');
    setEventTitle(ev.title || '');
    setEventDate(ev.event_date ? String(ev.event_date).slice(0, 10) : '');
    setEventStart(ev.start_time || '');
    setEventEnd(ev.end_time || '');
    setEventEntryType(Number(ev.entry_price) > 0 ? 'paid' : 'free');
    setEventPrice(ev.entry_price ? String(ev.entry_price) : '');
    setEventDesc(ev.description || '');
    setNewPost('');
    setPostImageFile(null);
    setPostImagePreview(ev.image_path ? getUploadUrl(ev.image_path) : null);
    setShowPostModal(true);
  };

  const closeModal = () => {
    setShowPostModal(false);
    setPostImageFile(null); setPostImagePreview(null);
    setEditingPost(null); setEditingEvent(null);
  };

  // ── Submit: create or edit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (postType === 'post') {
      if (!newPost.trim() && !postImageFile && !postImagePreview) {
        toast.error('Post content or image is required');
        return;
      }
      setCreatingPost(true);
      try {
        if (postMode === 'edit' && editingPost) {
          await barApi.updatePost(editingPost.id, { content: newPost.trim() }, postImageFile || null);
          toast.success('Post updated');
        } else {
          await barApi.createPost({ bar_id: user?.bar_id, content: newPost.trim() }, postImageFile || null);
          toast.success('Post created');
        }
        setNewPost('');
        setPostImageFile(null); setPostImagePreview(null);
        setShowPostModal(false);
        setEditingPost(null);
        load();
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to save post');
      } finally { setCreatingPost(false); }
    } else {
      // Event
      if (!eventTitle.trim() || !eventDate) {
        toast.error('Event title and date are required');
        return;
      }
      setCreatingPost(true);
      try {
        const payload = {
          title: eventTitle.trim(),
          description: eventDesc.trim() || null,
          event_date: eventDate,
          start_time: eventStart || null,
          end_time: eventEnd || null,
          entry_price: eventEntryType === 'paid' ? (Number(eventPrice) || 0) : 0,
        };
        let eventId;
        if (postMode === 'edit' && editingEvent) {
          await eventApi.update(editingEvent.id, payload);
          eventId = editingEvent.id;
          toast.success('Event updated');
        } else {
          const res = await eventApi.create(payload);
          eventId = res.data?.data?.id || res.data?.id;
          toast.success('Event created');
        }
        if (postImageFile && eventId) {
          const fd = new FormData();
          fd.append('image', postImageFile);
          await eventApi.uploadImage(eventId, fd);
        }
        closeModal();
        load();
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to save event');
      } finally { setCreatingPost(false); }
    }
  };

  const handleDeletePost = (postId) => {
    setConfirmModal({ isOpen: true, type: 'post', id: postId, extra: null });
  };
  const executeDeletePost = async (postId) => {
    try { await barApi.deletePost(postId); toast.success('Post deleted'); load(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Failed to delete post'); }
  };

  const handleDeleteEvent = (eventId) => {
    setConfirmModal({ isOpen: true, type: 'event', id: eventId, extra: null });
  };
  const executeDeleteEvent = async (eventId) => {
    try { await eventApi.cancelOrArchive(eventId, 'archive'); toast.success('Event archived'); load(); } catch {}
  };

  // ── Comment actions ──
  const openReply = (type, comment) => {
    setReplyModal({ open: true, commentId: comment.id, type, commentText: comment.comment, replyText: '' });
  };

  const submitReply = async () => {
    const text = replyModal.replyText.trim();
    if (!text) { toast.error('Reply cannot be empty'); return; }
    try {
      if (replyModal.type === 'posts') {
        await barApi.replyToPostComment(replyModal.commentId, text);
      } else {
        await eventApi.replyToComment(replyModal.commentId, text);
      }
      toast.success('Reply sent');
      setReplyModal({ open: false, commentId: null, type: null, commentText: '', replyText: '' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send reply');
    }
  };

  const handleHidePostComment = async (commentId, isHidden) => {
    try {
      await barApi.hidePostComment(commentId, isHidden ? 'unhide' : 'hide');
      toast.success(isHidden ? 'Comment unhidden' : 'Comment hidden');
      load();
    } catch {}
  };

  const handleDeleteComment = (type, commentId) => {
    setConfirmModal({ isOpen: true, type: 'comment', id: commentId, extra: type });
  };
  const executeDeleteComment = async (type, commentId) => {
    try { await barApi.deleteComment(type, commentId); toast.success('Comment deleted'); load(); } catch {}
  };

  // Media comment moderation
  const handleHideMediaComment = async (commentId) => {
    try {
      const { data } = await barApi.hideMediaComment(commentId);
      toast.success(data?.data?.is_hidden ? 'Comment hidden' : 'Comment unhidden');
      load();
    } catch { toast.error('Failed to toggle hide'); }
  };
  const handleReportMediaComment = async (commentId) => {
    try {
      const { data } = await barApi.reportMediaComment(commentId);
      toast.success(data?.data?.reported ? 'Comment reported' : 'Report removed');
      load();
    } catch { toast.error('Failed to toggle report'); }
  };
  const handleDeleteMediaComment = (mediaId, commentId) => {
    setConfirmModal({ isOpen: true, type: 'media_comment', id: commentId, extra: mediaId });
  };
  const executeDeleteMediaComment = async (mediaId, commentId) => {
    try { await barApi.deleteMediaComment(mediaId, commentId); toast.success('Comment deleted'); load(); } catch {}
  };

  const handleMediaReplySubmit = async (mediaId, topParentId) => {
    if (!replyMediaText.trim()) return;
    const content = replyMediaText.trim();
    const mentionUserId = replyMediaMentionUserId;
    const mentionName = replyMediaMentionName || null;
    setReplyMediaText('');
    setReplyMediaMentionPrefix('');
    setReplyMediaMentionUserId(null);
    setReplyMediaMentionName('');
    setReplyingToMedia(null);
    try {
      await barApi.addMediaComment(mediaId, content, topParentId, mentionUserId, mentionName);
      toast.success('Reply posted');
      load();
    } catch {
      toast.error('Failed to post reply');
    }
  };

  const executeConfirm = async () => {
    const { type, id, extra } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, id: null, extra: null });
    if (type === 'post') await executeDeletePost(id);
    else if (type === 'event') await executeDeleteEvent(id);
    else if (type === 'comment') await executeDeleteComment(extra, id);
    else if (type === 'media_comment') await executeDeleteMediaComment(extra, id);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="card py-3" style={{ background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.2)' }}>
          <p className="text-sm" style={{ color: '#ff6666' }}>{loadError}</p>
        </div>
      )}

      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
        <button onClick={() => setTab('followers')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'followers' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Followers ({followerCount})
        </button>
        <button onClick={() => setTab('posts')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'posts' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Posts ({posts.length})
        </button>
        <button onClick={() => setTab('events')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'events' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Events ({events.length})
        </button>
        <button onClick={() => setTab('comments')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'comments' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Comments ({comments.post_comments.length + comments.event_comments.length + comments.media_comments.length})
        </button>
      </div>

      {tab === 'followers' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ borderBottom: '1px solid var(--m-border)' }}><tr>
                <th className="table-header">User</th>
                <th className="table-header">Email</th>
                <th className="table-header">Followed Since</th>
              </tr></thead>
              <tbody>
                {followers.map((f, i) => (
                  <tr key={f.id || i} className="transition-colors" style={{ borderBottom: '1px solid var(--m-border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(204,0,0,0.12)', color: '#CC0000' }}>
                          {f.first_name?.[0]}{f.last_name?.[0]}
                        </div>
                        <span className="font-medium text-white">{f.first_name} {f.last_name}</span>
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: '#888' }}>{f.email || '\u2014'}</td>
                    <td className="table-cell">{safeFormat(f.followed_at || f.created_at, 'MMM d, yyyy')}</td>
                  </tr>
                ))}
                {followers.length === 0 && <tr><td colSpan="3" className="text-center py-8" style={{ color: '#555' }}>No followers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Post
            </button>
          </div>

          {posts.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start gap-4">
                {p.image_path && (
                  <img src={getUploadUrl(p.image_path)} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: '#ccc', wordBreak: 'break-word' }}>{p.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs flex-wrap" style={{ color: '#666' }}>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {p.like_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {p.comment_count || 0}</span>
                    <span>{safeFormat(p.created_at, 'MMM d, yyyy h:mm a')}</span>
                    <span className={p.status === 'active' ? 'badge-success' : 'badge-gray'}>{p.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditPost(p)} className="p-2 rounded-lg transition-colors" style={{ color: '#888' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeletePost(p.id)} className="p-2 rounded-lg transition-colors" style={{ color: '#ff6666' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && <div className="card text-center py-12" style={{ color: '#555' }}>No posts yet. Create your first post to appear on the customer feed.</div>}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setPostType('event'); openCreate(); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Event
            </button>
          </div>

          {events.map((ev) => (
            <div key={ev.id} className="card">
              <div className="flex items-start gap-4">
                {ev.image_path && (
                  <img src={getUploadUrl(ev.image_path)} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm mb-1">{ev.title}</h4>
                  {ev.description && <p className="text-sm mb-2" style={{ color: '#888' }}>{ev.description}</p>}
                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: '#666' }}>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {ev.event_date ? safeFormat(ev.event_date, 'MMM d, yyyy') : '\u2014'} {ev.start_time ? `${ev.start_time} - ${ev.end_time || ''}` : ''}</span>
                    <span style={{ background: Number(ev.entry_price) > 0 ? 'rgba(204,0,0,0.12)' : 'rgba(74,222,128,0.1)', color: Number(ev.entry_price) > 0 ? '#f87171' : '#4ade80', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {Number(ev.entry_price) > 0 ? `\u20B1${Number(ev.entry_price).toLocaleString()}` : 'FREE'}
                    </span>
                    <span className={ev.status === 'active' ? 'badge-success' : 'badge-gray'}>{ev.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditEvent(ev)} className="p-2 rounded-lg transition-colors" style={{ color: '#888' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-lg transition-colors" style={{ color: '#ff6666' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Archive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && <div className="card text-center py-12" style={{ color: '#555' }}>No events yet. Create an event to announce it on the customer feed.</div>}
        </div>
      )}

      {tab === 'comments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {commentsError && (
            <div className="col-span-full card py-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-sm" style={{ color: '#fbbf24' }}>{commentsError}</p>
            </div>
          )}
          <div className="card">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">Post Comments <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--m-active-bg)', color: '#888' }}>{comments.post_comments.length}</span></h4>
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {comments.post_comments.map((c) => {
                const isHidden = c.status === 'hidden';
                return (
                  <div key={`p-${c.id}`} className="rounded-lg p-3" style={{ background: isHidden ? 'rgba(245,158,11,0.06)' : 'var(--m-surface-2)', border: isHidden ? '1px dashed rgba(245,158,11,0.3)' : '1px solid transparent', opacity: isHidden ? 0.6 : 1 }}>
                    {isHidden && <span className="text-xs font-semibold mb-1 inline-block" style={{ color: '#fbbf24' }}>HIDDEN</span>}
                    <p className="text-sm" style={{ color: '#ccc' }}>{c.comment}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs" style={{ color: '#555' }}>{c.first_name} {c.last_name} &middot; {safeFormat(c.created_at, 'MMM d, h:mm a')}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openReply('posts', c)} className="p-1.5 rounded transition-colors" style={{ color: '#888' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Reply">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleHidePostComment(c.id, isHidden)} className="p-1.5 rounded transition-colors" style={{ color: isHidden ? '#4ade80' : '#f59e0b' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title={isHidden ? 'Unhide' : 'Hide'}>
                          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDeleteComment('posts', c.id)} className="p-1.5 rounded transition-colors" style={{ color: '#ff6666' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {comments.post_comments.length === 0 && !commentsError && <p className="text-sm" style={{ color: '#555' }}>No post comments yet.</p>}
            </div>
          </div>

          <div className="card">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">Event Comments <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--m-active-bg)', color: '#888' }}>{comments.event_comments.length}</span></h4>
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {comments.event_comments.map((c) => (
                <div key={`e-${c.id}`} className="rounded-lg p-3" style={{ background: 'var(--m-surface-2)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: '#CC0000' }}>{c.event_title}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openReply('events', c)} className="p-1 rounded transition-colors" style={{ color: '#888' }} title="Reply">
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteComment('events', c.id)} className="p-1 rounded transition-colors" style={{ color: '#ff6666' }} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#ccc' }}>{c.comment}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: '#555' }}>
                    <span>{c.first_name} {c.last_name}</span>
                    <span>{safeFormat(c.created_at, 'MMM d, h:mm a')}</span>
                  </div>
                  {c.event_date && (
                    <div className="text-xs mt-1" style={{ color: '#555' }}>
                      Event: {safeFormat(c.event_date, 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              ))}
              {comments.event_comments.length === 0 && !commentsError && <p className="text-sm" style={{ color: '#555' }}>No event comments yet.</p>}
            </div>
          </div>

          <div className="card">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">Media Comments <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--m-active-bg)', color: '#888' }}>{comments.media_comments.length}</span></h4>
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {comments.media_comments.map((c) => {
                const isHidden = c.is_hidden;
                const isReported = c.reported;
                const isReply = !!c.parent_comment_id;
                const isOwnerComment = c.user_id === user?.id;
                return (
                  <div key={`m-${c.id}`} className="rounded-lg p-3"
                       style={{ background: isHidden ? 'rgba(245,158,11,0.06)' : 'var(--m-surface-2)',
                                border: isHidden ? '1px dashed rgba(245,158,11,0.3)' : isReported ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                                opacity: isHidden ? 0.6 : 1,
                                marginLeft: isReply ? '1rem' : '0' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: '#CC0000' }}>
                          {isReply ? 'Reply' : `${c.media_type === 'photo' ? 'Photo' : 'Video'} comment`}
                          {c.caption ? ` · ${c.caption}` : ''}
                        </span>
                        {isOwnerComment && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,118,47,0.15)', color: '#C9762F' }}>OWNER</span>}
                        {isHidden && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>HIDDEN</span>}
                        {isReported && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>REPORTED</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => {
                          if (replyingToMedia === c.id) {
                            setReplyingToMedia(null);
                            setReplyMediaText('');
                            setReplyMediaMentionPrefix('');
                            setReplyMediaMentionUserId(null);
                            setReplyMediaMentionName('');
                            return;
                          }
                          const authorName = `${c.first_name} ${c.last_name}`;
                          setReplyingToMedia(c.id);
                          setReplyMediaText('');
                          setReplyMediaMentionPrefix(`@${authorName} `);
                          setReplyMediaMentionUserId(c.user_id);
                          setReplyMediaMentionName(authorName);
                        }} className="p-1.5 rounded transition-colors" style={{ color: replyingToMedia === c.id ? '#C9762F' : '#888' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Reply">
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleHideMediaComment(c.id)} className="p-1.5 rounded transition-colors" style={{ color: isHidden ? '#4ade80' : '#f59e0b' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title={isHidden ? 'Unhide' : 'Hide'}>
                          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleReportMediaComment(c.id)} className="p-1.5 rounded transition-colors" style={{ color: isReported ? '#ef4444' : '#888' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m-active-bg)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title={isReported ? 'Unreport' : 'Report'}>
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteMediaComment(c.media_id, c.id)} className="p-1.5 rounded transition-colors" style={{ color: '#ff6666' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,100,100,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm mb-2" style={{ color: '#ccc' }}>
                      {c.mentioned_user_id && c.mentioned_user_name ? (
                        <>
                          <span style={{ color: '#C9762F', fontWeight: 700 }}>@{c.mentioned_user_name}</span>
                          {' '}{c.content}
                        </>
                      ) : (
                        c.content
                      )}
                    </p>
                    <div className="flex items-center justify-between text-xs" style={{ color: '#555' }}>
                      <span>{c.first_name} {c.last_name}</span>
                      <span>{safeFormat(c.created_at, 'MMM d, h:mm a')}</span>
                    </div>
                    {replyingToMedia === c.id && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={`${replyMediaMentionPrefix}${replyMediaText}`}
                          onChange={(e) => {
                            const full = e.target.value;
                            if (replyMediaMentionPrefix && full.startsWith(replyMediaMentionPrefix)) {
                              setReplyMediaText(full.slice(replyMediaMentionPrefix.length));
                            } else {
                              setReplyMediaText(full);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const topId = isReply ? (c.parent_comment_id || c.id) : c.id;
                              handleMediaReplySubmit(c.media_id, topId);
                            }
                          }}
                          placeholder={`Reply to ${c.first_name}...`}
                          autoFocus
                          className="flex-1 text-sm rounded-full px-3 py-1.5 outline-none"
                          style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)', color: '#fff' }}
                        />
                        <button onClick={() => {
                          const topId = isReply ? (c.parent_comment_id || c.id) : c.id;
                          handleMediaReplySubmit(c.media_id, topId);
                        }} disabled={!replyMediaText.trim()} className="p-1.5 rounded-full transition-colors" style={{ background: replyMediaText.trim() ? '#C9762F' : 'var(--m-surface-2)', color: replyMediaText.trim() ? '#fff' : '#555', cursor: replyMediaText.trim() ? 'pointer' : 'default' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {comments.media_comments.length === 0 && !commentsError && <p className="text-sm" style={{ color: '#555' }}>No media comments yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Post / Event Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <h4 className="font-bold text-white">
                {postMode === 'edit' ? (postType === 'event' ? 'Edit Event' : 'Edit Post') : (postType === 'event' ? 'Create Event' : 'Create Post')}
              </h4>
              <button onClick={closeModal} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = '#666'}><X className="w-5 h-5" /></button>
            </div>

            {postMode === 'create' && (
              <div className="flex gap-1 p-3" style={{ borderBottom: '1px solid var(--m-border)' }}>
                <button type="button" onClick={() => setPostType('post')} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={postType === 'post' ? { background: '#CC0000', color: '#fff' } : { background: 'var(--m-active-bg)', color: '#888' }}>
                  Post
                </button>
                <button type="button" onClick={() => setPostType('event')} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={postType === 'event' ? { background: '#CC0000', color: '#fff' } : { background: 'var(--m-active-bg)', color: '#888' }}>
                  Event
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {postType === 'post' ? (
                <>
                  <div>
                    <label className="label">Content</label>
                    <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} className="input-field h-28 resize-none" placeholder="Share updates with your followers..." required />
                  </div>
                  {postImagePreview && (
                    <div className="relative">
                      <img src={postImagePreview} alt="preview" className="w-full max-h-48 object-cover rounded-lg" />
                      <button type="button" onClick={() => { setPostImageFile(null); setPostImagePreview(null); }} className="absolute top-1 right-1 p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}><X className="w-3 h-3 text-white" /></button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: '#888' }}>
                    <Image className="w-4 h-4" />
                    <span>{postImagePreview ? 'Change photo' : 'Add photo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setPostImageFile(file);
                      setPostImagePreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }} />
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Event Title *</label>
                    <input type="text" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="input-field" placeholder="e.g. DJ Night: Electric Beats" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Date *</label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-field" required />
                    </div>
                    <div>
                      <label className="label">Entry</label>
                      <select value={eventEntryType} onChange={(e) => setEventEntryType(e.target.value)} className="input-field">
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Start Time</label>
                      <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="label">End Time</label>
                      <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  {eventEntryType === 'paid' && (
                    <div>
                      <label className="label">Price (\u20B1)</label>
                      <input type="number" min="0" step="0.01" value={eventPrice} onChange={(e) => setEventPrice(e.target.value)} className="input-field" placeholder="0.00" />
                    </div>
                  )}
                  <div>
                    <label className="label">Description</label>
                    <textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} className="input-field h-20 resize-none" placeholder="Tell followers about this event..." />
                  </div>
                  {postImagePreview && (
                    <div className="relative">
                      <img src={postImagePreview} alt="preview" className="w-full max-h-48 object-cover rounded-lg" />
                      <button type="button" onClick={() => { setPostImageFile(null); setPostImagePreview(null); }} className="absolute top-1 right-1 p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}><X className="w-3 h-3 text-white" /></button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: '#888' }}>
                    <Image className="w-4 h-4" />
                    <span>{postImagePreview ? 'Change cover' : 'Add cover image'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setPostImageFile(file);
                      setPostImagePreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }} />
                  </label>
                </>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creatingPost} className="btn-primary flex-1">{creatingPost ? 'Saving...' : (postMode === 'edit' ? 'Update' : (postType === 'event' ? 'Create Event' : 'Post'))}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReplyModal({ open: false, commentId: null, type: null, commentText: '', replyText: '' })}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <h4 className="font-bold text-white">Reply to Comment</h4>
              <button onClick={() => setReplyModal({ open: false, commentId: null, type: null, commentText: '', replyText: '' })} className="p-1 rounded-lg" style={{ color: '#666' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }}>
                <p className="text-sm" style={{ color: '#888' }}>"{replyModal.commentText}"</p>
              </div>
              <textarea value={replyModal.replyText} onChange={(e) => setReplyModal(prev => ({ ...prev, replyText: e.target.value }))} className="input-field h-24 resize-none" placeholder="Write your reply..." autoFocus />
              <div className="flex gap-3">
                <button onClick={() => setReplyModal({ open: false, commentId: null, type: null, commentText: '', replyText: '' })} className="btn-secondary flex-1">Cancel</button>
                <button onClick={submitReply} className="btn-primary flex-1">Send Reply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, id: null, extra: null })}
        onConfirm={executeConfirm}
        title={confirmModal.type === 'post' ? 'Delete Post?' : confirmModal.type === 'event' ? 'Archive Event?' : 'Delete Comment?'}
        message={confirmModal.type === 'post'
          ? 'This post will be archived along with all its comments.'
          : confirmModal.type === 'event'
          ? 'This event will be archived.'
          : 'This comment will be permanently deleted.'}
        confirmText={confirmModal.type === 'event' ? 'Archive' : 'Delete'}
        type="danger"
      />
    </div>
  );
};

export default Social;
