"""FastAPI server for Deep Research Engine.

Provides HTTP API endpoints to invoke the deep research engine.
"""

import sys
from pathlib import Path

# Add project root to Python path for proper module imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Also add current directory to path (for Railway deployment)
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json

# Try two import methods: development and deployment environments
try:
    from deep_wide_research.engine import run_deep_research, run_deep_research_stream, Configuration
except ImportError:
    from engine import run_deep_research, run_deep_research_stream, Configuration

app = FastAPI(title="PuppyResearch API", version="1.0.0")

# Configure CORS to allow frontend access
import os

# Detect if running in a production environment
is_production = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("VERCEL"))

if is_production:
    # Production: must configure via environment variables
    allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
    if allowed_origins_env:
        allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
        allow_all_origins = False
    else:
        raise ValueError(
            "⚠️  Production environment detected but ALLOWED_ORIGINS is not set!\n"
            "Please set the ALLOWED_ORIGINS environment variable with your frontend URL(s).\n"
            "Example: ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://www.your-domain.com"
        )
else:
    # Local development: always allow all origins (for convenience)
    allowed_origins = ["*"]
    allow_all_origins = True
    print("💡 Tip: Running in development mode with CORS set to allow all origins (*)")

# Print CORS configuration (for debugging)
print("="*80)
print("🔧 CORS Configuration:")
print(f"   Environment: {'🌐 Production' if is_production else '💻 Development (Local)'}")
print(f"   Allowed Origins: {allowed_origins}")
print(f"   Allow All Origins: {'✅ Yes (*)' if allow_all_origins else '❌ No (Restricted)'}")
print(f"   Allow Credentials: {'✅ Yes' if not allow_all_origins else '❌ No (incompatible with *)'}")
print("="*80)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not allow_all_origins,  # Credentials cannot be enabled when using '*'
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add explicit OPTIONS handler for all routes (fix CORS preflight issues)
from fastapi import Request

@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    """Handle OPTIONS preflight requests for CORS"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allowed_origins[0] if allowed_origins else "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )


class Message(BaseModel):
    """Message model - Standard OpenAI format"""
    role: str  # "user", "assistant", or "system"
    content: str


class DeepWideParams(BaseModel):
    """Depth and breadth parameter model"""
    deep: float = 0.5  # Depth parameter (0-1), controls research depth
    wide: float = 0.5  # Breadth parameter (0-1), controls research breadth


class ResearchMessage(BaseModel):
    """Research message model - includes query and parameters"""
    query: str  # User's query text
    deepwide: DeepWideParams = DeepWideParams()  # Depth/breadth parameter object
    mcp: Dict[str, List[str]] = {}  # MCP config: {service_name: [tool list]}


class ResearchRequest(BaseModel):
    """Research request model"""
    message: ResearchMessage  # Now an object instead of a string
    history: Optional[List[Message]] = None


class ResearchResponse(BaseModel):
    """Research response model"""
    response: str
    notes: List[str] = []
    success: bool = True


@app.get("/")
async def root():
    """API root path"""
    return {
        "name": "PuppyResearch API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/api/mcp/status")
async def mcp_status():
    """Check MCP environment variables status (for debugging)"""
    import os
    return {
        "tavily_api_key_set": bool(os.getenv("TAVILY_API_KEY")),
        "exa_api_key_set": bool(os.getenv("EXA_API_KEY")),
        "openai_api_key_set": bool(os.getenv("OPENAI_API_KEY"))
    }


async def research_stream_generator(request: ResearchRequest):
    """Generate research streaming response"""
    try:
        # Build message history
        history_messages = request.history or []
        user_messages = [msg.content for msg in history_messages if msg.role == "user"]
        user_messages.append(request.message.query)
        
        # Create configuration
        cfg = Configuration()
        
        print(f"\n🔍 Received research request: {request.message.query}")
        print(f"📊 Deep: {request.message.deepwide.deep}, Wide: {request.message.deepwide.wide}")
        
        # Execute research and stream updates
        async for update in run_deep_research_stream(
            user_messages=user_messages,
            cfg=cfg,
            api_keys=None,
            mcp_config=request.message.mcp,
            deep_param=request.message.deepwide.deep,
            wide_param=request.message.deepwide.wide
        ):
            yield f"data: {json.dumps(update)}\n\n"
            
    except Exception as e:
        error_msg = {'action': 'error', 'message': f'Research failed: {str(e)}'}
        yield f"data: {json.dumps(error_msg)}\n\n"


@app.post("/api/research")
async def research(request: ResearchRequest):
    """Execute deep research - streaming response"""
    return StreamingResponse(
        research_stream_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class MCPTestRequest(BaseModel):
    """MCP test request model"""
    services: List[str]  # List of service names to test, e.g., ["tavily", "exa"]


class MCPToolInfo(BaseModel):
    """MCP tool information"""
    name: str
    description: str = ""


class MCPServiceStatus(BaseModel):
    """MCP service status"""
    name: str
    available: bool
    tools: List[MCPToolInfo] = []
    error: Optional[str] = None


class MCPTestResponse(BaseModel):
    """MCP test response model"""
    services: List[MCPServiceStatus]


@app.post("/api/mcp/test", response_model=MCPTestResponse)
async def test_mcp_services(request: MCPTestRequest):
    """Test MCP service connectivity
    
    Check whether MCP services are available by verifying:
    1. API key is set
    2. npx can be executed (Node.js is installed)
    3. MCP server can be started (optional: actual connection test)
    """
    import os
    
    # Configuration mapping for MCP services
    # Note: HTTP MCP uses underscores in tool names
    mcp_config = {
        "tavily": {
            "api_key_env": "TAVILY_API_KEY",
            "default_tools": [
                {"name": "tavily_search", "description": "Search the web using Tavily"},
                {"name": "tavily_extract", "description": "Extract content from URLs"}
            ]
        },
        "exa": {
            "api_key_env": "EXA_API_KEY",
            "default_tools": [
                {"name": "web_search_exa", "description": "AI-powered web search using Exa"}
            ]
        }
    }
    
    results = []
    for service_name in request.services:
        service_name_lower = service_name.lower()
        
        # Check whether the service exists in the configuration
        if service_name_lower not in mcp_config:
            results.append(MCPServiceStatus(
                name=service_name,
                available=False,
                error=f"Unknown service '{service_name}'. Supported: Tavily, Exa"
            ))
            continue
        
        config = mcp_config[service_name_lower]
        api_key = os.getenv(config["api_key_env"])
        
        if not api_key:
            # API key not set
            results.append(MCPServiceStatus(
                name=service_name,
                available=False,
                error=f"API key not set. Please set {config['api_key_env']} environment variable."
            ))
            continue
        
        # API key is set, return default tool list
        tool_infos = [
            MCPToolInfo(name=tool["name"], description=tool["description"])
            for tool in config["default_tools"]
        ]
        
        results.append(MCPServiceStatus(
            name=service_name,
            available=True,
            tools=tool_infos
        ))
    
    return MCPTestResponse(services=results)


if __name__ == "__main__":
    import uvicorn
    
    print("="*80)
    print("🚀 Starting PuppyResearch API Server")
    print("="*80)
    print("📡 Server will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    print("="*80)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

