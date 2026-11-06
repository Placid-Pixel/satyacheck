import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List
import fitz
from PIL import Image

def detect_copy_move(file_path: Path, min_matches: int = 12, min_distance_px: int = 40) -> Dict[str, Any]:
    """
    Detects copy-move / cloned regions within the same document page
    (e.g., fraudulent duplication of an official stamp, seal, or signature).
    """
    try:
        if file_path.suffix.lower() == ".pdf":
            doc = fitz.open(str(file_path))
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        else:
            cv_img = cv2.imread(str(file_path))

        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        
        # Initialize ORB detector
        orb = cv2.ORB_create(nfeatures=1500, fastThreshold=12)
        keypoints, descriptors = orb.detectAndCompute(gray, None)

        if descriptors is None or len(descriptors) < 20:
            return {
                "technique": "Copy-Move Cloned-Region Analysis",
                "cloned_regions_found": False,
                "matches_count": 0,
                "anomaly_score": 0.05
            }

        # Match descriptors against themselves (excluding identical index matches)
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        matches = bf.knnMatch(descriptors, descriptors, k=3)

        cloned_pairs = []
        for match_group in matches:
            if len(match_group) >= 2:
                # Top match is self (distance 0), second match is closest distinct point
                m1, m2 = match_group[0], match_group[1]
                if m1.queryIdx != m2.trainIdx and m2.distance < 35:
                    pt1 = keypoints[m1.queryIdx].pt
                    pt2 = keypoints[m2.trainIdx].pt
                    spatial_dist = np.sqrt((pt1[0] - pt2[0])**2 + (pt1[1] - pt2[1])**2)
                    if spatial_dist > min_distance_px:
                        cloned_pairs.append({
                            "source_pt": [round(pt1[0], 1), round(pt1[1], 1)],
                            "target_pt": [round(pt2[0], 1), round(pt2[1], 1)],
                            "distance": round(spatial_dist, 1)
                        })

        has_clone = len(cloned_pairs) >= min_matches
        score = min(1.0, len(cloned_pairs) / 25.0)

        return {
            "technique": "Copy-Move Cloned-Region Analysis",
            "cloned_regions_found": has_clone,
            "matches_count": len(cloned_pairs),
            "anomaly_score": round(score, 3),
            "cloned_clusters": cloned_pairs[:10] if has_clone else [],
            "disclaimer": "Preliminary indicator – requires human verification."
        }
    except Exception as e:
        return {
            "technique": "Copy-Move Cloned-Region Analysis",
            "cloned_regions_found": False,
            "error": str(e),
            "anomaly_score": 0.0
        }
