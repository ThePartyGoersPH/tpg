import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText } from 'lucide-react';

const FileDropZone = ({ label, accept, file, onFile, onRemove, error, helpText, hintText }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  }, [onFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const isImage = file && file.type.startsWith('image/');
  const preview = file && isImage ? URL.createObjectURL(file) : null;

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
        {label} <span style={{ color: '#CC0000' }}>*</span>
      </label>
      {helpText && (
        <p className="text-xs mb-2" style={{ color: '#555', fontFamily: "'DM Sans', Inter, sans-serif" }}>
          {helpText}
        </p>
      )}

      {file ? (
        <div
          className="relative flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(204,0,0,0.05)', border: '1px solid rgba(204,0,0,0.25)' }}
        >
          {isImage && preview ? (
            <img src={preview} alt="preview" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(204,0,0,0.15)' }}>
              <FileText className="w-5 h-5" style={{ color: '#CC0000' }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate" style={{ fontFamily: "'DM Sans', Inter, sans-serif" }}>{file.name}</p>
            <p className="text-xs" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" onClick={onRemove} className="flex-shrink-0 p-1 rounded-lg transition-colors" style={{ color: '#888' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="relative cursor-pointer rounded-xl p-6 text-center transition-all duration-200"
          style={{
            border: `1.5px dashed ${dragging ? '#CC0000' : error ? 'rgba(204,0,0,0.4)' : 'rgba(204,0,0,0.25)'}`,
            background: dragging ? 'rgba(204,0,0,0.06)' : 'rgba(204,0,0,0.02)',
          }}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: dragging ? '#CC0000' : '#555' }} />
          <p className="text-sm font-medium text-white mb-0.5" style={{ fontFamily: "'DM Sans', Inter, sans-serif" }}>
            Drag & drop or click to upload
          </p>
          <p className="text-xs" style={{ color: '#555', fontFamily: "'DM Sans', Inter, sans-serif" }}>
            {hintText || 'JPG, PNG, or PDF — max 5 MB'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
          />
        </div>
      )}
      {error && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{error}</p>}
    </div>
  );
};

export default FileDropZone;
