from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Application, Document, Finding, Institution

class KnowledgeGraphBuilder:
    @staticmethod
    def build_graph(application: Application, db: Session) -> Dict[str, Any]:
        nodes = []
        edges = []
        inst = application.institution

        # Root Node: Institution
        nodes.append({
            "id": f"inst_{inst.id}",
            "type": "institution",
            "data": {
                "label": inst.name,
                "sublabel": f"AICTE ID: {inst.aicte_id}",
                "intake": inst.approved_intake,
                "city": f"{inst.city}, {inst.state}",
                "category": "Institution"
            },
            "position": {"x": 350, "y": 50}
        })

        # Trust Node
        nodes.append({
            "id": f"trust_{inst.id}",
            "type": "trust",
            "data": {
                "label": inst.trust_name,
                "sublabel": "Sponsoring Trust / Society",
                "category": "Trust"
            },
            "position": {"x": 100, "y": 50}
        })

        edges.append({
            "id": f"e_inst_trust",
            "source": f"inst_{inst.id}",
            "target": f"trust_{inst.id}",
            "label": "governed_by",
            "animated": False,
            "style": {"stroke": "#64748b"}
        })

        # Declared Survey Number Entity
        declared_survey = application.declared_data.get("survey_no") or "N/A"
        nodes.append({
            "id": f"declared_survey",
            "type": "entity",
            "data": {
                "label": f"Declared Survey: {declared_survey}",
                "sublabel": "Official Campus Parcel",
                "category": "Land Entity"
            },
            "position": {"x": 600, "y": 50}
        })

        edges.append({
            "id": f"e_inst_survey",
            "source": f"inst_{inst.id}",
            "target": "declared_survey",
            "label": "declares_location",
            "style": {"stroke": "#0ea5e9"}
        })

        # Documents Nodes & Cross-Checking
        doc_x = 50
        y_offset = 200

        for idx, doc in enumerate(application.documents):
            d_id = f"doc_{doc.id}"
            nodes.append({
                "id": d_id,
                "type": "document",
                "data": {
                    "label": doc.file_name,
                    "sublabel": f"Type: {doc.doc_type}",
                    "category": "Submitted Document",
                    "doc_id": doc.id,
                    "risk": doc.risk_indicators.get("risk_score", 0.0)
                },
                "position": {"x": doc_x + (idx * 220), "y": y_offset}
            })

            edges.append({
                "id": f"e_inst_{d_id}",
                "source": f"inst_{inst.id}",
                "target": d_id,
                "label": "submitted",
                "style": {"stroke": "#94a3b8"}
            })

            # Check if document has extracted survey number
            fields = doc.extracted_fields or {}
            doc_survey = fields.get("survey_no")
            if doc_survey:
                s_node_id = f"survey_{doc.id}"
                has_conflict = (declared_survey != "N/A" and doc_survey.strip() != declared_survey.strip())

                nodes.append({
                    "id": s_node_id,
                    "type": "entity",
                    "data": {
                        "label": f"Survey No: {doc_survey}",
                        "sublabel": f"Extracted from {doc.file_name}",
                        "category": "Document Survey",
                        "has_conflict": has_conflict
                    },
                    "position": {"x": doc_x + (idx * 220), "y": y_offset + 140}
                })

                edge_color = "#ef4444" if has_conflict else "#10b981"
                edges.append({
                    "id": f"e_{d_id}_{s_node_id}",
                    "source": d_id,
                    "target": s_node_id,
                    "label": "CONFLICT: Mismatch" if has_conflict else "matches_parcel",
                    "animated": has_conflict,
                    "style": {
                        "stroke": edge_color,
                        "strokeWidth": 2 if has_conflict else 1,
                        "strokeDasharray": "5,5" if has_conflict else None
                    }
                })

        # Add Finding Nodes for Critical Discrepancies
        finding_y = 480
        for idx, finding in enumerate(application.findings[:4]):
            f_id = f"finding_{finding.id}"
            nodes.append({
                "id": f_id,
                "type": "finding",
                "data": {
                    "label": finding.rule_id,
                    "sublabel": finding.reason[:45] + "...",
                    "severity": finding.severity,
                    "clause": finding.clause,
                    "category": "Regulatory Discrepancy"
                },
                "position": {"x": 120 + (idx * 240), "y": finding_y}
            })

            # Connect to document if present
            if finding.document_id:
                edges.append({
                    "id": f"e_finding_{finding.id}",
                    "source": f"doc_{finding.document_id}",
                    "target": f_id,
                    "label": f"FLAGGED: {finding.severity}",
                    "animated": True,
                    "style": {"stroke": "#ef4444", "strokeWidth": 2}
                })

        return {
            "application_id": application.id,
            "institution_name": inst.name,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "nodes": nodes,
            "edges": edges
        }
