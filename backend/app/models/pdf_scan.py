from dataclasses import dataclass, field
import uuid


@dataclass
class PdfScan:
    filename: str
    recipe_id: str
    status: str = 'pending'
    scanned_at: str = ''
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
