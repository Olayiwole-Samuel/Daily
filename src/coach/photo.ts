// Shrinks a photo ON THE DEVICE before it goes anywhere: max 1024 px on the long
// side, JPEG, under ~300 KB. Saves the user's data and keeps the AI request cheap.

const MAX_SIDE = 1024;
const MAX_BYTES = 300 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't open that image. Try a JPG or PNG photo."));
    };
    img.src = url;
  });
}

// Base64 is 4 chars per 3 bytes, so the real size is about 3/4 of the string length.
function base64Bytes(dataUrl: string): number {
  return Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
}

function draw(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the image.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface CompressedPhoto {
  dataUrl: string; // for showing a preview
  base64: string; // what is sent to the server (no "data:" prefix)
}

export async function compressPhoto(file: File, maxSide = MAX_SIDE, maxBytes = MAX_BYTES): Promise<CompressedPhoto> {
  const img = await loadImage(file);
  let side = maxSide;
  let canvas = draw(img, side);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  // Lower the quality first, then the size, until it's small enough.
  while (base64Bytes(dataUrl) > maxBytes && (quality > 0.45 || side > 480)) {
    if (quality > 0.45) {
      quality -= 0.1;
    } else {
      side = Math.round(side * 0.8);
      canvas = draw(img, side);
    }
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
