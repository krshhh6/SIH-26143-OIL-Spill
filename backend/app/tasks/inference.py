import os
import onnxruntime as ort
import numpy as np
import rasterio
from shapely.geometry import shape, MultiPolygon
from rasterio.features import shapes
from celery import shared_task

@shared_task
def run_sar_inference(file_path: str, model_path: str):
    """
    Celery task that runs ONNX inference on a Sentinel-1 SAR GeoTIFF
    and returns a vectorized MultiPolygon of the detected oil slick.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"SAR file not found: {file_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"ONNX model not found: {model_path}")

    # 1. Read the SAR data using rasterio
    with rasterio.open(file_path) as dataset:
        img_array = dataset.read(1).astype(np.float32)
        # Assuming the model expects a normalized [1, 1, H, W] tensor
        # Add batch and channel dimensions
        input_tensor = np.expand_dims(np.expand_dims(img_array, axis=0), axis=0)
        
        # Normalize assuming model expects 0-1 range
        if np.max(input_tensor) > 0:
            input_tensor = input_tensor / np.max(input_tensor)

    # 2. Run ONNX Inference
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # Run the model
    predictions = session.run([output_name], {input_name: input_tensor})[0]
    
    # Extract mask (assuming shape is [1, 1, H, W])
    # Threshold probability at 0.5 for binary mask
    probability_mask = predictions[0, 0, :, :]
    binary_mask = (probability_mask > 0.5).astype(np.uint8)
    
    # 3. Vectorize the binary mask using rasterio and shapely
    slick_polygons = []
    # rasterio.features.shapes yields (polygon, value) pairs
    # we only care about the polygons where the value is 1 (the slick)
    # We pass the original dataset transform to get geographic coordinates instead of pixel coordinates
    with rasterio.open(file_path) as dataset:
        transform = dataset.transform
        for geom, value in shapes(binary_mask, mask=binary_mask == 1, transform=transform):
            slick_polygons.append(shape(geom))
    
    if not slick_polygons:
        return {"status": "success", "message": "No oil slick detected.", "geometry": None}

    # Combine into a single MultiPolygon
    multi_poly = MultiPolygon(slick_polygons)
    
    # Calculate geometric properties
    # Note: For true geodesic area, you should reproject to an equal-area CRS.
    # We leave that for a full GIS utility wrapper.
    centroid = multi_poly.centroid
    area = multi_poly.area
    perimeter = multi_poly.length
    
    return {
        "status": "success",
        "geometry": multi_poly.wkt,
        "centroid": centroid.wkt,
        "area": area,
        "perimeter": perimeter,
        "confidence": float(np.mean(probability_mask[binary_mask == 1])) if np.sum(binary_mask) > 0 else 0.0
    }
