from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SourceReference:
    provider_key: str
    source_type: str
    title: str
    url: str | None = None
    trust_level: str = "medium"
    retrieved_at: datetime = field(default_factory=datetime.utcnow)
    update_cadence: str | None = None
    notes: str | None = None


@dataclass
class ProviderResult:
    items: list[dict[str, Any]]
    source: SourceReference


class Provider(ABC):
    @abstractmethod
    def fetch(self, *args, **kwargs) -> ProviderResult:
        raise NotImplementedError
