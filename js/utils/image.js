// Shrinks an uploaded image so it fits comfortably in browser storage.

export async function resizeImage(file, maxSize = 640, quality = 0.8) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = url;
    });

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency, so paint a white background first.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
