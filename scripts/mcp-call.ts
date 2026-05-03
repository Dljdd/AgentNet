/**
 * One-shot MCP tool caller — used in the AgentNet demo video.
 * Connects to the local MCP server, calls check_token, prints the result, exits.
 *
 * Usage:
 *   npx tsx scripts/mcp-call.ts [tokenAddress]
 *
 * Defaults to USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) if no address is given.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const TOKEN_ADDRESS =
  process.argv[2] ?? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

const MCP_URL = process.env.MCP_URL ?? "http://localhost:8080/sse";

async function main() {
  console.log(`\n[MCP] Connecting to AgentNet MCP server at ${MCP_URL}...`);

  const client = new Client(
    { name: "agentnet-demo-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new SSEClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  console.log("[MCP] Connected ✓\n");

  console.log(`[MCP] Calling tool: check_token`);
  console.log(`[MCP] Arguments: { tokenAddress: "${TOKEN_ADDRESS}" }\n`);

  const result = await client.callTool({
    name: "check_token",
    arguments: { tokenAddress: TOKEN_ADDRESS },
  });

  console.log("[MCP] Result:\n");
  console.log(JSON.stringify(result, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error("[MCP] Error:", err.message);
  process.exit(1);
});
