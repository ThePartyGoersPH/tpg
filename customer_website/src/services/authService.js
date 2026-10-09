import { authApi } from '../api/authApi';
import { CUSTOMER_ROLE_BLOCK_MESSAGE, DEFAULT_ERROR_MESSAGE, isCustomerPortalUser } from '../utils/constants';

function extractError(error) {
  return error?.response?.data?.message || error?.message || DEFAULT_ERROR_MESSAGE;
}

export const authService = {
  async register(payload) {
    const response = await authApi.register(payload);
    return response.data;
  },

  async login(payload) {
    try {
      const response = await authApi.login(payload);
      const loginData = response.data?.data;
      const user = loginData?.user;

      if (!isCustomerPortalUser(user)) {
        throw new Error(CUSTOMER_ROLE_BLOCK_MESSAGE);
      }

      return loginData;
    } catch (error) {
      const msg = extractError(error) || error.message;
      const thrownError = new Error(msg);
      thrownError.code = error?.response?.data?.code || null;
      thrownError.status = error?.response?.status || null;
      thrownError.email = error?.response?.data?.email || null;
      // True when the backend actually re-sent the verification email on this
      // attempt (it stays quiet while the previous code is still valid).
      thrownError.verificationSent = error?.response?.data?.verification_sent === true;
      throw thrownError;
    }
  },

  async me() {
    const response = await authApi.me();
    return response.data?.data;
  },

  async updateProfile(payload) {
    const response = await authApi.updateProfile(payload);
    return response.data;
  },

  async changePassword(payload) {
    const response = await authApi.changePassword(payload);
    return response.data;
  },

  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profile_picture', file);
    const response = await authApi.uploadProfilePicture(formData);
    return response.data;
  },

  async maintenanceStatus() {
    const response = await authApi.maintenanceStatus();
    return response.data?.data;
  },

  async getMaintenanceStatus() {
    return this.maintenanceStatus();
  },

  async getAnnouncements(limit = 5) {
    const response = await authApi.announcements(limit);
    return response.data?.data || [];
  },
};
