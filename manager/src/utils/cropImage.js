/**
 * Crop an image using canvas and return a Blob.
 * @param {string} imageSrc - URL of the image to crop
 * @param {{ x: number, y: number }} crop - Crop position in pixels
 * @param {{ width: number, height: number }} cropSize - Crop area size in pixels
 * @param {number} [outputWidth=512] - Output width in pixels
 * @returns {Promise<Blob>} Cropped image as a Blob
 */
export function getCroppedImg(imageSrc, crop, cropSize, outputWidth = 512) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const outputHeight = (cropSize.height / cropSize.width) * outputWidth;
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        crop.x, crop.y, cropSize.width, cropSize.height,
        0, 0, outputWidth, outputHeight
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(blob);
        },
        'image/jpeg',
        0.9
      );
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}
