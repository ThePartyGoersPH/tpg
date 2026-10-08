import { useEffect, useState } from 'react';
import { takeActiveRequest } from '../utils/confirmDialog';

export function ConfirmDialogHost() {
  const [req, setReq] = useState(null);

  useEffect(() => {
    const onRequest = () => {
      const pending = takeActiveRequest();
      setReq(pending ? { ...pending } : null);
    };
    window.addEventListener('pos:confirm-request', onRequest);
    return () => window.removeEventListener('pos:confirm-request', onRequest);
  }, []);

  if (!req) return null;

  const done = (value) => {
    setReq(null);
    req.resolve(value);
  };

  return (
    <div className="modal-backdrop" onClick={() => done(false)}>
      <div
        className="modal-panel confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-title">{req.title}</h3>
        {req.message && <p className="confirm-message">{req.message}</p>}
        <div className="modal-action-grid confirm-actions">
          <button type="button" className="btn-secondary" onClick={() => done(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={req.danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => done(true)}
            autoFocus
          >
            {req.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
