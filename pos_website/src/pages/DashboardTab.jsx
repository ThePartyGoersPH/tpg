import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  History,
  Inbox,
  Package,
  Play,
  Receipt,
  RefreshCw,
  Square,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { posApi } from '../api/pos';

const INITIAL_REPORT_FILTERS = {
  date: '',
  shift_id: '',
};

function formatCurrency(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeCsv(value) {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export default function DashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shiftData, setShiftData] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [reportFilters, setReportFilters] = useState(INITIAL_REPORT_FILTERS);

  const [openingCash, setOpeningCash] = useState('');
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInReason, setCashInReason] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [cashOutReason, setCashOutReason] = useState('');
  const [actualCash, setActualCash] = useState('');

  const buildReportParams = useCallback((filters) => {
    const params = {};
    if (filters?.date) {
      params.date = filters.date;
      params.from = filters.date;
      params.to = filters.date;
    }
    if (filters?.shift_id && String(filters.shift_id).trim() !== '') {
      params.shift_id = Number(filters.shift_id);
    }
    return params;
  }, []);

  const loadShiftReport = useCallback(async (filters) => {
    const activeFilters = filters || INITIAL_REPORT_FILTERS;
    setReportLoading(true);
    setReportError('');
    try {
      const params = buildReportParams(activeFilters);
      const { data: res } = await posApi.listShiftReport(params);
      setReportRows(res?.data || []);
    } catch (err) {
      setReportError(err?.response?.data?.message || 'Failed to load shift history.');
      setReportRows([]);
    } finally {
      setReportLoading(false);
    }
  }, [buildReportParams]);

  const downloadShiftCsv = useCallback((rows, fileName) => {
    if (!rows?.length) {
      setActionMessage('No shift history records available for download.');
      return;
    }

    const headers = [
      'Shift ID',
      'Staff Name',
      'Staff Email',
      'Status',
      'Close Status',
      'Opening Cash',
      'Expected Cash',
      'Actual Cash',
      'Difference',
      'Started At',
      'Closed At',
    ];

    const lines = rows.map((row) => ([
      row.id,
      row.cashier_name || '-',
      row.cashier_email || '-',
      row.status || '-',
      row.close_status || '-',
      Number(row.opening_cash || 0).toFixed(2),
      Number(row.expected_cash || 0).toFixed(2),
      Number(row.actual_cash || 0).toFixed(2),
      Number(row.difference || 0).toFixed(2),
      row.created_at || '',
      row.closed_at || '',
    ].map(escapeCsv).join(',')));

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await posApi.getDashboard();
      setData(res?.data || res || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShift = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setShiftLoading(true);
    }
    setShiftError('');
    try {
      const { data: res } = await posApi.getCurrentShift();
      const payload = Object.prototype.hasOwnProperty.call(res || {}, 'data') ? res?.data : res;
      const normalized = payload?.shift?.id ? payload : null;
      setShiftData(normalized);
    } catch (err) {
      setShiftError(err?.response?.data?.message || 'Failed to load current shift.');
    } finally {
      if (!silent) {
        setShiftLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadShift();
    loadShiftReport(INITIAL_REPORT_FILTERS);
  }, [loadDashboard, loadShift, loadShiftReport]);

  const shiftBreakdown = shiftData?.breakdown || null;
  const hasOpenShift = Boolean(shiftData?.shift?.id);
  const expectedCash = Number(shiftBreakdown?.expected_cash || 0);

  const differencePreview = useMemo(() => {
    if (actualCash === '') return 0;
    return Number(actualCash || 0) - expectedCash;
  }, [actualCash, expectedCash]);

  const differenceLabel = differencePreview === 0 ? 'BALANCED' : differencePreview < 0 ? 'SHORT' : 'OVER';

  const startShift = async () => {
    setActionLoading(true);
    setActionMessage('');
    setShiftError('');
    try {
      await posApi.startShift({ opening_cash: Number(openingCash || 0) });
      setOpeningCash('');
      setActionMessage('Shift started successfully.');
      await loadShift();
    } catch (err) {
      setShiftError(err?.response?.data?.message || 'Failed to start shift.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitCashMovement = async (type) => {
    const isIn = type === 'in';
    const amount = Number(isIn ? cashInAmount : cashOutAmount);
    const reason = isIn ? cashInReason : cashOutReason;

    setActionLoading(true);
    setActionMessage('');
    setShiftError('');
    try {
      if (isIn) {
        await posApi.cashIn({ amount, reason });
        setCashInAmount('');
        setCashInReason('');
      } else {
        await posApi.cashOut({ amount, reason });
        setCashOutAmount('');
        setCashOutReason('');
      }
      setActionMessage(isIn ? 'Cash in recorded.' : 'Cash out recorded.');
      await loadShift();
    } catch (err) {
      setShiftError(err?.response?.data?.message || 'Failed to record cash movement.');
    } finally {
      setActionLoading(false);
    }
  };

  const endShift = async () => {
    setActionLoading(true);
    setActionMessage('');
    setShiftError('');
    try {
      const { data: res } = await posApi.endShift({ actual_cash: Number(actualCash || 0) });
      const result = res?.data || {};
      setActualCash('');
      setActionMessage(`Shift closed: ${result.close_status || 'CLOSED'} (${formatCurrency(result.difference || 0)}).`);
      await loadShift();
      await loadDashboard();
      await loadShiftReport(reportFilters);
    } catch (err) {
      setShiftError(err?.response?.data?.message || 'Failed to close shift.');
    } finally {
      setActionLoading(false);
    }
  };

  const applyHistoryFilters = async (event) => {
    event.preventDefault();
    await loadShiftReport(reportFilters);
  };

  const clearHistoryFilters = async () => {
    const reset = INITIAL_REPORT_FILTERS;
    setReportFilters(reset);
    await loadShiftReport(reset);
  };

  const downloadCurrentHistory = () => {
    downloadShiftCsv(reportRows, `shift-history-${Date.now()}.csv`);
  };

  const downloadSelectedShift = () => {
    const shiftId = Number(reportFilters.shift_id);
    if (!Number.isFinite(shiftId) || shiftId <= 0) {
      setActionMessage('Enter a valid Shift ID first.');
      return;
    }
    const rows = reportRows.filter((row) => Number(row.id) === shiftId);
    downloadShiftCsv(rows, `shift-${shiftId}-history.csv`);
  };

  const downloadAllHistory = async () => {
    setActionLoading(true);
    setReportError('');
    try {
      const { data: res } = await posApi.listShiftReport();
      downloadShiftCsv(res?.data || [], `shift-history-all-${Date.now()}.csv`);
    } catch (err) {
      setReportError(err?.response?.data?.message || 'Failed to download full shift history.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <span className="es-icon"><ClipboardList size={20} /></span>
        <strong>Loading report…</strong>
        <p>Pulling today&apos;s revenue, orders, and shift data.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <span className="es-icon"><TriangleAlert size={20} /></span>
        <strong>Couldn&apos;t load the report</strong>
        <p className="error-msg">{error}</p>
        <button className="btn-secondary" onClick={loadDashboard}>Try again</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <span className="es-icon"><Inbox size={20} /></span>
        <strong>No report data yet</strong>
        <p>Once this bar starts trading, revenue and shift numbers will appear here.</p>
        <button className="btn-secondary" onClick={loadDashboard}>Refresh</button>
      </div>
    );
  }

  return (
    <section className="report-layout">
      <div className="panel-header">
        <div className="section-title">
          <span className="sec-icon"><ClipboardList size={16} /></span>
          <div>
            <h2>Report Overview</h2>
            <span className="head-sub">Today&apos;s trading at a glance</span>
          </div>
        </div>
        <div className="panel-actions">
          <button className="btn-secondary" onClick={loadDashboard}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="cards-grid">
        <article className="metric-card">
          <span className="metric-icon"><Banknote size={20} /></span>
          <div className="metric-body">
            <p>Today Revenue</p>
            <h3>{formatCurrency(data.today?.revenue)}</h3>
            <span className="metric-meta"><CalendarRange size={12} /> {formatCurrency(data.week?.revenue)} this week</span>
          </div>
        </article>

        <article className="metric-card">
          <span className="metric-icon ok"><CheckCircle2 size={20} /></span>
          <div className="metric-body">
            <p>Completed Orders</p>
            <h3>{Number(data.today?.completed_count || 0)}</h3>
            <span className="metric-meta">Settled and closed today</span>
          </div>
        </article>

        <article className="metric-card">
          <span className="metric-icon warn"><Clock3 size={20} /></span>
          <div className="metric-body">
            <p>Pending Orders</p>
            <h3>{Number(data.today?.pending_count || 0)}</h3>
            <span className="metric-meta">Still awaiting payment</span>
          </div>
        </article>

        <article className="metric-card">
          <span className="metric-icon info"><TrendingUp size={20} /></span>
          <div className="metric-body">
            <p>Week Revenue</p>
            <h3>{formatCurrency(data.week?.revenue)}</h3>
            <span className="metric-meta">Rolling 7 days</span>
          </div>
        </article>
      </div>

      <div className="split-grid">
        <article className="box-card">
          <div className="section-head">
            <div className="section-title">
              <span className="sec-icon"><Receipt size={16} /></span>
              <div>
                <h4>Top Items</h4>
                <span className="head-sub">Best sellers today</span>
              </div>
            </div>
          </div>
          {(data.top_items || []).length ? (
            <ul>
              {data.top_items.map((item) => (
                <li key={item.item_name}>
                  <span>{item.item_name}</span>
                  <span>{item.total_qty} sold</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="es-icon"><Receipt size={18} /></span>
              <strong>No sales yet</strong>
              <p>Completed orders will show up here ranked by quantity sold.</p>
            </div>
          )}
        </article>

        <article className="box-card">
          <div className="section-head">
            <div className="section-title">
              <span className="sec-icon"><TriangleAlert size={16} /></span>
              <div>
                <h4>Low Stock</h4>
                <span className="head-sub">Reorder before service</span>
              </div>
            </div>
          </div>
          {(data.low_stock || []).length ? (
            <ul>
              {data.low_stock.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span>{item.stock_qty} left</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="es-icon"><Package size={18} /></span>
              <strong>Stock levels are healthy</strong>
              <p>Anything running low will be flagged here automatically.</p>
            </div>
          )}
        </article>
      </div>

      <article className="box-card">
        <div className="section-head">
          <div className="section-title">
            <span className="sec-icon"><Wallet size={16} /></span>
            <div>
              <h4>Cash Shift Management</h4>
              <span className="head-sub">
                {hasOpenShift ? `Shift #${shiftData.shift?.id} is open` : 'Open the drawer to start taking cash'}
              </span>
            </div>
          </div>
          <div className="panel-actions">
            <span className={`status-pill ${hasOpenShift ? 'ok' : 'muted'}`}><i /> {hasOpenShift ? 'Shift Open' : 'No Open Shift'}</span>
            <button className="btn-secondary" onClick={() => loadShift()} disabled={shiftLoading}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {shiftLoading ? <p className="empty-note">Loading shift...</p> : null}
        {shiftError ? <p className="error-msg">{shiftError}</p> : null}
        {actionMessage ? <p className="ok-msg">{actionMessage}</p> : null}

        {!shiftLoading && !hasOpenShift ? (
          <div className="cash-form-row">
            <label>
              Opening Cash
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="Enter opening balance"
              />
            </label>
            <button className="btn-primary btn-lg" onClick={startShift} disabled={actionLoading}>
              <Play size={15} /> {actionLoading ? 'Starting…' : 'Start Shift'}
            </button>
          </div>
        ) : null}

        {!shiftLoading && hasOpenShift ? (
          <div className="cash-grid">
            <div><span>Shift ID</span><strong>#{shiftData.shift?.id}</strong></div>
            <div><span>Started By</span><strong>{shiftData.shift?.cashier_name || `Staff #${shiftData.shift?.cashier_id || '-'}`}</strong></div>
            <div><span>Opening Cash</span><strong>{formatCurrency(shiftBreakdown?.opening_cash)}</strong></div>
            <div><span>Cash Sales</span><strong>{formatCurrency(shiftBreakdown?.cash_sales)}</strong></div>
            <div><span>Cash In</span><strong>{formatCurrency(shiftBreakdown?.cash_in)}</strong></div>
            <div><span>Cash Out</span><strong>{formatCurrency(shiftBreakdown?.cash_out)}</strong></div>
            <div><span>Expected Cash</span><strong>{formatCurrency(shiftBreakdown?.expected_cash)}</strong></div>
            <div><span>Opened At</span><strong>{formatDateTime(shiftData.shift?.created_at)}</strong></div>
          </div>
        ) : null}

        {!shiftLoading && hasOpenShift ? (
          <>
            <div className="cash-form-row">
              <label>
                Cash In Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashInAmount}
                  onChange={(e) => setCashInAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                Cash In Reason
                <input value={cashInReason} onChange={(e) => setCashInReason(e.target.value)} placeholder="Add change fund" />
              </label>
              <button className="btn-secondary" onClick={() => submitCashMovement('in')} disabled={actionLoading}>
                <ArrowDownToLine size={14} /> Add Cash In
              </button>
            </div>

            <div className="cash-form-row">
              <label>
                Cash Out Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashOutAmount}
                  onChange={(e) => setCashOutAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                Cash Out Reason
                <input value={cashOutReason} onChange={(e) => setCashOutReason(e.target.value)} placeholder="Expense / withdrawal" />
              </label>
              <button className="btn-danger-outline" onClick={() => submitCashMovement('out')} disabled={actionLoading}>
                <ArrowUpFromLine size={14} /> Add Cash Out
              </button>
            </div>

            <div className="cash-form-row">
              <label>
                Actual Cash (Counted)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="Counted cash at end of shift"
                />
              </label>
              <div className={`cash-breakdown ${differenceLabel === 'SHORT' ? 'is-short' : differenceLabel === 'OVER' ? 'is-over' : 'is-balanced'}`}>
                <span>Difference Preview</span>
                <strong>{formatCurrency(differencePreview)}</strong>
                <small className={differenceLabel === 'SHORT' ? 'danger' : differenceLabel === 'OVER' ? 'warn' : 'ok'}>{differenceLabel}</small>
              </div>
              <button className="btn-primary btn-lg" onClick={endShift} disabled={actionLoading || actualCash === ''}>
                <Square size={14} /> {actionLoading ? 'Closing…' : 'End Shift'}
              </button>
            </div>
          </>
        ) : null}
      </article>

      <article className="box-card">
        <div className="section-head">
          <div className="section-title">
            <span className="sec-icon"><History size={16} /></span>
            <div>
              <h4>Shift History</h4>
              <span className="head-sub">Reconcile past drawers and export CSV</span>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => loadShiftReport(reportFilters)} disabled={reportLoading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <form className="history-controls" onSubmit={applyHistoryFilters}>
          <label>
            Day
            <input
              type="date"
              value={reportFilters.date}
              onChange={(e) => setReportFilters((prev) => ({ ...prev, date: e.target.value }))}
            />
          </label>
          <label>
            Shift ID
            <input
              type="number"
              min="1"
              value={reportFilters.shift_id}
              onChange={(e) => setReportFilters((prev) => ({ ...prev, shift_id: e.target.value }))}
              placeholder="e.g. 101"
            />
          </label>
          <button className="btn-primary" type="submit" disabled={reportLoading}>Apply Filter</button>
          <button type="button" className="btn-secondary" onClick={clearHistoryFilters} disabled={reportLoading}>Clear</button>
        </form>

        <div className="history-actions">
          <button className="btn-secondary" type="button" onClick={downloadCurrentHistory} disabled={reportLoading || !reportRows.length}>
            <Download size={14} /> Download Filtered
          </button>
          <button className="btn-secondary" type="button" onClick={downloadSelectedShift} disabled={reportLoading}>
            <Download size={14} /> Download Per Shift
          </button>
          <button className="btn-secondary" type="button" onClick={downloadAllHistory} disabled={actionLoading}>
            <Download size={14} /> Download All History
          </button>
        </div>

        {reportError ? <p className="error-msg">{reportError}</p> : null}
        {reportLoading ? <p className="empty-note">Loading shift history...</p> : null}

        {!reportLoading ? (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Opening</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Difference</th>
                  <th>Started</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => {
                  const closeStatus = String(row.close_status || row.status || '-').toUpperCase();
                  const tone = closeStatus.includes('BALANC')
                    ? 'ok'
                    : closeStatus.includes('SHORT')
                      ? 'danger'
                      : closeStatus.includes('OVER')
                        ? 'warn'
                        : closeStatus.includes('OPEN')
                          ? 'info'
                          : 'muted';
                  const diff = Number(row.difference || 0);
                  return (
                    <tr key={row.id}>
                      <td className="num">#{row.id}</td>
                      <td>{row.cashier_name || `Staff #${row.cashier_id}`}</td>
                      <td><span className={`status-pill ${tone}`}><i /> {closeStatus}</span></td>
                      <td className="num">{formatCurrency(row.opening_cash)}</td>
                      <td className="num">{formatCurrency(row.expected_cash)}</td>
                      <td className="num">{formatCurrency(row.actual_cash)}</td>
                      <td className="num">{diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>{formatDateTime(row.closed_at)}</td>
                    </tr>
                  );
                })}
                {!reportRows.length ? (
                  <tr>
                    <td colSpan={9} className="history-empty">
                      <div className="empty-state">
                        <span className="es-icon"><Inbox size={20} /></span>
                        <strong>No shift history found</strong>
                        <p>No closed shifts match this filter yet. Clear the filters to see every past drawer.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
