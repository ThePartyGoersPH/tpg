const MIME_FALLBACK = 'image/jpeg';

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image file.'));
    img.src = src;
  });
}

/**
 * Draw the selected crop region onto a square canvas and return a JPEG File.
 * Runs fully client-side: no upload happens until the caller sends the result.
 */
export async function cropToSquare(imageSrc, pixelCrop, outputSize = 500) {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, MIME_FALLBACK, 0.9));
  if (!blob) throw new Error('Could not crop that image file.');

  const file = new File([blob], `profile-picture-${Date.now()}.jpg`, {
    type: MIME_FALLBACK,
    lastModified: Date.now(),
  });
  return file;
}
