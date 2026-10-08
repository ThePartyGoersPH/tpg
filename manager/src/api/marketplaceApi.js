import apiClient from './apiClient';

export const marketplaceApi = {
  // silentError: background status read (PayoutSetupCards / Packages). Both
  // callers degrade gracefully in their own catch, so a failed status must not
  // surface as a global toast on top of the page that is already rendering.
  status: () =>
    apiClient.get('/marketplace/bar/payments-onboarding', { silentError: true }),

  // NOTE: every mutating call below has its own specific toast in the
  // component's catch block, so all of them pass silentError: true — otherwise
  // the global apiClient interceptor would fire a second, duplicate toast.
  startOnboarding: (business_type = 'sole_proprietor') =>
    apiClient.post('/marketplace/bar/payments-onboarding', { business_type }, { silentError: true }),

  invite: (email) =>
    apiClient.post('/marketplace/bar/payments-onboarding/invite', { email }, { silentError: true }),

  startStripeOnboarding: (email) =>
    apiClient.post('/marketplace/bar/stripe-onboarding', email ? { email } : {}, { silentError: true }),

  refreshStripeStatus: () =>
    apiClient.post('/marketplace/bar/stripe-onboarding/refresh', {}, { silentError: true }),

  setMode: (mode) =>
    // silentError: the 403 here means "verification pending", not a real
    // permission problem — the component shows its own specific message.
    apiClient.post('/marketplace/bar/payments-mode', { mode }, { silentError: true }),

  testConnect: (data) =>
    apiClient.post('/marketplace/bar/payments-test-connect', data || {}, { silentError: true }),

  testConnectAuto: () =>
    apiClient.post('/marketplace/bar/payments-test-connect-auto', {}, { silentError: true }),

  testDisconnect: () =>
    apiClient.post('/marketplace/bar/payments-test-disconnect', {}, { silentError: true }),

  connectLive: (keys) =>
    apiClient.post('/marketplace/bar/payments-connect-live', keys, { silentError: true }),
};
