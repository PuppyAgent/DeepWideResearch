<p align="center">
  <img src="chat_interface/public/title3.svg" alt="Open Deep Wide Research" />
</p>

<h1 align="center">Open Deep Wide Research</h1>

<p align="center">
  <a href="https://www.puppyagent.com" target="_blank">
    <img src="https://img.shields.io/badge/Web-puppyagent.com-39BC66?style=flat&logo=google-chrome&logoColor=white" alt="Homepage" height="22" />
  </a>
  <a href="https://x.com/PuppyAgentTech" target="_blank">
    <img src="https://img.shields.io/badge/X-@PuppyAgentTech-000000?style=flat&logo=x&logoColor=white" alt="X (Twitter)" height="22" />
  </a>
  <a href="https://discord.gg/puppychat" target="_blank">
    <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat&logo=discord&logoColor=white" alt="Discord" height="22" />
  </a>
  <a href="mailto:support@puppyagent.com">
    <img src="https://img.shields.io/badge/Support-support@puppyagent.com-F44336?style=flat&logo=gmail&logoColor=white" alt="Support" height="22" />
  </a>
</p>

<p align="center">
  Build any agentic RAG with depth x width
</p>

<p align="center">
  <img src="chat_interface/public/chatinterface.png" alt="Deep & Wide Research Chat Interface" width="600" />
</p>

## Why Do You Need Open Deep Wide Research?

In 2025, we observed three critical trends reshaping the Retrieval-Augmented Generation (RAG) tech stacks:

1.  Traditional, Rigid, pipeline-driven RAG is giving way to more dynamic agentic RAG systems.

2.  The emergence of MCP is dramatically lowering the complexity of developing enterprise-grade Agentic RAG.

3.  Developers desperately need to customize and balance response time, the breadth of information retrieval, and cost. However, most agent solution ignore this critical requirement.

Based on these trends, the market needs a single, open-source RAG agent that is MCP-compatible and offers granular control over performance, scope, and cost.

We built **Open Deep Wide Research** to be that solution, providing one agent for all RAG scenarios. Its core is the "Deep/Wide" coordinate system, which gives you the control you need:

- **Deep:** Controls response time and reasoning depth.
- **Wide:** Controls information breadth from various sources.
- **Deep × Wide:** Predicts the cost of a single agentic RAG response.

**Example Scenarios:**

| Scenario | Settings | Use Case | Time | Cost |
|:---------|:---------|:---------|:----:|:----:|
| 💬 **Quick Chat** | Deep: `███░░░░░░░░░` 25%<br/>Wide: `███░░░░░░░░░` 25% | Fast Q&A | ~5-10s | $0.01-0.02 |
| 📊 **Deep Analysis** | Deep: `████████████` 100%<br/>Wide: `███░░░░░░░░░` 25% | Technical deep dive | ~1-2min | $0.08-0.12 |
| 🔍 **Wide Survey** | Deep: `███░░░░░░░░░` 25%<br/>Wide: `████████████` 100% | Broad market research | ~30-60s | $0.05-0.10 |
| ⚖️ **Balanced Research** | Deep: `██████░░░░░░` 50%<br/>Wide: `██████░░░░░░` 50% | General research | ~1-2min | $0.06-0.10 |
| 🎯 **Ultra Deep Dive** | Deep: `████████████` 100%<br/>Wide: `████████████` 100% | Maximum depth & breadth | ~5min | $0.15-0.50 |

> If this mission resonates with you, please give us a star ⭐ and fork it! 🤞


## Features

- **Deep × Wide Control** – Tune the depth of reasoning and breadth of information sources to perfectly match any RAG scenario, from quick chats to in-depth analysis.
- **Predictable Cost Management** – No more surprise bills. Cost is a transparent function of your Deep × Wide settings, giving you full control over your budget.
- **MCP Protocol Native Support** – Built on the Model Context Protocol for seamless integration with any compliant data source or tool, creating a truly extensible and future-proof agent.
- **Self-Hosted for Maximum Privacy** – Deploy on your own infrastructure to maintain absolute control over your data and meet the strictest security requirements.
- **Hot‑Swappable Models** – Plug in OpenAI, Claude, or your private LLM instantly.
- **Customizable Search Engines** – Integrate any search provider. Tavily and Exa supported out-of-the-box. As long as it supports MCP.



## How We Compare

<div style="width: 100%; overflow-x: auto; font-size: 12px;">

| Feature | <p align="center"><img src="asserts/DWResearch.png" alt="Open Deep Wide Research" width="40" /><br/>Open<br/>Deep Wide<br/>Research</p> | <p align="center"><img src="chat_interface/public/openai.jpg" alt="OpenAI" width="32" /><br/>OpenAI<br/>Deep Research</p> | <p align="center"><img src="chat_interface/public/genmini.jpg" alt="Gemini" width="32" /><br/>Gemini<br/>Deep Research</p> | <p align="center"><img src="chat_interface/public/manus.png" alt="Manus" width="28" /><br/>Manus  <br/> Wide Research</p> | <p align="center"><img src="chat_interface/public/genspark.jpg" alt="GenSpark" width="40" /><br/>GenSpark<br/>Deep Research</p> | <p align="center"><img src="chat_interface/public/jina.jpg" alt="Jina" width="40" /><br/>Jina<br/>DeepSearch</p> | <p align="center"><img src="chat_interface/public/langchain.png" alt="LangChain" width="40" /><br/>LangChain<br/>Open Deep Research</p> |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Depth × width controls** | D x W | × | × | W | × | D | × |
| **Open source** | ✅ | × | × | × | × | ✅ | ✅ |
| **MCP support** | ✅ | ✅ | × | × | × | ✅ | × |
| **SDK / API** | ✅ | ✅ | ✅ | × | × | ✅ | ✅ |
| **Local knowledge** | ✅ | × | × | × | × | ✅ | ✅ |
| **Model flexibility** | ✅ | × | × | × | × | × | ✅ |
| **Search engine flexibility**| ✅ | × | × | × | × | × | × |
| **Performance** | 5 | 5 | 4 | 3 | 4 | 4 | 3 |

</div>

*Names are trademarks of their owners; descriptions are generalized and may change.*


## Get Started

### Prerequisites
- Python 3.9+ and Node.js 18+
- API keys: Open Router (required), and  Exa / Tavily (at least one)
- Recommended model: open-o4mini

### Deployment Options
- API-only (Backend): If you only need the Deep Research backend as an API to embed in your codebase, deploy the backend only.
- Full stack (Frontend + Backend): If you want the full experience with the web UI, deploy both the backend and the frontend.

### Backend

1. Copy the env template:

```bash
cp deep_wide_research/env.example deep_wide_research/.env
```

2. Edit the copied .env and set your keys:

```bash
# deep_wide_research/.env
OPENROUTER_API_KEY=your_key
# At least one of the following
EXA_API_KEY=your_exa_key
# or
TAVILY_API_KEY=your_tavily_key
```

> You can obtain the Tavily and Exa API keys from their official sites: [Tavily](https://www.tavily.com/) and [Exa](https://exa.ai/).

3. Set up the environment:

```bash
cd deep_wide_research
python -m venv deep-wide-research
source deep-wide-research/bin/activate
pip install -r requirements.txt
```

4. Start the backend server:

```bash
python main.py
```

### Frontend

1. Copy the env template:

```bash
cp chat_interface/env.example chat_interface/.env.local
```

2. Install dependencies and start the dev server:

```bash
cd chat_interface
npm install
npm run dev
```

3. Open the app:

Open **http://localhost:3000** – Start researching in seconds.

### Docker (Production)

```bash
docker-compose up -d
```

---



### Deep Wide Research Archietecture

<p align="center">
  <img src="chat_interface/public/archietecture.png" alt="Deep & Wide Research Architecture" width="960" />
</p>

---

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 PuppyAgent and contributors.
