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
        self.final_report_model_max_tokens = int(os.getenv("FINAL_REPORT_MODEL_MAX_TOKENS", "10000"))
        self.mcp_prompt = None


async def run_deep_research_stream(user_messages: List[str], cfg: Optional[Configuration] = None, api_keys: Optional[dict] = None, mcp_config: Optional[Dict[str, List[str]]] = None, deep_param: float = 0.5, wide_param: float = 0.5):
    """Streaming version of the deep research flow: Research → Generate
    
    Yields:
        Status update dictionaries containing 'action' and 'message' fields
    """
    cfg = cfg or Configuration()
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
    yield {"action": "thinking", "message": "thinking..."}
    
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
    # Phase 2: Generate - use final_report_generation_prompt
    # ============================================================
    yield {"action": "generating", "message": "research finished, generating..."}
    
    await final_report_generation(state, cfg, api_keys)
    
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
    
    # Send the final result
    yield {"action": "complete", "message": state["final_report"], "final_report": state["final_report"]}


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
            self.final_report_model_max_tokens = 16000
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


