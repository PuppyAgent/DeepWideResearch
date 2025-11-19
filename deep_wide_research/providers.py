"""Simplified OpenRouter client - retains necessary tool invocation functionality"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

try:
    from openai import AsyncOpenAI
except ImportError as e:
    raise RuntimeError("OpenAI SDK installation required: pip install openai>=1.0.0") from e

# Try to load .env file
_ENV_DEBUG = False  # Set to True to see debug information

try:
    from dotenv import load_dotenv
    from pathlib import Path
    
    # Explicitly specify .env file path (in the current file directory)
    env_path = Path(__file__).parent / ".env"
    loaded = load_dotenv(dotenv_path=env_path)
    
    if _ENV_DEBUG:
        print(f"[DEBUG] .env file path: {env_path}")
        print(f"[DEBUG] .env file exists: {env_path.exists()}")
        print(f"[DEBUG] load_dotenv returned: {loaded}")
        print(f"[DEBUG] OPENROUTER_API_KEY: {os.getenv('OPENROUTER_API_KEY', 'None')[:20]}...")
except ImportError:
    if _ENV_DEBUG:
        print("[DEBUG] python-dotenv not installed")
    pass  # If python-dotenv is not installed, continue using system environment variables




class ChatResponse:
    """Simple response wrapper"""
    def __init__(self, content: str, raw: Any = None):
        self.content = content
        self.raw = raw


def _get_api_key(api_keys: Optional[dict] = None) -> str:
    """Get API key, prioritizing OPENROUTER_API_KEY"""
    api_key = (api_keys or {}).get("OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing API key. Please set environment variable OPENROUTER_API_KEY")
    return api_key


def _fix_model_id(model: str) -> str:
    """Fix model name format: 'openai:gpt-4' -> 'openai/gpt-4'"""
    return model if "/" in model else model.replace(":", "/", 1)


async def chat_complete(
    model: str, 
    messages: List[Dict[str, Any]], 
    max_tokens: int, 
    api_keys: Optional[dict] = None,
) -> ChatResponse:
    """Chat completion - pure conversation mode, without using OpenAI function call"""
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=_get_api_key(api_keys)
    )
    
    resp = await client.chat.completions.create(
        model=_fix_model_id(model),
        messages=messages,
        max_tokens=max_tokens,
    )
    
    # Be defensive: choices/message may be missing in rare cases
    content_text = ""
    try:
        choices = getattr(resp, "choices", None)
        if isinstance(choices, list) and len(choices) > 0:
            message = getattr(choices[0], "message", None)
            if message is not None:
                content_text = getattr(message, "content", "") or ""
    except Exception:
        content_text = ""
    
    return ChatResponse(content=content_text, raw=resp)


async def chat_complete_stream(
    model: str, 
    messages: List[Dict[str, Any]], 
    max_tokens: int, 
    api_keys: Optional[dict] = None,
):
    """Chat completion with streaming - yields content chunks as they arrive"""
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=_get_api_key(api_keys)
    )
    
    stream = await client.chat.completions.create(
        model=_fix_model_id(model),
        messages=messages,
        max_tokens=max_tokens,
        stream=True,
    )
    
    async for chunk in stream:
        # Guard against empty/irregular frames (e.g., heartbeats, role-only deltas)
        try:
            choices = getattr(chunk, "choices", None)
            if not (isinstance(choices, list) and len(choices) > 0):
                continue
            delta = getattr(choices[0], "delta", None)
            if delta is None:
                continue
            piece = getattr(delta, "content", None)
            if piece:
                yield piece
        except Exception:
            # Skip malformed frames without failing the whole stream
            continue


if __name__ == "__main__":
    import asyncio
    
    async def test():
        resp = await chat_complete(
            model="openai/gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say hello in Chinese"}],
            max_tokens=50
        )
        print(f"Response: {resp.content}")
    
    asyncio.run(test())
