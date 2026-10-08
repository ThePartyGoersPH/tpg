import { useCallback, useEffect, useState } from 'react';
import { reservationService } from '../services/reservationService';

export function useReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await reservationService.myReservations();
      setReservations(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load reservations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  return { reservations, loading, error, reload: loadReservations };
}
