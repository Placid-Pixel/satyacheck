from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Application, User
from app.knowledge_graph.builder import KnowledgeGraphBuilder
from app.api.deps import get_current_user

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])

@router.get("/{app_id}")
def get_application_knowledge_graph(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates interactive cross-document entity knowledge graph for React Flow."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    return KnowledgeGraphBuilder.build_graph(app, db)
