import asyncio
from types import SimpleNamespace

from ness_api.brain.anthropic_brain import AnthropicBrain
from ness_api.brain.base import ActionCall, TextDelta, ToolCallEvent
from ness_api.brain.openai_brain import OpenAIBrain


class FakeAsyncStream:
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    def __aiter__(self):
        async def iterate():
            for chunk in self.chunks:
                yield chunk

        return iterate()


def test_openai_stream_emits_text_deltas_and_complete_tool_calls(monkeypatch):
    class FakeCompletions:
        async def create(self, **kwargs):
            assert kwargs["stream"] is True
            return FakeAsyncStream(
                [
                    SimpleNamespace(
                        choices=[
                            SimpleNamespace(
                                delta=SimpleNamespace(content="Olá", tool_calls=[])
                            )
                        ]
                    ),
                    SimpleNamespace(
                        choices=[
                            SimpleNamespace(
                                delta=SimpleNamespace(
                                    content=None,
                                    tool_calls=[
                                        SimpleNamespace(
                                            index=0,
                                            function=SimpleNamespace(
                                                name="calendar.",
                                                arguments='{"day":',
                                            ),
                                        )
                                    ],
                                )
                            )
                        ]
                    ),
                    SimpleNamespace(
                        choices=[
                            SimpleNamespace(
                                delta=SimpleNamespace(
                                    content=None,
                                    tool_calls=[
                                        SimpleNamespace(
                                            index=0,
                                            function=SimpleNamespace(
                                                name="read",
                                                arguments='"today"}',
                                            ),
                                        )
                                    ],
                                )
                            )
                        ]
                    ),
                ]
            )

    brain = OpenAIBrain("test-key")
    monkeypatch.setattr(
        brain,
        "client",
        SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions())),
    )

    async def collect():
        return [
            event
            async for event in brain.stream_response(
                [{"role": "user", "content": "Leia minha agenda"}]
            )
        ]

    assert asyncio.run(collect()) == [
        TextDelta("Olá"),
        ToolCallEvent(ActionCall("calendar.read", {"day": "today"})),
    ]


def test_anthropic_stream_emits_text_deltas_and_tool_calls(monkeypatch):
    class FakeMessageStream(FakeAsyncStream):
        async def get_final_message(self):
            return SimpleNamespace(
                content=[
                    SimpleNamespace(type="text", text="Oi"),
                    SimpleNamespace(
                        type="tool_use",
                        name="calendar.read",
                        input={"day": "today"},
                    ),
                ]
            )

    class FakeMessages:
        def stream(self, **kwargs):
            assert kwargs["model"] == "claude-sonnet-5"
            return FakeMessageStream(
                [
                    SimpleNamespace(
                        type="content_block_delta",
                        delta=SimpleNamespace(type="text_delta", text="Oi"),
                    )
                ]
            )

    brain = AnthropicBrain("test-key")
    monkeypatch.setattr(brain, "client", SimpleNamespace(messages=FakeMessages()))

    async def collect():
        return [
            event
            async for event in brain.stream_response(
                [{"role": "user", "content": "Oi"}]
            )
        ]

    assert asyncio.run(collect()) == [
        TextDelta("Oi"),
        ToolCallEvent(ActionCall("calendar.read", {"day": "today"})),
    ]
