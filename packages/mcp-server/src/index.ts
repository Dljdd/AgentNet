import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools";

// ---------------------------------------------------------------------------
// MCP server instance — capabilities declared once, shared across sessions.
// ---------------------------------------------------------------------------

function buildMcpServer() {
  const server = new Server(
    { name: "agentnet-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools[name as keyof typeof tools];

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tool.handler as (input: any) => Promise<unknown>)(args ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: String(err) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "agentnet://workers",
        name: "Active Workers",
        description: "All registered active worker agents with scores",
        mimeType: "application/json",
      },
      {
        uri: "agentnet://scores",
        name: "Reputation Scores",
        description: "Current on-chain reputation scores for all agents",
        mimeType: "application/json",
      },
      {
        uri: "agentnet://activity",
        name: "Activity Feed",
        description: "Recent task completions, payments, and score updates",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

    const routeMap: Record<string, string> = {
      "agentnet://workers": `${apiBase}/api/workers`,
      "agentnet://scores": `${apiBase}/api/scores`,
      "agentnet://activity": `${apiBase}/api/activity`,
    };

    const url = routeMap[uri];
    if (!url) throw new Error(`Unknown resource: ${uri}`);

    const resp = await fetch(url);
    const data = await resp.json();

    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
    };
  });

  return server;
}

// ---------------------------------------------------------------------------
// Express HTTP server — one SSE transport per client session.
// GET /sse   → open SSE stream, return session endpoint URL
// POST /messages?sessionId=X → deliver client message to the right transport
// GET /health → Railway health check
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// sessionId → active transport
const transports = new Map<string, SSEServerTransport>();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "agentnet-mcp-server", version: "0.1.0" });
});

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);

  transports.set(transport.sessionId, transport);
  transport.onclose = () => transports.delete(transport.sessionId);

  const server = buildMcpServer();
  await server.connect(transport);

  console.log(`[MCP] SSE session opened: ${transport.sessionId} (${req.ip})`);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: `No session: ${sessionId}` });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

app.listen(PORT, HOST, () => {
  console.log(`AgentNet MCP server listening on http://${HOST}:${PORT}`);
  console.log(`  SSE endpoint : GET  /sse`);
  console.log(`  Message POST : POST /messages?sessionId=<id>`);
  console.log(`  Health check : GET  /health`);
});
