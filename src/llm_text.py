"""Normalise an LLM reply into plain text.

LangChain chat models may return `content` as a plain string OR as a list of
content parts (Gemini does the latter for some replies). Every call site that
consumes model output goes through `message_text` so a list reply can never
reach code that expects a string.
"""


def message_text(reply) -> str:
    content = getattr(reply, "content", reply)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text") or part.get("content") or "")
        return "".join(parts)
    return str(content)
