import { useEffect, useState } from 'react';
import { platformAPI, paymentsAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Shield, DollarSign, Bell, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('maintenance');
  const [maintenance, setMaintenance] = useState({ maintenance_mode: 0, maintenance_message: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState({ platform_fee_percentage: 5, payments_enabled: true });
  const [loading, setLoading] = useState(true);
  const [announcementModal, setAnnouncementModal] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', starts_at: '', ends_at: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [maintRes, annRes, payRes] = await Promise.allSettled([platformAPI.getMaintenance(), platformAPI.getAnnouncements(), paymentsAPI.getSettings()]);
      if (maintRes.status==='fulfilled'&&maintRes.value.data.success) setMaintenance(maintRes.value.data.data||{maintenance_mode:0,maintenance_message:''});
      if (annRes.status==='fulfilled'&&annRes.value.data.success) setAnnouncements(annRes.value.data.data||[]);
      if (payRes.status==='fulfilled'&&payRes.value.data.success) {
        const s = payRes.value.data.data||{};
        if (Array.isArray(s)) {
          const fee = s.find(x=>x.setting_key==='platform_fee_percentage');
          const en = s.find(x=>x.setting_key==='payments_enabled');
          setPaymentSettings({ platform_fee_percentage: fee?parseFloat(fee.setting_value):5, payments_enabled: en?en.setting_value==='1'||en.setting_value==='true':true });
        } else {
          const fee = s.platform_fee_percentage;
          const en = s.payments_enabled;
          setPaymentSettings({ platform_fee_percentage: fee?parseFloat(fee.value||fee):5, payments_enabled: en?(en.value==='1'||en.value==='true'||en===true):true });
        }
      }
    } catch(e){console.error(e)} finally{setLoading(false)}
  };

  const handleMaintenanceToggle = async () => {
    try {
      const newMode = !maintenance.maintenance_mode;
      const res = await platformAPI.setMaintenance({ maintenance_mode: newMode, maintenance_message: maintenance.maintenance_message });
      if (res.data.success) { setMaintenance(p=>({...p,maintenance_mode:newMode?1:0})); toast.success(newMode?'Maintenance mode enabled':'Maintenance mode disabled'); }
    } catch(e){toast.error(e.response?.data?.message||'Failed')}
  };

  const handleMaintenanceMessageSave = async () => {
    try { const r = await platformAPI.setMaintenance({ maintenance_mode: maintenance.maintenance_mode, maintenance_message: maintenance.maintenance_message }); if(r.data.success) toast.success('Message updated'); }
    catch(e){toast.error('Failed')}
  };

  const handleSavePaymentSettings = async () => {
    try { const r = await paymentsAPI.updateSettings({ platform_fee_percentage: paymentSettings.platform_fee_percentage, payments_enabled: paymentSettings.payments_enabled }); if(r.data.success) toast.success('Payment settings updated'); }
    catch(e){toast.error(e.response?.data?.message||'Failed')}
  };

  const handleCreateAnnouncement = async () => {
    if(!announcementForm.title||!announcementForm.message){toast.error('Title and message required');return;}

    const toIsoOrNull = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const payload = {
      title: announcementForm.title.trim(),
      message: announcementForm.message.trim(),
      starts_at: toIsoOrNull(announcementForm.starts_at),
      ends_at: toIsoOrNull(announcementForm.ends_at),
    };

    if (!payload.title || !payload.message) {
      toast.error('Title and message required');
      return;
    }

    try { const r = await platformAPI.createAnnouncement(payload); if(r.data.success){toast.success('Created');setAnnouncementModal(null);setAnnouncementForm({title:'',message:'',starts_at:'',ends_at:''});fetchAll();} }
    catch(e){toast.error(e.response?.data?.message||'Failed')}
  };

  const handleDeleteAnnouncement = async (id) => {
    if(!confirm('Delete this announcement?'))return;
    try { const r = await platformAPI.deleteAnnouncement(id); if(r.data.success){toast.success('Deleted');setAnnouncements(p=>p.filter(a=>a.id!==id));} }
    catch(e){toast.error('Failed')}
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div></div>;

  const tabs = [{key:'maintenance',label:'Maintenance',icon:Shield},{key:'payments',label:'Payment Settings',icon:DollarSign},{key:'announcements',label:'Announcements',icon:Bell}];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-white/40 text-sm mt-1">Configure platform-wide settings</p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${activeTab===t.key?'text-red-400 border-b-2 border-red-500':'text-white/40 hover:text-white/60'}`}>
            <t.icon className="h-4 w-4"/>{t.label}
          </button>
        ))}
      </div>

      {activeTab==='maintenance'&&(
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Maintenance Mode</h3>
              <p className="text-xs text-white/40 mt-1">When enabled, only Super Admins can access the platform</p>
            </div>
            <button onClick={handleMaintenanceToggle} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${maintenance.maintenance_mode?'bg-red-600':'bg-white/10'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${maintenance.maintenance_mode?'translate-x-6':'translate-x-1'}`}/>
            </button>
          </div>

          {maintenance.maintenance_mode ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">Maintenance mode is <strong>ACTIVE</strong>. Non-admin users cannot access.</div>
          ) : (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">Platform is operating normally.</div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Maintenance Message</label>
            <textarea rows="3" className="glass-input w-full text-sm" value={maintenance.maintenance_message||''} onChange={e=>setMaintenance(p=>({...p,maintenance_message:e.target.value}))} placeholder="Message shown to users..."/>
            <button onClick={handleMaintenanceMessageSave} className="btn-red text-xs mt-2 flex items-center gap-1"><Save className="h-3 w-3"/>Save Message</button>
          </div>
        </div>
      )}

      {activeTab==='payments'&&(
        <div className="glass-card p-6 space-y-5">
          <h3 className="text-base font-semibold text-white">Payment Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Platform Fee (%)</label>
              <input type="number" min="0" max="100" step="0.5" className="glass-input w-full text-sm" value={paymentSettings.platform_fee_percentage} onChange={e=>setPaymentSettings(p=>({...p,platform_fee_percentage:parseFloat(e.target.value)||0}))}/>
              <p className="text-[10px] text-white/30 mt-1">Fee deducted from each bar payout · shows live in Bar Management payout sections</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Payments Enabled</label>
              <button onClick={()=>setPaymentSettings(p=>({...p,payments_enabled:!p.payments_enabled}))} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${paymentSettings.payments_enabled?'bg-green-600':'bg-white/10'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${paymentSettings.payments_enabled?'translate-x-6':'translate-x-1'}`}/>
              </button>
              <p className="text-[10px] text-white/30 mt-1">{paymentSettings.payments_enabled?'Accepting payments':'Payments disabled'}</p>
            </div>
          </div>
          <button onClick={handleSavePaymentSettings} className="btn-red text-xs flex items-center gap-1"><Save className="h-3 w-3"/>Save Settings</button>
        </div>
      )}

      {activeTab==='announcements'&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Platform Announcements</h3>
            <button onClick={()=>setAnnouncementModal('create')} className="btn-red text-xs flex items-center gap-1"><Plus className="h-3.5 w-3.5"/>New</button>
          </div>

          {announcements.length===0?(
            <div className="glass-card p-8 text-center text-white/30 text-sm">No announcements yet</div>
          ):(
            <div className="space-y-3">
              {announcements.map(ann=>(
                <div key={ann.id} className="glass-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{ann.title}</h4>
                      <p className="text-xs text-white/50 mt-1">{ann.message}</p>
                      <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                        {ann.starts_at&&<span>Starts: {formatDateTime(ann.starts_at)}</span>}
                        {ann.ends_at&&<span>Ends: {formatDateTime(ann.ends_at)}</span>}
                        <span>Created: {formatDateTime(ann.created_at)}</span>
                      </div>
                    </div>
                    <button onClick={()=>handleDeleteAnnouncement(ann.id)} className="text-red-400/50 hover:text-red-400 p-1"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {announcementModal&&(
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="glass-modal p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-white mb-4">New Announcement</h3>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-white/50 mb-1">Title *</label><input className="glass-input w-full text-sm" value={announcementForm.title} onChange={e=>setAnnouncementForm(p=>({...p,title:e.target.value}))}/></div>
                  <div><label className="block text-xs font-medium text-white/50 mb-1">Message *</label><textarea rows="3" className="glass-input w-full text-sm" value={announcementForm.message} onChange={e=>setAnnouncementForm(p=>({...p,message:e.target.value}))}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-white/50 mb-1">Starts At</label><input type="datetime-local" className="glass-input w-full text-sm" value={announcementForm.starts_at} onChange={e=>setAnnouncementForm(p=>({...p,starts_at:e.target.value}))}/></div>
                    <div><label className="block text-xs font-medium text-white/50 mb-1">Ends At</label><input type="datetime-local" className="glass-input w-full text-sm" value={announcementForm.ends_at} onChange={e=>setAnnouncementForm(p=>({...p,ends_at:e.target.value}))}/></div>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={()=>{setAnnouncementModal(null);setAnnouncementForm({title:'',message:'',starts_at:'',ends_at:''})}} className="btn-ghost flex-1 text-sm">Cancel</button>
                  <button onClick={handleCreateAnnouncement} className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700">Create</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
