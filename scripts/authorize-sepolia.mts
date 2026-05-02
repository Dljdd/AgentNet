import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/dylanmoraes/Documents/GitHub/AgentNet/.env' });

const ABI = [
  { name: 'setAuthorizedUpdater', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'updater', type: 'address' }, { name: 'authorized', type: 'bool' }], outputs: [] },
  { name: 'authorizedUpdaters', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

const ORACLE = '0xde94A743D06143b08E4B49E3812D570065BEdC51' as const;
const KEEPER_WALLET = '0x3e3E41936dA69b2368E7c7935c05F0E6Cc745d7b' as const;
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const key = process.env.PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(key);
const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });

const isAlready = await pub.readContract({ address: ORACLE, abi: ABI, functionName: 'authorizedUpdaters', args: [KEEPER_WALLET] });
console.log('KeeperHub wallet already authorized:', isAlready);

if (!isAlready) {
  const wallet = createWalletClient({ account, chain: sepolia, transport });
  const hash = await wallet.writeContract({ address: ORACLE, abi: ABI, functionName: 'setAuthorizedUpdater', args: [KEEPER_WALLET, true], account });
  console.log('setAuthorizedUpdater tx:', hash);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log('Confirmed in block', receipt.blockNumber.toString(), '— status:', receipt.status);
} else {
  console.log('Already authorized.');
}
