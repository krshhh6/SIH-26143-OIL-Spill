import * as GeoTIFF from 'geotiff';

export interface DecodedTiffResult {
  dataUrl: string;
  width: number;
  height: number;
  bands: number;
  formatDescription: string;
}

/**
 * Decodes any TIFF or GeoTIFF (including Sentinel-1 32-bit float SAR dB files)
 * into a browser-renderable PNG Data URL.
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

  // Case 1: Dual-polarization Sentinel-1 SAR (Band 0 = VH, Band 1 = VV in dB)
  if (rasters.length >= 2) {
    // VV band (index 1) provides the strongest capillary wave depression contrast for oil slicks
    const vvRaster = (rasters[1] as unknown) as ArrayLike<number>;
    formatDescription = `Sentinel-1 Dual-Pol SAR (${originalWidth}x${originalHeight}, VV band displayed)`;

    // Calculate percentiles for optimal dynamic range
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < totalPixels; i++) {
      const v = vvRaster[i];
      if (Number.isFinite(v)) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    // Standard SAR dB normalization (calibrated to -35.0 dB to -10.0 dB range)
    const isDbScale = minVal < -5.0 || maxVal < 10.0;
    const lowBound = isDbScale ? -35.0 : minVal;
    const highBound = isDbScale ? -10.0 : maxVal;
    const range = highBound - lowBound || 1.0;

    for (let i = 0; i < totalPixels; i++) {
      const v = vvRaster[i];
      let norm = 0;
      if (Number.isFinite(v)) {
        const clipped = Math.max(lowBound, Math.min(highBound, v));
        norm = (clipped - lowBound) / range;
      }
      const gray = Math.round(norm * 255);
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
    const lowBound = isDbScale ? -35.0 : minVal;
    const highBound = isDbScale ? -10.0 : (maxVal || 1);
    const range = highBound - lowBound || 1;

    for (let i = 0; i < totalPixels; i++) {
      const v = singleRaster[i];
      let norm = 0;
      if (Number.isFinite(v)) {
        const clipped = Math.max(lowBound, Math.min(highBound, v));
        norm = (clipped - lowBound) / range;
      }
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
  };
}
