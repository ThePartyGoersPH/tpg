import React from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action', 
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // danger, warning, info
  loading = false
}) => {
  if (!isOpen) return null;

  const typeColors = {
    danger:  { iconBg: 'rgba(204,0,0,0.12)',    iconColor: '#ff6666', btnBg: '#CC0000',  btnHover: '#991500' },
    warning: { iconBg: 'rgba(245,158,11,0.12)',  iconColor: '#fbbf24', btnBg: '#d97706', btnHover: '#b45309' },
    info:    { iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#60a5fa', btnBg: '#2563eb', btnHover: '#1d4ed8' },
  };
  const tc = typeColors[type] || typeColors.info;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: tc.iconBg }}>
            <AlertTriangle className="w-6 h-6" style={{ color: tc.iconColor }} />
          </div>

          <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>

          <p className="text-sm text-center mb-6" style={{ color: '#888' }}>{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: '#aaa' }}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: tc.btnBg }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
