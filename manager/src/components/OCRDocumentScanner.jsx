import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle, RotateCw } from 'lucide-react';
import Tesseract from 'tesseract.js';

const OCRDocumentScanner = ({ 
  label, 
  accept = '.jpg,.jpeg,.png,.pdf',
  file,
  onFile,
  onRemove,
  onOCRExtract,
  error,
  documentType = 'permit' // 'permit' or 'bir'
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Unable to access camera. Please check permissions or use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const capturedFile = new File([blob], `${documentType}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onFile(capturedFile);
      stopCamera();
      setCapturing(false);

      // Start OCR processing
      await processOCR(capturedFile);
    }, 'image/jpeg', 0.95);
  };

  const processOCR = async (imageFile) => {
    setProcessing(true);
    setOcrError(null);
    setOcrResult(null);

    try {
      const result = await Tesseract.recognize(
        imageFile,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const extractedText = result.data.text;
      console.log('Extracted Text:', extractedText);

      // Extract permit number and expiry date based on document type
      const extracted = extractDocumentInfo(extractedText, documentType);
      
      setOcrResult(extracted);
      
      // Callback to parent with extracted data
      if (onOCRExtract) {
        onOCRExtract(extracted);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrError('Failed to extract text from image. Please enter details manually.');
    } finally {
      setProcessing(false);
    }
  };

  const extractDocumentInfo = (text, type) => {
    const result = {
      permitNumber: '',
      expiryDate: '',
      rawText: text
    };

    // Clean and normalize text
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // Extract permit/certificate number
    // Common patterns: "No. 12345", "Number: 12345", "Permit No: 12345", "Certificate No: 12345"
    const numberPatterns = [
      /(?:permit|certificate|license|no\.?|number|#)\s*:?\s*([A-Z0-9-]+)/i,
      /([A-Z]{2,}\s*\d{4,})/,
      /(\d{4,}[-\s]?\d+)/
    ];

    for (const pattern of numberPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        result.permitNumber = match[1].trim();
        break;
      }
    }

    // Extract expiry/validity date
    // Common patterns: "12/31/2025", "31-12-2025", "December 31, 2025", "Valid until: 2025-12-31"
    const datePatterns = [
      /(?:expir(?:y|es?|ation)|valid(?:ity)?|until|to)\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:expir(?:y|es?|ation)|valid(?:ity)?|until|to)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        result.expiryDate = match[1].trim();
        break;
      }
    }

    return result;
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      onFile(selectedFile);
      
      // Only process OCR for images
      if (selectedFile.type.startsWith('image/')) {
        await processOCR(selectedFile);
      }
    }
  };

  return (
    <div className="space-y-3">
      <label className="label">{label}</label>

      {!file && !showCamera && (
        <div className="space-y-2">
          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(204,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload File</span>
          </button>

          {/* Camera Button */}
          <button
            type="button"
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors"
            style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', color: '#CC0000' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
          >
            <Camera className="w-4 h-4" />
            <span className="text-sm font-medium">Scan with Camera</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Camera View */}
      {showCamera && (
        <div className="relative rounded-xl overflow-hidden" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={capturing}
              className="px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
              style={{ background: '#CC0000', color: '#fff' }}
            >
              {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File Preview */}
      {file && (
        <div className="rounded-xl p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#4ade80' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: '#ff6666' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* OCR Processing */}
      {processing && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: '#60a5fa' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#93c5fd' }}>Processing Document...</p>
              <p className="text-xs mt-0.5" style={{ color: '#bfdbfe' }}>
                Extracting text using OCR technology
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OCR Result */}
      {ocrResult && !processing && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#4ade80' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>Text Extracted Successfully</p>
              <div className="mt-2 space-y-1 text-xs" style={{ color: '#86efac' }}>
                {ocrResult.permitNumber && (
                  <p>Permit Number: <strong>{ocrResult.permitNumber}</strong></p>
                )}
                {ocrResult.expiryDate && (
                  <p>Expiry Date: <strong>{ocrResult.expiryDate}</strong></p>
                )}
                {!ocrResult.permitNumber && !ocrResult.expiryDate && (
                  <p>No specific data extracted. Please enter manually.</p>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: '#86efac' }}>
                Please verify and correct the extracted information before submitting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OCR Error */}
      {ocrError && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#fcd34d' }}>OCR Processing Issue</p>
              <p className="text-xs mt-0.5" style={{ color: '#fde68a' }}>{ocrError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {error && (
        <p className="text-sm" style={{ color: '#ff6666' }}>{error}</p>
      )}
    </div>
  );
};

export default OCRDocumentScanner;
