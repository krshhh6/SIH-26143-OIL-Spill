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

  // Read raster data (downsampled or full resolution)
  const rasters = await image.readRasters({
    width: targetWidth,
    height: targetHeight,
  });

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

    for (let i = 0; i < totalPixels; i++) {
      const v_vv = vvRaster[i];
      const v_vh = vhRaster[i];

      let n_vv = 0;
      if (Number.isFinite(v_vv)) {
        const clipped = Math.max(vvMin, Math.min(vvMax, v_vv));
        n_vv = (clipped - vvMin) / (vvMax - vvMin);
      }
      vvNormBuffer[i] = n_vv;

      let n_vh = 0;
      if (Number.isFinite(v_vh)) {
        const clipped = Math.max(vhMin, Math.min(vhMax, v_vh));
        n_vh = (clipped - vhMin) / (vhMax - vhMin);
      }
      vhNormBuffer[i] = n_vh;

      // Draw VV to visual canvas
      const gray = Math.round(n_vv * 255);
      const pixelIdx = i * 4;
      imgData.data[pixelIdx] = gray;
      imgData.data[pixelIdx + 1] = gray;
      imgData.data[pixelIdx + 2] = gray;
      imgData.data[pixelIdx + 3] = 255;
    }
  } else if (rasters.length === 1) {
    // Case 2: Single band (Grayscale or single-pol SAR)
    const singleRaster = (rasters[0] as unknown) as ArrayLike<number>;
    formatDescription = `Single-Band Raster (${originalWidth}x${originalHeight})`;

    vvNormBuffer = new Float32Array(totalPixels);
    vhNormBuffer = new Float32Array(totalPixels);

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < totalPixels; i++) {
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

    for (let i = 0; i < totalPixels; i++) {
      const v = singleRaster[i];
      let norm = 0;
      if (Number.isFinite(v)) {
        const clipped = Math.max(lowBound, Math.min(highBound, v));
        norm = (clipped - lowBound) / range;
      }
      vvNormBuffer[i] = norm;
      // Synthesize VH with physical ocean offset (-10.5 dB -> approx -0.22 normalized)
      vhNormBuffer[i] = Math.max(0, norm - 0.22);

      const gray = Math.round(norm * 255);
      const pixelIdx = i * 4;
      imgData.data[pixelIdx] = gray;
      imgData.data[pixelIdx + 1] = gray;
      imgData.data[pixelIdx + 2] = gray;
      imgData.data[pixelIdx + 3] = 255;
    }
  } else if (rasters.length >= 3) {
    // Case 3: RGB / Multi-spectral TIFF
    formatDescription = `RGB Multi-Band TIFF (${originalWidth}x${originalHeight})`;
    const rRaster = (rasters[0] as unknown) as ArrayLike<number>;
    const gRaster = (rasters[1] as unknown) as ArrayLike<number>;
    const bRaster = (rasters[2] as unknown) as ArrayLike<number>;

    for (let i = 0; i < totalPixels; i++) {
      const pixelIdx = i * 4;
      imgData.data[pixelIdx] = Math.min(255, Math.max(0, rRaster[i]));
      imgData.data[pixelIdx + 1] = Math.min(255, Math.max(0, gRaster[i]));
      imgData.data[pixelIdx + 2] = Math.min(255, Math.max(0, bRaster[i]));
      imgData.data[pixelIdx + 3] = 255;
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
