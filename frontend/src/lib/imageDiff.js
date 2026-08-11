// How different are two photos?
//
// Computed in the browser with a difference hash (dHash), because the backend
// has no image-comparison endpoint — /ai/duplicates compares text and location,
// and /ai/analyze-image looks at one image at a time.
//
// READ THIS BEFORE USING THE NUMBER FOR ANYTHING:
//
// Visual difference does NOT tell you whether a complaint was fixed. Both
// extremes are ambiguous:
//
//   very similar    nothing changed (not fixed)  — OR — same angle, small fix
//   very different  the problem is gone (fixed)  — OR — a photo of somewhere
//                                                        else entirely
//
// So this is a supporting signal, never a verdict. What actually answers "was
// it fixed" is re-running vision on the after photo and asking whether the
// reported problem still appears — see AiVerificationPanel.
//
// dHash compares adjacent-pixel gradients, so it is robust to exposure and
// scale changes but sensitive to framing. That is the right trade-off here:
// two photos of the same pothole in different light should read as similar.

const SIZE = 9;   // 9x8 comparisons -> 64-bit hash

function toGrayscaleGrid(img) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE - 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE, SIZE - 1);

  // Throws a SecurityError if the image tainted the canvas — i.e. it was served
  // without CORS headers. The caller treats that as "unavailable" rather than
  // failing the whole panel.
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE - 1);

  const grid = [];
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma — closer to perceived brightness than a flat average.
    grid.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return grid;
}

function dHash(img) {
  const g = toGrayscaleGrid(img);
  const bits = [];
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let col = 0; col < SIZE - 1; col += 1) {
      bits.push(g[row * SIZE + col] > g[row * SIZE + col + 1] ? 1 : 0);
    }
  }
  return bits;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for getImageData to work on a cross-origin image. Uploads are
    // served from the API host, which is a different origin in dev.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image could not be loaded'));
    img.src = url;
  });
}

/**
 * @returns {Promise<{ similarity: number|null, reason?: string }>}
 *          similarity is 0–100, or null when it cannot be computed.
 */
export async function compareImages(beforeUrl, afterUrl) {
  if (!beforeUrl || !afterUrl) {
    return { similarity: null, reason: 'Needs one photo from each side.' };
  }
  try {
    const [a, b] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl)]);
    const ha = dHash(a);
    const hb = dHash(b);
    let same = 0;
    for (let i = 0; i < ha.length; i += 1) if (ha[i] === hb[i]) same += 1;
    return { similarity: (same / ha.length) * 100 };
  } catch (err) {
    // Tainted canvas, 404, or a decode failure. All mean the same thing to the
    // caller: no number, and say why rather than showing a zero.
    return {
      similarity: null,
      reason: err?.name === 'SecurityError'
        ? 'Images are served without CORS headers, so they cannot be compared in the browser.'
        : 'One of the photos could not be loaded.',
    };
  }
}
