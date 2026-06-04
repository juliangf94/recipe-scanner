from dataclasses import dataclass, field
import uuid


@dataclass
class Ingredient:
    name: str
    quantity: str
    unit: str
    recipe_id: str
    off_product_id: str = ''
    estimated_cost: float = 0.0
    cost_is_manual: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
