from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field


@dataclass
class ActionCall:
    name: str
    parameters: dict


@dataclass
class BrainResponse:
    text: str
    actions: list[ActionCall] = field(default_factory=list)


@dataclass
class TextDelta:
    text: str


@dataclass
class ToolCallEvent:
    action: ActionCall


BrainStreamEvent = TextDelta | ToolCallEvent


class Brain(ABC):
    @abstractmethod
    async def get_response(self, messages: list[dict]) -> BrainResponse: ...

    @abstractmethod
    def stream_response(
        self, messages: list[dict]
    ) -> AsyncIterator[BrainStreamEvent]: ...
