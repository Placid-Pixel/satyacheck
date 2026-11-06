import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from pathlib import Path
from typing import Dict, Any, Tuple
import fitz

def perform_ela(image_path: Path, output_heatmap_path: Path, quality: int = 90, scale: int = 15) -> Dict[str, Any]:
    """
    Performs Error Level Analysis (ELA) to detect JPEG compression inconsistencies
    characteristic of digital tampering, spliced text, or pasted stamps.
    """
    try:
        # If PDF, render first page to pixmap
        if image_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(image_path))
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            original = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            original = Image.open(str(image_path)).convert("RGB")

        # Save temporary resaved JPEG
        temp_resaved = output_heatmap_path.parent / f"temp_{output_heatmap_path.stem}.jpg"
        original.save(str(temp_resaved), "JPEG", quality=quality)

        resaved = Image.open(str(temp_resaved))
        # Compute difference
        diff = ImageChops.difference(original, resaved)
        
        # Scale difference to highlight tampering
        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        if max_diff == 0:
            max_diff = 1
        scale_factor = min(scale, 255.0 / max_diff)
        
        enhancer = ImageEnhance.Brightness(diff)
        diff_enhanced = enhancer.enhance(scale_factor)

        # Apply color colormap (JET/INFERNO) via OpenCV for rich visual inspection
        diff_np = np.array(diff_enhanced)
        diff_gray = cv2.cvtColor(diff_np, cv2.COLOR_RGB2GRAY)
        diff_colored = cv2.applyColorMap(diff_gray, cv2.COLORMAP_JET)

        output_heatmap_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_heatmap_path), diff_colored)

        if temp_resaved.exists():
            temp_resaved.unlink()

        # Compute metric score (mean difference in high-frequency regions)
        mean_diff = float(np.mean(diff_gray))
        max_val = float(np.max(diff_gray))
        anomaly_score = min(1.0, mean_diff / 45.0)

        is_tampered_indicated = anomaly_score > 0.45 or max_val > 220

        return {
            "technique": "Error Level Analysis (ELA)",
            "anomaly_score": round(anomaly_score, 3),
            "mean_error": round(mean_diff, 2),
            "max_error": round(max_val, 2),
            "tampering_suspected": is_tampered_indicated,
            "heatmap_path": str(output_heatmap_path.name),
            "disclaimer": "Preliminary indicator – requires human forensic verification."
        }
    except Exception as e:
        return {
            "technique": "Error Level Analysis (ELA)",
            "anomaly_score": 0.0,
            "error": str(e),
            "tampering_suspected": False
        }
