import { createPublicClient, createWalletClient, http, encodeFunctionData, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ZG_CHAIN = {
  id: 16602,
  name: "0G Chain Testnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
    public: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
} as const;

const WORKER_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataUri", type: "string" },
      { name: "feePerTask", type: "uint256" },
      { name: "capabilities", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "isRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const REPUTATION_ORACLE_ABI = [
  {
    name: "updateScore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "accuracy", type: "uint256" },
      { name: "timeliness", type: "uint256" },
      { name: "uptime", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "authorizedUpdaters",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ALL_CAPABILITIES = [
  "pool-indexer",
  "wallet-summarizer",
  "token-fact-checker",
] as const;

type Capability = (typeof ALL_CAPABILITIES)[number];

interface WorkerProfile {
  name: string;
  count: number;
  accuracyRange: [number, number];
  timelinessRange: [number, number];
  uptimeRange: [number, number];
  jobCount: [number, number];
}

const PROFILES: WorkerProfile[] = [
  { name: "broken", count: 3, accuracyRange: [100, 900], timelinessRange: [200, 800], uptimeRange: [100, 600], jobCount: [5, 10] },
  { name: "elite", count: 5, accuracyRange: [9000, 9800], timelinessRange: [9100, 9700], uptimeRange: [9200, 9900], jobCount: [30, 50] },
  { name: "good", count: 7, accuracyRange: [7000, 8500], timelinessRange: [7200, 8300], uptimeRange: [7500, 8800], jobCount: [15, 30] },
  { name: "mediocre", count: 5, accuracyRange: [4000, 6000], timelinessRange: [3500, 5500], uptimeRange: [4500, 6500], jobCount: [8, 18] },
  { name: "new", count: 5, accuracyRange: [6000, 8000], timelinessRange: [6000, 7500], uptimeRange: [7000, 8500], jobCount: [0, 5] },
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function derivePrivateKey(baseKey: string, index: number): `0x${string}` {
  const combined = toHex(`${baseKey}-seed-worker-${index}`);
  return keccak256(combined);
}

function pickCapabilities(seed: number): Capability[] {
  const count = (seed % 3) + 1;
  const shuffled = [...ALL_CAPABILITIES].sort(() => (seed % 7) - 3);
  return shuffled.slice(0, count) as Capability[];
}

interface SeedWorker {
  index: number;
  profile: string;
  address: string;
  privateKey: string;
  capabilities: string[];
  feePerTask: string;
  accuracy: number;
  timeliness: number;
  uptime: number;
  composite: number;
  totalJobs: number;
  registered: boolean;
  scored: boolean;
}

async function main() {
  const FAST_MODE = process.env.FAST_MODE === "true";
  const SEED_COUNT = parseInt(process.env.SEED_COUNT ?? "25", 10);
  const rawKey = process.env.PRIVATE_KEY ?? "deadbeef".repeat(8);
  const BASE_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const REGISTRY = process.env.WORKER_REGISTRY_ADDRESS ?? "";
  const ORACLE = process.env.REPUTATION_ORACLE_ADDRESS ?? "";

  console.log(`\n${"=".repeat(60)}`);
  console.log("  AgentNet Seed Script — M-30");
  console.log(`  Mode: ${FAST_MODE ? "FAST (no chain writes)" : "LIVE (on-chain)"}`);
  console.log(`  Workers: ${SEED_COUNT}`);
  console.log(`${"=".repeat(60)}\n`);

  const deployerAccount = privateKeyToAccount(BASE_KEY as `0x${string}`);
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: ZG_CHAIN,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: ZG_CHAIN,
    transport: http(),
  });

  const workers: SeedWorker[] = [];
  let globalIndex = 0;

  for (const profile of PROFILES) {
    const count = Math.min(profile.count, SEED_COUNT - globalIndex);
    if (count <= 0) break;

    for (let i = 0; i < count; i++) {
      const idx = globalIndex++;
      const privateKey = derivePrivateKey(BASE_KEY, idx);
      const account = privateKeyToAccount(privateKey);

      const capabilities = pickCapabilities(idx);
      const feePerTask = BigInt(rand(1, 20)) * BigInt("10000000000000000");
      const accuracy = rand(...profile.accuracyRange);
      const timeliness = rand(...profile.timelinessRange);
      const uptime = rand(...profile.uptimeRange);
      const composite = Math.floor(accuracy * 0.5 + timeliness * 0.3 + uptime * 0.2);
      const totalJobs = rand(...profile.jobCount);

      const worker: SeedWorker = {
        index: idx,
        profile: profile.name,
        address: account.address,
        privateKey,
        capabilities,
        feePerTask: feePerTask.toString(),
        accuracy,
        timeliness,
        uptime,
        composite,
        totalJobs,
        registered: false,
        scored: false,
      };

      process.stdout.write(
        `  [${String(idx + 1).padStart(2, "0")}/${SEED_COUNT}] ${profile.name.padEnd(8)} ${account.address.slice(0, 10)}... `
      );

      if (!FAST_MODE && REGISTRY) {
        try {
          const alreadyRegistered = await publicClient.readContract({
            address: REGISTRY as `0x${string}`,
            abi: WORKER_REGISTRY_ABI,
            functionName: "isRegistered",
            args: [account.address as `0x${string}`],
          });

          if (!alreadyRegistered) {
            const metadataUri = `ipfs://agentnet/worker/${account.address}`;
            const data = encodeFunctionData({
              abi: WORKER_REGISTRY_ABI,
              functionName: "register",
              args: [metadataUri, feePerTask, capabilities],
            });

            const workerWallet = createWalletClient({
              account,
              chain: ZG_CHAIN,
              transport: http("https://evmrpc-testnet.0g.ai", { timeout: 30000 }),
            });

            await workerWallet.sendTransaction({
              account,
              to: REGISTRY as `0x${string}`,
              data,
              chain: ZG_CHAIN,
            });
            worker.registered = true;
          } else {
            worker.registered = true;
          }
        } catch (err) {
          process.stdout.write(`[register fail] `);
        }
      } else {
        worker.registered = FAST_MODE;
      }

      if (!FAST_MODE && ORACLE) {
        try {
          const canScore = await publicClient.readContract({
            address: ORACLE as `0x${string}`,
            abi: REPUTATION_ORACLE_ABI,
            functionName: "authorizedUpdaters",
            args: [deployerAccount.address as `0x${string}`],
          });

          if (canScore) {
            const data = encodeFunctionData({
              abi: REPUTATION_ORACLE_ABI,
              functionName: "updateScore",
              args: [
                account.address as `0x${string}`,
                BigInt(accuracy),
                BigInt(timeliness),
                BigInt(uptime),
              ],
            });

            await deployerWallet.sendTransaction({
              account: deployerAccount,
              to: ORACLE as `0x${string}`,
              data,
              chain: ZG_CHAIN,
            });
            worker.scored = true;
          }
        } catch (err) {
          process.stdout.write(`[score fail] `);
        }
      } else {
        worker.scored = FAST_MODE;
      }

      workers.push(worker);
      process.stdout.write(`composite=${composite} ✓\n`);
    }
  }

  const outputPath = path.resolve(process.cwd(), "scripts/seed-output.json");
  const output = {
    seededAt: new Date().toISOString(),
    fastMode: FAST_MODE,
    count: workers.length,
    workers: workers.map(({ privateKey: _pk, ...w }) => w),
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Summary");
  console.log(`${"=".repeat(60)}`);

  const profiles = [...new Set(workers.map((w) => w.profile))];
  for (const p of profiles) {
    const group = workers.filter((w) => w.profile === p);
    const avgComposite = Math.floor(group.reduce((s, w) => s + w.composite, 0) / group.length);
    console.log(`  ${p.padEnd(10)} ${group.length} workers  avg composite=${avgComposite}`);
  }
  console.log(`\n  Output written to: ${outputPath}`);
  console.log(`  Total workers seeded: ${workers.length}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
