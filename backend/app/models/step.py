from dataclasses import dataclass, field
import uuid


@dataclass
class Step:
    order_num: int
    description: str
    recipe_id: str
    duration_min: int = 0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
