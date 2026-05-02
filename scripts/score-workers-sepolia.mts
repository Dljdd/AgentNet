/**
 * Scores all seed workers on the Sepolia ReputationOracle.
 * Sends txs sequentially (waits for each confirmation) to avoid nonce conflicts.
 */
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '.env') });

const ORACLE = '0xde94A743D06143b08E4B49E3812D570065BEdC51' as const;
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const ABI = [{
  name: 'updateScore', type: 'function', stateMutability: 'nonpayable',
  inputs: [
    { name: 'agent', type: 'address' },
    { name: 'accuracy', type: 'uint256' },
    { name: 'timeliness', type: 'uint256' },
    { name: 'uptime', type: 'uint256' },
  ],
  outputs: [],
}] as const;

const key = process.env.PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(key);
const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ account, chain: sepolia, transport });

const seedPath = resolve(process.cwd(), 'scripts/seed-output.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const workers: Array<{ address: string; accuracy: number; timeliness: number; uptime: number; composite: number }> = seed.workers;

console.log(`Scoring ${workers.length} workers on Sepolia ReputationOracle ${ORACLE}\n`);

const scoreTxs: Array<{ address: string; txHash: string; blockNumber: number }> = [];

for (let i = 0; i < workers.length; i++) {
  const w = workers[i];
  process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${workers.length}] ${w.address.slice(0, 10)}... `);

  const hash = await wallet.writeContract({
    address: ORACLE, abi: ABI, functionName: 'updateScore',
    args: [w.address as `0x${string}`, BigInt(w.accuracy), BigInt(w.timeliness), BigInt(w.uptime)],
    account,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`composite=${w.composite} tx=${hash.slice(0, 14)}... block=${receipt.blockNumber}`);
  scoreTxs.push({ address: w.address, txHash: hash, blockNumber: Number(receipt.blockNumber) });
}

// Persist tx hashes back into seed-output.json
seed.sepoliaScoreTxs = scoreTxs;
seed.sepoliaOracle = ORACLE;
writeFileSync(seedPath, JSON.stringify(seed, null, 2));

console.log(`\n✅ All ${workers.length} workers scored. Tx hashes written to seed-output.json`);
