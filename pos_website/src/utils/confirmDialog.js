let activeRequest = null;

function emit() {
  window.dispatchEvent(new CustomEvent('pos:confirm-request'));
}

// Drop-in async replacement for window.confirm(), styled like the app.
// Resolves true on confirm, false on cancel/dismiss.
export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    activeRequest = { title, message, confirmText, danger, resolve };
    emit();
  });
}

export function takeActiveRequest() {
  const req = activeRequest;
  activeRequest = null;
  return req;
}
