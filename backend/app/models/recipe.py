from dataclasses import dataclass, field
import uuid


@dataclass
class Recipe:
    title: str
    user_id: str
    description: str = ''
    servings: int = 0
    prep_time_min: int = 0
    category: str = ''
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
