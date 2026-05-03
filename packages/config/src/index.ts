import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PRIVATE_KEY: z.string().min(1),
  ZG_RPC_URL: z.string().min(1),
  // Storage indexer RPC (for file uploads and KV node selection)
  ZG_STORAGE_ENDPOINT: z.string().min(1),
  // KV node HTTP endpoint (for key-value reads)
  ZG_KV_ENDPOINT: z.string().optional().default("http://3.101.147.150:6789"),
  // Flow contract address on 0G testnet (Galileo)
  ZG_FLOW_CONTRACT: z.string().optional().default("0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"),
  // Compute router endpoint — OpenAI-compatible, get key from pc.0g.ai
  ZG_COMPUTE_ENDPOINT: z.string().min(1),
  // API key for 0G Compute router (separate from ETH private key)
  ZG_COMPUTE_API_KEY: z.string().optional().default(""),
  ZG_DA_ENDPOINT: z.string().min(1),
  UNISWAP_API_KEY: z.string().min(1),
  KEEPERHUB_API_KEY: z.string().min(1),
  CHAIN_ID: z.string().min(1),
  REPUTATION_ORACLE_ADDRESS: z.string().default(""),
  WORKER_REGISTRY_ADDRESS: z.string().default(""),
});

export function getConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  const env = result.data;
  return {
    privateKey: env.PRIVATE_KEY,
    zgRpcUrl: env.ZG_RPC_URL,
    zgStorageEndpoint: env.ZG_STORAGE_ENDPOINT,
    zgKvEndpoint: env.ZG_KV_ENDPOINT,
    zgFlowContract: env.ZG_FLOW_CONTRACT,
    zgComputeEndpoint: env.ZG_COMPUTE_ENDPOINT,
    zgComputeApiKey: env.ZG_COMPUTE_API_KEY,
    zgDAEndpoint: env.ZG_DA_ENDPOINT,
    uniswapApiKey: env.UNISWAP_API_KEY,
    keeperHubApiKey: env.KEEPERHUB_API_KEY,
    chainId: parseInt(env.CHAIN_ID, 10),
    contracts: {
      reputationOracle: env.REPUTATION_ORACLE_ADDRESS,
      workerRegistry: env.WORKER_REGISTRY_ADDRESS,
    },
  };
}

export { ZG_TESTNET, CONTRACT_ADDRESSES, TESTNET_TOKENS } from "./chains";
