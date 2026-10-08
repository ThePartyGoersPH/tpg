import { create } from 'zustand';
import { branchApi } from '../api/branchApi';

const useBranchStore = create((set, get) => ({
  branches: [],
  selectedBarId: null,
  selectedBranch: null,
  subscriptionInfo: null,
  loading: false,

  fetchBranches: async () => {
    try {
      set({ loading: true });
      const { data } = await branchApi.getMyBranches();
      const list = data.data || data || [];
      set({ branches: list });

      // Auto-select first branch if none selected
      const { selectedBarId } = get();
      if (!selectedBarId && list.length > 0) {
        const saved = localStorage.getItem('selectedBarId');
        const match = saved ? list.find((b) => b.id === Number(saved)) : null;
        const pick = match || list[0];
        set({ selectedBarId: pick.id, selectedBranch: pick });
      } else if (selectedBarId) {
        const match = list.find((b) => b.id === selectedBarId);
        if (match) set({ selectedBranch: match });
      }

      return list;
    } catch {
      set({ branches: [] });
      return [];
    } finally {
      set({ loading: false });
    }
  },

  switchBranch: async (barId) => {
    try {
      const { data } = await branchApi.switchBranch(barId);
      const result = data.data || data;
      localStorage.setItem('selectedBarId', barId);

      const { branches } = get();
      const match = branches.find((b) => b.id === barId);
      set({ selectedBarId: barId, selectedBranch: match || null });

      return { success: true, bar_name: result.bar_name };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to switch branch' };
    }
  },

  setSelectedBarId: (barId) => {
    const { branches } = get();
    const match = branches.find((b) => b.id === barId);
    localStorage.setItem('selectedBarId', barId);
    set({ selectedBarId: barId, selectedBranch: match || null });
  },

  fetchSubscriptionInfo: async () => {
    try {
      const { data } = await branchApi.getSubscriptionInfo();
      set({ subscriptionInfo: data.data || data });
    } catch {
      set({ subscriptionInfo: null });
    }
  },

  reset: () => {
    localStorage.removeItem('selectedBarId');
    set({ branches: [], selectedBarId: null, selectedBranch: null, subscriptionInfo: null });
  },
}));

export default useBranchStore;
