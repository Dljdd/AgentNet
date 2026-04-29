import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PRIVATE_KEY: z.string().min(1),
  ZG_RPC_URL: z.string().min(1),
  ZG_STORAGE_ENDPOINT: z.string().min(1),
  ZG_COMPUTE_ENDPOINT: z.string().min(1),
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
    zgComputeEndpoint: env.ZG_COMPUTE_ENDPOINT,
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
