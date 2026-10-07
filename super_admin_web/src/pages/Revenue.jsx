import { useEffect, useState } from 'react';
import { paymentsAPI } from '../api/services';
import { formatCurrency } from '../utils/formatters';
import { TrendingUp, DollarSign, CreditCard, Banknote, Filter } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Area, AreaChart } from 'recharts';

const COLORS = ['#dc2626','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];

export default function Revenue() {
  const [dashboard, setDashboard] = useState(null);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [graphType, setGraphType] = useState('bar');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.from && dateRange.to) { params.from = dateRange.from; params.to = dateRange.to; }
      const [dashRes, barsRes] = await Promise.allSettled([
        paymentsAPI.dashboard(params),
        paymentsAPI.barConfigs(),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value.data.success) setDashboard(dashRes.value.data.data);
      if (barsRes.status === 'fulfilled' && barsRes.value.data.success) setBars(barsRes.value.data.data || []);
    } catch (err) { console.error('Revenue fetch error:', err); }
    finally { setLoading(false); }
  };

  const handleFilter = () => { fetchData(); };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>;

  const rev = dashboard?.revenue || {};
  const pay = dashboard?.payouts || {};
  const subRev = dashboard?.subscription_revenue || {};
  const methods = dashboard?.payment_methods || [];

  const methodPieData = methods.map(m => ({ name: m.payment_method || 'Unknown', value: Number(m.total_amount) || 0, count: m.count }));
  
  const revBreakdown = [
    { name: 'Paid Revenue', value: Number(rev.paid_revenue) || 0 },
    { name: 'Pending', value: Number(rev.pending_revenue) || 0 },
    { name: 'Failed', value: Number(rev.failed_revenue) || 0 },
  ];

  const payoutBreakdown = [
    { name: 'Completed', value: Number(pay.completed_payouts) || 0 },
    { name: 'Processing', value: Number(pay.processing_payouts) || 0 },
    { name: 'Pending', value: Number(pay.pending_payouts) || 0 },
  ];

  const topBars = [...bars]
    .sort((a, b) => Number(b.total_paid_out || 0) - Number(a.total_paid_out || 0))
    .slice(0, 8)
    .map(b => ({ name: b.name?.substring(0, 15) || 'Unknown', revenue: Number(b.total_paid_out) || 0, pending: Number(b.pending_amount) || 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-white/40 text-sm mt-1">Platform-wide financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="glass-input text-xs py-1.5" value={dateRange.from} onChange={e => setDateRange(p => ({...p, from: e.target.value}))} />
          <span className="text-white/30 text-xs">to</span>
          <input type="date" className="glass-input text-xs py-1.5" value={dateRange.to} onChange={e => setDateRange(p => ({...p, to: e.target.value}))} />
          <button onClick={handleFilter} className="btn-red text-xs px-3 py-1.5 flex items-center gap-1"><Filter className="h-3 w-3"/>Filter</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-5 w-5"/>} title="Transaction Revenue" value={formatCurrency(rev.paid_revenue ?? 0)} sub={`${rev.total_transactions ?? 0} transactions`} />
        <StatCard icon={<TrendingUp className="h-5 w-5"/>} title="Subscription Revenue" value={formatCurrency(subRev.total_subscription_revenue ?? 0)} sub={`${subRev.total_subscriptions ?? 0} subscriptions`} />
        <StatCard icon={<Banknote className="h-5 w-5"/>} title="Platform Fees" value={formatCurrency(pay.total_platform_fees ?? 0)} sub={`${dashboard?.platform_fee_percentage ?? 5}% fee rate`} />
        <StatCard icon={<CreditCard className="h-5 w-5"/>} title="Net Payouts" value={formatCurrency(pay.total_net_amount ?? 0)} sub={`${pay.total_payouts ?? 0} payouts processed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">Revenue Breakdown</h3>
            <select className="glass-input text-xs py-1 px-2" value={graphType} onChange={e=>setGraphType(e.target.value)}>
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
            </select>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {graphType === 'bar' ? (
                <BarChart data={revBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v) => formatCurrency(v)}/>
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {revBreakdown.map((_,i)=><Cell key={i} fill={['#22c55e','#eab308','#ef4444'][i]}/>)}
                  </Bar>
                </BarChart>
              ) : graphType === 'line' ? (
                <LineChart data={revBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v) => formatCurrency(v)}/>
                  <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{fill:'#dc2626',r:4}}/>
                </LineChart>
              ) : (
                <AreaChart data={revBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v) => formatCurrency(v)}/>
                  <Area type="monotone" dataKey="value" stroke="#dc2626" fill="#dc2626" fillOpacity={0.3}/>
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Payout Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payoutBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v) => formatCurrency(v)}/>
                <Bar dataKey="value" radius={[0,6,6,0]}>
                  {payoutBreakdown.map((_,i)=><Cell key={i} fill={['#22c55e','#3b82f6','#eab308'][i]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Payment Methods</h3>
          {methodPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={methodPieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={0}>
                    {methodPieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie><Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff',fontSize:12}} formatter={(v) => formatCurrency(v)}/></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {methodPieData.map((pm,i)=>(
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-white/60 capitalize">{pm.name}</span>
                        <span className="text-xs text-white/80 font-medium">{formatCurrency(pm.value)}</span>
                      </div>
                      <p className="text-[10px] text-white/30">{pm.count} transactions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-white/30">No data available</p>}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Top Bars by Revenue</h3>
          {topBars.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.35)',fontSize:10}} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff',fontSize:12}} formatter={(v) => formatCurrency(v)}/>
                  <Bar dataKey="revenue" name="Paid Out" fill="#dc2626" radius={[4,4,0,0]}/>
                  <Bar dataKey="pending" name="Pending" fill="#eab308" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-white/30">No bar data available</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white/80 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryItem label="Gross Amount" value={formatCurrency(pay.total_gross_amount ?? 0)} />
          <SummaryItem label="Platform Fees" value={formatCurrency(pay.total_platform_fees ?? 0)} />
          <SummaryItem label="Net to Bars" value={formatCurrency(pay.total_net_amount ?? 0)} />
          <SummaryItem label="Pending Payouts" value={formatCurrency(pay.pending_payouts ?? 0)} />
          <SummaryItem label="Subscription Revenue" value={formatCurrency(subRev.total_subscription_revenue ?? 0)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({icon, title, value, sub}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/[0.06] text-red-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-white/40 uppercase tracking-wider">{title}</p>
          <p className="text-lg font-bold text-white mt-0.5">{value}</p>
          {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({label, value}) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-white mt-1">{value}</p>
    </div>
  );
}
