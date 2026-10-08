import React, { useState, useEffect } from 'react';
import {
  Database, Info, Brain, Lightbulb, TrendingUp, AlertTriangle,
  PackageX, CalendarClock, Coins, Sparkles, RefreshCw
} from 'lucide-react';
import { dssApi } from '../api/dssApi';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const php = (n) => '₱' + fmt(n);

const SEVERITY = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  insight: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  positive: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

const TierHeader = ({ icon: Icon, label, desc, color }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color.bg, color: color.fg }}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h3 className="font-bold text-white leading-tight">{label}</h3>
      <p className="text-xs" style={{ color: '#888' }}>{desc}</p>
    </div>
  </div>
);

const Dss = () => {
  const [data, setData] = useState(null);
  const [information, setInformation] = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [wisdom, setWisdom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const toObj = (v, keys = []) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    if (!v || typeof v !== 'object') return null;
    for (const k of keys) if (v[k] && typeof v[k] === 'object' && !Array.isArray(v[k])) return v[k];
    return null;
  };
  const toArr = (v, keys = []) => {
    if (Array.isArray(v)) return v;
    if (!v || typeof v !== 'object') return [];
    for (const k of keys) if (Array.isArray(v[k])) return v[k];
    return [];
  };

  const load = async () => {
    try {
      const [dR, iR, kR, wR] = await Promise.allSettled([
        dssApi.data(), dssApi.information(), dssApi.knowledge(), dssApi.wisdom(),
      ]);
      setData(toObj(dR.status === 'fulfilled' ? dR.value.data?.data || dR.value.data : null, ['data']));
      setInformation(toObj(iR.status === 'fulfilled' ? iR.value.data?.data || iR.value.data : null, ['data']));
      setKnowledge(toObj(kR.status === 'fulfilled' ? kR.value.data?.data || kR.value.data : null, ['data']));
      setWisdom(toObj(wR.status === 'fulfilled' ? wR.value.data?.data || wR.value.data : null, ['data', 'wisdom']));
      const allFailed = [dR, iR, kR, wR].every((r) => r.status === 'rejected');
      setError(allFailed ? 'Smart Recommendations data is temporarily unavailable.' : '');
    } catch {
      setError('Smart Recommendations data is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;

  const info = information || {};
  const know = knowledge || {};
  const wis = wisdom || {};

  const trend = (toArr(info.revenue_trend, ['revenue_trend']) || []).map((t) => ({
    ...t, day: String(t.day).slice(5),
  }));
  const EXPENSE_COLORS = { Payroll: '#ef4444', Procurement: '#f59e0b', Wastage: '#8b5cf6' };
  const expenseData = info.expense_breakdown
    ? [
        { name: 'Payroll', value: Number(info.expense_breakdown.payroll || 0), color: EXPENSE_COLORS.Payroll },
        { name: 'Procurement', value: Number(info.expense_breakdown.procurement || 0), color: EXPENSE_COLORS.Procurement },
        { name: 'Wastage', value: Number(info.expense_breakdown.wastage || 0), color: EXPENSE_COLORS.Wastage },
      ]
    : [];
  // Recharts won't render a 0-value slice. Give zero categories a small display
  // floor (a thin, visible sliver) so all three segments + legend colors appear,
  // while the real value is still surfaced in labels/tooltips. Floored to ~2% of
  // the largest real value so the segment is perceptible but correctly labelled ₱0.
  const maxExpense = Math.max(0, ...expenseData.map((d) => d.value));
  const expenseRender = expenseData.map((d) => ({
    ...d,
    display: d.value > 0 ? d.value : Math.max(1, maxExpense * 0.02),
  }));
  const topItems = toArr(info.top_items, ['top_items']);
  const recommendations = toArr(wis.recommendations, ['recommendations']);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Smart Recommendations</h1>
          <p className="text-sm" style={{ color: '#888' }}>Your day-to-day numbers, turned into clear next steps</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={load}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="card py-3" style={{ borderLeft: '3px solid #CC0000', background: 'rgba(204,0,0,0.06)' }}>
          <p className="text-sm" style={{ color: '#ff6666' }}>{error}</p>
        </div>
      )}

      {/* DATA TIER */}
      <div className="card">
        <TierHeader icon={Database} label="Today's Records" desc="Latest transactions, wastage, payroll, procurement & promotions" color={{ bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8' }} />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { k: 'POS Orders', v: toArr(data?.pos_orders, ['pos_orders']).length, icon: TrendingUp },
            { k: 'Wastage Logs', v: toArr(data?.wastage_logs, ['wastage_logs']).length, icon: PackageX },
            { k: 'Payroll Runs', v: toArr(data?.payroll_runs, ['payroll_runs']).length, icon: Coins },
            { k: 'Purchase Orders', v: toArr(data?.purchase_orders, ['purchase_orders']).length, icon: CalendarClock },
            { k: 'Active Promos', v: toArr(data?.promotions, ['promotions']).length, icon: Sparkles },
          ].map((s) => (
            <div key={s.k} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <s.icon className="w-4 h-4 mb-1" style={{ color: '#94a3b8' }} />
              <p className="text-xl font-extrabold text-white">{s.v}</p>
              <p className="text-xs" style={{ color: '#888' }}>{s.k}</p>
            </div>
          ))}
        </div>
        {toArr(data?.pos_orders, ['pos_orders']).length > 0 && (
          <div className="mt-3 space-y-1 max-h-44 overflow-y-auto">
            {toArr(data?.pos_orders, ['pos_orders']).slice(0, 6).map((o) => (
              <div key={o.id} className="flex justify-between text-xs" style={{ color: '#bbb' }}>
                <span>#{o.order_number} {o.transaction_name ? `· ${o.transaction_name}` : ''}</span>
                <span>{php(o.total_amount)} · {o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INFORMATION TIER */}
      <div className="card">
        <TierHeader icon={Info} label="Key Numbers" desc="Revenue, orders, expenses & best sellers (last 30 days)" color={{ bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Revenue (30d)</p>
            <p className="text-xl font-extrabold text-white">{php(info?.kpis?.total_revenue_30d)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Orders (30d)</p>
            <p className="text-xl font-extrabold text-white">{fmt(info?.kpis?.total_orders_30d)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Avg Order Value</p>
            <p className="text-xl font-extrabold text-white">{php(info?.kpis?.avg_order_value)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Payroll Expense (30d)</p>
            <p className="text-xl font-extrabold text-white">{php(info?.kpis?.total_payroll_expense_30d)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-2">Revenue Trend</p>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm" style={{ color: '#555' }}>No revenue data yet.</p>}
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-2">Expense Breakdown</p>
            {expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={expenseRender}
                    dataKey="display"
                    nameKey="name"
                    outerRadius={80}
                    label={({ name }) => {
                      const d = expenseData.find((x) => x.name === name);
                      return `${name}: ${php(d ? d.value : 0)}`;
                    }}
                    labelLine={false}
                  >
                    {expenseRender.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const d = expenseData.find((x) => x.name === name);
                      return [php(d ? d.value : 0), name];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm" style={{ color: '#555' }}>No expense data yet.</p>}
          </div>
        </div>
        {topItems.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-white mb-2">Top Selling Items</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis type="category" dataKey="item_name" width={110} tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#10b981" name="Qty sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* KNOWLEDGE TIER */}
      <div className="card">
        <TierHeader icon={Brain} label="What's Coming" desc="Stock risks, wastage anomalies, turnover & sales forecast" color={{ bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' }} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><PackageX className="w-4 h-4" style={{ color: '#f59e0b' }} /> Low / Critical Stock</p>
            {toArr(know.low_stock_items, ['low_stock_items']).length > 0 ? (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {toArr(know.low_stock_items, ['low_stock_items']).map((it) => (
                  <div key={it.id} className="flex justify-between text-xs" style={{ color: '#bbb' }}>
                    <span>{it.name}</span>
                    <span style={{ color: it.stock_status === 'critical' ? '#ef4444' : '#f59e0b' }}>{it.stock_qty} left (reorder {it.reorder_level})</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: '#555' }}>All stock healthy.</p>}
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><CalendarClock className="w-4 h-4" style={{ color: '#f59e0b' }} /> Near-Expiry (7 days)</p>
            {toArr(know.near_expiry_items, ['near_expiry_items']).length > 0 ? (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {toArr(know.near_expiry_items, ['near_expiry_items']).map((it) => (
                  <div key={it.id} className="flex justify-between text-xs" style={{ color: '#bbb' }}>
                    <span>{it.name}</span><span>{it.expiry_date?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: '#555' }}>No items expiring soon.</p>}
          </div>
        </div>

        {know.wastage_anomaly && (
          <div className="mt-3 rounded-lg p-3 flex items-center gap-3" style={{ background: know.wastage_anomaly.flagged ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: know.wastage_anomaly.flagged ? '#ef4444' : '#10b981' }} />
            <p className="text-sm" style={{ color: '#ccc' }}>
              Wastage cost {php(know.wastage_anomaly.wastage_cost)} vs revenue {php(know.wastage_anomaly.revenue)}
              (ratio {(know.wastage_anomaly.ratio * 100).toFixed(1)}%) — {know.wastage_anomaly.flagged ? 'anomaly detected' : 'within normal range'}
            </p>
          </div>
        )}

        {toArr(know.inventory_turnover, ['inventory_turnover']).length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-white mb-2">Inventory Turnover (sold vs stock)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={toArr(know.inventory_turnover, ['inventory_turnover'])}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip />
                <Bar dataKey="sold_30d" fill="#f59e0b" name="Sold (30d)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {know.sales_forecast && (
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="text-xs" style={{ color: '#888' }}>Avg Daily Revenue</p>
              <p className="text-lg font-extrabold text-white">{php(know.sales_forecast.avg_daily_revenue)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="text-xs" style={{ color: '#888' }}>Forecast (next 7d)</p>
              <p className="text-lg font-extrabold text-white">{php(know.sales_forecast.forecast_next_7d)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="text-xs" style={{ color: '#888' }}>Promo Effectiveness</p>
              <p className="text-sm font-bold text-white">{toArr(know.promo_effectiveness, ['promo_effectiveness']).length} tracked</p>
            </div>
          </div>
        )}
      </div>

      {/* WISDOM TIER */}
      <div className="card">
        <TierHeader icon={Lightbulb} label="What To Do Next" desc="Suggested actions based on your recent numbers" color={{ bg: 'rgba(139,92,246,0.12)', fg: '#8b5cf6' }} />
        {recommendations.length > 0 ? (
          <div className="space-y-2">
            {recommendations.map((r) => {
              const s = SEVERITY[r.severity] || SEVERITY.insight;
              return (
                <div key={r.id} className="flex items-start gap-3 rounded-lg p-3" style={{ background: s.bg, borderLeft: `3px solid ${s.color}` }}>
                  <Sparkles className="w-4 h-4 mt-0.5" style={{ color: s.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: s.color }}>{r.title}</p>
                    <p className="text-xs" style={{ color: '#ccc' }}>{r.message}</p>
                  </div>
                  {r.action_label && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: '#ddd' }}>{r.action_label}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#555' }}>
            {wis?.message || 'No recommendations yet — the engine needs more operational activity to generate actions.'}
          </p>
        )}
      </div>
    </div>
  );
};

export default Dss;
