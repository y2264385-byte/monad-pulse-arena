export type GmonadsNetwork = 'mainnet' | 'testnet'

export type GmonadsPoint = {
  bucket: string
  tps: number
  bps: number
}

export type GmonadsSnapshot = {
  network: GmonadsNetwork
  updatedAt: string
  validatorCount: number
  activeValidators: number
  registeredValidators: number
  epoch: number
  latestBucket: string
  avgTps: number
  avgBps: number
  avgBlockTime: number
  latestTxs: number
  latestBlocks: number
  blockFullness: number
  topValidator: string
  topStake: number
  history: GmonadsPoint[]
}

type BlocksResponse = {
  success: boolean
  data: Array<{
    bucket: string
    blocks: string
    txs: string
    avg_bps: number
    avg_tps: number
    avg_block_time_s: string
    avg_block_fullness_pct: number
  }>
  meta: {
    timestamp: string
    network: GmonadsNetwork
  }
}

type ValidatorsResponse = {
  success: boolean
  data: Array<{
    epoch: string
    stake: string
    validator_set_type: 'active' | 'registered'
    auth_address: string
  }>
  meta: {
    timestamp: string
    network: GmonadsNetwork
    validatorCount: number
  }
}

const baseUrl = 'https://www.gmonads.com/api/v1/public'

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`gmonads request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchGmonadsSnapshot(network: GmonadsNetwork): Promise<GmonadsSnapshot> {
  const [blocks, validators] = await Promise.all([
    fetchJson<BlocksResponse>(`${baseUrl}/blocks/1m?network=${network}`),
    fetchJson<ValidatorsResponse>(`${baseUrl}/validators/epoch?network=${network}`),
  ])

  if (!blocks.success || !validators.success) {
    throw new Error('gmonads returned an unsuccessful response')
  }

  const latest = blocks.data.at(-1)
  if (!latest) throw new Error('gmonads returned no block buckets')

  const activeValidators = validators.data.filter((validator) => validator.validator_set_type === 'active')
  const registeredValidators = validators.data.filter(
    (validator) => validator.validator_set_type === 'registered',
  )
  const topValidator = [...activeValidators].sort((a, b) => Number(b.stake) - Number(a.stake))[0]

  return {
    network,
    updatedAt: blocks.meta.timestamp,
    validatorCount: validators.meta.validatorCount,
    activeValidators: activeValidators.length,
    registeredValidators: registeredValidators.length,
    epoch: Number(validators.data[0]?.epoch ?? 0),
    latestBucket: latest.bucket,
    avgTps: Number(latest.avg_tps),
    avgBps: Number(latest.avg_bps),
    avgBlockTime: Number(latest.avg_block_time_s),
    latestTxs: Number(latest.txs),
    latestBlocks: Number(latest.blocks),
    blockFullness: Number(latest.avg_block_fullness_pct),
    topValidator: topValidator?.auth_address ?? '0x0000000000000000000000000000000000000000',
    topStake: Number(topValidator?.stake ?? 0),
    history: blocks.data.slice(-40).map((point) => ({
      bucket: point.bucket,
      tps: Number(point.avg_tps),
      bps: Number(point.avg_bps),
    })),
  }
}
