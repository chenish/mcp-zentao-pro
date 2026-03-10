---
name: zentao
description: ZenTao MCP Server & CLI Tool. Provides ChatOps capabilities (God-Mode Dashboard, Task Creation, Effort Logging) directly into OpenClaw for efficient agile management.
metadata: {"openclaw":{"emoji":"🚀","install":[{"id":"node","kind":"node","package":"@chenish/zentao-mcp-agent","bins":["zentao-mcp", "zentao-cli"],"label":"Install zentao-mcp-agent (node)"}]}}
---

# zentao-mcp-agent (ZenTao MCP & CLI)

## When to use this skill

Use this skill when the user asks to manage ZenTao (禅道) via OpenClaw / LLM Chat:

- Fetch my/everyone's dashboard across projects (God-Mode)
- Create new tasks with Natural Language parameters inference
- Log effort (addEstimate) for tasks seamlessly
- Query product and bug lists
- Get detailed view of specific tasks, bugs or stories

## Installation

This package operates as a powerful MCP Server. To install it into OpenClaw:

```bash
npx skills add @chenish/zentao-mcp-agent
```

Alternatively, to use it as a global CLI tool:

```bash
npm install -g @chenish/zentao-mcp-agent
```

## Login workflow

Before the MCP Server or CLI can communicate with ZenTao, you must authenticate once using the CLI:

```bash
zentao-cli login \
  --url="https://<your-zentao-domain>/zentao" \
  --account="<your-account>" \
  --pwd="<your-password>"
```

*This will store your ZENTAO_URL and Access Token in `~/.config/zentao/.env`.*

## Core MCP Tools usage

Once installed in OpenClaw, the AI can invoke the following tools:

- `getDashboard`: Fetch a summarized list of tasks, bugs, or stories (Bypasses project isolation using MVC engine).
- `createTask`: Automatically infer requirements and dispatch new tasks (Auto-fills estStarted, estimate, deadline).
- `addEstimate`: Directly log consumed hours for a specific task (Handles ZenTao's ghost-logging bugs).
- `getUsersMapping`: Resolve assigning aliases.

## Direct CLI Commands

Fetch my tasks dashboard:
```bash
zentao-cli my tasks
```

Create a task explicitly:
```bash
zentao-cli task create --execId 123 --name "Demo Task" --assign "zhangsan" --estimate 4 --deadline "2026-03-15"
```

Log effort globally:
```bash
zentao-cli task effort --taskId 456 --consumed 2.5 --desc "Completed code logic"
```

