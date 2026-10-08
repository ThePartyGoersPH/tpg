import React, { useState, useEffect } from 'react';
import { Upload, Search, Eye, FileText, X, Loader2, Send, Users } from 'lucide-react';
import { documentApi } from '../api/documentApi';
import { staffApi } from '../api/staffApi';
import { usePermission } from '../hooks/usePermission';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DOC_TYPES = ['contract', 'id', 'nbi', 'medical', 'clearance', 'other'];

const Documents = () => {
  const [docs, setDocs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [sendModal, setSendModal] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', doc_type: 'other', employee_user_id: '', file: null });
  const { can } = usePermission();
  const canViewAll = can('documents_view_all');
  const canViewOwn = can('documents_view_own');
  const canSendDocuments = can('documents_send');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const params = {};
      if (filterType) params.doc_type = filterType;
      
      let docsData;
      if (canViewAll) {
        docsData = await documentApi.list(params);
      } else if (canViewOwn) {
        docsData = await documentApi.getReceived();
      } else {
        docsData = { data: [] };
      }
      
      setDocs(docsData.data?.data || docsData.data || []);
      
      if (canSendDocuments) {
        try { const { data: e } = await staffApi.list(); setEmployees(e.data || e || []); } catch {}
      }
    } catch {} finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file) { toast.error('Select a file'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('title', form.title);
      fd.append('doc_type', form.doc_type);
      if (form.employee_user_id) fd.append('employee_user_id', form.employee_user_id);
      await documentApi.upload(fd);
      toast.success('Document uploaded!');
      setShowModal(false);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleView = async (doc) => {
    try {
      const response = await documentApi.view(doc.id);
      const blob = new Blob([response.data], { type: response.headers['content-type'] || doc.mime_type });
      const url = URL.createObjectURL(blob);
      setViewModal({ doc, url });
    } catch { toast.error('Failed to load document'); }
  };

  const handleSendToStaff = async () => {
    if (!sendModal || selectedStaff.length === 0) {
      toast.error('Select at least one staff member');
      return;
    }
    setSaving(true);
    try {
      await documentApi.send(sendModal.id, selectedStaff);
      toast.success(`Document sent to ${selectedStaff.length} staff member(s)`);
      setSendModal(null);
      setSelectedStaff([]);
    } catch {
      toast.error('Failed to send document');
    } finally {
      setSaving(false);
    }
  };

  const filtered = docs.filter((d) =>
    (d.title || d.original_filename || '').toLowerCase().includes(search.toLowerCase())
  );

  const typeColor = (t) => {
    const map = { contract: 'badge-info', id: 'badge-success', nbi: 'badge-purple', medical: 'badge-danger', clearance: 'badge-warning' };
    return map[t] || 'badge-gray';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-64" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search className="w-4 h-4" style={{ color: '#555' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
          </div>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); }} className="input-field w-auto">
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {canSendDocuments && (
          <button onClick={() => { setForm({ title: '', doc_type: 'other', employee_user_id: '', file: null }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}><tr>
              <th className="table-header">Document</th>
              <th className="table-header">Type</th>
              {canViewAll && <th className="table-header">Employee</th>}
              <th className="table-header">Date</th>
              <th className="table-header text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: '#555' }} />
                      <div>
                        <p className="font-medium text-white">{d.title || d.original_filename}</p>
                        <p className="text-xs" style={{ color: '#555' }}>{d.original_filename}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><span className={typeColor(d.doc_type)}>{d.doc_type}</span></td>
                  {canViewAll && <td className="table-cell">{d.employee_first_name ? `${d.employee_first_name} ${d.employee_last_name}` : `#${d.employee_user_id || '—'}`}</td>}
                  <td className="table-cell">{d.created_at ? format(parseUTC(d.created_at), 'MMM d, yyyy') : '—'}</td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleView(d)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }} title="View"><Eye className="w-4 h-4" /></button>
                      {canSendDocuments && (
                        <button onClick={() => { setSendModal(d); setSelectedStaff([]); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }} title="Send to staff"><Send className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={canViewAll ? 5 : 4} className="text-center py-8" style={{ color: '#555' }}>No documents found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Document Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d' }}>
              <h3 className="font-bold text-white">{viewModal.doc.title || viewModal.doc.original_filename}</h3>
              <button onClick={() => setViewModal(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {viewModal.doc.mime_type?.startsWith('image/') ? (
                <img src={viewModal.url} alt="Document" className="max-w-full h-auto mx-auto" />
              ) : viewModal.doc.mime_type === 'application/pdf' ? (
                <iframe src={viewModal.url} className="w-full h-[70vh]" title="PDF Viewer" />
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: '#333' }} />
                  <p className="mb-4" style={{ color: '#888' }}>Preview not available for this file type</p>
                  <a href={viewModal.url} download={viewModal.doc.original_filename} className="btn-primary inline-flex items-center gap-2">
                    Download {viewModal.doc.original_filename}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send to Staff Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSendModal(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">Send Document to Staff</h3>
              <button onClick={() => setSendModal(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: '#888' }}>Select staff members to send <strong className="text-white">{sendModal.title || sendModal.original_filename}</strong></p>
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg p-3" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <label className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors" onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <input type="checkbox" checked={selectedStaff.length === employees.length && employees.length > 0} onChange={(e) => setSelectedStaff(e.target.checked ? employees.map(emp => emp.id) : [])} className="w-4 h-4" style={{ accentColor: '#CC0000' }} />
                  <Users className="w-4 h-4" style={{ color: '#555' }} />
                  <span className="text-sm font-semibold text-white">All Staff</span>
                </label>
                <div className="my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}></div>
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors" onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <input type="checkbox" checked={selectedStaff.includes(emp.id)} onChange={(e) => setSelectedStaff(e.target.checked ? [...selectedStaff, emp.id] : selectedStaff.filter(id => id !== emp.id))} className="w-4 h-4" style={{ accentColor: '#CC0000' }} />
                    <span className="text-sm" style={{ color: '#ccc' }}>{emp.first_name} {emp.last_name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSendModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSendToStaff} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Send ({selectedStaff.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">Upload Document</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div><label className="label">Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required /></div>
              <div>
                <label className="label">Document Type</label>
                <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} className="input-field">
                  {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Employee</label>
                <select value={form.employee_user_id} onChange={(e) => setForm({ ...form, employee_user_id: e.target.value })} className="input-field">
                  <option value="">Select employee...</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">File *</label>
                <input type="file" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} className="input-field" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
