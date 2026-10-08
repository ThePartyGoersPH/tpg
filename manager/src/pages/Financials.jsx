import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, BarChart2, Calendar, Filter, Eye, X, Loader2, ArrowDownToLine, Clock, Receipt } from 'lucide-react';
import { financialsApi } from '../api/financialsApi';
import { orderApi } from '../api/orderApi';
import { posApi } from '../api/posApi';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const Financials = () => {
  const [autoPayout, setAutoPayout] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [trends, setTrends] = useState(null);
  const [posOrders, setPosOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [orderFilters, setOrderFilters] = useState({ status: '', from: '', to: '' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [payoutsData, setPayoutsData] = useState({ payouts: [], summary: null });
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutFilters, setPayoutFilters] = useState({ status: '', from: '', to: '' });

  const [taxReport, setTaxReport] = useState(null);
  const [taxReportLoading, setTaxReportLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [taxFilters, setTaxFilters] = useState({ from: firstOfMonth, to: today });

  useEffect(() => {
    loadFinancials();
    loadOrders();
  }, []);

  useEffect(() => {
    if (activeTab === 'payouts') loadPayouts();
    if (activeTab === 'tax') loadTaxReport();
  }, [activeTab]);

  const loadFinancials = async () => {
    try {
      const [autoPayoutRes, cashflowRes, trendsRes] = await Promise.allSettled([
        financialsApi.getAutoPayout(dateRange),
        financialsApi.getCashflow(dateRange),
        financialsApi.getTrends({ period: '30days' }),
      ]);

      if (autoPayoutRes.status === 'fulfilled') {
        setAutoPayout(autoPayoutRes.value.data.data || autoPayoutRes.value.data);
      }
      if (cashflowRes.status === 'fulfilled') {
        setCashflow(cashflowRes.value.data.data || cashflowRes.value.data);
      }
      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value.data.data || trendsRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load financials:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data } = await posApi.getOrderHistory(orderFilters);
      setPosOrders(data.data || data || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const { data } = await financialsApi.getPayouts(payoutFilters);
      setPayoutsData(data.data || { payouts: [], summary: null });
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const loadTaxReport = async () => {
    setTaxReportLoading(true);
    try {
      const { data } = await orderApi.salesReport(taxFilters);
      setTaxReport(data.data || data);
    } catch (err) {
      console.error('Failed to load tax report:', err);
    } finally {
      setTaxReportLoading(false);
    }
  };

  const handleFilterChange = () => {
    loadFinancials();
  };

  const handleOrderFilterChange = () => {
    loadOrders();
  };

  const viewOrderDetails = async (order) => {
    setOrderDetailLoading(true);
    setSelectedOrder({ ...order, items: [] });
    try {
      const { data } = await posApi.getOrderDetails(order.id);
      const orderData = data.data || data;
      setSelectedOrder(orderData);
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const statusColor = (status) => {
    const colors = { completed: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger' };
    return colors[status] || 'badge-gray';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'overview', label: 'Auto Payout', icon: DollarSign },
          { id: 'cashflow', label: 'Cashflow', icon: TrendingUp },
          { id: 'orders', label: 'POS Orders', icon: CreditCard },
          { id: 'payouts', label: 'Payouts', icon: ArrowDownToLine },
          { id: 'tax', label: 'Tax Report', icon: Receipt },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={activeTab === tab.id ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* AUTO PAYOUT TAB */}
      {activeTab === 'overview' && autoPayout && (
        <div className="space-y-6">
          {/* Date Range Filter */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="w-5 h-5" style={{ color: '#555' }} />
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="input-field w-auto"
                placeholder="From"
              />
              <span style={{ color: '#666' }}>to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="input-field w-auto"
                placeholder="To"
              />
              <button onClick={handleFilterChange} className="btn-primary flex items-center gap-2">
                <Filter className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>

          {/* Auto Payout Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>Total Sales</p>
                <DollarSign className="w-8 h-8" style={{ color: '#60a5fa' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">₱{Number(autoPayout.gross_revenue || 0).toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: '#60a5fa' }}>{autoPayout.order_count || 0} orders</p>
            </div>

            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Platform Fees ({autoPayout.platform_fee_percentage}%)</p>
                <TrendingDown className="w-8 h-8" style={{ color: '#fbbf24' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">₱{Number(autoPayout.platform_fee_amount || 0).toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>Deducted from sales</p>
            </div>

            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Net Earnings</p>
                <Wallet className="w-8 h-8" style={{ color: '#4ade80' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">₱{Number(autoPayout.net_earnings || 0).toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: '#4ade80' }}>Your payout amount</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">Revenue Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#161616' }}>
                <span className="text-sm" style={{ color: '#888' }}>POS Sales</span>
                <span className="text-sm font-semibold text-white">₱{Number(autoPayout.total_sales || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#161616' }}>
                <span className="text-sm" style={{ color: '#888' }}>Reservation Payments</span>
                <span className="text-sm font-semibold text-white">₱{Number(autoPayout.total_reservations || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASHFLOW TAB */}
      {activeTab === 'cashflow' && cashflow && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card"><p className="text-xs font-medium" style={{ color: '#4ade80' }}>Total Income</p><p className="text-2xl font-extrabold text-white mt-1">₱{Number(cashflow.income?.total || 0).toLocaleString()}</p></div>
            <div className="card"><p className="text-xs font-medium" style={{ color: '#ff6666' }}>Total Expenses</p><p className="text-2xl font-extrabold text-white mt-1">₱{Number(cashflow.expenses?.total || 0).toLocaleString()}</p></div>
            <div className="card"><p className="text-xs font-medium" style={{ color: '#fbbf24' }}>Platform Fees</p><p className="text-2xl font-extrabold text-white mt-1">₱{Number(cashflow.platform_fees?.amount || 0).toLocaleString()}</p></div>
            <div className="card"><p className="text-xs font-medium" style={{ color: '#60a5fa' }}>Net Profit</p><p className="text-2xl font-extrabold text-white mt-1">₱{Number(cashflow.net_profit || 0).toLocaleString()}</p></div>
          </div>

          {/* Income & Expenses Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Income Sources
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)' }}>
                  <span className="text-sm" style={{ color: '#ccc' }}>POS Revenue</span>
                  <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>₱{Number(cashflow.income?.pos_revenue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)' }}>
                  <span className="text-sm" style={{ color: '#ccc' }}>Reservations</span>
                  <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>₱{Number(cashflow.income?.reservation_revenue || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Expenses
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-3 rounded-lg" style={{ background: 'rgba(204,0,0,0.08)' }}>
                  <span className="text-sm" style={{ color: '#ccc' }}>Payroll</span>
                  <span className="text-sm font-semibold" style={{ color: '#ff6666' }}>₱{Number(cashflow.expenses?.payroll || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg" style={{ background: 'rgba(204,0,0,0.08)' }}>
                  <span className="text-sm" style={{ color: '#ccc' }}>Inventory</span>
                  <span className="text-sm font-semibold" style={{ color: '#ff6666' }}>₱{Number(cashflow.expenses?.inventory || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payouts */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">Payout Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg text-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                <p className="text-sm" style={{ color: '#4ade80' }}>Released</p>
                <p className="text-xl font-bold text-white">₱{Number(cashflow.payouts?.released || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ background: 'rgba(245,158,11,0.08)' }}>
                <p className="text-sm" style={{ color: '#fbbf24' }}>Pending</p>
                <p className="text-xl font-bold text-white">₱{Number(cashflow.payouts?.pending || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg text-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
                <p className="text-sm" style={{ color: '#60a5fa' }}>Processing</p>
                <p className="text-xl font-bold text-white">₱{Number(cashflow.payouts?.processing || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          {trends && trends.sales_trend && trends.sales_trend.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" style={{ color: '#CC0000' }} />
                Sales Trend (Last 30 Days)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.sales_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#0066FF" name="Revenue" strokeWidth={2} />
                  <Line type="monotone" dataKey="order_count" stroke="#10B981" name="Orders" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* POS ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-5 h-5" style={{ color: '#555' }} />
              <select
                value={orderFilters.status}
                onChange={(e) => setOrderFilters({ ...orderFilters, status: e.target.value })}
                className="input-field w-auto"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input
                type="date"
                value={orderFilters.from}
                onChange={(e) => setOrderFilters({ ...orderFilters, from: e.target.value })}
                className="input-field w-auto"
                placeholder="From"
              />
              <input
                type="date"
                value={orderFilters.to}
                onChange={(e) => setOrderFilters({ ...orderFilters, to: e.target.value })}
                className="input-field w-auto"
                placeholder="To"
              />
              <button onClick={handleOrderFilterChange} className="btn-primary flex items-center gap-2">
                <Filter className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <tr>
                    <th className="table-header">Order #</th>
                    <th className="table-header">Table</th>
                    <th className="table-header">Staff</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Payment</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Date</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr>
                      <td colSpan="8" className="table-cell text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: '#CC0000' }} />
                      </td>
                    </tr>
                  ) : posOrders.length > 0 ? (
                    posOrders.map((order) => (
                      <tr key={order.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="table-cell font-medium">{order.order_number}</td>
                        <td className="table-cell">{order.table_number ? `Table ${order.table_number}` : '—'}</td>
                        <td className="table-cell text-sm">{order.staff_name || '—'}</td>
                        <td className="table-cell font-semibold" style={{ color: '#CC0000' }}>₱{Number(order.total_amount || 0).toLocaleString()}</td>
                        <td className="table-cell text-xs">{order.payment_method || '—'}</td>
                        <td className="table-cell">
                          <span className={statusColor(order.status)}>
                            {order.status}
                          </span>
                        </td>
                        <td className="table-cell text-sm">{order.created_at ? format(parseUTC(order.created_at), 'MMM d, yyyy h:mm a') : '—'}</td>
                        <td className="table-cell text-right">
                          <button
                            onClick={() => viewOrderDetails(order)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#666' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="table-cell text-center py-8" style={{ color: '#555' }}>No orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAYOUTS TAB */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Pending Payout</p>
                <Clock className="w-8 h-8" style={{ color: '#fbbf24' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">
                ₱{(parseFloat(payoutsData.summary?.pending || 0) + parseFloat(payoutsData.summary?.processing || 0)).toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>Pending + processing</p>
            </div>
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Paid Out</p>
                <ArrowDownToLine className="w-8 h-8" style={{ color: '#4ade80' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">
                ₱{parseFloat(payoutsData.summary?.paid_out || 0).toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: '#4ade80' }}>Sent + completed</p>
            </div>
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>Total Payouts</p>
                <Wallet className="w-8 h-8" style={{ color: '#60a5fa' }} />
              </div>
              <p className="text-3xl font-extrabold text-white">
                ₱{parseFloat(payoutsData.summary?.total || 0).toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: '#60a5fa' }}>All time</p>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-5 h-5" style={{ color: '#555' }} />
              <select
                value={payoutFilters.status}
                onChange={(e) => setPayoutFilters({ ...payoutFilters, status: e.target.value })}
                className="input-field w-auto"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="sent">Sent</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input type="date" value={payoutFilters.from} onChange={(e) => setPayoutFilters({ ...payoutFilters, from: e.target.value })} className="input-field w-auto" />
              <input type="date" value={payoutFilters.to} onChange={(e) => setPayoutFilters({ ...payoutFilters, to: e.target.value })} className="input-field w-auto" />
              <button onClick={loadPayouts} className="btn-primary flex items-center gap-2">
                <Filter className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>

          {/* Payouts Table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">Reservation</th>
                    <th className="table-header">Gross</th>
                    <th className="table-header">Platform Fee</th>
                    <th className="table-header">Net Amount</th>
                    <th className="table-header">Method</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Processed</th>
                    <th className="table-header">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutsLoading ? (
                    <tr><td colSpan="9" className="table-cell text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: '#CC0000' }} />
                    </td></tr>
                  ) : payoutsData.payouts.length > 0 ? (
                    payoutsData.payouts.map((p) => {
                      const payoutStatusColor = {
                        pending: '#fbbf24', processing: '#60a5fa',
                        sent: '#a78bfa', completed: '#4ade80',
                        failed: '#ff6666', cancelled: '#555',
                      }[p.status] || '#888';
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="table-cell text-xs" style={{ color: '#666' }}>#{p.id}</td>
                          <td className="table-cell">
                            {p.reservation_txn
                              ? <span className="text-xs font-mono" style={{ color: '#aaa' }}>{p.reservation_txn}</span>
                              : <span style={{ color: '#444' }}>—</span>}
                            {p.reservation_date && <p className="text-xs" style={{ color: '#555' }}>{format(parseUTC(p.reservation_date), 'MMM d, yyyy')}</p>}
                          </td>
                          <td className="table-cell text-sm text-white">₱{Number(p.gross_amount).toLocaleString()}</td>
                          <td className="table-cell text-xs" style={{ color: '#ff9999' }}>
                            ₱{Number(p.platform_fee_amount).toLocaleString()}
                            <span className="ml-1" style={{ color: '#555' }}>({p.platform_fee}%)</span>
                          </td>
                          <td className="table-cell font-bold" style={{ color: '#4ade80' }}>₱{Number(p.net_amount).toLocaleString()}</td>
                          <td className="table-cell text-xs capitalize" style={{ color: '#ccc' }}>{p.payout_method || '—'}</td>
                          <td className="table-cell">
                            <span className="text-xs font-semibold capitalize" style={{ color: payoutStatusColor }}>{p.status}</span>
                          </td>
                          <td className="table-cell text-xs" style={{ color: '#888' }}>
                            {p.processed_at ? format(parseUTC(p.processed_at), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="table-cell">
                            {p.payout_reference
                              ? <span className="text-xs font-mono" style={{ color: '#666' }}>{p.payout_reference}</span>
                              : <span style={{ color: '#444' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="9" className="table-cell text-center py-8" style={{ color: '#555' }}>No payouts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAX REPORT TAB */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          {/* Date Range Filter */}
          <div className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="w-5 h-5" style={{ color: '#555' }} />
              <input
                type="date"
                value={taxFilters.from}
                onChange={(e) => setTaxFilters({ ...taxFilters, from: e.target.value })}
                className="input-field w-auto"
              />
              <span style={{ color: '#666' }}>to</span>
              <input
                type="date"
                value={taxFilters.to}
                onChange={(e) => setTaxFilters({ ...taxFilters, to: e.target.value })}
                className="input-field w-auto"
              />
              <button onClick={loadTaxReport} className="btn-primary flex items-center gap-2">
                <Filter className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>

          {taxReportLoading ? (
            <div className="card flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#CC0000' }} />
            </div>
          ) : taxReport ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>Total Orders</p>
                    <CreditCard className="w-8 h-8" style={{ color: '#60a5fa' }} />
                  </div>
                  <p className="text-3xl font-extrabold text-white">{Number(taxReport.total_orders || 0).toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: '#60a5fa' }}>Web orders only</p>
                </div>

                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.06))' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Net Sales</p>
                    <TrendingUp className="w-8 h-8" style={{ color: '#4ade80' }} />
                  </div>
                  <p className="text-3xl font-extrabold text-white">₱{Number(taxReport.net_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs mt-1" style={{ color: '#4ade80' }}>Before tax</p>
                </div>

                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Tax Collected</p>
                    <Receipt className="w-8 h-8" style={{ color: '#fbbf24' }} />
                  </div>
                  <p className="text-3xl font-extrabold text-white">₱{Number(taxReport.total_tax_collected || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>VAT / tax remittable</p>
                </div>

                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(204,0,0,0.12), rgba(204,0,0,0.06))' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium" style={{ color: '#ff6666' }}>Gross Sales</p>
                    <DollarSign className="w-8 h-8" style={{ color: '#ff6666' }} />
                  </div>
                  <p className="text-3xl font-extrabold text-white">₱{Number(taxReport.total_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs mt-1" style={{ color: '#ff6666' }}>Including tax</p>
                </div>
              </div>

              {/* Tax Breakdown Summary */}
              <div className="card">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5" style={{ color: '#CC0000' }} />
                  Tax Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <p className="text-sm font-medium text-white">Net Sales (excl. tax)</p>
                      <p className="text-xs mt-0.5" style={{ color: '#888' }}>Revenue before tax is applied</p>
                    </div>
                    <p className="text-lg font-bold text-white">₱{Number(taxReport.net_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Output VAT / Tax Collected</p>
                      <p className="text-xs mt-0.5" style={{ color: '#888' }}>Amount remittable to BIR</p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>₱{Number(taxReport.total_tax_collected || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Gross Sales (incl. tax)</p>
                      <p className="text-xs mt-0.5" style={{ color: '#888' }}>Total amount collected from customers</p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: '#4ade80' }}>₱{Number(taxReport.total_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  {Number(taxReport.total_orders || 0) > 0 && (
                    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <p className="text-sm font-medium text-white">Avg Tax per Order</p>
                        <p className="text-xs mt-0.5" style={{ color: '#888' }}>Based on {Number(taxReport.total_orders).toLocaleString()} orders</p>
                      </div>
                      <p className="text-lg font-bold text-white">₱{(Number(taxReport.total_tax_collected || 0) / Number(taxReport.total_orders)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Breakdown Table */}
              {taxReport.daily && taxReport.daily.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-5 h-5" style={{ color: '#CC0000' }} />
                      Daily Tax Breakdown
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <tr>
                          <th className="table-header">Date</th>
                          <th className="table-header text-right">Orders</th>
                          <th className="table-header text-right">Net Sales</th>
                          <th className="table-header text-right">Tax Collected</th>
                          <th className="table-header text-right">Gross Revenue</th>
                          <th className="table-header text-right">Tax %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxReport.daily.map((row, idx) => {
                          const taxPct = Number(row.revenue) > 0
                            ? ((Number(row.tax_collected) / Number(row.revenue)) * 100).toFixed(1)
                            : '0.0';
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <td className="table-cell font-medium text-white">{row.date}</td>
                              <td className="table-cell text-right text-sm" style={{ color: '#60a5fa' }}>{Number(row.orders).toLocaleString()}</td>
                              <td className="table-cell text-right text-sm text-white">₱{(Number(row.revenue) - Number(row.tax_collected)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="table-cell text-right text-sm font-semibold" style={{ color: '#fbbf24' }}>₱{Number(row.tax_collected).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="table-cell text-right text-sm" style={{ color: '#4ade80' }}>₱{Number(row.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="table-cell text-right">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
                                  {taxPct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <tr style={{ background: '#111' }}>
                          <td className="table-cell font-bold text-white">Total</td>
                          <td className="table-cell text-right font-bold" style={{ color: '#60a5fa' }}>{Number(taxReport.total_orders || 0).toLocaleString()}</td>
                          <td className="table-cell text-right font-bold text-white">₱{Number(taxReport.net_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="table-cell text-right font-bold" style={{ color: '#fbbf24' }}>₱{Number(taxReport.total_tax_collected || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="table-cell text-right font-bold" style={{ color: '#4ade80' }}>₱{Number(taxReport.total_sales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="table-cell text-right">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Chart */}
              {taxReport.daily && taxReport.daily.length > 1 && (
                <div className="card">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5" style={{ color: '#CC0000' }} />
                    Revenue vs Tax Chart
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={taxReport.daily.map(r => ({
                      date: r.date,
                      'Net Sales': parseFloat((Number(r.revenue) - Number(r.tax_collected)).toFixed(2)),
                      'Tax': parseFloat(Number(r.tax_collected).toFixed(2)),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(v) => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Bar dataKey="Net Sales" stackId="a" fill="#4ade80" radius={[0,0,0,0]} />
                      <Bar dataKey="Tax" stackId="a" fill="#fbbf24" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-12" style={{ color: '#555' }}>
              No tax data available for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d' }}>
              <h3 className="font-bold text-white">Order Details: {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
              ><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {orderDetailLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: '#CC0000' }} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Order Number</p>
                      <p className="text-sm font-semibold text-white">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Table</p>
                      <p className="text-sm font-semibold text-white">{selectedOrder.table_number ? `Table ${selectedOrder.table_number}` : 'Takeaway'}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Staff</p>
                      <p className="text-sm font-semibold text-white">{selectedOrder.staff_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#666' }}>Status</p>
                      <span className={statusColor(selectedOrder.status)}>{selectedOrder.status}</span>
                    </div>
                  </div>

                  <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <h4 className="font-semibold text-white mb-3">Items Ordered</h4>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="space-y-2">
                        {selectedOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 rounded-lg" style={{ background: '#161616' }}>
                            <div>
                              <p className="text-sm font-medium text-white">{item.item_name || item.name}</p>
                              <p className="text-xs" style={{ color: '#666' }}>Qty: {item.quantity} × ₱{Number(item.unit_price || item.price || 0).toLocaleString()}</p>
                            </div>
                            <p className="text-sm font-semibold text-white">₱{Number((item.quantity || 0) * (item.unit_price || item.price || 0)).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: '#555' }}>No items data available</p>
                    )}
                  </div>

                  <div className="pt-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#888' }}>Subtotal</span>
                      <span className="font-medium text-white">₱{Number(selectedOrder.subtotal || 0).toLocaleString()}</span>
                    </div>
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: '#888' }}>Discount</span>
                        <span className="font-medium" style={{ color: '#ff6666' }}>-₱{Number(selectedOrder.discount_amount || 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-white">Total</span>
                      <span style={{ color: '#CC0000' }}>₱{Number(selectedOrder.total_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {selectedOrder.payment_method && (
                    <div className="p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)' }}>
                      <p className="text-xs font-medium" style={{ color: '#60a5fa' }}>Payment Method</p>
                      <p className="text-sm font-semibold text-white mt-1 capitalize">{selectedOrder.payment_method}</p>
                      {selectedOrder.amount_received > 0 && (
                        <div className="mt-2 text-xs" style={{ color: '#60a5fa' }}>
                          <p>Received: ₱{Number(selectedOrder.amount_received || 0).toLocaleString()}</p>
                          <p>Change: ₱{Number(selectedOrder.change_amount || 0).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financials;
