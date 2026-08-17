from langchain_core.messages import AIMessage

from src.llm_text import message_text


def test_plain_string_content():
    assert message_text(AIMessage(content="hello")) == "hello"


def test_list_of_parts_is_joined():
    """Gemini can return content as a list of parts instead of a string."""
    reply = AIMessage(content=[{"type": "text", "text": "# CV\n"},
                               {"type": "text", "text": "body"}])
    assert message_text(reply) == "# CV\nbody"


def test_list_of_plain_strings():
    assert message_text(AIMessage(content=["a", "b"])) == "ab"


def test_raw_string_without_content_attribute():
    assert message_text("already text") == "already text"
