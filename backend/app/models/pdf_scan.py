from app.extensions import db
import uuid


class PdfScan(db.Model):
    __tablename__ = 'pdf_scans'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = db.Column(db.String(255), nullable=False)
    recipe_id = db.Column(db.String(36), db.ForeignKey('recipes.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')
    scanned_at = db.Column(db.String(50), default='')
