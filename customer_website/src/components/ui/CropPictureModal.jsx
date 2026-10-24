import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { X } from 'lucide-react';
import { cropToSquare } from '../../utils/cropImage';

const OUTPUT_SIZE = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function CropPictureModal({ src, onClose, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [areaPixels, setAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const onCropComplete = useCallback((_area, pixels) => {
    setAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!areaPixels || saving) return;
    setSaving(true);
    setError('');
    try {
      const croppedFile = await cropToSquare(src, areaPixels, OUTPUT_SIZE);
      await onSave(croppedFile);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to upload picture.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="crop-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Crop profile picture"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div className="crop-panel" onClick={(e) => e.stopPropagation()}>
        <div className="crop-head">
          <div>
            <h3 className="text-h3">Adjust your picture</h3>
            <p className="crop-sub">
              Drag to reposition and scroll or use the slider to zoom. The circle shows how your
              profile photo will look.
            </p>
          </div>
          <button
            type="button"
            className="crop-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="crop-stage">
          <Cropper
            image={src}
            crop={crop}
            rotation={0}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            restrictPosition
            zoomWithScroll
            zoomSpeed={0.5}
            showGrid
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
          {saving && (
            <div className="crop-busy">
              <span className="crop-spinner" />
              Saving picture…
            </div>
          )}
        </div>

        <div className="crop-zoom-row">
          <span className="text-label">Zoom</span>
          <input
            className="crop-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={saving}
            aria-label="Zoom"
          />
        </div>

        {error && <div className="alert alert-err" style={{ marginTop: '0.85rem' }}>{error}</div>}

        <div className="crop-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-red"
            onClick={handleSave}
            disabled={saving || !areaPixels}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CropPictureModal;
