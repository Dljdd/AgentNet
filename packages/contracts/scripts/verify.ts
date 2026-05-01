import { createPublicClient, http } from "viem";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const client = createPublicClient({
    transport: http(process.env.ZG_RPC_URL!),
  });

  const oracleAddr = process.env.REPUTATION_ORACLE_ADDRESS as `0x${string}`;
  const registryAddr = process.env.WORKER_REGISTRY_ADDRESS as `0x${string}`;

  if (!oracleAddr || !registryAddr) {
    throw new Error("Contract addresses not set in .env — run deploy first");
  }

  const oracleBytecode = await client.getBytecode({ address: oracleAddr });
  const registryBytecode = await client.getBytecode({ address: registryAddr });

  if (!oracleBytecode || oracleBytecode === "0x") {
    throw new Error(`ReputationOracle not found at ${oracleAddr}`);
  }
  if (!registryBytecode || registryBytecode === "0x") {
    throw new Error(`WorkerRegistry not found at ${registryAddr}`);
  }

  console.log("✅ ReputationOracle verified on-chain:", oracleAddr);
  console.log("✅ WorkerRegistry verified on-chain:", registryAddr);
  console.log("\nBlock explorer links:");
  console.log(`   https://chainscan-galileo.0g.ai/address/${oracleAddr}`);
  console.log(`   https://chainscan-galileo.0g.ai/address/${registryAddr}`);
}

main().catch(console.error);
