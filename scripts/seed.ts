import 'dotenv/config'
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { pulseProofAbi } from '../src/lib/abi'

const samples = [
  'Baseline wallet-to-receipt probe',
  'gmonads telemetry context check',
  'Live demo execution proof',
] as const

async function main() {
  const address = process.env.PULSE_PROOF_ADDRESS ?? process.env.VITE_PULSE_PROOF_ADDRESS
  const rpcUrl = process.env.MONAD_TESTNET_RPC_URL
  const privateKey = process.env.PRIVATE_KEY as Hex | undefined

  if (!address) throw new Error('Set PULSE_PROOF_ADDRESS or VITE_PULSE_PROOF_ADDRESS before running seed')
  if (!rpcUrl) throw new Error('Set MONAD_TESTNET_RPC_URL before running seed')
  if (!privateKey) throw new Error('Set PRIVATE_KEY before running seed')

  const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'MON',
      symbol: 'MON',
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  } as const

  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  for (const label of samples) {
    const hash = await walletClient.writeContract({
      address: address as Address,
      abi: pulseProofAbi,
      functionName: 'runPulse',
      args: [label],
    })
    console.log(`Recorded "${label}": ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
