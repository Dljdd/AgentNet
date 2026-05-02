// Lists all wallets that need OG funding for on-chain registration + scoring
import * as fs from "fs";
import * as path from "path";
import { createPublicClient, http, formatEther } from "viem";
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

const FAUCET_URL = "https://hub.0g.ai/faucet";
const MIN_BALANCE = BigInt("5000000000000000"); // 0.005 OG

async function main() {
  const seedPath = path.resolve(process.cwd(), "scripts/seed-output.json");
  if (!fs.existsSync(seedPath)) {
    console.error("seed-output.json not found. Run: pnpm seed");
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const workers: Array<{ address: string; profile: string; composite: number }> =
    seed.workers ?? [];

  const deployer = process.env.PRIVATE_KEY
    ? (await import("viem/accounts")).privateKeyToAccount(
        (process.env.PRIVATE_KEY.startsWith("0x")
          ? process.env.PRIVATE_KEY
          : `0x${process.env.PRIVATE_KEY}`) as `0x${string}`
      )
    : null;

  const client = createPublicClient({
    chain: ZG_CHAIN,
    transport: http("https://evmrpc-testnet.0g.ai", { timeout: 15000 }),
  });

  console.log(`\n${"═".repeat(70)}`);
  console.log("  AgentNet — Wallet Funding Report");
  console.log(`  Faucet: ${FAUCET_URL}`);
  console.log(`${"═".repeat(70)}\n`);

  const needsFunding: Array<{ label: string; address: string; balance: string; needed: string }> = [];

  // Check deployer
  if (deployer) {
    console.log(`Checking deployer: ${deployer.address}`);
    try {
      const bal = await client.getBalance({ address: deployer.address });
      const needed = "0.1 OG (25 score-update txs)";
      const ok = bal >= MIN_BALANCE * 20n;
      console.log(
        `  Balance: ${formatEther(bal)} OG  ${ok ? "✓ funded" : "✗ needs funding"}`
      );
      if (!ok) needsFunding.push({ label: "Deployer (score updater)", address: deployer.address, balance: formatEther(bal), needed });
    } catch {
      console.log("  Balance: (RPC timeout)");
      needsFunding.push({ label: "Deployer (score updater)", address: deployer.address, balance: "unknown", needed: "0.1 OG" });
    }
  }

  console.log(`\nChecking ${workers.length} worker wallets...\n`);

  const results = await Promise.allSettled(
    workers.map((w) =>
      client.getBalance({ address: w.address as `0x${string}` })
    )
  );

  let funded = 0;
  let unfunded = 0;

  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const result = results[i];
    const bal = result.status === "fulfilled" ? result.value : null;
    const hasEnough = bal !== null && bal >= MIN_BALANCE;

    if (hasEnough) {
      funded++;
    } else {
      unfunded++;
      needsFunding.push({
        label: `Worker #${i + 1} (${w.profile})`,
        address: w.address,
        balance: bal !== null ? formatEther(bal) : "unknown",
        needed: "0.01 OG (1 registration tx)",
      });
    }
  }

  console.log(`  Funded:   ${funded} / ${workers.length}`);
  console.log(`  Unfunded: ${unfunded} / ${workers.length}`);

  if (needsFunding.length === 0) {
    console.log("\n✓ All wallets are funded! Run: pnpm seed (without FAST_MODE)");
    return;
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log("  Addresses that need OG from the faucet:");
  console.log(`  ${FAUCET_URL}`);
  console.log(`${"═".repeat(70)}\n`);

  for (const w of needsFunding) {
    console.log(`  ${w.label}`);
    console.log(`  Address: ${w.address}`);
    console.log(`  Current: ${w.balance} OG  →  Need: ${w.needed}`);
    console.log();
  }

  // Write a plain list for easy copy-paste
  const addressList = needsFunding.map((w) => w.address);
  const outPath = path.resolve(process.cwd(), "scripts/wallets-to-fund.txt");
  fs.writeFileSync(outPath, addressList.join("\n") + "\n");
  console.log(`Saved plain address list to: ${outPath}`);
  console.log(`Total addresses to fund: ${addressList.length}`);
  console.log(`\nFaucet: ${FAUCET_URL}`);

  // Also print a compact list for easy reading
  console.log(`\n${"─".repeat(70)}`);
  console.log("  One-liner (copy all addresses):");
  console.log(`${"─".repeat(70)}`);
  console.log(addressList.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
