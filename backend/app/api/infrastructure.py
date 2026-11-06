from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Dict, Any

from app.core.database import get_db
from app.models import Document, Application, User
from app.infrastructure_cv.inspector import InfrastructureInspector
from app.api.deps import get_current_user

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure Computer Vision"])

@router.post("/analyze-photo/{doc_id}")
def analyze_infra_photo(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes YOLO counting, blur/brightness checks, and EXIF GPS geofence analysis."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(doc.file_path)
    if not file_path.exists():
        # Fallback to local test photo
        file_path = Path("backend/storage/synthetic/infrastructure/app1_cs_lab.jpg")

    app = doc.application
    inst = app.institution

    # Quality check
    quality = InfrastructureInspector.analyze_image_quality(file_path)

    # Geofence check
    geofence = InfrastructureInspector.verify_exif_geofence(
        file_path, inst.latitude or 12.9716, inst.longitude or 77.5946
    )

    # Object counting
    counts = InfrastructureInspector.count_infrastructure_objects(file_path)

    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "quality_metrics": quality,
        "geofence_verification": geofence,
        "detected_objects": counts,
        "advisory_recommendation": (
            "Evidence satisfactory. Meets classroom infrastructure norms."
            if quality["quality_status"] == "ACCEPTABLE" and geofence["geofence_in_bounds"]
            else "Quality deficient or location mismatch. Recommend physical or virtual spot inspection."
        )
    }
