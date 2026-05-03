'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, createWalletClient, custom, http, formatEther, parseEther } from 'viem'
import { sepolia } from 'viem/chains'

// AgentNet contracts (WorkerRegistry, ReputationOracle) are deployed on Sepolia.
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

// 0G chain config — kept for the "Add Network" helper and future 0G deployments.
const ZG_CHAIN = {
  id: 16602,
  name: '0G Chain Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
    public: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
} as const

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read client on Sepolia — where the AgentNet contracts live.
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC, { timeout: 15000 }),
  })

  const refreshBalance = useCallback(
    async (addr: string) => {
      try {
        const bal = await publicClient.getBalance({ address: addr as `0x${string}` })
        setBalance(parseFloat(formatEther(bal)).toFixed(4))
      } catch {
        setBalance(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  /** Switch MetaMask to Sepolia (where AgentNet contracts are deployed). */
  const switchToSepolia = async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + sepolia.id.toString(16) }],
      })
    } catch {
      // Sepolia is pre-installed in MetaMask; this should never fail.
    }
  }

  /** Add the 0G Galileo testnet to MetaMask (for users who want to explore 0G directly). */
  const addZGChain = async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x' + ZG_CHAIN.id.toString(16),
            chainName: ZG_CHAIN.name,
            nativeCurrency: ZG_CHAIN.nativeCurrency,
            rpcUrls: ['https://evmrpc-testnet.0g.ai'],
            blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
          },
        ],
      })
    } catch {
      // ignore
    }
  }
  void addZGChain // referenced to satisfy linter

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Please install MetaMask.')
      return
    }
    setIsConnecting(true)
    setError(null)
    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts[0]) {
        setAddress(accounts[0])
        await switchToSepolia()
        await refreshBalance(accounts[0])
      }
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshBalance])

  const disconnect = useCallback(() => {
    setAddress(null)
    setBalance(null)
  }, [])

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts[0]) {
          setAddress(accounts[0])
          refreshBalance(accounts[0])
        }
      })
      .catch(() => {})

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts[0]) {
        setAddress(accounts[0])
        refreshBalance(accounts[0])
      } else {
        setAddress(null)
        setBalance(null)
      }
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [refreshBalance])

  const writeContract = useCallback(
    async (params: {
      address: `0x${string}`
      abi: readonly object[]
      functionName: string
      args: unknown[]
    }): Promise<`0x${string}`> => {
      if (!window.ethereum || !address) throw new Error('Wallet not connected')
      // Use Sepolia — that's where WorkerRegistry and ReputationOracle are deployed.
      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: sepolia,
        transport: custom(window.ethereum),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return walletClient.writeContract(params as any)
    },
    [address]
  )

  const waitForTx = useCallback(
    async (hash: `0x${string}`) => {
      return publicClient.waitForTransactionReceipt({ hash })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const readContract = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: { address: `0x${string}`; abi: readonly object[]; functionName: string; args?: unknown[] }): Promise<any> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return publicClient.readContract(params as any)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return {
    address,
    balance,
    isConnected: !!address,
    isConnecting,
    error,
    connect,
    disconnect,
    writeContract,
    waitForTx,
    readContract,
    parseEther,
  }
}
