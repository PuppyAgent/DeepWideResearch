"""Native Deep Research engine orchestrating the full flow without LangChain.

This engine orchestrates two core phases:
1. Research Phase: use unified_research_prompt for search and information gathering
2. Generate Phase: use final_report_generation_prompt to produce the final report
"""

from __future__ import annotations

import json
from typing import Dict, List, Optional

import os
import sys

# Support direct execution and module imports - try absolute and relative imports
try:
    # Try importing as part of the package (development environment)
    from .research_strategy import run_research_llm_driven
    from .generate_strategy import generate_report
except ImportError:
    # Try absolute imports (direct run or deployment environment)
    try:
        from deep_wide_research.research_strategy import run_research_llm_driven
        from deep_wide_research.generate_strategy import generate_report
    except ImportError:
        # Import as standalone modules (Railway deployment environment)
        from research_strategy import run_research_llm_driven
        from generate_strategy import generate_report


def today_str() -> str:
    import datetime as _dt

    now = _dt.datetime.now()
    return f"{now:%a} {now:%b} {now.day}, {now:%Y}"


async def _run_researcher(topic: str, cfg: Configuration, api_keys: Optional[dict], mcp_config: Optional[Dict[str, List[str]]] = None, deep_param: float = 0.5, wide_param: float = 0.5, status_callback=None) -> Dict[str, str]:
    # Delegate to LLM-driven tool-calling strategy
    return await run_research_llm_driven(topic=topic, cfg=cfg, api_keys=api_keys, mcp_config=mcp_config, deep_param=deep_param, wide_param=wide_param, status_callback=status_callback)



# removed supervisor_tools for single-agent design


async def final_report_generation(state: dict, cfg: Configuration, api_keys: Optional[dict] = None) -> None:
    # Delegate to report strategy
    report_content = await generate_report(state=state, cfg=cfg, api_keys=api_keys)
    state["final_report"] = report_content
    state["notes"] = []
    state["messages"].append({"role": "assistant", "content": report_content})


class Configuration:
    def __init__(self):
        # Minimal config fields used in this file
        self.allow_clarification = True
        self.max_concurrent_research_units = 5
        self.max_researcher_iterations = 6
        self.max_react_tool_calls = 10
        self.research_model = os.getenv("RESEARCH_MODEL", "openai:gpt-4.1")
        self.research_model_max_tokens = int(os.getenv("RESEARCH_MODEL_MAX_TOKENS", "10000"))
        self.final_report_model = os.getenv("FINAL_REPORT_MODEL", "openai:gpt-4.1")
        self.final_report_model_max_tokens = int(os.getenv("FINAL_REPORT_MODEL_MAX_TOKENS", "128000"))
        self.mcp_prompt = None

MODEL_GRID = [
    # deep = 0.25
    [
        ("openai/gpt-4.1", "openai/gpt-4.1"),   # wide = 0.25
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.5
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.75
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 1.0
    ],
    # deep = 0.5
    [
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.25
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.5
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.75
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 1.0
    ],
    # deep = 0.75
    [
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.25
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.5
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.75
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 1.0
    ],
    # deep = 1.0
    [
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.25
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.5
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 0.75
        ("openai/gpt-5", "openai/gpt-5"),   # wide = 1.0
    ],
]


def _index_for_param(x: float) -> int:
    """Map a float in [0,1] to index {0,1,2,3} using simple thresholds."""
    try:
        v = float(x)
    except Exception:
        v = 0.5
    if v < 0.25:
        return 0
    if v < 0.5:
        return 0  # <0.5 → 0.25 bucket
    if v < 0.75:
        return 1  # [0.5,0.75) → 0.5 bucket
    if v < 1.0:
        return 2  # [0.75,1.0) → 0.75 bucket
    return 3       # >=1.0 → 1.0 bucket


def _apply_model_mapping_to_cfg(cfg: Configuration, deep_param: float, wide_param: float) -> None:
    di = _index_for_param(deep_param)
    wi = _index_for_param(wide_param)
    research_model, final_model = MODEL_GRID[di][wi]
    cfg.research_model = research_model
    cfg.final_report_model = final_model


async def run_deep_research_stream(user_messages: List[str], cfg: Optional[Configuration] = None, api_keys: Optional[dict] = None, mcp_config: Optional[Dict[str, List[str]]] = None, deep_param: float = 0.5, wide_param: float = 0.5):
    """Streaming version of the deep research flow: Research → Generate
    
    Yields:
        Status update dictionaries containing 'action' and 'message' fields
    """
    cfg = cfg or Configuration()
    # Dynamically select models based on deep & wide from frontend
    _apply_model_mapping_to_cfg(cfg, deep_param, wide_param)
    # Print selected models before any OpenRouter requests
    print(f"[DeepWideResearch] Using OpenRouter research model: {cfg.research_model}")
    print(f"[DeepWideResearch] Using OpenRouter final report model: {cfg.final_report_model}")
    state = {
        "messages": [{"role": "user", "content": m} for m in user_messages],
        "research_brief": None,
        "notes": [],
        "final_report": "",
    }

    # Extract research topic
    last_user = next((m for m in reversed(state["messages"]) if m["role"] == "user"), {"content": ""})
    research_topic = last_user.get("content", "")

    # ============================================================
    # Phase 1: Research - use unified_research_prompt
    # ============================================================
    yield {"action": "thinking", "message": "thinking"}
    
    # Let the user briefly see the thinking state
    import asyncio
    await asyncio.sleep(1.5)
    
    # Create a queue to receive status updates
    from asyncio import Queue
    status_queue = Queue()
    
    # Create the status callback
    async def status_callback(message: str):
        await status_queue.put(message)
    
    # Start the research task
    # Ensure model is logged before the first OpenRouter call made inside research strategy
    print(f"[DeepWideResearch] (pre-call) Research will use: {cfg.research_model}")
    research_task = asyncio.create_task(_run_researcher(research_topic, cfg, api_keys, mcp_config, deep_param, wide_param, status_callback))
    
    # Read and yield status updates from the queue
    while not research_task.done():
        try:
            # Try to get a status update (short timeout)
            message = await asyncio.wait_for(status_queue.get(), timeout=0.1)
            yield {"action": "using_tools", "message": message}
        except asyncio.TimeoutError:
            # No message; continue waiting
            continue
    
    # After research completes, process remaining messages in the queue
    while not status_queue.empty():
        try:
            message = status_queue.get_nowait()
            yield {"action": "using_tools", "message": message}
        except asyncio.QueueEmpty:
            break
    
    # Retrieve research results
    research = await research_task
    raw_notes = research.get("raw_notes", "") if research else ""
    state["notes"] = [raw_notes] if raw_notes else []
    
    if raw_notes:
        try:
            json.loads(raw_notes)
        except Exception:
            pass
        state["messages"].append({
            "role": "user",
            "content": f"<RAW_NOTES_JSON>\n{raw_notes}\n</RAW_NOTES_JSON>"
        })

    # ============================================================
    # Phase 2: Generate - use final_report_generation_prompt with streaming
    # ============================================================
    yield {"action": "generating", "message": "research finished, generating"}
    
    # Import the streaming report generation function
    try:
        from .generate_strategy import generate_report_stream
    except ImportError:
        try:
            from deep_wide_research.generate_strategy import generate_report_stream
        except ImportError:
            from generate_strategy import generate_report_stream
    
    # Stream the report generation
    # Ensure model is logged before the first OpenRouter call made inside generation strategy
    print(f"[DeepWideResearch] (pre-call) Final report will use: {cfg.final_report_model}")
    final_report_content = ""
    async for chunk in generate_report_stream(state, cfg, api_keys):
        final_report_content += chunk
        # Yield each chunk as it arrives
        yield {"action": "report_chunk", "chunk": chunk, "accumulated_report": final_report_content}
    
    # Update state with the final report
    state["final_report"] = final_report_content
    state["notes"] = []
    state["messages"].append({"role": "assistant", "content": final_report_content})
    
    # Close all MCP clients
    try:
        from deep_wide_research.mcp_client import get_registry
    except Exception:
        try:
            from .mcp_client import get_registry
        except Exception:
            get_registry = None
    
    if get_registry is not None:
        try:
            registry = get_registry()
            if hasattr(registry, "close_all_clients"):
                await registry.close_all_clients()
        except Exception:
            pass
    
    # Send the completion signal
    yield {"action": "complete", "message": final_report_content, "final_report": final_report_content}


async def run_deep_research(user_messages: List[str], cfg: Optional[Configuration] = None, api_keys: Optional[dict] = None, mcp_config: Optional[Dict[str, List[str]]] = None, deep_param: float = 0.5, wide_param: float = 0.5) -> dict:
    """Full deep research flow: Research → Generate
    
    Args:
        user_messages: list of user messages
        cfg: configuration object
        api_keys: API keys
        
    Returns:
        State dict containing research results and the final report
    """
    cfg = cfg or Configuration()
    # Dynamically select models based on deep & wide from frontend
    _apply_model_mapping_to_cfg(cfg, deep_param, wide_param)
    # Print selected models before any OpenRouter requests
    print(f"[DeepWideResearch] Using OpenRouter research model: {cfg.research_model}")
    print(f"[DeepWideResearch] Using OpenRouter final report model: {cfg.final_report_model}")
    state = {
        "messages": [{"role": "user", "content": m} for m in user_messages],
        "research_brief": None,
        "notes": [],
        "final_report": "",
    }

    # Extract research topic
    last_user = next((m for m in reversed(state["messages"]) if m["role"] == "user"), {"content": ""})
    research_topic = last_user.get("content", "")

    # ============================================================
    # Phase 1: Research - use unified_research_prompt
    # ============================================================
    # Ensure model is logged before the first OpenRouter call made inside research strategy
    print(f"[DeepWideResearch] (pre-call) Research will use: {cfg.research_model}")
    research = await _run_researcher(research_topic, cfg, api_keys, mcp_config, deep_param, wide_param)
    raw_notes = research.get("raw_notes", "") if research else ""
    state["notes"] = [raw_notes] if raw_notes else []
    # Also inject raw_notes JSON into messages for the generation phase as context
    if raw_notes:
        try:
            # Validate whether it is JSON; if not, still include it
            json.loads(raw_notes)
        except Exception:
            pass
        state["messages"].append({
            "role": "user",
            "content": f"<RAW_NOTES_JSON>\n{raw_notes}\n</RAW_NOTES_JSON>"
        })
    # ============================================================
    # Phase 2: Generate - use final_report_generation_prompt
    # ============================================================
    # Ensure model is logged before the first OpenRouter call made inside generation strategy
    print(f"[DeepWideResearch] (pre-call) Final report will use: {cfg.final_report_model}")
    await final_report_generation(state, cfg, api_keys)
    
    # Close all MCP clients to avoid cancel-scope errors caused by different tasks closing clients
    try:
        from deep_wide_research.mcp_client import get_registry
    except Exception:
        try:
            from .mcp_client import get_registry
        except Exception:
            get_registry = None
    
    if get_registry is not None:
        try:
            registry = get_registry()
            if hasattr(registry, "close_all_clients"):
                await registry.close_all_clients()
        except Exception:
            pass
    
    return state


if __name__ == "__main__":
    """Click Run in VSCode to test the full Deep Research flow"""
    import asyncio
    
    class TestConfig(Configuration):
        def __init__(self):
            super().__init__()
            # Custom test configuration
            self.research_model = "openai/o4-mini"
            self.research_model_max_tokens = 16000
            self.final_report_model = "openai/o4-mini"
            self.final_report_model_max_tokens = 128000
            self.max_react_tool_calls = 5
    
    async def test():
        print("="*80)
        print("🚀 Testing Deep Research Engine")
        print("="*80)
        
        # Test case
        test_question = "DataBricks, Snowflake what services they provide and what are the differences?"
        
        # Run the full flow
        result = await run_deep_research(
            user_messages=[test_question],
            cfg=TestConfig()
        )
        
        print("\n" + "="*80)
        print("📊 Research Results:")
        print("="*80)
        print(f"Notes collected: {len(result['notes'])}")
        if result['notes']:
            print("\nResearch Notes:")
            print("-"*80)
            print(result['notes'][0][:500] + "..." if len(result['notes'][0]) > 500 else result['notes'][0])
        
        print("\n" + "="*80)
        print("📄 Final Report:")
        print("="*80)
        print(result['final_report'])
        
        print("\n" + "="*80)
        print("Test Complete!")
        print("="*80)
    
    asyncio.run(test())


