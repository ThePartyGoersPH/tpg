import { useEffect, useMemo, useState } from 'react';

const initialState = {
  date: '',
  time: '',
  party_size: 2,
  table_id: '',
  event_id: '',
  notes: '',
  payment_method: '',
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
};

const dayHoursByIndex = [
  'sunday_hours',
  'monday_hours',
  'tuesday_hours',
  'wednesday_hours',
  'thursday_hours',
  'friday_hours',
  'saturday_hours',
];

const parseClockToMinutes = (token) => {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hh = Number(match[1]);
  const mm = Number(match[2] || 0);
  const meridiem = match[3] ? match[3].toLowerCase() : null;
  if (mm < 0 || mm > 59) return null;

  if (meridiem) {
    if (hh < 1 || hh > 12) return null;
    if (meridiem === 'am' && hh === 12) hh = 0;
    if (meridiem === 'pm' && hh !== 12) hh += 12;
  }

  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
};

const buildHourlySlots = (hoursText, reservationDate) => {
  if (!hoursText) return [];
  const normalized = String(hoursText).replace(/\s+to\s+/gi, ' - ').trim();
  const range = normalized.match(/(.+?)\s*-\s*(.+)/);
  if (!range) return [];
  const start = parseClockToMinutes(range[1]);
  const end = parseClockToMinutes(range[2]);
  if (start === null || end === null) return [];

  const slots = [];
  const startHour = Math.ceil(start / 60);
  const endHour = Math.ceil(end / 60);

  if (end > start) {
    for (let h = startHour; h < endHour; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
  } else {
    for (let h = startHour; h < 24; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
    for (let h = 0; h < endHour; h += 1) slots.push(`${String(h).padStart(2, '0')}:00:00`);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (reservationDate === todayStr) {
    const nowHour = new Date().getHours();
    return slots.filter((s) => Number(s.slice(0, 2)) > nowHour);
  }

  return slots;
};

const displayHourLabel = (timeValue) => {
  const hh = Number(String(timeValue).slice(0, 2));
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const suffix = hh >= 12 ? 'PM' : 'AM';
  return `${hour12}:00 ${suffix}`;
};

function ReservationForm({ barId, barDetail, tables, events, onCheckTables, onSubmit, submitting }) {
  const [form, setForm] = useState(initialState);

  const availableTableOptions = useMemo(
    () => tables.filter((table) => table.is_active === 1 || table.is_active === true),
    [tables]
  );

  const acceptCash = toBool(barDetail?.accept_cash_payment);
  const acceptGcash = toBool(barDetail?.accept_gcash);
  const acceptOnline = toBool(barDetail?.accept_online_payment);
  const minimumDeposit = Number(barDetail?.minimum_reservation_deposit) || 0;

  const availableHours = useMemo(() => {
    if (!form.date) return [];
    const d = new Date(`${form.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return [];
    const col = dayHoursByIndex[d.getDay()];
    const hoursText = barDetail?.[col];
    return buildHourlySlots(hoursText, form.date);
  }, [barDetail, form.date]);

  useEffect(() => {
    if (form.payment_method) return;

    if (acceptCash) {
      setForm((prev) => ({ ...prev, payment_method: 'cash' }));
      return;
    }

    if (acceptOnline && acceptGcash) {
      setForm((prev) => ({ ...prev, payment_method: 'gcash' }));
      return;
    }

    if (acceptOnline) {
      setForm((prev) => ({ ...prev, payment_method: 'paymaya' }));
    }
  }, [acceptCash, acceptOnline, acceptGcash, form.payment_method]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!form.date) return;
    if (!availableHours.length) {
      if (form.time) setForm((prev) => ({ ...prev, time: '' }));
      return;
    }
    const stillValid = availableHours.includes(form.time);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, time: availableHours[0] }));
    }
  }, [availableHours, form.date, form.time]);

  const handleCheck = () => {
    if (!form.date || !form.time || !form.party_size) return;
    onCheckTables({
      date: form.date,
      time: form.time,
      party_size: Number(form.party_size),
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.table_id) return;

    onSubmit({
      bar_id: Number(barId),
      table_id: Number(form.table_id),
      event_id: form.event_id ? Number(form.event_id) : undefined,
      reservation_date: form.date,
      reservation_time: form.time,
      party_size: Number(form.party_size),
      notes: form.notes.trim(),
      payment_method: form.payment_method,
    });
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h4>Reserve a table</h4>

      <div className="grid two-col">
        <input className="input" type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} required />
        <select className="select" value={form.time} onChange={(e) => handleChange('time', e.target.value)} required>
          <option value="">Select hour</option>
          {availableHours.map((time) => (
            <option key={time} value={time}>{displayHourLabel(time)}</option>
          ))}
        </select>
      </div>
      {form.date && availableHours.length === 0 && (
        <div className="alert alert-warning">No available reservation slots for the selected date.</div>
      )}

      <div className="grid two-col">
        <input
          className="input"
          type="number"
          min="1"
          value={form.party_size}
          onChange={(e) => handleChange('party_size', e.target.value)}
          required
        />
        <button className="button ghost" type="button" onClick={handleCheck}>
          Check Available Tables
        </button>
      </div>

      <select className="select" value={form.table_id} onChange={(e) => handleChange('table_id', e.target.value)} required>
        <option value="">Select table</option>
        {availableTableOptions.map((table) => (
          <option key={table.id} value={table.id}>
            {table.table_number} (Cap {table.capacity}){table.price ? ` - ₱${table.price}` : ''}
          </option>
        ))}
      </select>

      <select className="select" value={form.event_id} onChange={(e) => handleChange('event_id', e.target.value)}>
        <option value="">Optional: Link to event</option>
        {events.map((eventItem) => (
          <option key={eventItem.id} value={eventItem.id}>
            {eventItem.title}
          </option>
        ))}
      </select>

      <textarea
        className="textarea"
        placeholder="Notes"
        value={form.notes}
        onChange={(e) => handleChange('notes', e.target.value)}
      />

      <div className="payment-method-section">
        <label className="form-label">Payment Method</label>
        <div className="payment-options">
          {acceptCash && (
            <label className={`payment-option ${form.payment_method === 'cash' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="payment_method"
                value="cash"
                checked={form.payment_method === 'cash'}
                onChange={(e) => handleChange('payment_method', e.target.value)}
              />
              <span className="payment-option-icon">💵</span>
              <span className="payment-option-label">Pay on Arrival</span>
            </label>
          )}
          {acceptOnline && acceptGcash && (
            <label className={`payment-option ${form.payment_method === 'gcash' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="payment_method"
                value="gcash"
                checked={form.payment_method === 'gcash'}
                onChange={(e) => handleChange('payment_method', e.target.value)}
              />
              <span className="payment-option-icon">📱</span>
              <span className="payment-option-label">GCash</span>
            </label>
          )}
          {acceptOnline && (
            <label className={`payment-option ${form.payment_method === 'paymaya' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="payment_method"
                value="paymaya"
                checked={form.payment_method === 'paymaya'}
                onChange={(e) => handleChange('payment_method', e.target.value)}
              />
              <span className="payment-option-icon">💳</span>
              <span className="payment-option-label">PayMaya</span>
            </label>
          )}
        </div>

        {!acceptCash && !acceptOnline && (
          <div className="alert alert-warning">
            This bar doesn't accept online payments at this time.
          </div>
        )}

        {(form.payment_method === 'gcash' || form.payment_method === 'paymaya') && minimumDeposit > 0 && (
          <div className="deposit-info">
            <div className="deposit-amount">
              <span>Minimum Deposit Required:</span>
              <strong>₱{minimumDeposit.toFixed(2)}</strong>
            </div>
            <div className="alert alert-warning">
              Reservation deposits are non-refundable. Once payment is completed, cancellation is no longer allowed.
            </div>
          </div>
        )}
      </div>

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : (form.payment_method === 'cash' ? 'Reserve Now' : `Reserve & Pay ₱${minimumDeposit.toFixed(2)}`)}
      </button>
    </form>
  );
}

export default ReservationForm;
