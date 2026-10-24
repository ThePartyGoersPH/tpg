import apiClient from './apiClient';

export const attendanceApi = {
  // silentError: Quick Clock handlers show their own specific toasts from the
  // server response, so the global interceptor must not double-toast.
  clockInOut: (action) =>
    apiClient.post('/attendance/employee/attendance', { action }, { silentError: true }),

  getMyAttendance: (params) =>
    apiClient.get('/attendance/my/attendance', { params }),

  hrList: (params) =>
    apiClient.get('/attendance/hr/attendance', { params }),

  hrCreate: (data) =>
    apiClient.post('/attendance/hr/attendance', data),

  hrUpdate: (id, data) =>
    apiClient.patch(`/attendance/hr/attendance/${id}`, data),

  hrSummary: (params) =>
    apiClient.get('/hr/attendance', { params }),

  hrReport: (params) =>
    apiClient.get('/attendance/hr/attendance/report', { params }),

  listSchedules: (params) =>
    apiClient.get('/attendance/hr/schedules', { params }),

  saveSchedule: (data) =>
    apiClient.post('/attendance/hr/schedules', data),

  updateSchedule: (id, data) =>
    apiClient.patch(`/attendance/hr/schedules/${id}`, data),
};
