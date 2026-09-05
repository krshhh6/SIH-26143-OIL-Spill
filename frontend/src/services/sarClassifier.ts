import * as ort from 'onnxruntime-web';
import type { SarClassificationResult } from '../types/dashboard';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

let session: ort.InferenceSession | null = null;

export async function loadModel(): Promise<void> {
  if (!session) {
    try {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';
      session = await ort.InferenceSession.create('/models/oil_classifier.onnx', {
        executionProviders: ['wasm'],
      });
    } catch (e) {
      console.warn("Could not load ONNX model. Falling back to demo mode.", e);
      session = null;
    }
  }
}

interface ImageValidationResult {
  isValid: boolean;
  reason?: string;
  metrics: {
    meanBrightness: number;
    brightRatio: number;
    sharpTransitions: number;
    isColor: boolean;
  };
}

export function validateSarImage(data: Uint8ClampedArray, width: number, height: number): ImageValidationResult {
  const totalPixels = width * height;
  let sumBrightness = 0;
  let brightCount = 0;
  let colorDiffSum = 0;
  
  const grayValues = new Float32Array(totalPixels);
  
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    // Saturation / color distance
    colorDiffSum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grayValues[i] = gray;
    sumBrightness += gray;
    if (gray > 190) {
      brightCount++;
    }
  }
  
  const meanBrightness = sumBrightness / totalPixels;
  const brightRatio = brightCount / totalPixels;
  const avgColorDiff = colorDiffSum / totalPixels;
  const isColor = avgColorDiff > 28;
  
  // Check for document/invoice text transitions
  let sharpTransitions = 0;
  const stride = 3;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width - stride; x++) {
      const diff = Math.abs(grayValues[rowOffset + x + stride] - grayValues[rowOffset + x]);
      if (diff > 85) {
        sharpTransitions++;
      }
    }
  }
  const transitionRatio = sharpTransitions / totalPixels;
  
  // 1. Text document / invoice / receipt detection:
  // Paper background is predominantly bright (>190) and contains sharp dark-to-bright text transitions.
  if (brightRatio > 0.30 && transitionRatio > 0.02) {
    return {
      isValid: false,
      reason: 'Paper Document / Printed Invoice (Non-Marine Scene)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }
  
  // 2. Overexposed or flat white sheet/document
  if (brightRatio > 0.50 && meanBrightness > 160) {
    return {
      isValid: false,
      reason: 'High-Luminance Non-Marine Surface (White paper/document)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }
  
  // 3. Completely blank or black image
  if (meanBrightness < 8) {
    return {
      isValid: false,
      reason: 'Empty / Black Frame (Zero radar backscatter signal)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  // 4. Strong optical color photo (portrait, selfie, colorful room)
  if (isColor && avgColorDiff > 45) {
    return {
      isValid: false,
      reason: 'Optical Color Camera Photo (SAR models require single-polarization microwave radar)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  return {
    isValid: true,
    metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
  };
}

export async function classifyImage(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<SarClassificationResult> {
  const start = performance.now();
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 400, 400);
  
  const imageData = ctx.getImageData(0, 0, 400, 400);
  const data = imageData.data;
  
  // Domain Validation Check
  const validation = validateSarImage(data, 400, 400);
  if (!validation.isValid) {
    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: 'invalid_sar',
      confidence: 0,
      inferenceTimeMs: Math.round(performance.now() - start),
      errorMessage: 'Uploaded image is not a Synthetic Aperture Radar (SAR) ocean scene.',
      rejectionReason: validation.reason,
      metrics: validation.metrics,
    };
  }

  // Demo mode fallback
  if (!session) {
    await new Promise(r => setTimeout(r, 600)); // Simulate inference time
    const prob = Math.random();
    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: prob > 0.5 ? 'oil_spill' : 'no_oil',
      confidence: prob > 0.5 ? prob : 1 - prob,
      inferenceTimeMs: Math.round(performance.now() - start),
      metrics: validation.metrics,
    };
  }
  
  const tensorData = new Float32Array(400 * 400);
  for (let i = 0; i < 400 * 400; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    tensorData[i] = gray / 255.0;
  }
  
  const tensor = new ort.Tensor('float32', tensorData, [1, 1, 400, 400]);
  
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = tensor;
  
  const results = await session.run(feeds);
  const outputTensor = results[session.outputNames[0]];
  const logit = outputTensor.data[0] as number;
  const prob = sigmoid(logit);
  
  const prediction = prob > 0.5 ? 'oil_spill' : 'no_oil';
  const confidence = prob > 0.5 ? prob : 1 - prob;
  
  return {
    imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
    prediction,
    confidence,
    inferenceTimeMs: Math.round(performance.now() - start),
    metrics: validation.metrics,
  };
}

export async function generateOcclusionMap(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<string> {
  if (!session) {
    // Demo mode occlusion map
    await new Promise(r => setTimeout(r, 1000));
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(100, 100, 200, 200);
    return canvas.toDataURL();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 400, 400);
  
  const imageData = ctx.getImageData(0, 0, 400, 400);
  const data = imageData.data;
  const tensorData = new Float32Array(400 * 400);
  for (let i = 0; i < 400 * 400; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    tensorData[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
  }
  
  // Baseline inference
  const baseTensor = new ort.Tensor('float32', tensorData, [1, 1, 400, 400]);
  const baseFeeds: Record<string, ort.Tensor> = {};
  baseFeeds[session.inputNames[0]] = baseTensor;
  const baseResults = await session.run(baseFeeds);
  const baseLogit = baseResults[session.outputNames[0]].data[0] as number;
  const baseProb = sigmoid(baseLogit);
  
  const heatmapData = new Float32Array(10 * 10);
  const patchSize = 40;
  
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const occludedData = new Float32Array(tensorData);
      
      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          const iy = y * patchSize + py;
          const ix = x * patchSize + px;
          occludedData[iy * 400 + ix] = 0;
        }
      }
      
      const occTensor = new ort.Tensor('float32', occludedData, [1, 1, 400, 400]);
      const occFeeds: Record<string, ort.Tensor> = {};
      occFeeds[session.inputNames[0]] = occTensor;
      const occResults = await session.run(occFeeds);
      const occLogit = occResults[session.outputNames[0]].data[0] as number;
      const occProb = sigmoid(occLogit);
      
      // Importance is the drop in probability for the predicted class
      heatmapData[y * 10 + x] = baseProb > 0.5 ? Math.max(0, baseProb - occProb) : Math.max(0, occProb - baseProb);
    }
  }
  
  // Normalize heatmap
  let maxHeat = 0;
  for (let i = 0; i < 100; i++) {
    if (heatmapData[i] > maxHeat) maxHeat = heatmapData[i];
  }
  
  // Draw heatmap overlay
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = 400;
  heatCanvas.height = 400;
  const heatCtx = heatCanvas.getContext('2d')!;
  
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const heat = maxHeat > 0 ? heatmapData[y * 10 + x] / maxHeat : 0;
      if (heat > 0.1) {
        heatCtx.fillStyle = `rgba(255, 0, 0, ${heat * 0.6})`;
        heatCtx.fillRect(x * patchSize, y * patchSize, patchSize, patchSize);
      }
    }
  }
  
  return heatCanvas.toDataURL();
}

export function isModelLoaded(): boolean {
  return session !== null;
}
