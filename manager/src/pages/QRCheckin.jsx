import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Keyboard, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { reservationApi } from '../api/reservationApi';
import Swal from 'sweetalert2';

const SCAN_REGION_ID = 'qr-reader';
const DECODE_INTERVAL_MS = 250;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

const SWAL_DARK = {
  background: 'var(--m-surface-2)',
  color: '#e5e5e5',
  confirmButtonColor: '#C9762F',
  cancelButtonColor: '#555',
  fontFamily: "'Inter', 'Sora', sans-serif",
};

function formatMoney(n) {
  const num = Number(n || 0);
  return `\u20B1${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatDateTime(dt) {
  if (!dt) return null;
  const d = new Date(typeof dt === 'string' && !dt.includes('T') ? dt.replace(' ', 'T') : dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function detailRow(label, value) {
  return `<p style="margin:0 0 4px;"><strong style="color:#fff;">${label}:</strong> ${value}</p>`;
}

export default function QRCheckin() {
  const [mode, setMode] = useState('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const inputRef = useRef(null);
  const alertDialogOpen = useRef(false);
  const destroyedRef = useRef(false);
  const startingRef = useRef(false);

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const lastDecodeRef = useRef(0);

  const processingRef = useRef(false);
  const lastScannedRef = useRef('');
  const lastScanTimeRef = useRef(0);

  // ── Camera teardown ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.load();
    }
    setCameraActive(false);
  }, []);

  // ── Camera startup ────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (alertDialogOpen.current || destroyedRef.current || startingRef.current) return;
    startingRef.current = true;

    try {
      stopCamera();

      const container = document.getElementById(SCAN_REGION_ID);
      if (!container) { startingRef.current = false; return; }

      container.innerHTML = '';

      const video = document.createElement('video');
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('style', 'width:100%;height:100%;object-fit:cover;display:block;');
      container.appendChild(video);
      videoRef.current = video;

      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      canvasRef.current = canvas;
      ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });

      const constraints = {
        video: {
          facingMode: 'environment',
          width:  { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
        },
        audio: false,
      };
      console.log('[QRScan] Requesting camera with constraints:', JSON.stringify(constraints));

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (destroyedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        startingRef.current = false;
        return;
      }

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      console.log('[QRScan] Camera stream active:', {
        label: track.label,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode,
      });

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      // Match canvas to the real camera resolution (better decode accuracy
      // than a fixed 640x480 upscale/downscale)
      const vw = video.videoWidth || VIDEO_WIDTH;
      const vh = video.videoHeight || VIDEO_HEIGHT;
      if (vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
      }
      console.log('[QRScan] Video dimensions:', video.videoWidth, 'x', video.videoHeight);

      if (destroyedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        startingRef.current = false;
        return;
      }

      setCameraActive(true);
      console.log('[QRScan] Camera started — RAF decode loop beginning');

      // ── Decode loop ─────────────────────────────────────────────
      let loopCount = 0;
      const decodeLoop = (timestamp) => {
        // Always reschedule first — ensures the loop survives even if we return early
        if (!destroyedRef.current) {
          rafRef.current = requestAnimationFrame(decodeLoop);
        }

        // Throttle: skip if less than DECODE_INTERVAL_MS since last decode
        if (timestamp - lastDecodeRef.current < DECODE_INTERVAL_MS) return;
        lastDecodeRef.current = timestamp;
        loopCount++;

        // Skip while alert open or request in flight
        if (alertDialogOpen.current || processingRef.current) return;

        const v = videoRef.current;
        const c = canvasRef.current;
        const cx = ctxRef.current;
        if (!v || !c || !cx || v.readyState < 2) return;

        // Draw video frame onto the fixed-size canvas (GPU-accelerated downscale)
        cx.drawImage(v, 0, 0, c.width, c.height);

        // NOTE: getImageData's 5th argument is an ImageDataSettings dictionary,
        // NOT a destination buffer — always decode the freshly returned ImageData.
        const frame = cx.getImageData(0, 0, c.width, c.height);

        const t0 = performance.now();
        const code = jsQR(frame.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
        const decodeMs = performance.now() - t0;

        if (loopCount <= 5 || decodeMs > 30 || code?.data) {
          console.log(`[QRScan] decode #${loopCount}: ${decodeMs.toFixed(1)}ms, result: ${code?.data ? 'FOUND' : 'none'}`);
        }

        if (code?.data) {
          const txn = String(code.data).trim();
          if (txn) processScan(txn);
        }
      };

      rafRef.current = requestAnimationFrame(decodeLoop);
    } catch (err) {
      if (destroyedRef.current) { startingRef.current = false; return; }
      console.error('[QRScan] Camera start failed:', err);
      setCameraActive(false);
      Swal.fire({
        ...SWAL_DARK,
        icon: 'error',
        title: 'Camera Error',
        text: err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : `Could not access camera: ${err.message}. Try manual entry.`,
        confirmButtonText: 'Switch to Manual',
        allowOutsideClick: false,
      }).then(() => { setMode('manual'); });
    } finally {
      startingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  // ── Alert helpers ─────────────────────────────────────────────────
  const showSuccessAlert = useCallback(async (reservation, _txn) => {
    alertDialogOpen.current = true;
    const guestName = reservation.guest_name || 'Guest';
    const tableNum = reservation.table_number || reservation.table_id || '-';
    const partySize = reservation.party_size || '-';
    const paid = Number(reservation.deposit_amount || 0);
    const paymentStatus = reservation.payment_status;

    let paymentHtml = '';
    if (paymentStatus !== 'paid' && paid > 0) {
      paymentHtml = `<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);font-size:0.85rem;">
        <span style="color:#fbbf24;font-weight:600;">Balance: ${formatMoney(paid)} due at door</span>
      </div>`;
    } else if (paymentStatus === 'paid') {
      paymentHtml = `<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);font-size:0.85rem;">
        <span style="color:#4ade80;font-weight:600;">Fully Paid</span>
      </div>`;
    }

    await Swal.fire({
      ...SWAL_DARK,
      icon: 'success',
      title: 'Checked In Successfully',
      html: `
        <div style="text-align:left;font-size:0.9rem;line-height:1.6;">
          <p style="margin:0 0 4px;"><strong style="color:#fff;">Guest:</strong> ${guestName}</p>
          <p style="margin:0 0 4px;"><strong style="color:#fff;">Table:</strong> #${tableNum}</p>
          <p style="margin:0 0 4px;"><strong style="color:#fff;">Party:</strong> ${partySize} guests</p>
          ${paymentHtml}
        </div>
      `,
      confirmButtonText: 'Check In Next Guest',
      allowOutsideClick: false,
      allowEscapeKey: false,
      buttonsStyling: true,
      customClass: { popup: 'swal-dark-popup', confirmButton: 'swal-confirm-btn' },
    });

    alertDialogOpen.current = false;
    lastScannedRef.current = '';
    processingRef.current = false;
    setLoading(false);
    // Resume camera — use setTimeout to let React finish the current render cycle first
    setTimeout(() => {
      if (!destroyedRef.current && mode === 'camera') startCamera();
    }, 0);
  }, [mode, startCamera]);

  const showErrorAlert = useCallback(async (errData) => {
    alertDialogOpen.current = true;
    const resStatus = errData?.reservation_status || 'not_found';
    const message = errData?.message || 'An unexpected error occurred.';
    const rsv = errData?.reservation || {};
    const guestName = rsv.guest_name || null;

    const ALERT_MAP = {
      not_found:   { icon: 'error',   title: 'No Reservation Found' },
      pending:     { icon: 'info',    title: 'Pending Approval' },
      cancelled:   { icon: 'warning', title: 'Reservation Cancelled' },
      rejected:    { icon: 'warning', title: 'Reservation Rejected' },
      no_show:     { icon: 'warning', title: 'Marked as No-Show' },
      checked_in:  { icon: 'warning', title: 'Already Checked In' },
      completed:   { icon: 'info',    title: 'Reservation Already Completed' },
      forbidden:   { icon: 'error',   title: 'Permission Denied' },
      error:       { icon: 'error',   title: 'Check-In Failed' },
    };
    const { icon, title } = ALERT_MAP[resStatus] || { icon: 'error', title: 'Check-In Failed' };

    // Per-case detail block (guest name, check-in time, served/closed note)
    let detailHtml = '';
    if (resStatus === 'checked_in') {
      const checkedInAt = formatDateTime(rsv.checked_in_at);
      detailHtml = `<div style="text-align:left;font-size:0.9rem;line-height:1.6;">`
        + (guestName ? detailRow('Guest', guestName) : '')
        + (checkedInAt ? detailRow('Checked in at', checkedInAt) : '')
        + `<p style="margin:8px 0 0;color:#fbbf24;font-size:0.85rem;">This guest is already inside — no need to check in again.</p>`
        + `</div>`;
    } else if (resStatus === 'completed') {
      detailHtml = `<div style="text-align:left;font-size:0.9rem;line-height:1.6;">`
        + (guestName ? detailRow('Guest', guestName) : '')
        + `<p style="margin:8px 0 0;color:#ccc;font-size:0.85rem;">This booking has already been served and closed. No further action needed.</p>`
        + `</div>`;
    } else if (resStatus === 'not_found') {
      detailHtml = `<p style="margin:0;color:#ccc;font-size:0.85rem;">This QR code doesn't match any active booking. Please verify the code with the customer.</p>`;
    } else if (guestName) {
      detailHtml = `<div style="text-align:left;font-size:0.9rem;line-height:1.6;">`
        + detailRow('Guest', guestName)
        + `</div>`;
    }

    await Swal.fire({
      ...SWAL_DARK, icon, title,
      html: `${detailHtml}<p style="margin:8px 0 0;color:#888;font-size:0.8rem;">${message}</p>`,
      confirmButtonText: resStatus === 'pending' ? 'Go to Reservations' : 'Scan Next',
      showCancelButton: resStatus === 'pending',
      cancelButtonText: 'Close',
      allowOutsideClick: false,
      allowEscapeKey: false,
      buttonsStyling: true,
      customClass: { popup: 'swal-dark-popup', confirmButton: 'swal-confirm-btn' },
    }).then((result) => {
      if (resStatus === 'pending' && result.isConfirmed) window.location.href = '/reservations';
    });

    alertDialogOpen.current = false;
    lastScannedRef.current = '';
    processingRef.current = false;
    setLoading(false);
    setTimeout(() => {
      if (!destroyedRef.current && mode === 'camera') startCamera();
    }, 0);
  }, [mode, startCamera]);

  // ── Process a scanned transaction code ────────────────────────────
  const processScan = useCallback(async (txn) => {
    if (!txn || processingRef.current || alertDialogOpen.current) return;

    const now = Date.now();
    if (txn === lastScannedRef.current && now - lastScanTimeRef.current < 5000) return;
    if (now - lastScanTimeRef.current < 800) return;

    console.log('[QRScan] Processing:', txn);
    processingRef.current = true;
    lastScannedRef.current = txn;
    lastScanTimeRef.current = now;
    setLoading(true);

    stopCamera();

    try {
      const res = await reservationApi.qrCheckIn(txn);
      const data = res.data;

      setRecentScans(prev => [
        { txn, time: new Date(), type: 'success', guest: data.reservation?.guest_name },
        ...prev.slice(0, 19),
      ]);

      await showSuccessAlert(data.reservation, txn);
    } catch (err) {
      const errData = err.response?.data || {};
      const httpStatus = err.response?.status;
      const resStatus = errData.reservation_status
        || (httpStatus === 403 ? 'forbidden'
          : httpStatus === 404 ? 'not_found'
          : 'error');
      const msg = errData.message
        || (httpStatus === 403 ? 'You do not have permission to perform QR check-in.'
          : httpStatus === 500 ? 'Server error — please try again.'
          : 'An unexpected error occurred.');

      setRecentScans(prev => [
        { txn, time: new Date(), type: httpStatus === 409 ? 'warning' : 'error', guest: errData.reservation?.guest_name },
        ...prev.slice(0, 19),
      ]);

      await showErrorAlert({ reservation_status: resStatus, message: msg, reservation: errData.reservation });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera, showSuccessAlert, showErrorAlert]);

  // ── Mode / mount lifecycle ────────────────────────────────────────
  useEffect(() => {
    destroyedRef.current = false;
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      destroyedRef.current = true;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const txn = manualInput.trim();
    if (!txn || loading || alertDialogOpen.current) return;
    setManualInput('');
    await processScan(txn);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
            QR Check-In
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.2rem 0 0' }}>
            Scan customer QR codes to verify reservations
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setMode(mode === 'camera' ? 'manual' : 'camera')}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
              background: mode === 'manual' ? 'rgba(201,118,47,0.15)' : 'var(--m-active-bg)',
              color: mode === 'manual' ? '#C9762F' : '#aaa',
              border: `1px solid ${mode === 'manual' ? 'rgba(201,118,47,0.3)' : 'var(--m-border)'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            {mode === 'camera' ? <Keyboard size={14} /> : <Camera size={14} />}
            {mode === 'camera' ? 'Manual' : 'Camera'}
          </button>
        </div>
      </div>

      {/* Camera Scanner */}
      {mode === 'camera' && (
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '16px',
          overflow: 'hidden', background: '#111', marginBottom: '1.5rem',
          border: '1px solid var(--m-border)',
        }}>
          <div id={SCAN_REGION_ID} style={{ width: '100%', height: '100%' }} />

          {cameraActive && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                width: '220px', height: '220px', position: 'relative',
                border: '2px solid rgba(201,118,47,0.6)', borderRadius: '16px',
              }}>
                {[
                  { top: '-2px', left: '-2px', borderTop: '3px solid #C9762F', borderLeft: '3px solid #C9762F', borderTopLeftRadius: '16px' },
                  { top: '-2px', right: '-2px', borderTop: '3px solid #C9762F', borderRight: '3px solid #C9762F', borderTopRightRadius: '16px' },
                  { bottom: '-2px', left: '-2px', borderBottom: '3px solid #C9762F', borderLeft: '3px solid #C9762F', borderBottomLeftRadius: '16px' },
                  { bottom: '-2px', right: '-2px', borderBottom: '3px solid #C9762F', borderRight: '3px solid #C9762F', borderBottomRightRadius: '16px' },
                ].map((style, i) => (
                  <div key={i} style={{ position: 'absolute', width: '24px', height: '24px', ...style }} />
                ))}
                <div style={{
                  position: 'absolute', left: '8px', right: '8px', height: '2px',
                  background: 'linear-gradient(90deg, transparent, #C9762F, transparent)',
                  animation: 'scanLine 2s ease-in-out infinite',
                }} />
              </div>
              <p style={{ color: '#C9762F', fontSize: '0.8rem', fontWeight: 600, marginTop: '1rem' }}>
                {loading ? 'Processing...' : 'Point camera at QR code'}
              </p>
            </div>
          )}

          {!cameraActive && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '1rem',
            }}>
              <CameraOff size={48} color="#555" />
              <p style={{ color: '#888', fontSize: '0.85rem' }}>Camera access required</p>
              <button onClick={startCamera} style={{
                padding: '0.6rem 1.5rem', borderRadius: '8px', background: '#C9762F',
                color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer',
              }}>
                Enable Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Transaction Number
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={inputRef}
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g. RES-20260908-ARP24V"
              autoFocus
              style={{
                flex: 1, padding: '0.7rem 1rem', borderRadius: '10px',
                background: 'var(--m-active-bg)', border: '1px solid var(--m-border)',
                color: '#fff', fontSize: '0.95rem', fontFamily: "'Sora', monospace",
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || loading}
              style={{
                padding: '0.7rem 1.2rem', borderRadius: '10px', background: '#C9762F',
                color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                opacity: !manualInput.trim() || loading ? 0.5 : 1,
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Check In
            </button>
          </div>
        </form>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Recent Scans
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {recentScans.map((scan, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.8rem', borderRadius: '8px',
                background: 'var(--m-active-bg)', border: '1px solid var(--m-border)',
                fontSize: '0.8rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {scan.type === 'success' ? <CheckCircle2 size={14} color="#4ade80" /> :
                   scan.type === 'warning' ? <CheckCircle2 size={14} color="#fbbf24" /> :
                   <XCircle size={14} color="#ef4444" />}
                  <span style={{ color: '#ccc', fontWeight: 600 }}>{scan.guest || scan.txn}</span>
                </div>
                <span style={{ color: '#555', fontSize: '0.72rem' }}>
                  {scan.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SweetAlert2 dark theme overrides */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 8px; }
          50% { top: calc(100% - 10px); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .swal-dark-popup {
          background: var(--m-surface-2) !important;
          border: 1px solid var(--m-border) !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important;
        }
        .swal-dark-popup .swal2-title {
          color: #fff !important;
          font-family: 'Outfit', sans-serif !important;
          font-weight: 700 !important;
        }
        .swal-dark-popup .swal2-html-container {
          color: #ccc !important;
          margin: 0.5rem 0 0 !important;
          font-family: 'Inter', sans-serif !important;
        }
        .swal-dark-popup .swal2-icon {
          border: none !important;
          margin: 0 auto 0.75rem !important;
        }
        .swal-dark-popup .swal2-icon.swal2-success [class^=swal2-success-line] {
          border-color: #4ade80 !important;
        }
        .swal-dark-popup .swal2-icon.swal2-success .swal2-success-ring {
          border-color: rgba(74,222,128,0.3) !important;
        }
        .swal-dark-popup .swal2-icon.swal2-error {
          border-color: #ef4444 !important;
        }
        .swal-dark-popup .swal2-icon.swal2-warning {
          border-color: #fbbf24 !important;
        }
        .swal-confirm-btn {
          background: #C9762F !important;
          color: #fff !important;
          border: none !important;
          border-radius: 10px !important;
          padding: 0.65rem 1.5rem !important;
          font-weight: 600 !important;
          font-size: 0.9rem !important;
          cursor: pointer !important;
          transition: background 0.2s !important;
        }
        .swal-confirm-btn:hover {
          background: #b5682a !important;
        }
      `}</style>
    </div>
  );
}
