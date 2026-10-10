import Swal from 'sweetalert2';

// Dark-theme defaults matching the Super Admin panel (dark glass + red accents).
const base = {
  background: '#171017',
  color: '#fff',
  customClass: {
    popup: 'swal-dark-popup',
    title: 'swal-dark-title',
    htmlContainer: 'swal-dark-text',
    confirmButton: 'swal-dark-confirm',
    cancelButton: 'swal-dark-cancel',
  },
  buttonsStyling: false,
};

// Inject minimal button styling once (kept here so no CSS file changes needed).
let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const el = document.createElement('style');
  el.id = 'swal-dark-theme';
  el.textContent = `
    .swal-dark-popup { border: 1px solid rgba(255,255,255,0.12) !important; border-radius: 16px !important; }
    .swal-dark-title { font-size: 18px !important; font-weight: 700 !important; }
    .swal-dark-text { font-size: 13px !important; color: rgba(255,255,255,0.55) !important; }
    .swal-dark-confirm { background: #dc2626 !important; color: #fff !important; font-size: 13px !important; font-weight: 600 !important; padding: 9px 22px !important; border-radius: 10px !important; margin-right: 8px !important; }
    .swal-dark-confirm:hover { background: #b91c1c !important; }
    .swal-dark-confirm:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.35) !important; }
    .swal-dark-cancel { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.75) !important; font-size: 13px !important; font-weight: 600 !important; padding: 9px 22px !important; border-radius: 10px !important; }
    .swal-dark-cancel:hover { background: rgba(255,255,255,0.14) !important; }
  `;
  document.head.appendChild(el);
}

/**
 * Destructive-action confirmation modal.
 * Resolves true when the user confirms, false otherwise.
 */
export async function confirmDestructive({ title, text, confirmText = 'Delete', cancelText = 'Cancel' }) {
  ensureStyle();
  const result = await Swal.fire({
    ...base,
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

const REJECT_QUICK_PICKS = [
  'Incomplete or fake details',
  'Under 18',
  'Duplicate account',
  'Other',
];

/**
 * Rejection dialog: required reason textarea (5-300 chars) plus quick picks.
 * Resolves the trimmed reason string, or null when cancelled.
 */
export async function promptRejectReason({ title = 'Reject this registration?', name = '' }) {
  ensureStyle();
  const result = await Swal.fire({
    ...base,
    title,
    html:
      (name ? `<p style="margin:0 0 10px;">${name}</p>` : '') +
      `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">` +
      REJECT_QUICK_PICKS.map(
        (p) => `<button type="button" data-pick="${p}" style="font-size:11px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.1);cursor:pointer;">${p}</button>`
      ).join('') +
      `</div>`,
    input: 'textarea',
    inputPlaceholder: 'Reason (required, 5-300 characters)…',
    inputAttributes: { maxlength: 300, 'aria-label': 'Rejection reason' },
    showCancelButton: true,
    confirmButtonText: 'Reject',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    showLoaderOnConfirm: true,
    didOpen: () => {
      const popup = Swal.getPopup();
      const ta = Swal.getInput();
      popup?.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (ta) {
            ta.value = btn.getAttribute('data-pick') === 'Other' ? '' : btn.getAttribute('data-pick');
            ta.focus();
          }
        });
      });
    },
    preConfirm: (value) => {
      const reason = String(value || '').trim();
      if (reason.length < 5 || reason.length > 300) {
        Swal.showValidationMessage('Please give a reason between 5 and 300 characters.');
        return false;
      }
      return reason;
    },
  });
  return result.isConfirmed ? String(result.value || '').trim() : null;
}

/**
 * Optional-note dialog for approvals. Resolves the trimmed note
 * (empty string when skipped), or null when cancelled.
 */
export async function promptApproveNote({ title = 'Approve this registration?', name = '' }) {
  ensureStyle();
  const result = await Swal.fire({
    ...base,
    title,
    html: name ? `<p style="margin:0 0 10px;">${name}</p>` : '',
    input: 'textarea',
    inputPlaceholder: 'Optional note for the customer (up to 300 characters)…',
    inputAttributes: { maxlength: 300, 'aria-label': 'Approval note (optional)' },
    showCancelButton: true,
    confirmButtonText: 'Approve',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusCancel: true,
    showLoaderOnConfirm: true,
    preConfirm: (value) => String(value || '').trim().slice(0, 300),
  });
  return result.isConfirmed ? String(result.value || '').trim().slice(0, 300) : null;
}

const toastMixin = () =>
  Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
    background: '#171017',
    color: '#fff',
  });

export function swalSuccess(message) {
  ensureStyle();
  return toastMixin().fire({ icon: 'success', title: message });
}

export function swalError(message) {
  ensureStyle();
  return toastMixin().fire({ icon: 'error', title: message });
}
