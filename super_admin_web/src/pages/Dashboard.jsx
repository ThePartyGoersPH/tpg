import { useEffect, useState } from 'react';
import { dashboardAPI, paymentsAPI } from '../api/services';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { Users, CreditCard, Store, DollarSign, Activity, TrendingUp, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const PIE_COLORS = ['#dc2626','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [graphType, setGraphType] = useState('bar');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [summaryRes, paymentRes, activityRes] = await Promise.allSettled([
        dashboardAPI.getSummary(),
        paymentsAPI.dashboard(),
        dashboardAPI.getRecentActivity(15),
      ]);
      if (summaryRes.status === 'fulfilled' && summaryRes.value.data.success) setSummary(summaryRes.value.data.data);
      if (paymentRes.status === 'fulfilled' && paymentRes.value.data.success) setPaymentData(paymentRes.value.data.data);
      if (activityRes.status === 'fulfilled' && activityRes.value.data.success) setRecentActivity(activityRes.value.data.data || []);
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>;

  const s = summary || {};
  const rev = paymentData?.revenue || {};
  const pay = paymentData?.payouts || {};
  const subRev = paymentData?.subscription_revenue || {};
  const pieData = (paymentData?.payment_methods || []).map(pm => ({ name: pm.payment_method || 'Unknown', value: Number(pm.total_amount) || 0, count: pm.count }));
  const revBarData = [{ name: 'Paid', value: Number(rev.paid_revenue) || 0 }, { name: 'Pending', value: Number(rev.pending_revenue) || 0 }, { name: 'Failed', value: Number(rev.failed_revenue) || 0 }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Platform overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SC icon={<Store className="h-5 w-5"/>} t="Total Bars" v={s.total_bars ?? 0} sub={`${s.active_bars ?? 0} active · ${s.pending_bars ?? 0} pending`}/>
        <SC icon={<Users className="h-5 w-5"/>} t="Total Users" v={s.total_users ?? 0} sub={`${s.active_users ?? 0} active`}/>
        <SC icon={<DollarSign className="h-5 w-5"/>} t="Transaction Revenue" v={formatCurrency(rev.paid_revenue ?? 0)} sub={`${rev.total_transactions ?? 0} transactions`}/>
        <SC icon={<TrendingUp className="h-5 w-5"/>} t="Subscription Revenue" v={formatCurrency(subRev.total_subscription_revenue ?? 0)} sub={`${subRev.total_subscriptions ?? 0} subscriptions`}/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SC icon={<TrendingUp className="h-5 w-5"/>} t="Platform Earnings" v={formatCurrency(paymentData?.platform_earnings ?? 0)} sub={`${paymentData?.platform_fee_percentage ?? 5}% fee rate`}/>
        <SC icon={<CreditCard className="h-5 w-5"/>} t="Pending Payouts" v={formatCurrency(pay.pending_payouts ?? 0)} sub={`${pay.total_payouts ?? 0} total`}/>
        <SC icon={<Clock className="h-5 w-5"/>} t="Pending Revenue" v={formatCurrency(rev.pending_revenue ?? 0)} sub="Awaiting payment"/>
        <SC icon={<AlertTriangle className="h-5 w-5"/>} t="Failed Payments" v={formatCurrency(rev.failed_revenue ?? 0)} sub="Needs attention"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/80">Revenue Breakdown</h3>
            <select className="glass-input text-xs py-1 px-2" value={graphType} onChange={e=>setGraphType(e.target.value)}>
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {graphType === 'bar' ? (
                <BarChart data={revBarData}>
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v)=>formatCurrency(v)}/>
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {revBarData.map((_,i)=><Cell key={i} fill={['#22c55e','#eab308','#ef4444'][i]}/>)}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={revBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff'}} formatter={(v)=>formatCurrency(v)}/>
                  <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{fill:'#dc2626',r:4}}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Payment Methods</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={0}>
                    {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie><Tooltip contentStyle={{background:'rgba(30,15,25,0.95)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff',fontSize:12}}/></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((pm,i)=>(
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                    <span className="text-white/60 capitalize flex-1">{pm.name}</span>
                    <span className="text-white/80 font-medium">{pm.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-white/30">No payment data</p>}
          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-white/40">Completed Payouts</span><span className="text-green-400 font-medium">{formatCurrency(pay.completed_payouts ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Processing</span><span className="text-blue-400 font-medium">{formatCurrency(pay.processing_payouts ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Pending</span><span className="text-amber-400 font-medium">{formatCurrency(pay.pending_payouts ?? 0)}</span></div>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white/80 mb-4">Recent Activity</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {recentActivity.map((item,i)=>(
                <div key={i} className="flex items-start gap-3 p-2 hover:bg-white/[0.03] rounded-lg">
                  <div className="w-1.5 h-1.5 mt-2 rounded-full bg-red-500 flex-shrink-0"/>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/70 truncate">{item.action?.replace(/_/g,' ')}</p>
                    <p className="text-[11px] text-white/30">{item.actor_name||'System'} · {formatRelativeTime(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-white/30">No recent activity</p>}
          <Link to="/audit-logs" className="mt-3 flex items-center text-xs text-red-400 hover:text-red-300">
            View all logs <ChevronRight className="h-3 w-3 ml-1"/>
          </Link>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/80">Quick Navigation</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {to:'/bars',label:'Manage Bars',count:s.pending_bars},
            {to:'/revenue',label:'Revenue Analytics'},
            {to:'/payouts',label:'Process Payouts',count:pay.total_payouts},
            {to:'/subscriptions',label:'Subscriptions'},
            {to:'/users',label:'User Management'},
            {to:'/banning',label:'Customer Banning'},
            {to:'/settings',label:'System Settings'},
          ].map(q=>(
            <Link key={q.to} to={q.to} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] transition group">
              <span className="text-xs font-medium text-white/60 group-hover:text-white/90">{q.label}</span>
              {q.count > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400">{q.count}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function SC({icon,t,v,sub}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/[0.06] text-red-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-white/40 uppercase tracking-wider">{t}</p>
          <p className="text-lg font-bold text-white mt-0.5">{v}</p>
          {sub && <p className="text-[11px] text-white/30 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
