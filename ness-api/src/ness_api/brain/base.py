from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ActionCall:
    name: str
    parameters: dict


@dataclass
class BrainResponse:
    text: str
    actions: list[ActionCall] = field(default_factory=list)


class Brain(ABC):
    @abstractmethod
    async def get_response(self, messages: list[dict]) -> BrainResponse: ...
