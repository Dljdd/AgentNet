import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
dotenv.config();

const ZG_CHAIN = {
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
    public: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
} as const;

const ABI = [
  {
    name: "setAuthorizedUpdater",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "updater", type: "address" },
      { name: "authorized", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "authorizedUpdaters",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ORACLE = "0x19139CDE2d0da0B148bE69cD4261AA62B9d4F125" as const;
const KEEPER_WALLET = "0x3e3E41936dA69b2368E7c7935c05F0E6Cc745d7b" as const;

async function main() {
  const key = process.env.PRIVATE_KEY as `0x${string}`;
  if (!key) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(key);
  console.log("Deployer:", account.address);

  const pub = createPublicClient({ chain: ZG_CHAIN, transport: http() });

  const isAlready = await pub.readContract({
    address: ORACLE,
    abi: ABI,
    functionName: "authorizedUpdaters",
    args: [KEEPER_WALLET],
  });
  console.log("KeeperHub wallet authorized:", isAlready);

  if (!isAlready) {
    const wallet = createWalletClient({ account, chain: ZG_CHAIN, transport: http() });
    const hash = await wallet.writeContract({
      address: ORACLE,
      abi: ABI,
      functionName: "setAuthorizedUpdater",
      args: [KEEPER_WALLET, true],
      account,
    });
    console.log("setAuthorizedUpdater tx:", hash);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    console.log("Confirmed in block", receipt.blockNumber.toString(), "— status:", receipt.status);
  } else {
    console.log("Already authorized, nothing to do.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
