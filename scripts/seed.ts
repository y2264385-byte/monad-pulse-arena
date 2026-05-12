import 'dotenv/config'
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { blitzBoardAbi } from '../src/lib/abi'

const samples = [
  ['PulseBoard', 'Monad network pulse board powered by gmonads live validator and block metrics.'],
  ['Validator Lens', 'A focused leaderboard for active validators, epoch state, stake and commission.'],
  ['Blitz Votes', 'A one-address-one-vote judging flow deployed on Monad Testnet.'],
] as const

async function main() {
  const address = process.env.BLITZ_BOARD_ADDRESS ?? process.env.VITE_BLITZ_BOARD_ADDRESS
  const rpcUrl = process.env.MONAD_TESTNET_RPC_URL
  const privateKey = process.env.PRIVATE_KEY as Hex | undefined

  if (!address) throw new Error('Set BLITZ_BOARD_ADDRESS or VITE_BLITZ_BOARD_ADDRESS before running seed')
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

  for (const [name, pitch] of samples) {
    const hash = await walletClient.writeContract({
      address: address as Address,
      abi: blitzBoardAbi,
      functionName: 'registerProject',
      args: [name, pitch],
    })
    console.log(`Registered ${name}: ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
