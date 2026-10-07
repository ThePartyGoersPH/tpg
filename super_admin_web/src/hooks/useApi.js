import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useApi(apiFn, { immediate = true, params = null, onSuccess, onError } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (overrideParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFn(overrideParams ?? params);
      const result = response.data;
      if (result.success) {
        setData(result.data);
        onSuccess?.(result.data);
      } else {
        const msg = result.message || 'Request failed';
        setError(msg);
        onError?.(msg);
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Server error';
      setError(msg);
      onError?.(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [apiFn, params]);

  useEffect(() => {
    if (immediate) execute();
  }, []);

  return { data, loading, error, execute, setData };
}

export function useAction() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (apiFn, { successMsg, errorMsg, onSuccess } = {}) => {
    setLoading(true);
    try {
      const response = await apiFn();
      if (response.data?.success) {
        if (successMsg) toast.success(successMsg);
        onSuccess?.(response.data);
        return true;
      } else {
        toast.error(response.data?.message || errorMsg || 'Action failed');
        return false;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || errorMsg || 'Server error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, run };
}
