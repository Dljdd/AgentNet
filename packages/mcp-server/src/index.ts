import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools";
import { getConfig } from "@agentnet/config";

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
  if (!url) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const resp = await fetch(url);
  const data = await resp.json();

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const cfg = getConfig();
  console.error(
    `AgentNet MCP server running — oracle: ${cfg.contracts.reputationOracle}, registry: ${cfg.contracts.workerRegistry}`
  );
}

main().catch(console.error);
