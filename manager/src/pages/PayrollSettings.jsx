import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Info } from 'lucide-react';
import apiClient from '../api/apiClient';
import { leaveApi } from '../api/leaveApi';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { format } from 'date-fns';

const PayrollSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    sss_rate: 4.50,
    philhealth_rate: 3.00,
    pagibig_rate: 2.00,
    withholding_tax_rate: 0.00,
    minimum_wage: 610.00,
    updated_at: null
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/hr/payroll/settings');
      if (data.success && data.data) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error('Failed to load payroll settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await apiClient.put('/hr/payroll/settings', {
        sss_rate: Number(settings.sss_rate),
        philhealth_rate: Number(settings.philhealth_rate),
        pagibig_rate: Number(settings.pagibig_rate),
        withholding_tax_rate: Number(settings.withholding_tax_rate),
        minimum_wage: Number(settings.minimum_wage)
      });
      
      if (data.success) {
        toast.success('Payroll settings updated successfully!');
        loadSettings(); // Reload to get updated timestamp
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // ── Leave-to-cash conversion window (company-wide, stored on the backend) ──
  const [windowLoading, setWindowLoading] = useState(true);
  const [windowSaving, setWindowSaving] = useState(false);
  const [windowCfg, setWindowCfg] = useState({
    frequency: 'yearly',
    months: [12],
    open_day: 1,
    close_day: 31,
    configured: false,
    windows: [],
  });

  const loadWindowSettings = async () => {
    try {
      const { data } = await leaveApi.conversionSettings();
      if (data?.success && data.data) {
        setWindowCfg({
          frequency: data.data.frequency,
          months: data.data.months,
          open_day: data.data.open_day,
          close_day: data.data.close_day,
          configured: Boolean(data.data.configured),
          windows: data.data.windows || [],
        });
      }
    } catch (err) {
      console.error('Failed to load conversion window settings:', err);
    } finally {
      setWindowLoading(false);
    }
  };

  useEffect(() => { loadWindowSettings(); }, []);

  const DEFAULT_MONTHS = { yearly: [12], semiannual: [6, 12], quarterly: [1, 4, 7, 10] };
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const handleFrequencyChange = (frequency) => {
    setWindowCfg(prev => ({ ...prev, frequency, months: DEFAULT_MONTHS[frequency] || prev.months }));
  };

  const setMonthAt = (index, month) => {
    setWindowCfg(prev => {
      const months = [...prev.months];
      months[index] = month;
      return { ...prev, months };
    });
  };

  const toggleMonth = (month) => {
    setWindowCfg(prev => ({
      ...prev,
      months: prev.months.includes(month)
        ? prev.months.filter(m => m !== month)
        : [...prev.months, month].sort((a, b) => a - b),
    }));
  };

  // Local preview of the same maths the backend runs (day range clamped to
  // the real length of each month) so the admin sees windows before saving.
  const previewWindows = () => {
    const year = new Date().getFullYear();
    const clamp = (value, fallback) => Math.min(31, Math.max(1, Math.round(Number(value)) || fallback));
    const openDay = clamp(windowCfg.open_day, 1);
    const closeDay = Math.max(openDay, clamp(windowCfg.close_day, 31));
    return [...windowCfg.months]
      .filter(m => m >= 1 && m <= 12)
      .sort((a, b) => a - b)
      .map(month => {
        const len = new Date(year, month, 0).getDate();
        const o = Math.min(openDay, len);
        const c = Math.min(Math.max(o, closeDay), len);
        return `${MONTH_NAMES[month - 1].slice(0, 3)} ${o}\u2013${c}, ${year}`;
      });
  };

  const saveWindowSettings = async () => {
    setWindowSaving(true);
    try {
      const { data } = await leaveApi.saveConversionSettings({
        frequency: windowCfg.frequency,
        months: windowCfg.months,
        open_day: Number(windowCfg.open_day),
        close_day: Number(windowCfg.close_day),
      });
      if (data?.success) {
        toast.success('Conversion window updated');
        loadWindowSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update the conversion window');
    } finally {
      setWindowSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Payroll Settings</h2>
        <p className="text-sm mt-1" style={{ color: '#888' }}>
          Configure payroll rates and deductions for your bar
        </p>
      </div>

      {/* Info Alert */}
      <div className="card" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0" style={{ color: '#60a5fa' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#93c5fd' }}>Important Notice</p>
            <p className="text-sm mt-1" style={{ color: '#bfdbfe' }}>
              Update these rates yearly based on current government regulations. These values will be used when computing employee payroll.
            </p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {settings.updated_at && (
        <div className="text-sm" style={{ color: '#666' }}>
          Last updated: {format(new Date(settings.updated_at), 'MMM d, yyyy • h:mm a')}
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">Government Contributions</h3>
          
          <div className="space-y-4">
            {/* SSS Rate */}
            <div>
              <label className="label">
                SSS Contribution Rate (%)
                <span className="text-xs ml-2" style={{ color: '#666' }}>
                  {settings.updated_at ? `Last updated: ${format(new Date(settings.updated_at), 'MMM d, yyyy')}` : 'Not yet configured'}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.sss_rate}
                onChange={(e) => handleChange('sss_rate', e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                Social Security System contribution rate
              </p>
            </div>

            {/* PhilHealth Rate */}
            <div>
              <label className="label">
                PhilHealth Contribution Rate (%)
                <span className="text-xs ml-2" style={{ color: '#666' }}>
                  {settings.updated_at ? `Last updated: ${format(new Date(settings.updated_at), 'MMM d, yyyy')}` : 'Not yet configured'}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.philhealth_rate}
                onChange={(e) => handleChange('philhealth_rate', e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                Philippine Health Insurance Corporation contribution rate
              </p>
            </div>

            {/* Pag-IBIG Rate */}
            <div>
              <label className="label">
                Pag-IBIG Contribution Rate (%)
                <span className="text-xs ml-2" style={{ color: '#666' }}>
                  {settings.updated_at ? `Last updated: ${format(new Date(settings.updated_at), 'MMM d, yyyy')}` : 'Not yet configured'}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.pagibig_rate}
                onChange={(e) => handleChange('pagibig_rate', e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                Home Development Mutual Fund contribution rate
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">Tax & Wage Settings</h3>
          
          <div className="space-y-4">
            {/* Withholding Tax Rate */}
            <div>
              <label className="label">
                Withholding Tax Rate (%)
                <span className="text-xs ml-2" style={{ color: '#666' }}>
                  {settings.updated_at ? `Last updated: ${format(new Date(settings.updated_at), 'MMM d, yyyy')}` : 'Not yet configured'}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.withholding_tax_rate}
                onChange={(e) => handleChange('withholding_tax_rate', e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                Bureau of Internal Revenue withholding tax rate
              </p>
            </div>

            {/* Minimum Wage */}
            <div>
              <label className="label">
                Minimum Wage (₱ per day)
                <span className="text-xs ml-2" style={{ color: '#666' }}>
                  {settings.updated_at ? `Last updated: ${format(new Date(settings.updated_at), 'MMM d, yyyy')}` : 'Not yet configured'}
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.minimum_wage}
                onChange={(e) => handleChange('minimum_wage', e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                Regional minimum wage per day
              </p>
            </div>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="card" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#fcd34d' }}>Before Updating</p>
              <p className="text-sm mt-1" style={{ color: '#fde68a' }}>
                Changes to these rates will affect future payroll calculations. Existing payroll runs will not be affected.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Leave-to-Cash Conversion Window ── */}
      <div className="card" data-testid="window-settings-card">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-lg font-bold text-white">Leave-to-Cash Conversion Window</h3>
          <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: '#161616', color: windowCfg.configured ? '#4ade80' : '#888' }}>
            {windowCfg.configured ? 'Custom schedule' : 'Default: every year, December'}
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: '#888' }}>
          Choose when staff may convert unused sick leave to cash. Applies to every employee in this bar.
        </p>

        {windowLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#888' }} />
        ) : (
          <div className="space-y-4">
            {/* Frequency */}
            <div>
              <label className="label">Frequency</label>
              <select
                className="input-field"
                data-testid="window-frequency-select"
                value={windowCfg.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value)}
              >
                <option value="yearly">Every year</option>
                <option value="semiannual">Every 6 months</option>
                <option value="quarterly">Every 3 months (quarterly)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Months */}
            <div>
              <label className="label">
                {windowCfg.frequency === 'custom' ? 'Months when the window opens' : 'Month(s) when the window opens'}
              </label>

              {windowCfg.frequency === 'custom' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTH_NAMES.map((name, i) => {
                    const month = i + 1;
                    const on = windowCfg.months.includes(month);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleMonth(month)}
                        data-testid={`window-month-${month}`}
                        className="px-3 py-2 rounded-md text-xs font-medium transition-colors"
                        style={{
                          background: on ? '#CC0000' : '#161616',
                          color: on ? '#fff' : '#888',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`grid gap-2 ${windowCfg.months.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                  {windowCfg.months.map((selected, i) => (
                    <select
                      key={i}
                      className="input-field"
                      data-testid={`window-month-${i}`}
                      value={selected}
                      onChange={(e) => setMonthAt(i, Number(e.target.value))}
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx + 1} disabled={idx + 1 !== selected && windowCfg.months.includes(idx + 1)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              )}
            </div>

            {/* Day range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Opens on day</label>
                <input
                  type="number" min="1" max="31"
                  className="input-field"
                  data-testid="window-open-day"
                  value={windowCfg.open_day}
                  onChange={(e) => setWindowCfg(prev => ({ ...prev, open_day: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Closes on day</label>
                <input
                  type="number" min="1" max="31"
                  className="input-field"
                  data-testid="window-close-day"
                  value={windowCfg.close_day}
                  onChange={(e) => setWindowCfg(prev => ({ ...prev, close_day: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: '#666' }}>
              Day range within each selected month (clamped to the real length of the month, e.g. February closes on the 28th/29th).
            </p>

            {/* Preview */}
            <div className="rounded-lg px-3 py-3" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#f59e0b' }}>Windows this year</p>
              <p className="text-sm text-white" data-testid="window-preview">
                {previewWindows().length ? previewWindows().join('  \u00b7  ') : 'Pick at least one month'}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveWindowSettings}
                disabled={windowSaving || !windowCfg.months.length}
                className="btn-primary flex items-center gap-2"
                data-testid="window-save"
              >
                {windowSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Conversion Window
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default PayrollSettings;
