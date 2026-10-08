import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader2, X, Shield, DollarSign, FileText, Clock3 } from 'lucide-react';
import apiClient from '../api/apiClient';
import { usePermission } from '../hooks/usePermission';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DeductionSettings = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [settings, setSettings] = useState({
    bir_enabled: false,
    bir_exemption_status: 'S',
    sss_enabled: false,
    sss_number: '',
    philhealth_enabled: false,
    philhealth_number: '',
    late_deduction_enabled: false,
  });
  const { can, isOwner, isHR } = usePermission();
  const canViewDailyRate = isOwner || isHR;

  useEffect(() => {
    if (can('deduction_settings_view') || can('payroll_view_all')) {
      loadEmployees();
    }
  }, []);

  const loadEmployees = async () => {
    try {
      const { data } = await apiClient.get('/hr/payroll/deduction-settings');
      setEmployees(data.data || []);
    } catch (err) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSettings = async (employee) => {
    setSelectedEmployee(employee);
    setSettings({
      bir_enabled: employee.bir_enabled || false,
      bir_exemption_status: employee.bir_exemption_status || 'S',
      sss_enabled: employee.sss_enabled || false,
      sss_number: employee.sss_number || '',
      philhealth_enabled: employee.philhealth_enabled || false,
      philhealth_number: employee.philhealth_number || '',
      late_deduction_enabled: employee.late_deduction_enabled || false,
    });
    setShowModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      await apiClient.put(`/hr/payroll/deduction-settings/${selectedEmployee.id}`, settings);
      toast.success('Deduction settings updated successfully');
      setShowModal(false);
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDeduction = async (employeeId, deductionType, currentValue) => {
    try {
      await apiClient.patch(`/hr/payroll/deduction-settings/${employeeId}/toggle`, {
        deduction_type: deductionType,
        enabled: !currentValue
      });
      toast.success(`${deductionType.toUpperCase()} deduction ${!currentValue ? 'enabled' : 'disabled'}`);
      loadEmployees();
    } catch (err) {
      toast.error('Failed to toggle deduction');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!can('deduction_settings_view') && !can('payroll_view_all')) {
    return (
      <div className="card p-8 text-center">
        <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: '#444' }} />
        <p style={{ color: '#888' }}>You don't have permission to view deduction settings.</p>
      </div>
    );
  }

  const canManage = can('deduction_settings_manage') || can('payroll_create');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6" style={{ color: '#CC0000' }} />
          <div>
            <h2 className="text-xl font-bold text-white">Payroll Deduction Settings</h2>
            <p className="text-sm" style={{ color: '#888' }}>Configure BIR, SSS, PhilHealth, and Late deductions for each employee</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5" style={{ color: '#60a5fa' }} />
              <span className="text-sm font-medium" style={{ color: '#60a5fa' }}>BIR Tax</span>
            </div>
            <p className="text-xs" style={{ color: '#888' }}>Withholding tax based on income</p>
          </div>
          <div className="p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5" style={{ color: '#4ade80' }} />
              <span className="text-sm font-medium" style={{ color: '#4ade80' }}>SSS</span>
            </div>
            <p className="text-xs" style={{ color: '#888' }}>Social Security contribution</p>
          </div>
          <div className="p-4 rounded-lg" style={{ background: 'rgba(168,85,247,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" style={{ color: '#c084fc' }} />
              <span className="text-sm font-medium" style={{ color: '#c084fc' }}>PhilHealth</span>
            </div>
            <p className="text-xs" style={{ color: '#888' }}>Health insurance contribution</p>
          </div>
          <div className="p-4 rounded-lg" style={{ background: 'rgba(251,191,36,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock3 className="w-5 h-5" style={{ color: '#facc15' }} />
              <span className="text-sm font-medium" style={{ color: '#facc15' }}>Late</span>
            </div>
            <p className="text-xs" style={{ color: '#888' }}>Deduction for accumulated late minutes</p>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--m-border)', background: 'var(--m-surface-2)' }}>
          <h4 className="font-semibold text-white">Employee Deduction Configuration</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--m-border)' }}>
              <tr>
                <th className="table-header text-left">Employee</th>
                <th className="table-header">Daily Rate</th>
                <th className="table-header">BIR Tax</th>
                <th className="table-header">SSS</th>
                <th className="table-header">PhilHealth</th>
                <th className="table-header">Late</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="transition-colors" style={{ borderBottom: '1px solid var(--m-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--m-active-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-white">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs" style={{ color: '#666' }}>{emp.email}</p>
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    {canViewDailyRate ? `₱${Number(emp.daily_rate || 0).toLocaleString()}` : '*****'}
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => canManage && handleToggleDeduction(emp.id, 'bir', emp.bir_enabled)}
                      disabled={!canManage}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={emp.bir_enabled ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' } : { background: 'var(--m-active-bg)', color: '#666' }}
                    >
                      {emp.bir_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => canManage && handleToggleDeduction(emp.id, 'sss', emp.sss_enabled)}
                      disabled={!canManage}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={emp.sss_enabled ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' } : { background: 'var(--m-active-bg)', color: '#666' }}
                    >
                      {emp.sss_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => canManage && handleToggleDeduction(emp.id, 'philhealth', emp.philhealth_enabled)}
                      disabled={!canManage}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={emp.philhealth_enabled ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc' } : { background: 'var(--m-active-bg)', color: '#666' }}
                    >
                      {emp.philhealth_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => canManage && handleToggleDeduction(emp.id, 'late', emp.late_deduction_enabled)}
                      disabled={!canManage}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={emp.late_deduction_enabled ? { background: 'rgba(251,191,36,0.15)', color: '#facc15' } : { background: 'var(--m-active-bg)', color: '#666' }}
                    >
                      {emp.late_deduction_enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="table-cell text-right">
                    {canManage ? (
                      <button
                        onClick={() => handleEditSettings(emp)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Configure
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditSettings(emp)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8" style={{ color: '#555' }}>
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--m-border)' }}>
              <div>
                <h3 className="font-bold text-white">Deduction Settings</h3>
                <p className="text-sm" style={{ color: '#888' }}>{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* BIR Settings */}
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--m-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" style={{ color: '#60a5fa' }} />
                    <h4 className="font-semibold text-white">BIR Withholding Tax</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.bir_enabled} onChange={(e) => setSettings({ ...settings, bir_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: settings.bir_enabled ? '#CC0000' : '#333', border: '1px solid var(--m-border)' }}></div>
                  </label>
                </div>
                {settings.bir_enabled && (
                  <div>
                    <label className="label">Tax Exemption Status</label>
                    <select
                      value={settings.bir_exemption_status}
                      onChange={(e) => setSettings({ ...settings, bir_exemption_status: e.target.value })}
                      className="input-field"
                    >
                      <option value="S">S - Single</option>
                      <option value="ME">ME - Married Employee</option>
                      <option value="S1">S1 - Single with 1 dependent</option>
                      <option value="S2">S2 - Single with 2 dependents</option>
                      <option value="S3">S3 - Single with 3 dependents</option>
                      <option value="S4">S4 - Single with 4 dependents</option>
                      <option value="ME1">ME1 - Married with 1 dependent</option>
                      <option value="ME2">ME2 - Married with 2 dependents</option>
                      <option value="ME3">ME3 - Married with 3 dependents</option>
                      <option value="ME4">ME4 - Married with 4 dependents</option>
                    </select>
                  </div>
                )}
              </div>

              {/* SSS Settings */}
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--m-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" style={{ color: '#4ade80' }} />
                    <h4 className="font-semibold text-white">SSS Contribution</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.sss_enabled} onChange={(e) => setSettings({ ...settings, sss_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: settings.sss_enabled ? '#CC0000' : '#333', border: '1px solid var(--m-border)' }}></div>
                  </label>
                </div>
                {settings.sss_enabled && (
                  <div>
                    <label className="label">SSS Number (Optional)</label>
                    <input
                      type="text"
                      value={settings.sss_number}
                      onChange={(e) => setSettings({ ...settings, sss_number: e.target.value })}
                      placeholder="XX-XXXXXXX-X"
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              {/* PhilHealth Settings */}
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--m-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" style={{ color: '#c084fc' }} />
                    <h4 className="font-semibold text-white">PhilHealth Contribution</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.philhealth_enabled} onChange={(e) => setSettings({ ...settings, philhealth_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: settings.philhealth_enabled ? '#CC0000' : '#333', border: '1px solid var(--m-border)' }}></div>
                  </label>
                </div>
                {settings.philhealth_enabled && (
                  <div>
                    <label className="label">PhilHealth Number (Optional)</label>
                    <input
                      type="text"
                      value={settings.philhealth_number}
                      onChange={(e) => setSettings({ ...settings, philhealth_number: e.target.value })}
                      placeholder="XX-XXXXXXXXX-X"
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              {/* Late Deduction Settings */}
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--m-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="w-5 h-5" style={{ color: '#facc15' }} />
                    <h4 className="font-semibold text-white">Late Deduction</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.late_deduction_enabled} onChange={(e) => setSettings({ ...settings, late_deduction_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: settings.late_deduction_enabled ? '#CC0000' : '#333', border: '1px solid var(--m-border)' }}></div>
                  </label>
                </div>
                <p className="text-xs" style={{ color: '#888' }}>
                  When enabled, payroll applies deduction based on the employee&apos;s total late minutes in the payroll period.
                </p>
              </div>

            </div>

            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--m-border)', background: 'var(--m-surface)' }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeductionSettings;
