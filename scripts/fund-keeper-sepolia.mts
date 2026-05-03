import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/dylanmoraes/Documents/GitHub/AgentNet/.env' });

const KEEPER_WALLET = '0x3e3E41936dA69b2368E7c7935c05F0E6Cc745d7b' as const;
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const key = process.env.PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(key);
const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });

const before = await pub.getBalance({ address: KEEPER_WALLET });
console.log('KeeperHub wallet balance before:', formatEther(before), 'ETH');

const wallet = createWalletClient({ account, chain: sepolia, transport });
const hash = await wallet.sendTransaction({ to: KEEPER_WALLET, value: parseEther('0.005'), account });
console.log('Fund tx:', hash);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log('Confirmed in block', receipt.blockNumber.toString(), '— status:', receipt.status);

const after = await pub.getBalance({ address: KEEPER_WALLET });
console.log('KeeperHub wallet balance after:', formatEther(after), 'ETH');
