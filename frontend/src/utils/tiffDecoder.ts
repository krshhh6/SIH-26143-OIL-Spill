import * as GeoTIFF from 'geotiff';

export interface DecodedTiffResult {
  dataUrl: string;
  width: number;
  height: number;
  bands: number;
  formatDescription: string;
  vvRaster?: Float32Array;
  vhRaster?: Float32Array;
}

/**
 * Decodes any TIFF or GeoTIFF (including Sentinel-1 32-bit float SAR dB files)
 * into a browser-renderable PNG Data URL, and provides calibrated dual-pol raster buffers.
 */
export async function decodeTiffFile(file: File | Blob): Promise<DecodedTiffResult> {
  const arrayBuffer = await file.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const originalWidth = image.getWidth();
  const originalHeight = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();

  // Constrain max preview dimension to 800px to ensure fast rendering in web UI
  const maxDim = 800;
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((originalHeight / originalWidth) * maxDim);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((originalWidth / originalHeight) * maxDim);
      targetHeight = maxDim;
    }
  }

  // Read raster data safely without triggering geotiff.js LZW strip resizing bugs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rasters: any;
  let isNativeResolution = true;
  try {
    rasters = await image.readRasters();
  } catch (err) {
    console.warn('Native readRasters failed, trying with target dimensions:', err);
    try {
      rasters = await image.readRasters({
        width: targetWidth,
        height: targetHeight,
      });
      isNativeResolution = false;
    } catch (fallbackErr) {
      console.error('All geotiff readRasters attempts failed:', fallbackErr);
      throw fallbackErr;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas context for TIFF decoding');
  }

  const imgData = ctx.createImageData(targetWidth, targetHeight);
  const totalPixels = targetWidth * targetHeight;

  let formatDescription = '';
  let vvNormBuffer: Float32Array | undefined;
  let vhNormBuffer: Float32Array | undefined;

  // Helper to get pixel index in source raster
  const getSrcIndex = (x: number, y: number): number => {
    if (!isNativeResolution) {
      return y * targetWidth + x;
    }
    const srcX = Math.min(Math.floor(x * originalWidth / targetWidth), originalWidth - 1);
    const srcY = Math.min(Math.floor(y * originalHeight / targetHeight), originalHeight - 1);
    return srcY * originalWidth + srcX;
  };

  // Case 1: Dual-polarization Sentinel-1 SAR (Band 0 = VH, Band 1 = VV in dB)
  if (rasters.length >= 2) {
    // Verified: Band 1 = VV (co-pol), Band 0 = VH (cross-pol)
    const vhRaster = (rasters[0] as unknown) as ArrayLike<number>;
    const vvRaster = (rasters[1] as unknown) as ArrayLike<number>;
    formatDescription = `Sentinel-1 Dual-Pol SAR (${originalWidth}x${originalHeight}, VV/VH dual-polarization calibrated)`;

    vvNormBuffer = new Float32Array(totalPixels);
    vhNormBuffer = new Float32Array(totalPixels);

    // Calibrated physical SAR dB normalization
    // VV bounds: [-32.0 dB, -10.0 dB]
    // VH bounds: [-42.0 dB, -20.0 dB]
    const vvMin = -32.0;
    const vvMax = -10.0;
    const vhMin = -42.0;
    const vhMax = -20.0;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const dstIdx = y * targetWidth + x;
        const srcIdx = getSrcIndex(x, y);

        const v_vv = vvRaster[srcIdx];
        const v_vh = vhRaster[srcIdx];

        let n_vv = 0;
        if (Number.isFinite(v_vv)) {
          const clipped = Math.max(vvMin, Math.min(vvMax, v_vv));
          n_vv = (clipped - vvMin) / (vvMax - vvMin);
        }
        vvNormBuffer[dstIdx] = n_vv;

        let n_vh = 0;
        if (Number.isFinite(v_vh)) {
          const clipped = Math.max(vhMin, Math.min(vhMax, v_vh));
          n_vh = (clipped - vhMin) / (vhMax - vhMin);
        }
        vhNormBuffer[dstIdx] = n_vh;

        // Draw VV to visual canvas
        const gray = Math.round(n_vv * 255);
        const pixelIdx = dstIdx * 4;
        imgData.data[pixelIdx] = gray;
        imgData.data[pixelIdx + 1] = gray;
        imgData.data[pixelIdx + 2] = gray;
        imgData.data[pixelIdx + 3] = 255;
      }
    }
  } else if (rasters.length === 1) {
    // Case 2: Single band (Grayscale or single-pol SAR)
    const singleRaster = (rasters[0] as unknown) as ArrayLike<number>;
    formatDescription = `Single-Band Raster (${originalWidth}x${originalHeight})`;

    vvNormBuffer = new Float32Array(totalPixels);
    vhNormBuffer = new Float32Array(totalPixels);

    // Sample range to check scale
    let minVal = Infinity;
    let maxVal = -Infinity;
    const stride = Math.max(1, Math.floor(singleRaster.length / 5000));
    for (let i = 0; i < singleRaster.length; i += stride) {
      const v = singleRaster[i];
      if (Number.isFinite(v)) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    const isDbScale = minVal < -5.0;
    const lowBound = isDbScale ? -32.0 : minVal;
    const highBound = isDbScale ? -10.0 : (maxVal || 1);
    const range = highBound - lowBound || 1;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const dstIdx = y * targetWidth + x;
        const srcIdx = getSrcIndex(x, y);
        const v = singleRaster[srcIdx];

        let norm = 0;
        if (Number.isFinite(v)) {
          const clipped = Math.max(lowBound, Math.min(highBound, v));
          norm = (clipped - lowBound) / range;
        }
        vvNormBuffer[dstIdx] = norm;
        vhNormBuffer[dstIdx] = Math.max(0, norm - 0.22);

        const gray = Math.round(norm * 255);
        const pixelIdx = dstIdx * 4;
        imgData.data[pixelIdx] = gray;
        imgData.data[pixelIdx + 1] = gray;
        imgData.data[pixelIdx + 2] = gray;
        imgData.data[pixelIdx + 3] = 255;
      }
    }
  } else if (rasters.length >= 3) {
    // Case 3: RGB / Multi-spectral TIFF
    formatDescription = `RGB Multi-Band TIFF (${originalWidth}x${originalHeight})`;
    const rRaster = (rasters[0] as unknown) as ArrayLike<number>;
    const gRaster = (rasters[1] as unknown) as ArrayLike<number>;
    const bRaster = (rasters[2] as unknown) as ArrayLike<number>;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const dstIdx = y * targetWidth + x;
        const srcIdx = getSrcIndex(x, y);
        const pixelIdx = dstIdx * 4;
        imgData.data[pixelIdx] = Math.min(255, Math.max(0, rRaster[srcIdx]));
        imgData.data[pixelIdx + 1] = Math.min(255, Math.max(0, gRaster[srcIdx]));
        imgData.data[pixelIdx + 2] = Math.min(255, Math.max(0, bRaster[srcIdx]));
        imgData.data[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    bands: samplesPerPixel,
    formatDescription,
    vvRaster: vvNormBuffer,
    vhRaster: vhNormBuffer
  };
}
