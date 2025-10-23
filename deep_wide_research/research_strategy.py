"""Research stage strategy for Deep Research.

This module encapsulates the research step, fetching information from
external search providers and returning raw notes.

Uses prompt-based tool invocation without OpenAI function call API.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

# Support both direct execution and module import - try absolute and relative imports
try:
    # Try importing as part of a package (development environment)
    from .providers import chat_complete
    from .mcp_client import get_registry
    from .newprompt import create_unified_research_prompt
except ImportError:
    # Try absolute import (direct execution or deployment environment)
    try:
        from deep_wide_research.providers import chat_complete
        from deep_wide_research.mcp_client import get_registry
        from deep_wide_research.newprompt import create_unified_research_prompt
    except ImportError:
        # Import as standalone module (Railway deployment environment)
        from providers import chat_complete
        from mcp_client import get_registry
        from newprompt import create_unified_research_prompt


# MCP tool selection configuration: {server_name: [tool_names]}
# Note: HTTP MCP uses underscores in tool names (tavily_search, not tavily-search)
MCP_TOOLS_CONFIG = {
    "tavily": ["tavily_search"],  # Fixed: use underscore (HTTP MCP naming)
    "exa": ["web_search_exa"]
}

def build_mcp_tools_description(tools: List[Dict[str, Any]]) -> str:
    """Build MCP tool description for insertion into unified_research_prompt
    
    Args:
        tools: List of MCP tools
    
    Returns:
        Tool description text
    """
    if not tools:
        return "\n**Note**: No additional search tools are currently available."
    
    tools_description = []
    
    for idx, tool in enumerate(tools, 1):
        tool_name = tool.get("name", "unknown")
        tool_desc = tool.get("description", "No description")
        input_schema = tool.get("inputSchema", {})
        
        tool_text = f"{idx + 1}. **{tool_name}**: {tool_desc}"
        
        properties = input_schema.get("properties", {})
        required = input_schema.get("required", [])
        
        if properties:
            tool_text += "\n   Arguments:"
            for param_name, param_info in properties.items():
                param_type = param_info.get("type", "any")
                param_desc = param_info.get("description", "")
                is_required = "required" if param_name in required else "optional"
                tool_text += f"\n   - {param_name} ({is_required}, {param_type}): {param_desc}"
        
        tools_description.append(tool_text)
    
    tools_list = "\n\n".join(tools_description)
    
    # Tool call format description
    example_tool = tools[0]
    example_name = example_tool.get("name", "tool_name")
    example_args = {}
    example_props = example_tool.get("inputSchema", {}).get("properties", {})
    
    for param_name, param_info in list(example_props.items())[:2]:
        param_type = param_info.get("type", "string")
        example_args[param_name] = "example value" if param_type == "string" else (5 if param_type == "integer" else "value")
    
    example_json = json.dumps({"tool": example_name, "arguments": example_args}, indent=2)
    
    return f"""
{tools_list}

**Tool Call Format:**
<tool_call>
{example_json}
</tool_call>

You can call multiple tools in parallel by including multiple <tool_call> blocks."""


def parse_tool_calls(content: str) -> List[Dict[str, Any]]:
    """Parse tool calls from LLM response
    
    Example input:
    <tool_call>
    {
      "tool": "tavily_search",
      "arguments": {"query": "Python programming", "max_results": 5}
    }
    </tool_call>
    
    Returns: [{"tool": "tavily_search", "arguments": {...}, "id": "call_1"}]
    """
    tool_calls = []
    
    # Use regex to extract all <tool_call>...</tool_call> blocks
    pattern = r'<tool_call>(.*?)</tool_call>'
    matches = re.findall(pattern, content, re.DOTALL)
    
    for idx, match in enumerate(matches):
        try:
            # Try parsing JSON
            tool_data = json.loads(match.strip())
            tool_calls.append({
                "id": f"call_{idx + 1}",
                "tool": tool_data.get("tool", ""),
                "arguments": tool_data.get("arguments", {})
            })
        except json.JSONDecodeError as e:
            print(f"⚠️ Failed to parse tool call JSON: {e}")
            continue
    
    return tool_calls


async def _execute_single_tool(
    tc: Dict[str, Any],
    mcp_clients: List
) -> Dict[str, Any]:
    """Execute a single tool call"""
    result = None
    for client in mcp_clients:
        try:
            result = await client.call_tool(tc["tool"], tc["arguments"])
            result = json.dumps(result)
            break  # Stop if successful
        except:
            continue  # Try next client on failure
    
    if result is None:
        result = json.dumps({"error": f"Tool '{tc['tool']}' not found in any MCP server"})
    
    # Output tool result
    print(f"\n✓ Tool '{tc['tool']}' result ({len(result)} chars)")
    print(f"{'='*60}")
    
    return {
        "tool_call_id": tc["id"],
        "tool": tc["tool"],
        "result": result
    }


async def execute_tool_calls(
    tool_calls: List[Dict[str, Any]],
    mcp_clients: List
) -> List[Dict[str, Any]]:
    """Execute all tool calls in parallel and return results list"""
    if not tool_calls:
        return []
    
    # Execute all tool calls in parallel
    tool_results = await asyncio.gather(
        *[_execute_single_tool(tc, mcp_clients) for tc in tool_calls]
    )

    print(tool_results)
    
    return list(tool_results)


async def run_research_llm_driven(
    topic: str, 
    cfg, 
    api_keys: Optional[dict] = None,
    mcp_config: Optional[Dict[str, List[str]]] = None,
    deep_param: float = 0.5,
    wide_param: float = 0.5,
    status_callback=None
) -> Dict[str, str]:
    """LLM-driven research loop using unified_research_prompt
    
    Args:
        topic: Research topic
        cfg: Configuration object
        api_keys: API key dictionary
        status_callback: Status callback function for sending real-time updates to frontend
    """
    if not topic:
        empty_json = json.dumps({"topic": "", "tool_calls": []}, ensure_ascii=False)
        return {"raw_notes": empty_json}
    
    # 1. Collect MCP tools - use configuration from frontend or default
    print("\n🔍 Collecting tools from MCP servers...")
    registry = get_registry()
    
    # Use MCP configuration from frontend, or use default if not provided
    effective_config = mcp_config or MCP_TOOLS_CONFIG
    print(f"📋 Using MCP config: {effective_config}")
    
    mcp_tools, mcp_clients = await registry.collect_tools(effective_config)
    
    if not mcp_tools:
        print("⚠️ No tools available")
        error_json = json.dumps({
            "topic": topic,
            "tool_calls": [],
            "error": "No tools available"
        }, ensure_ascii=False)
        return {
            "raw_notes": error_json
        }
    
    print(f"✅ Collected {len(mcp_tools)} tool(s):")
    for tool in mcp_tools:
        print(f"  - {tool.get('name', 'unknown')}")
    
    # 2. Build system prompt - dynamically generate using create_unified_research_prompt
    mcp_prompt = build_mcp_tools_description(mcp_tools)
    max_iterations = getattr(cfg, 'max_react_tool_calls', 8)
    
    system_prompt = create_unified_research_prompt(
        date=datetime.now().strftime("%Y-%m-%d"),
        mcp_prompt=mcp_prompt,
        max_researcher_iterations=max_iterations,
        deep_param=deep_param,
        wide_param=wide_param
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": topic}
    ]
    
    print(messages)
    
    max_steps = getattr(cfg, 'max_react_tool_calls', 8)
    conversation_history = []  # Save complete conversation history for final return
    tool_interactions: List[Dict[str, Any]] = []  # Accumulate all tool calls and results (for JSON raw_notes)

    # Tool calling loop
    for step in range(max_steps):
        # Call LLM (pure conversation mode)
        resp = await chat_complete(
            model=cfg.research_model,
            messages=messages,
            max_tokens=cfg.research_model_max_tokens,
            api_keys=api_keys,
        )
        
        # Parse tool calls from response
        tool_calls = parse_tool_calls(resp.content)
        
        # Output raw LLM response
        print(f"\n{'='*60}")
        print(f"[Step {step+1}] LLM Output:")
        print(f"{'='*60}")
        print(f"Content:\n{resp.content}")
        if tool_calls:
            print(f"\n🔧 Parsed {len(tool_calls)} tool call(s):")
            for tc in tool_calls:
                print(f"  - {tc['tool']}: {tc['arguments']}")
        print(f"{'='*60}")
        
        # Save assistant response to history
        conversation_history.append({"role": "assistant", "content": resp.content})
        
        if not tool_calls:
            # No tool calls, LLM has provided final answer
            raw_json = json.dumps({
                "topic": topic,
                "tool_calls": tool_interactions,
            }, ensure_ascii=False)
            return {
                "raw_notes": raw_json
            }
        
        # Check if ResearchComplete was called
        if any(tc["tool"] == "ResearchComplete" for tc in tool_calls):
            print("\n✅ Research completed by agent")
            return {
                "raw_notes": "\n\n".join([m["content"] for m in conversation_history if m.get("content")])
            }
        
        # Add assistant message to conversation
        messages.append({"role": "assistant", "content": resp.content})
        
        # Send status update - notify frontend which tools are being used
        if status_callback and tool_calls:
            tools_being_used = [tc["tool"] for tc in tool_calls]
            unique_tools = list(set(tools_being_used))  # Deduplicate
            tools_text = ", ".join(unique_tools[:3])  # Show max 3 tools
            await status_callback(f"using {tools_text}")
        
        # Execute all tool calls
        tool_results = await execute_tool_calls(tool_calls, mcp_clients)

        # Record this round's tool calls and results (structured as JSON items)
        call_info_map = {tc["id"]: {"tool": tc["tool"], "arguments": tc.get("arguments", {})} for tc in tool_calls}
        for tr in tool_results:
            call_id = tr.get("tool_call_id")
            info = call_info_map.get(call_id, {})
            result_text = tr.get("result", "")
            # Prioritize parsing as JSON
            parsed_result: Any
            try:
                parsed_result = json.loads(result_text)
            except Exception:
                parsed_result = result_text
            tool_interactions.append({
                "step": step + 1,
                "id": call_id,
                "tool": tr.get("tool") or info.get("tool"),
                "arguments": info.get("arguments", {}),
                "result": parsed_result,
            })
        
        # Add tool results back to conversation
        # Format as readable text for LLM understanding
        results_text = "\n\n".join([
            f"<tool_result tool_call_id=\"{tr['tool_call_id']}\" tool=\"{tr['tool']}\">\n{tr['result']}\n</tool_result>"
            for tr in tool_results
        ])
        
        messages.append({"role": "user", "content": f"Tool results:\n{results_text}"})
        conversation_history.append({"role": "tool_results", "content": results_text})
    
    # Reached max steps, return collected tool interactions as JSON
    raw_json = json.dumps({
        "topic": topic,
        "tool_calls": tool_interactions,
    }, ensure_ascii=False)
    return {"raw_notes": raw_json}


if __name__ == "__main__":
    """Can test directly by clicking Run button in VSCode"""
    import asyncio
    
    class TestConfig:
        research_model = "openai/o4-mini"
        research_model_max_tokens = 128000
        max_react_tool_calls = 3
    
    async def test():
        result = await run_research_llm_driven("History of Volkswagen over the past 50 years and its early development path?", TestConfig())
    
    asyncio.run(test())
