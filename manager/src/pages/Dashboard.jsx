import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarCheck, DollarSign, Users, TrendingUp,
  AlertTriangle, ShoppingCart, PartyPopper, Clock,
  Brain, RefreshCw, CheckCircle2, ArrowUpRight,
  ChevronLeft, ChevronRight, Calendar, User, MapPin,
} from 'lucide-react';
import { barApi } from '../api/barApi';
import { dssApi } from '../api/dssApi';
import { leaveApi } from '../api/leaveApi';
import useAuthStore from '../stores/authStore';
import LoadingSpinner from '../components/common/LoadingSpinner';

const StatCard = ({ icon: Icon, label, value, sub, color, to }) => (
  <Link to={to || '#'} className="card transition-all duration-200 group" style={{ cursor: 'pointer' }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(204,0,0,0.25)'; e.currentTarget.style.background = '#161616'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = '#111111'; }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium" style={{ color: '#888' }}>{label}</p>
        <p className="text-2xl font-extrabold text-white mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs mt-1" style={{ color: '#555' }}>{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="mt-3 flex items-center text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#CC0000' }}>
      View details <ArrowUpRight className="w-3 h-3 ml-1" />
    </div>
  </Link>
);

const severityConfig = {
  critical: { dot: '#ef4444', label: 'CRITICAL',  bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: '#ef4444' },
  warning:  { dot: '#f59e0b', label: 'WARNING',   bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  insight:  { dot: '#3b82f6', label: 'INSIGHT',   bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
  positive: { dot: '#22c55e', label: 'POSITIVE',  bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  text: '#22c55e' },
};

const DSS_REFRESH_MS = 30 * 60 * 1000;

// Calendar Widget Component
const LeaveCalendar = ({ leaves, onMonthChange }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  // Group leaves by date for quick lookup
  const leavesByDate = useMemo(() => {
    const map = {};
    leaves.forEach((leave) => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(leave);
      }
    });
    return map;
  }, [leaves]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const leaveTypeColors = {
    vacation: '#60a5fa',
    sick: '#f87171',
    emergency: '#fbbf24',
    maternity: '#f472b6',
    paternity: '#a78bfa',
    special: '#34d399',
  };

  const getLeaveColor = (leaveType) => leaveTypeColors[leaveType] || '#60a5fa';

  const dayHasLeaves = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leavesByDate[dateStr] || [];
  };

  return (
    <div className="card" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" style={{ color: '#CC0000' }} />
          Approved Leaves
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666', background: 'rgba(255,255,255,0.04)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-white min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666', background: 'rgba(255,255,255,0.04)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium py-1" style={{ color: '#666' }}>{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayLeaves = dayHasLeaves(day);
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === new Date().toISOString().slice(0, 10);
          const isHovered = hoveredDate === dateStr;

          return (
            <div
              key={day}
              className="relative aspect-square rounded-lg flex flex-col cursor-pointer transition-all"
              style={{
                background: dayLeaves.length > 0 ? 'rgba(204,0,0,0.08)' : (isToday ? 'rgba(204,0,0,0.1)' : 'transparent'),
                border: isToday ? '1px solid #CC0000' : (dayLeaves.length > 0 ? '1px solid rgba(204,0,0,0.3)' : '1px solid transparent'),
              }}
              onMouseEnter={() => dayLeaves.length > 0 && setHoveredDate(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <span className="text-xs font-medium flex-1 flex items-center justify-center" style={{ color: dayLeaves.length > 0 ? '#fff' : (isToday ? '#CC0000' : '#ccc') }}>
                {day}
              </span>
              {dayLeaves.length > 0 && (
                <div className="flex gap-1 px-1 pb-1">
                  {dayLeaves.slice(0, 3).map((leave, idx) => (
                    <div
                      key={leave.id}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: getLeaveColor(leave.leave_type) }}
                      title={`${leave.first_name} ${leave.last_name} - ${leave.leave_type}`}
                    />
                  ))}
                  {dayLeaves.length > 3 && (
                    <span className="text-[8px] text-white/60 flex items-center">+{dayLeaves.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip / Popover */}
      {hoveredDate && dayHasLeaves(Number(hoveredDate.split('-')[2])).length > 0 && (
        <div className="fixed z-50 pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="card w-80 p-4 shadow-2xl" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-white">{new Date(hoveredDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h4>
              <button onClick={() => setHoveredDate(null)} className="p-1 rounded-lg" style={{ color: '#666' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}>×</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dayHasLeaves(Number(hoveredDate.split('-')[2])).map((leave) => (
                <div key={leave.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${getLeaveColor(leave.leave_type)}40` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: getLeaveColor(leave.leave_type) }}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{leave.first_name} {leave.last_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: getLeaveColor(leave.leave_type) }}>
                        {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full badge-success">Approved</span>
                    </div>
                    {leave.reason && <p className="text-xs mt-1" style={{ color: '#888' }}>{leave.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dss, setDss] = useState(null);
  const [dssLoading, setDssLoading] = useState(false);
  const [dssUpdatedAt, setDssUpdatedAt] = useState(null);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const can = (perms) => hasPermission(Array.isArray(perms) ? perms : [perms]);

  const loadDss = useCallback(async () => {
    if (!can('analytics_bar_view')) return;
    setDssLoading(true);
    try {
      const { data } = await dssApi.getRecommendations();
      setDss(data);
      setDssUpdatedAt(new Date());
    } catch (err) {
      console.error('DSS fetch error:', err);
    } finally {
      setDssLoading(false);
    }
  }, []);

  const loadApprovedLeaves = useCallback(async () => {
    if (!can('leave_view_all') && !can('leave_view_own')) return;
    setLeavesLoading(true);
    try {
      const today = new Date();
      const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, 0);
      const from = threeMonthsAgo.toISOString().slice(0, 10);
      const to = threeMonthsLater.toISOString().slice(0, 10);
      const { data } = await leaveApi.list({ status: 'approved', from, to });
      setApprovedLeaves(data.data || data || []);
    } catch (err) {
      console.error('Approved leaves fetch error:', err);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        if (can(['bar_details_view', 'reservation_view', 'menu_view', 'financials_view', 'analytics_bar_view'])) {
          const response = await barApi.getDashboardSummary({ silentError: true });
          setSummary(response.data.data || response.data);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    loadDss();
    loadApprovedLeaves();
    const interval = setInterval(loadDss, DSS_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Welcome — always shown */}
      <div className="card text-white border-0" style={{ background: 'linear-gradient(135deg, #CC0000 0%, #6b0f00 100%)', boxShadow: '0 0 40px rgba(204,0,0,0.2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              Welcome back, {user?.first_name}!
            </h1>
            <p className="text-white/70 mt-1 text-sm">
              Here's what's happening at your bar today.
            </p>
          </div>
          <PartyPopper className="w-12 h-12 text-white/20" />
        </div>
      </div>

      {/* Stats Grid */}
      {can(['reservation_view', 'bar_details_view', 'financials_view', 'events_view']) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {can('reservation_view') && (
              <StatCard
                icon={CalendarCheck}
                label="Today's Reservations"
                value={summary?.reservations_today ?? 0}
                color="" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
                to="/reservations"
              />
            )}
            {can('financials_view') && (
              <StatCard
                icon={DollarSign}
                label="Today's Revenue"
                value={summary?.today_revenue != null ? `₱${Number(summary.today_revenue).toLocaleString()}` : '₱0'}
                color="" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}
                to="/financials"
              />
            )}
            {can('financials_view') && (
              <StatCard
                icon={ShoppingCart}
                label="Today's Orders"
                value={summary?.today_orders ?? 0}
                color="" style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}
                to="/financials"
              />
            )}
            {can('events_view') && (
              <StatCard
                icon={PartyPopper}
                label="Upcoming Events"
                value={summary?.upcoming_events ?? 0}
                color="" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}
                to="/events"
              />
            )}
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approved Leaves Calendar */}
        {(can('leave_view_all') || can('leave_view_own')) && (
          <div className="lg:col-span-1">
            <LeaveCalendar leaves={approvedLeaves} />
          </div>
        )}

        {/* Low Stock Alerts */}
        {can('menu_view') && (
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-white">Low Stock Alerts</h3>
            </div>
            {summary?.low_stock_alerts?.length > 0 ? (
              <div className="space-y-2">
                {summary.low_stock_alerts.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-sm" style={{ color: '#ccc' }}>{item.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      item.stock_status === 'critical' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {item.stock_qty} {item.unit || 'pcs'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No low stock alerts.</p>
            )}
          </div>
        )}

        {/* Top Menu Items */}
        {can('menu_view') && (
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <h3 className="font-bold text-white">Top Menu Items</h3>
            </div>
            {summary?.top_menu_items?.length > 0 ? (
              <div className="space-y-2">
                {summary.top_menu_items.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.15)', color: '#CC0000' }}>
                        {i + 1}
                      </span>
                      <span className="text-sm" style={{ color: '#ccc' }}>{item.name || item.menu_name}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#666' }}>{item.total_qty || item.count} sold</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No sales data yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Smart Suggestions DSS Panel */}
      {can('analytics_bar_view') && (
        <div className="card" style={{ borderColor: 'rgba(59,130,246,0.15)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5" style={{ color: '#3b82f6' }} />
              <h3 className="font-bold text-white">Smart Suggestions</h3>
            </div>
            <button
              onClick={loadDss}
              disabled={dssLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <RefreshCw className={`w-3 h-3 ${dssLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {dssUpdatedAt && (
            <p className="text-xs mb-4" style={{ color: '#555' }}>
              Last updated: {dssUpdatedAt.toLocaleTimeString()}
            </p>
          )}

          {dssLoading && !dss ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: '#1a1a1a' }} />
              ))}
            </div>
          ) : dss?.recommendations?.length > 0 ? (
            <div className="space-y-3">
              {dss.recommendations.map((rec) => {
                const cfg = severityConfig[rec.severity] || severityConfig.insight;
                return (
                  <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: cfg.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold tracking-wider" style={{ color: cfg.text }}>{cfg.label}</span>
                        <span className="text-xs font-semibold text-white">{rec.title}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>{rec.message}</p>
                    </div>
                    <button
                      onClick={() => navigate(rec.action_route)}
                      className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#ccc'; }}
                    >
                      {rec.action_label} →
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 className="w-8 h-8" style={{ color: '#22c55e' }} />
              <p className="text-sm font-medium" style={{ color: '#4ade80' }}>All good!</p>
              <p className="text-xs text-center" style={{ color: '#555' }}>
                {dss?.message || 'No suggestions at the moment.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Staff Activity */}
      {can('staff_view') && summary?.recent_staff_activity?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-white">Recent Staff Activity</h3>
          </div>
          <div className="space-y-2">
            {summary.recent_staff_activity.slice(0, 5).map((act, i) => (
              <div key={i} className="flex items-center gap-3 py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#CC0000' }}>
                  {act.first_name?.[0]}{act.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{act.first_name} {act.last_name}</p>
                  <p className="text-xs" style={{ color: '#666' }}>{act.action || act.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance shortcut for users with only attendance permissions */}
      {can(['attendance_view_own', 'attendance_create']) && !can('bar_details_view') && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-white">Attendance</h3>
          </div>
          <p className="text-sm mb-3" style={{ color: '#888' }}>Manage your attendance records and time tracking.</p>
          <Link to="/attendance" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" /> Go to Attendance
          </Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
