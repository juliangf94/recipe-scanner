from dataclasses import dataclass, field
import uuid


@dataclass
class User:
    first_name: str
    last_name: str
    email: str
    password_hash: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
