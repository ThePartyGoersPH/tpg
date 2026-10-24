import { useCallback, useEffect, useState, useRef } from 'react';
import { barService } from '../services/barService';

export function useBars(initialParams = {}) {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useState(initialParams);
  const paramsRef = useRef(params);

  // Keep ref in sync with state
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const fetchBars = useCallback(async (overrideParams) => {
    // Use override if provided, otherwise use current ref
    const currentParams = overrideParams !== undefined ? overrideParams : paramsRef.current;
    try {
      setLoading(true);
      setError('');
      const data = await barService.list(currentParams);
      setBars(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load bars.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBars(params);
  }, [fetchBars, params]);

  const updateFilters = (nextParams) => {
    setParams((prev) => ({ ...prev, ...nextParams }));
  };

  return { bars, loading, error, params, updateFilters, refetch: fetchBars };
}
