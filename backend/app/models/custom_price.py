from dataclasses import dataclass, field
import uuid


@dataclass
class CustomPrice:
    user_id: str
    ingredient_name: str
    price_per_kg: float
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
