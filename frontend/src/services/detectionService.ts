import type { DetectionResult } from '../types/dashboard';

const API_BASE = 'http://localhost:8000/api/v1';

export async function runSentinel1Detection(
  aoi?: { type: string; coordinates: [number, number][][] },
  dateRange?: string[],
  sensitivity: number = 0.35
): Promise<DetectionResult> {
  try {
    const response = await fetch(`${API_BASE}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aoi,
        date_range: dateRange,
        sensitivity,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: 'error',
        polygons: [],
        error: `Detection API returned HTTP ${response.status}: ${errorText}`,
        message: 'Detection service encountered an error processing Sentinel-1 SAR pass.',
      };
    }

    const data: DetectionResult = await response.json();
    return data;
  } catch (err: any) {
    return {
      status: 'error',
      polygons: [],
      error: err?.message || 'Failed to connect to backend detection service at http://localhost:8000',
      message: 'Detection service unavailable. Please ensure backend is running.',
    };
  }
}
