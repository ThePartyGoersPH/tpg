import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Crown, Star, Phone, Mail, TrendingUp, Gift } from 'lucide-react';
import { crmApi } from '../api/crmApi';
import LoadingSpinner from '../components/common/LoadingSpinner';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const php = (n) => '₱' + fmt(n);

const Crm = () => {
  const [customers, setCustomers] = useState([]);
  const [segments, setSegments] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toArr = (v) => (Array.isArray(v) ? v : []);
  const toObj = (v) => (v && typeof v === 'object' ? v : null);

  const load = async () => {
    try {
      const [cR, sR, lR] = await Promise.allSettled([crmApi.list(), crmApi.segments(), crmApi.loyalty()]);
      setCustomers(toArr(cR.status === 'fulfilled' ? (cR.value.data.data || cR.value.data) : []));
      setSegments(toObj(sR.status === 'fulfilled' ? (sR.value.data.data || sR.value.data) : null));
      setLoyalty(toObj(lR.status === 'fulfilled' ? (lR.value.data.data || lR.value.data) : null));
      const allFailed = [cR, sR, lR].every((r) => r.status === 'rejected');
      setError(allFailed ? 'Customer insights are temporarily unavailable.' : '');
    } catch {
      setError('Customer insights are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    setSelected(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await crmApi.detail(id);
      setDetail(data.data || data);
    } catch {
      setDetail({ error: true });
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Customer Insights</h1>
        <p className="text-sm" style={{ color: '#888' }}>Customer insights, segmentation & loyalty for your bar</p>
      </div>

      {error && (
        <div className="card py-3" style={{ borderLeft: '3px solid #CC0000', background: 'rgba(204,0,0,0.06)' }}>
          <p className="text-sm" style={{ color: '#ff6666' }}>{error}</p>
        </div>
      )}

      {/* Segments + Loyalty */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs" style={{ color: '#888' }}>Total Customers</p>
          <p className="text-2xl font-extrabold text-white">{loyalty?.total_customers ?? customers.length}</p>
        </div>
        <div className="card">
          <p className="text-xs" style={{ color: '#888' }}>VIP (≥₱5,000)</p>
          <p className="text-2xl font-extrabold" style={{ color: '#f59e0b' }}>{segments?.vip ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs" style={{ color: '#888' }}>Regular (≥₱1,000)</p>
          <p className="text-2xl font-extrabold" style={{ color: '#3b82f6' }}>{segments?.regular ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs" style={{ color: '#888' }}>New (&lt;₱1,000)</p>
          <p className="text-2xl font-extrabold" style={{ color: '#10b981' }}>{segments?.new ?? 0}</p>
        </div>
      </div>

      {loyalty?.tiers && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            <h3 className="font-bold text-white">Loyalty Tiers</h3>
            <span className="text-xs ml-auto" style={{ color: '#888' }}>{loyalty.reachable} reachable followers</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {loyalty.tiers.map((t) => (
              <div key={t.tier} className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" style={{ color: t.tier === 'VIP' ? '#f59e0b' : t.tier === 'Regular' ? '#3b82f6' : '#10b981' }} />
                  <span className="text-sm font-semibold text-white">{t.tier}</span>
                </div>
                <span className="text-sm" style={{ color: '#aaa' }}>{t.count} customers</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer table */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" style={{ color: '#CC0000' }} />
            <h3 className="font-bold text-white">Customers ({customers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Spend</th>
                  <th className="text-left py-2">Orders</th>
                  <th className="text-left py-2">Resv</th>
                  <th className="text-left py-2">Rating</th>
                  <th className="text-left py-2"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/5">
                    <td className="py-2 text-white">{c.name}
                      {c.is_follower && <UserCheck className="w-3 h-3 inline ml-1" style={{ color: '#10b981' }} />}
                    </td>
                    <td className="py-2" style={{ color: '#ccc' }}>{php(c.total_spent)}</td>
                    <td className="py-2" style={{ color: '#ccc' }}>{c.order_count}</td>
                    <td className="py-2" style={{ color: '#ccc' }}>{c.reservation_count}</td>
                    <td className="py-2" style={{ color: '#f59e0b' }}>{Number(c.avg_rating).toFixed(1)} ★</td>
                    <td className="py-2">
                      <button className="text-xs text-blue-400" onClick={() => openDetail(c.id)}>View</button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan="6" className="py-6 text-center" style={{ color: '#555' }}>No customers with activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        <div className="card">
          <h3 className="font-bold text-white mb-3">Customer Detail</h3>
          {!selected && <p className="text-sm" style={{ color: '#555' }}>Select a customer to view their history.</p>}
          {detailLoading && <p className="text-sm" style={{ color: '#888' }}>Loading…</p>}
          {detail && !detail.error && (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold text-white">{detail.name}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#aaa' }}><Mail className="w-3 h-3" /> {detail.email}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#aaa' }}><Phone className="w-3 h-3" /> {detail.phone || '—'}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm font-bold text-white">{php(detail.total_spent)}</p><p className="text-[10px]" style={{ color: '#888' }}>Spend</p>
                </div>
                <div className="rounded p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm font-bold text-white">{detail.order_count}</p><p className="text-[10px]" style={{ color: '#888' }}>Orders</p>
                </div>
                <div className="rounded p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm font-bold text-white">{detail.reservation_count}</p><p className="text-[10px]" style={{ color: '#888' }}>Resv</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Reservations</p>
                {detail.reservations?.length ? detail.reservations.map((r) => (
                  <p key={r.id} className="text-xs" style={{ color: '#bbb' }}>{r.reservation_date?.slice(0, 10)} · {r.party_size} pax · {r.status}</p>
                )) : <p className="text-xs" style={{ color: '#555' }}>None</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-white mb-1 flex items-center gap-1"><Star className="w-3 h-3" style={{ color: '#f59e0b' }} /> Reviews</p>
                {detail.reviews?.length ? detail.reviews.map((r) => (
                  <p key={r.id} className="text-xs" style={{ color: '#bbb' }}>{r.rating}★ — {r.comment || '(no comment)'}</p>
                )) : <p className="text-xs" style={{ color: '#555' }}>No reviews</p>}
              </div>
            </div>
          )}
          {detail?.error && <p className="text-sm" style={{ color: '#ff6666' }}>Could not load customer.</p>}
        </div>
      </div>
    </div>
  );
};

export default Crm;
