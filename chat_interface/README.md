# DeepWideResearch Chat Interface

The **DeepWideResearch Chat Interface** is the core frontend component of the DeepWideResearch system. Built with **Next.js 15** and **React 19**, this modern AI chat interface is designed specifically for deep research and complex information retrieval scenarios.

The project integrates **Supabase** for authentication, **Polar.sh** for payments, and supports the **MCP (Model Context Protocol)**, providing a fully featured and extensible frontend for research-oriented AI assistants.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black)
![React](https://img.shields.io/badge/React-19.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6)

## ✨ Core Features

*   **💬 Intelligent Chat System**
    *   Full support for **Streaming Responses**.
    *   Rich **Markdown Rendering** with syntax highlighting and math formula support.
    *   Multi-session history management via `SessionContext`.

*   **🔌 MCP (Model Context Protocol) Integration**
    *   Built-in **MCP Status Bar** (`MCPBar`) and control interface.
    *   Extensible model context capabilities to connect with external tools and data sources.

*   **📚 Deep Research Tools**
    *   **Source Management**: Add and manage custom information sources via `AddSourcePanel`.
    *   **Developer Mode**: Integrated developer panel for API Key management and debugging (`devmode/`).

*   **🔐 Enterprise-Grade Infrastructure**
    *   **Authentication**: Secure login and registration flows powered by **Supabase**.
    *   **Payments & Subscriptions**: Integrated **Polar.sh** for handling subscription plans and checkout flows (`api/polar`).

## 🛠️ Tech Stack

*   **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
*   **Language**: TypeScript
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
*   **Authentication**: [Supabase Auth](https://supabase.com/auth)
*   **Payments**: [Polar.sh](https://polar.sh/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Package Manager**: pnpm (Recommended)

## 🚀 Quick Start

### 1. Prerequisites

Ensure your local environment has the following installed:
*   Node.js 20+
*   pnpm (recommended) or npm/yarn

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

The project root contains an `env.example` file. Copy this file to `.env.local` and fill in the necessary configuration details.

```bash
cp env.example .env.local
```

**Key Configuration Variables:**

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Backend FastAPI Server URL | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | `eyJ...` |
| `NEXT_PUBLIC_POLAR_PRODUCT_ID` | Polar Product ID (for payments) | `...` |

### 4. Start Development Server

```bash
pnpm dev
```

Open your browser and visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📂 Project Structure

```
chat_interface/
├── app/                    # Next.js App Router Main Directory
│   ├── api/                # Backend API Routes (History, Polar, Waitinglist)
│   ├── auth/               # Auth Callback Handling
│   ├── context/            # Global State (Session, Account)
│   ├── devmode/            # Developer Mode Panels
│   ├── headercomponent/    # Top Navigation Bar Components
│   ├── login/              # Login Page
│   ├── layout.tsx          # Global Layout
│   └── page.tsx            # Main Chat Page
├── components/             # Shared UI Components
│   ├── component/          # Message Rendering (BotMessage, UserMessage)
│   └── SessionsSidebar.tsx # Chat Session Sidebar
├── public/                 # Static Assets
└── env.example             # Environment Variables Template
```

## 🔧 Development Guide

### Developer Mode
The application features a built-in Developer Mode panel located in the top navigation bar. This panel allows you to quickly configure:
*   **API Keys**: Manage API keys required for backend services.
*   **Information Sources**: View and debug connected data sources.
*   **Plans**: Debug subscription plan displays.

### Styling
This project uses **Tailwind CSS v4**. Global styles are defined in `app/globals.css`. Tailwind v4 offers improved performance and a simplified configuration experience.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue to help improve the DeepWideResearch Chat Interface.

## 📄 License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](../LICENSE) file for details.

Copyright (c) 2025 PuppyAgent and contributors.
