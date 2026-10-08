import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import { Heart, MessageCircle, Users, PartyPopper, Plus, Edit2, Trash2, X, Loader2, Search, Image } from 'lucide-react';
import { eventApi } from '../api/eventApi';
import { socialApi } from '../api/socialApi';
import { barApi } from '../api/barApi';
import { subscriptionApi } from '../api/subscriptionApi';
import { getUploadUrl } from '../api/apiClient';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const Events = () => {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [archivedPosts, setArchivedPosts] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [postImageFile, setPostImageFile] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [eventImagePreview, setEventImagePreview] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', event_type: '', description: '', event_date: '', start_time: '', end_time: '', entry_price: '', max_capacity: '' });
  const [detailModal, setDetailModal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLiked, setDetailLiked] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, eventId: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [subInfo, setSubInfo] = useState(null);
  const { hasPermission: can, user } = useAuthStore();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [eventsRes, subRes] = await Promise.allSettled([
        eventApi.list(),
        subscriptionApi.getMySubscription(),
      ]);

      if (subRes.status === 'fulfilled') {
        const subData = subRes.value.data?.data || subRes.value.data;
        setSubInfo(subData);
      }

      const { data } = eventsRes.status === 'fulfilled' ? eventsRes.value : { data: { data: [] } };
      const payload = data.data || data;
      const list = Array.isArray(payload) ? payload : (payload.events || payload.data || []);
      setEvents(list);

      // Enrich list counts from details endpoint (list endpoint may omit computed counters)
      if (Array.isArray(list) && list.length > 0) {
        const detailResults = await Promise.allSettled(
          list.map((ev) => eventApi.getDetails(ev.id))
        );

        const countsById = {};
        detailResults.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          const eventId = list[index]?.id;
          if (!eventId) return;
          const detailPayload = result.value.data?.data || result.value.data;
          const detailEvent = detailPayload?.event || detailPayload;
          countsById[eventId] = {
            like_count: Number(detailEvent?.like_count || 0),
            comment_count: Number(detailEvent?.comment_count || 0),
          };
        });

        setEvents((prev) => prev.map((ev) => ({
          ...ev,
          like_count: countsById[ev.id]?.like_count ?? Number(ev.like_count || 0),
          comment_count: countsById[ev.id]?.comment_count ?? Number(ev.comment_count || 0),
        })));
      }

      setLoadError('');
    } catch (err) {
      setEvents([]);
      setLoadError(err.response?.data?.message || 'Events data is unavailable right now.');
    } finally { setLoading(false); }
  };

  const filtered = events.filter((e) =>
    e.title?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', event_type: '', description: '', event_date: '', start_time: '', end_time: '', entry_price: '', max_capacity: '' });
    setEventImageFile(null); setEventImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title, event_type: ev.event_type || '', description: ev.description || '', event_date: ev.event_date?.split('T')[0] || '',
      start_time: ev.start_time || '', end_time: ev.end_time || '',
      entry_price: ev.entry_price || '', max_capacity: ev.max_capacity || '',
    });
    setEventImageFile(null);
    setEventImagePreview(ev.image_path ? null : null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, entry_price: Number(form.entry_price) || 0, max_capacity: Number(form.max_capacity) || 0 };
      let eventId;
      if (editing) {
        await eventApi.update(editing.id, payload);
        eventId = editing.id;
        toast.success('Event updated!');
      } else {
        const { data } = await eventApi.create(payload);
        eventId = data?.data?.id || data?.id;
        toast.success('Event created!');
      }
      if (eventImageFile && eventId) {
        const fd = new FormData(); fd.append('image', eventImageFile);
        await eventApi.uploadImage(eventId, fd);
      }
      setShowModal(false);
      setEventImageFile(null); setEventImagePreview(null);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleCancel = (id) => {
    setConfirmModal({
      isOpen: true,
      action: 'cancel',
      eventId: id,
      title: 'Cancel Event?',
      message: 'This will cancel the event. This action can be undone.',
      type: 'warning'
    });
  };

  const handleArchive = (id) => {
    setConfirmModal({
      isOpen: true,
      action: 'archive',
      eventId: id,
      title: 'Archive Event?',
      message: 'This will move the event to archives. You can restore it later if needed.',
      type: 'info'
    });
  };

  const executeAction = async () => {
    if (!confirmModal.eventId) return;
    setActionLoading(true);
    try {
      await eventApi.cancelOrArchive(confirmModal.eventId, confirmModal.action);
      toast.success(`Event ${confirmModal.action}d successfully`);
      setConfirmModal({ isOpen: false, action: null, eventId: null });
      load();
      if (confirmModal.action === 'archive') {
        loadArchived();
      }
    } catch (err) {
      toast.error(`Failed to ${confirmModal.action} event`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImageUpload = (ev) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const fd = new FormData(); fd.append('image', file);
      await eventApi.uploadImage(ev.id, fd);
      toast.success('Event image uploaded!'); load();
    };
    input.click();
  };

  const openDetail = async (ev) => {
    setDetailModal({ ...ev, comments: [] });
    setDetailLiked(false);
    setCommentInput('');
    setDetailLoading(true);
    try {
      const { data } = await eventApi.getDetails(ev.id);
      const payload = data.data || data;
      const eventData = payload?.event || payload || ev;
      const comments = Array.isArray(payload?.comments)
        ? payload.comments
        : Array.isArray(eventData?.comments)
          ? eventData.comments
          : [];

      setDetailModal({
        ...eventData,
        comments,
      });
    } catch {
      toast.error('Failed to load event details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReply = async (commentId, reply) => {
    try {
      await eventApi.replyToComment(commentId, reply);
      toast.success('Reply added!');
      // Refresh the event details to show the new reply
      if (detailModal?.id) {
        await openDetail(detailModal);
      }
      // Reload events list to update comment counts
      load();
    } catch (err) {
      toast.error('Failed to add reply');
      console.error('Reply error:', err);
    }
  };

  const humanizeStatus = (status) => {
    const map = {
      active: 'Active',
      cancelled: 'Cancelled',
      archived: 'Archived',
      draft: 'Draft',
    };
    return map[status] || status;
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const { data } = await barApi.getPosts();
      const payload = data.data || data;
      setPosts(Array.isArray(payload) ? payload : (payload.posts || []));
    } catch { setPosts([]); } finally { setPostsLoading(false); }
  };

  const loadArchived = async () => {
    setArchivedLoading(true);
    try {
      const [{ data: eventsData }, { data: postsData }] = await Promise.all([
        eventApi.listArchived(),
        barApi.getArchivedPosts(),
      ]);

      const archivedEventPayload = eventsData.data || eventsData;
      const archivedPostPayload = postsData.data || postsData;

      setArchivedEvents(Array.isArray(archivedEventPayload) ? archivedEventPayload : (archivedEventPayload.events || []));
      setArchivedPosts(Array.isArray(archivedPostPayload) ? archivedPostPayload : (archivedPostPayload.posts || []));
    } catch {
      setArchivedEvents([]);
      setArchivedPosts([]);
    } finally {
      setArchivedLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const text = newPost.trim();
    if (!text) return;
    setCreatingPost(true);
    try {
      await barApi.createPost({ content: text }, postImageFile || null);
      toast.success('Post created!');
      setNewPost('');
      setPostImageFile(null); setPostImagePreview(null);
      loadPosts();
    } catch { toast.error('Failed to create post'); } finally { setCreatingPost(false); }
  };

  const handleDeletePost = async (postId) => {
    try {
      await barApi.deletePost(postId);
      toast.success('Post archived');
      loadPosts();
      loadArchived();
    } catch { toast.error('Failed to delete post'); }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmModal({
      isOpen: true,
      action: 'deleteComment',
      eventId: commentId,
      title: 'Delete Comment?',
      message: 'This comment will be permanently deleted. This action cannot be undone.',
      type: 'danger'
    });
  };

  const executeDeleteComment = async () => {
    setActionLoading(true);
    try {
      await eventApi.deleteComment(confirmModal.eventId);
      toast.success('Comment deleted');
      setConfirmModal({ isOpen: false, action: null, eventId: null });
      if (detailModal) await openDetail(detailModal);
      else load();
    } catch (err) {
      toast.error('Failed to delete comment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = () => {
    if (confirmModal.action === 'deleteComment') executeDeleteComment();
    else executeAction();
  };

  const handleToggleLike = async () => {
    if (!detailModal?.id) return;
    try {
      const currentLiked = detailLiked;
      let nextCount;
      if (currentLiked) {
        const { data } = await socialApi.unlikeEvent(detailModal.id);
        nextCount = Number(data?.likeCount ?? Math.max(0, Number(detailModal.like_count || 1) - 1));
        setDetailLiked(false);
      } else {
        const { data } = await socialApi.likeEvent(detailModal.id);
        nextCount = Number(data?.likeCount ?? Number(detailModal.like_count || 0) + 1);
        setDetailLiked(true);
      }

      setDetailModal((prev) => ({ ...prev, like_count: nextCount }));
      setEvents((prev) => prev.map((ev) =>
        ev.id === detailModal.id ? { ...ev, like_count: nextCount } : ev
      ));
    } catch {}
  };

  const handleAddComment = async () => {
    const text = commentInput.trim();
    if (!detailModal?.id || !text) return;
    try {
      const { data } = await socialApi.addEventComment(detailModal.id, text);
      const created = data?.data || data?.comment || null;
      const nextCount = Number(data?.commentCount ?? Number(detailModal.comment_count || 0) + 1);

      if (created) {
        setDetailModal((prev) => ({
          ...prev,
          comment_count: nextCount,
          comments: [
            { ...created, replies: created.replies || [] },
            ...(Array.isArray(prev.comments) ? prev.comments : []),
          ],
        }));
      } else if (detailModal?.id) {
        await openDetail(detailModal);
      }

      setEvents((prev) => prev.map((ev) =>
        ev.id === detailModal.id ? { ...ev, comment_count: nextCount } : ev
      ));
      setCommentInput('');
      toast.success('Comment posted');
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setTab('events')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'events' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Events
        </button>
        <button onClick={() => { setTab('posts'); if (posts.length === 0) loadPosts(); }} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'posts' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Posts
        </button>
        <button onClick={() => { setTab('archived'); if (archivedEvents.length === 0 && archivedPosts.length === 0) loadArchived(); }} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'archived' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
          Archived
        </button>
      </div>

      {tab === 'posts' ? (
        <div className="space-y-4">
          {can('events_create') && (
            <form onSubmit={handleCreatePost} className="card">
              <h3 className="font-bold text-white mb-3">Create Post</h3>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's happening at your bar?"
                className="input-field h-20 resize-none w-full mb-3"
              />
              {postImagePreview && (
                <div className="relative mb-3 w-full">
                  <img src={postImagePreview} alt="preview" className="w-full max-h-48 object-cover rounded-lg" />
                  <button type="button" onClick={() => { setPostImageFile(null); setPostImagePreview(null); }} className="absolute top-1 right-1 p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}><X className="w-3 h-3 text-white" /></button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: '#888' }}>
                  <Image className="w-4 h-4" />
                  <span>Add photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files[0]; if (!file) return;
                    setPostImageFile(file);
                    setPostImagePreview(URL.createObjectURL(file));
                    e.target.value = '';
                  }} />
                </label>
                <button type="submit" disabled={creatingPost || !newPost.trim()} className="btn-primary flex items-center gap-2">
                  {creatingPost && <Loader2 className="w-4 h-4 animate-spin" />} Post
                </button>
              </div>
            </form>
          )}
          {postsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#555' }}>
              <MessageCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#333' }} />
              <p className="text-sm">No posts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="card">
                  {(post.image_path) && (
                    <img src={getUploadUrl(post.image_path)} alt="" className="w-full max-h-48 object-cover rounded-lg mb-3" />
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm" style={{ color: '#ccc' }}>{post.content || post.text}</p>
                      <p className="text-xs mt-1" style={{ color: '#555' }}>{post.created_at ? format(parseUTC(post.created_at), 'MMM d, yyyy • h:mm a') : ''}</p>
                    </div>
                    {can('events_delete') && (
                      <button onClick={() => handleDeletePost(post.id)} className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6666'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#666' }}>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.like_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comment_count || post.comments_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'archived' ? (
        <div className="space-y-6">
          {archivedLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} /></div>
          ) : (
            <>
              <div className="card">
                <h3 className="font-bold text-white mb-3">Archived Events</h3>
                {archivedEvents.length === 0 ? (
                  <p className="text-sm" style={{ color: '#666' }}>No archived events.</p>
                ) : (
                  <div className="space-y-3">
                    {archivedEvents.map((ev) => (
                      <div key={ev.id} className="rounded-lg p-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{ev.title}</p>
                            {ev.description && <p className="text-sm mt-1" style={{ color: '#888' }}>{ev.description}</p>}
                            <p className="text-xs mt-1" style={{ color: '#666' }}>
                              {ev.event_date ? format(parseUTC(ev.event_date), 'MMM d, yyyy') : '—'}
                            </p>
                          </div>
                          <span className="badge-gray">Archived</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-bold text-white mb-3">Archived Posts</h3>
                {archivedPosts.length === 0 ? (
                  <p className="text-sm" style={{ color: '#666' }}>No archived posts.</p>
                ) : (
                  <div className="space-y-3">
                    {archivedPosts.map((post) => (
                      <div key={post.id} className="rounded-lg p-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-sm" style={{ color: '#ccc' }}>{post.content || post.text}</p>
                        <p className="text-xs mt-1" style={{ color: '#666' }}>
                          {post.updated_at ? format(parseUTC(post.updated_at), 'MMM d, yyyy • h:mm a') : post.created_at ? format(parseUTC(post.created_at), 'MMM d, yyyy • h:mm a') : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {archivedEvents.length === 0 && archivedPosts.length === 0 && (
                <div className="text-center py-8" style={{ color: '#555' }}>No archived content yet.</div>
              )}
            </>
          )}
        </div>
      ) : (
      <>
      {loadError && (
        <div className="card py-3" style={{ background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.2)' }}>
          <p className="text-sm" style={{ color: '#ff6666' }}>{loadError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search className="w-4 h-4" style={{ color: '#555' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
        </div>
        {can('events_update') && (
          <div className="flex items-center gap-3">
            {subInfo && (() => {
              const maxEvents = subInfo.subscription?.max_events;
              const currentEvents = subInfo.usage?.events || 0;
              if (!maxEvents) return null;
              const atLimit = currentEvents >= maxEvents;
              return (
                <span className="text-xs font-medium" style={{ color: atLimit ? '#f87171' : '#888' }}>
                  {currentEvents}/{maxEvents} events used
                  {atLimit && ' — upgrade to add more'}
                </span>
              );
            })()}
            <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Create Event</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((ev) => (
          <div key={ev.id} className="card p-0 overflow-hidden transition-shadow cursor-pointer" onClick={() => openDetail(ev)}>
            <div className="h-40 relative group" style={{ background: '#1a1a1a' }}>
              {ev.image_path || ev.image_url ? (
                <img src={getUploadUrl(ev.image_path || ev.image_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(204,0,0,0.1), rgba(59,130,246,0.05))' }}>
                  <PartyPopper className="w-10 h-10" style={{ color: 'rgba(204,0,0,0.3)' }} />
                </div>
              )}
              <span className={`absolute top-2 right-2 ${
                ev.status === 'active' ? 'badge-success' : ev.status === 'cancelled' ? 'badge-danger' : 'badge-gray'
              }`}>{humanizeStatus(ev.status)}</span>
              {can('events_update') && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleImageUpload(ev); }} className="p-1.5 rounded-lg shadow" style={{ background: 'rgba(0,0,0,0.7)' }}><Plus className="w-3.5 h-3.5 text-white" /></button>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-white">{ev.title}</h4>
              </div>
              {ev.description && <p className="text-sm mb-3 line-clamp-2" style={{ color: '#888' }}>{ev.description}</p>}
              <div className="text-xs mb-3" style={{ color: '#555' }}>
                {ev.event_date && <span>{format(parseUTC(ev.event_date), 'MMM d, yyyy')}</span>}
                {ev.start_time && <span> • {ev.start_time}</span>}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs" style={{ color: '#666' }}>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {ev.like_count || 0}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {ev.comment_count || 0}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {ev.reservation_count || 0}</span>
                </div>
                <div className="flex gap-1">
                  {can('events_update') && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(ev); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleArchive(ev.id); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#ff6666' }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loadError && (
          <div className="col-span-full text-center py-12" style={{ color: '#555' }}>
            <PartyPopper className="w-12 h-12 mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm">No events found.</p>
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">{detailModal.title || 'Event Details'}</h3>
              <button onClick={() => setDetailModal(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#CC0000' }} /></div>
              ) : (
                <>
                  {detailModal.image_path && (
                    <img src={getUploadUrl(detailModal.image_path)} alt="" className="w-full h-48 object-cover rounded-lg mb-4" />
                  )}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-white mb-1">Description</h4>
                      <p className="text-sm" style={{ color: '#888' }}>{detailModal.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleToggleLike} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={detailLiked ? { background: '#CC0000', color: '#fff' } : { background: '#1a1a1a', color: '#ccc' }}
                      >
                        {detailLiked ? 'Unlike' : 'Like'} Event
                      </button>
                      <span className="text-xs" style={{ color: '#666' }}>{Number(detailModal.like_count || 0)} likes</span>
                      <span className="text-xs" style={{ color: '#666' }}>{Number(detailModal.comment_count || 0)} comments</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p style={{ color: '#666' }}>Date</p>
                        <p className="font-medium text-white">{detailModal.event_date ? format(parseUTC(detailModal.event_date), 'MMM d, yyyy') : '—'}</p>
                      </div>
                      <div>
                        <p style={{ color: '#666' }}>Time</p>
                        <p className="font-medium text-white">{detailModal.start_time || '—'} {detailModal.end_time ? `- ${detailModal.end_time}` : ''}</p>
                      </div>
                      <div>
                        <p style={{ color: '#666' }}>Entry Price</p>
                        <p className="font-medium text-white">₱{Number(detailModal.entry_price || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p style={{ color: '#666' }}>Capacity</p>
                        <p className="font-medium text-white">{detailModal.current_bookings || 0}/{detailModal.max_capacity || 0}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-3">Comments</h4>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          type="text"
                          placeholder="Write a comment..."
                          className="input-field text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddComment();
                            }
                          }}
                        />
                        <button onClick={handleAddComment} className="btn-primary text-sm">Post</button>
                      </div>

                      {Array.isArray(detailModal.comments) && detailModal.comments.length > 0 ? (
                        <div className="space-y-3">
                          {detailModal.comments.map((c) => (
                            <div key={c.id} className="rounded-lg p-3" style={{ background: '#161616' }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium" style={{ color: '#ccc' }}>{c.first_name} {c.last_name}</span>
                                <span className="text-xs" style={{ color: '#555' }}>{c.created_at ? format(parseUTC(c.created_at), 'MMM d, h:mm a') : ''}</span>
                              </div>
                              <p className="text-sm mb-2" style={{ color: '#aaa' }}>{c.comment}</p>
                              {c.replies && c.replies.length > 0 && (
                                <div className="ml-4 space-y-2 mt-2">
                                  {c.replies.map((r) => (
                                    <div key={r.id} className="rounded p-2 text-xs" style={{ background: '#0d0d0d' }}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-white">{r.first_name} {r.last_name}</span>
                                        {r.role && String(r.role).toLowerCase() === 'bar_owner' && (
                                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#CC0000', color: '#fff' }}>Bar Owner</span>
                                        )}
                                      </div>
                                      <p style={{ color: '#888' }}>{r.reply}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <input type="text" placeholder="Add a reply..." className="input-field text-xs flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      e.preventDefault();
                                      handleReply(c.id, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </div>
                              {can('events_update') && (
                                <button onClick={() => handleDeleteComment(c.id)} className="p-1 transition-colors" style={{ color: '#ff6666' }}>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: '#555' }}>No comments yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111111' }}>
              <h3 className="font-bold text-white">{editing ? 'Edit Event' : 'Create Event'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="label">Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required /></div>
              <div>
                <label className="label">Event Type</label>
                <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="input-field">
                  <option value="">Select type (optional)</option>
                  <option value="Stand-up Comedy">Stand-up Comedy</option>
                  <option value="Open Mic">Open Mic</option>
                  <option value="Live Band">Live Band</option>
                  <option value="DJ Night">DJ Night</option>
                  <option value="Ladies Night">Ladies Night</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div><label className="label">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-20 resize-none" /></div>
              <div><label className="label">Event Date *</label><input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Time</label><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input-field" /></div>
                <div><label className="label">End Time</label><input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Entry Price</label><input type="number" step="0.01" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} className="input-field" /></div>
                <div><label className="label">Max Capacity</label><input type="number" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: e.target.value })} className="input-field" /></div>
              </div>
              <div>
                <label className="label">Event Image</label>
                {eventImagePreview ? (
                  <div className="relative">
                    <img src={eventImagePreview} alt="preview" className="w-full h-32 object-cover rounded-lg" />
                    <button type="button" onClick={() => { setEventImageFile(null); setEventImagePreview(null); }} className="absolute top-1 right-1 p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}><X className="w-3 h-3 text-white" /></button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer input-field" style={{ color: '#888' }}>
                    <Image className="w-4 h-4" />
                    <span className="text-sm">{editing?.image_path ? 'Replace image' : 'Upload image (optional)'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setEventImageFile(file);
                      setEventImagePreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }} />
                  </label>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, eventId: null })}
        onConfirm={handleConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.action === 'deleteComment' ? 'Delete' : confirmModal.action === 'cancel' ? 'Cancel Event' : 'Archive'}
        loading={actionLoading}
      />
      </>
      )}
    </div>
  );
};

export default Events;
