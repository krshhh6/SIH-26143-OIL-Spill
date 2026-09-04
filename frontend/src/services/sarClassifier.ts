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

export async function classifyImage(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<SarClassificationResult> {
  const start = performance.now();
  
  // Demo mode fallback
  if (!session) {
    await new Promise(r => setTimeout(r, 600)); // Simulate inference time
    const prob = Math.random();
    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: prob > 0.5 ? 'oil_spill' : 'no_oil',
      confidence: prob > 0.5 ? prob : 1 - prob,
      inferenceTimeMs: Math.round(performance.now() - start),
    };
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
