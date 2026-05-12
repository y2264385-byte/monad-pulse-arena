import {
  Activity,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  Fingerprint,
  Gauge,
  Loader2,
  Network,
  Radio,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wallet,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getContract,
  http,
  toHex,
  type Address,
  type Hash,
} from 'viem'
import './App.css'
import { PulseCanvas } from './components/PulseCanvas'
import { pulseProofAbi } from './lib/abi'
import { formatCompact, formatNumber, shortAddress } from './lib/format'
import { fetchGmonadsSnapshot, type GmonadsSnapshot } from './lib/gmonads'
import { monadTestnet, switchToMonadTestnet } from './lib/monad'

const emptyAddress = '0x0000000000000000000000000000000000000000'
const defaultContractAddress = '0x35d42feD97705034BA4613f2e0bFE14309852472'
const pulseProofAddress = (import.meta.env.VITE_PULSE_PROOF_ADDRESS || defaultContractAddress) as Address
const monadVisionBaseUrl = 'https://testnet.monadvision.com'

const fallbackSnapshot: GmonadsSnapshot = {
  network: 'mainnet',
  updatedAt: new Date().toISOString(),
  validatorCount: 219,
  activeValidators: 200,
  registeredValidators: 19,
  epoch: 1481,
  latestBucket: new Date().toISOString(),
  avgTps: 22.28,
  avgBps: 2.52,
  avgBlockTime: 0.393,
  latestTxs: 1337,
  latestBlocks: 151,
  blockFullness: 2.55,
  topValidator: '0xbB8EE00846BF924F34Ba4f8a86d690Ff11Eed7cA',
  topStake: 1_780_353_434,
  history: [],
}

type Pulse = {
  id: number
  runner: Address
  label: string
  createdAt: number
  observedBlock: number
}

type ExecutionProof = {
  hash: Hash
  label: string
  runner: Address
  blockNumber: bigint
  gasUsed: bigint
  latencyMs: number
  recordedAt: string
}

type ExecutionStage =
  | 'idle'
  | 'requesting_wallet'
  | 'switching_network'
  | 'ready'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'failed'

type StepStatus = 'complete' | 'active' | 'upcoming' | 'error'

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
})

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function explorerTxUrl(hash: Hash) {
  return `${monadVisionBaseUrl}/tx/${hash}`
}

function explorerAddressUrl(address: Address) {
  return `${monadVisionBaseUrl}/address/${address}`
}

function formatPulseTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString()
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const candidate = error as {
      shortMessage?: unknown
      message?: unknown
      details?: unknown
      code?: unknown
    }

    for (const value of [candidate.shortMessage, candidate.message, candidate.details]) {
      if (typeof value === 'string' && value.trim().length > 0) return value
    }

    try {
      return JSON.stringify(error)
    } catch {
      if (candidate.code !== undefined) return `Wallet request failed with code ${String(candidate.code)}.`
    }
  }

  return 'Pulse Check failed.'
}

function App() {
  const [snapshot, setSnapshot] = useState<GmonadsSnapshot>(fallbackSnapshot)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true)
  const [snapshotError, setSnapshotError] = useState('')
  const [account, setAccount] = useState<Address>()
  const [walletStatus, setWalletStatus] = useState('')
  const [isWalletPending, setIsWalletPending] = useState(false)
  const [pulseLabel, setPulseLabel] = useState('Live execution probe')
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [proof, setProof] = useState<ExecutionProof>()
  const [txStatus, setTxStatus] = useState('')
  const [isTxPending, setIsTxPending] = useState(false)
  const [executionStage, setExecutionStage] = useState<ExecutionStage>('idle')

  const isContractReady = pulseProofAddress !== emptyAddress
  const latestPulse = pulses.at(-1)
  const recentPulses = [...pulses].reverse().slice(0, 6)
  const updatedAtLabel = new Date(snapshot.updatedAt).toLocaleTimeString()

  const metrics = useMemo(
    () => [
      {
        label: 'TPS',
        value: formatNumber(snapshot.avgTps, 2),
        icon: Activity,
        tone: 'teal',
      },
      {
        label: 'Blocks / sec',
        value: formatNumber(snapshot.avgBps, 2),
        icon: Radio,
        tone: 'sky',
      },
      {
        label: 'Block time',
        value: `${formatNumber(snapshot.avgBlockTime, 3)}s`,
        icon: Zap,
        tone: 'amber',
      },
      {
        label: 'Active validators',
        value: snapshot.activeValidators.toString(),
        icon: ShieldCheck,
        tone: 'pine',
      },
    ],
    [snapshot],
  )

  const stageMeta = {
    idle: {
      label: 'Waiting for wallet',
      note: 'Live telemetry is flowing. Connect a wallet to turn this into a real Monad transaction.',
    },
    requesting_wallet: {
      label: 'Wallet handshake',
      note: 'We are asking the browser wallet for account access.',
    },
    switching_network: {
      label: 'Switching network',
      note: 'The probe is moving the wallet onto Monad Testnet before signing.',
    },
    ready: {
      label: 'Ready to sign',
      note: 'Wallet is connected. The next click should open a signature request.',
    },
    submitting: {
      label: 'Opening signature',
      note: 'The write is being prepared and sent to the wallet for approval.',
    },
    confirming: {
      label: 'Waiting for receipt',
      note: 'The transaction is in flight. The next visual transition happens when a block confirms it.',
    },
    confirmed: {
      label: 'Receipt captured',
      note: 'Latency, gas, block number and explorer proof are now available.',
    },
    failed: {
      label: 'Needs attention',
      note: 'The flow paused because the wallet or transaction returned an error.',
    },
  }[executionStage]

  const proofStats = [
    {
      label: 'Confirmation latency',
      value: proof ? formatLatency(proof.latencyMs) : 'No receipt yet',
      icon: TimerReset,
    },
    {
      label: 'Gas used',
      value: proof ? formatCompact(Number(proof.gasUsed)) : 'Waiting',
      icon: Gauge,
    },
    {
      label: 'Receipt block',
      value: proof ? proof.blockNumber.toString() : latestPulse?.observedBlock.toString() ?? 'No block yet',
      icon: Blocks,
    },
    {
      label: 'Recorded pulses',
      value: pulses.length ? pulses.length.toString() : '0',
      icon: CheckCircle2,
    },
  ]

  const executionSteps = [
    {
      key: 'telemetry',
      title: 'Read live telemetry',
      detail: `${formatNumber(snapshot.avgTps, 2)} TPS / ${formatNumber(snapshot.avgBps, 2)} BPS`,
      icon: Activity,
      status: 'complete' as StepStatus,
    },
    {
      key: 'wallet',
      title: 'Handshake wallet',
      detail:
        account ??
        (executionStage === 'requesting_wallet' ? 'Approving wallet access...' : 'Connect an EVM wallet'),
      icon: Wallet,
      status: ((): StepStatus => {
        if (executionStage === 'failed' && !account) return 'error'
        if (
          executionStage === 'requesting_wallet' ||
          executionStage === 'switching_network' ||
          executionStage === 'idle'
        ) {
          return 'active'
        }
        return 'complete'
      })(),
    },
    {
      key: 'signature',
      title: 'Request signature',
      detail: pulseLabel.trim() || 'Live execution probe',
      icon: Fingerprint,
      status: ((): StepStatus => {
        if (executionStage === 'failed' && account) return 'error'
        if (executionStage === 'ready' || executionStage === 'submitting') return 'active'
        if (executionStage === 'confirming' || executionStage === 'confirmed') return 'complete'
        return 'upcoming'
      })(),
    },
    {
      key: 'block',
      title: 'Wait for block',
      detail: proof ? `Block ${proof.blockNumber}` : executionStage === 'confirming' ? 'Receipt pending...' : 'Awaiting submission',
      icon: Blocks,
      status: ((): StepStatus => {
        if (executionStage === 'failed' && !proof) return 'error'
        if (executionStage === 'confirming') return 'active'
        if (executionStage === 'confirmed') return 'complete'
        return 'upcoming'
      })(),
    },
    {
      key: 'proof',
      title: 'Render proof',
      detail: proof ? shortAddress(proof.hash) : 'Latency, gas and explorer link',
      icon: ReceiptText,
      status: proof ? 'complete' : executionStage === 'confirmed' ? 'active' : 'upcoming',
    },
  ]

  const refreshSnapshot = async () => {
    setIsLoadingSnapshot(true)
    setSnapshotError('')
    try {
      const next = await fetchGmonadsSnapshot('mainnet')
      setSnapshot(next)
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : 'Unable to read gmonads data')
      setSnapshot(fallbackSnapshot)
    } finally {
      setIsLoadingSnapshot(false)
    }
  }

  const loadPulses = useCallback(async () => {
    if (!isContractReady) return

    type RawPulse = ReadonlyArray<{
      id: bigint
      runner: Address
      label: string
      createdAt: bigint
      observedBlock: bigint
    }>

    const contract = getContract({
      address: pulseProofAddress,
      abi: pulseProofAbi,
      client: publicClient,
    })

    const callViaProvider = async (data: `0x${string}`) => {
      const result = (await window.ethereum!.request({
        method: 'eth_call',
        params: [{ to: pulseProofAddress, data }, 'latest'],
      })) as `0x${string}`
      return result
    }

    const readPaginated = async (): Promise<RawPulse> => {
      const data = encodeFunctionData({
        abi: pulseProofAbi,
        functionName: 'getPulsesPaginated',
        args: [0n, 100n],
      })

      if (window.ethereum) {
        try {
          const result = await callViaProvider(data)
          return decodeFunctionResult({
            abi: pulseProofAbi,
            functionName: 'getPulsesPaginated',
            data: result,
          })
        } catch {
          // wallet provider refused — fall through
        }
      }

      try {
        return await contract.read.getPulsesPaginated([0n, 100n])
      } catch {
        // paginated not available on this deployment — throw so caller can fall back
        throw new Error('getPulsesPaginated not available')
      }
    }

    const readAll = async (): Promise<RawPulse> => {
      const data = encodeFunctionData({
        abi: pulseProofAbi,
        functionName: 'getPulses',
      })

      if (window.ethereum) {
        try {
          const result = await callViaProvider(data)
          return decodeFunctionResult({
            abi: pulseProofAbi,
            functionName: 'getPulses',
            data: result,
          })
        } catch {
          // wallet provider refused — fall through to public client
        }
      }

      return await contract.read.getPulses()
    }

    try {
      let rawPulses: RawPulse
      try {
        rawPulses = await readPaginated()
      } catch {
        rawPulses = await readAll()
      }

      setPulses(
        rawPulses.map((pulse) => ({
          id: Number(pulse.id),
          runner: pulse.runner,
          label: pulse.label,
          createdAt: Number(pulse.createdAt),
          observedBlock: Number(pulse.observedBlock),
        })),
      )
    } catch {
      // Keep the UI usable even if every read path fails.
    }
  }, [isContractReady])

  useEffect(() => {
    const initialize = async () => {
      await Promise.allSettled([refreshSnapshot(), loadPulses()])
    }

    void initialize()

    const timer = window.setInterval(() => {
      void refreshSnapshot()
      void loadPulses()
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [loadPulses])

  useEffect(() => {
    const restoreWallet = async () => {
      if (!window.ethereum) return

      try {
        const accounts = (await window.ethereum.request({
          method: 'eth_accounts',
        })) as Address[]
        const nextAccount = accounts[0]
        if (!nextAccount) return

        setAccount(nextAccount)
        setWalletStatus(`Wallet ready: ${shortAddress(nextAccount)}`)
        setExecutionStage((current) => (current === 'confirmed' ? current : 'ready'))
      } catch {
        // ignore passive wallet detection failures
      }
    }

    void restoreWallet()
  }, [])

  const connectWallet = async () => {
    if (!window.ethereum) {
      const message =
        'No wallet detected. Open the live site in a browser with MetaMask or another EVM wallet installed.'
      setExecutionStage('failed')
      setWalletStatus(message)
      setTxStatus(message)
      return undefined
    }

    setIsWalletPending(true)
    setExecutionStage('requesting_wallet')
    setWalletStatus('Requesting wallet permission...')

    try {
      const [address] = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as Address[]
      setAccount(address)
      setExecutionStage('switching_network')
      setWalletStatus('Switching to Monad Testnet...')
      await switchToMonadTestnet()
      setExecutionStage('ready')
      setWalletStatus(`Wallet connected: ${shortAddress(address)}`)
      return address
    } catch (error) {
      const message = describeError(error)
      setExecutionStage('failed')
      setWalletStatus(message)
      setTxStatus(message)
      return undefined
    } finally {
      setIsWalletPending(false)
    }
  }

  const runPulseCheck = async () => {
    if (!isContractReady) {
      setExecutionStage('failed')
      setTxStatus('PulseProof contract is not configured yet.')
      return
    }

    let activeAccount = account
    if (!activeAccount) {
      activeAccount = await connectWallet()
      if (!activeAccount) return
    }

    setIsTxPending(true)
    setExecutionStage('submitting')
    setTxStatus('Opening signature request...')

    try {
      const label = pulseLabel.trim() || 'Live execution probe'
      const startedAt = performance.now()
      const expectedChainId = `0x${monadTestnet.id.toString(16)}`
      const activeChainId = (await window.ethereum?.request({
        method: 'eth_chainId',
      })) as string | undefined
      if (activeChainId !== expectedChainId) {
        setExecutionStage('switching_network')
        setWalletStatus('Switching to Monad Testnet...')
        await switchToMonadTestnet()
      }

      const data = encodeFunctionData({
        abi: pulseProofAbi,
        functionName: 'runPulse',
        args: [label],
      })
      const gas = 250000n
      const hash = (await window.ethereum?.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeAccount,
            to: pulseProofAddress,
            data,
            gas: toHex(gas),
          },
        ],
      })) as Hash | undefined
      if (!hash) throw new Error('Wallet did not return a transaction hash.')
      setExecutionStage('confirming')
      setTxStatus(`Transaction submitted: ${shortAddress(hash)}`)

      let receipt: { blockNumber: bigint; gasUsed: bigint } | null = null
      for (let attempt = 0; attempt < 90; attempt += 1) {
        receipt = await publicClient.getTransactionReceipt({ hash })
        if (receipt) break
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
      }
      if (!receipt) throw new Error('Timed out while waiting for the transaction receipt.')
      const latencyMs = Math.round(performance.now() - startedAt)
      setProof({
        hash,
        label,
        runner: activeAccount,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        latencyMs,
        recordedAt: new Date().toLocaleTimeString(),
      })
      setExecutionStage('confirmed')
      await loadPulses()
      setTxStatus(
        `Confirmed in ${formatLatency(latencyMs)} on block ${receipt.blockNumber}.`,
      )
    } catch (error) {
      console.dir(error)
      setExecutionStage('failed')
      setTxStatus(describeError(error))
    } finally {
      setIsTxPending(false)
    }
  }

  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-copy-grid">
            <div>
              <div className="eyebrow">
                <CircleDot size={16} />
                Monad execution probe
              </div>
              <h1>Monad Pulse Lab</h1>
              <p>
                A live developer surface that turns Monad transaction flow into something you can
                watch, follow and verify in one glance.
              </p>
            </div>

            <div className="signal-grid">
              <article className="signal-card">
                <span>Probe state</span>
                <strong>{stageMeta.label}</strong>
                <p>{stageMeta.note}</p>
              </article>
              <article className="signal-card">
                <span>Latest on-chain pulse</span>
                <strong>{latestPulse?.label ?? 'No pulse yet'}</strong>
                <p>
                  {latestPulse
                    ? `${shortAddress(latestPulse.runner)} at ${formatPulseTime(latestPulse.createdAt)}`
                    : 'Run the next Pulse Check to leave a fresh chain record.'}
                </p>
              </article>
            </div>
          </div>

          <div>
            <div className="hero-actions">
              <button
                type="button"
                className="primary-action"
                onClick={connectWallet}
                disabled={isWalletPending}
              >
                {isWalletPending ? <Loader2 className="spin" size={18} /> : <Wallet size={18} />}
                {account ? shortAddress(account) : isWalletPending ? 'Connecting' : 'Connect wallet'}
              </button>
              <a
                href={explorerAddressUrl(pulseProofAddress)}
                target="_blank"
                rel="noreferrer"
                className="ghost-action"
              >
                <Code2 size={18} />
                PulseProof contract
              </a>
            </div>
            {walletStatus && <p className="wallet-status">{walletStatus}</p>}
          </div>
        </div>

        <div className="live-panel" aria-label="Monad live network dashboard">
          <div className="panel-topline">
            <span>
              <Network size={16} />
              gmonads live feed
            </span>
            <div className="panel-actions">
              <span className="panel-stamp">Updated {updatedAtLabel}</span>
              <button type="button" onClick={refreshSnapshot} disabled={isLoadingSnapshot} title="Refresh">
                {isLoadingSnapshot ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
              </button>
            </div>
          </div>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <article className={`metric ${metric.tone}`} key={metric.label}>
                <metric.icon size={19} />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
          <div className="validator-strip">
            <div>
              <span>Epoch</span>
              <strong>{snapshot.epoch}</strong>
            </div>
            <div>
              <span>Validators</span>
              <strong>{snapshot.validatorCount}</strong>
            </div>
            <div>
              <span>Top stake</span>
              <strong>{formatCompact(snapshot.topStake)}</strong>
            </div>
          </div>
          <PulseCanvas points={snapshot.history} />
          {snapshotError && <p className="inline-warning">{snapshotError}</p>}
        </div>
      </section>

      <section className="path-band">
        <div className="path-headline">
          <div>
            <span className="eyebrow">
              <Sparkles size={16} />
              Execution path
            </span>
            <h2>Watch the transaction move from wallet intent to receipt proof</h2>
          </div>
          <p>
            The flow below stays readable while the state changes, so the Monad path feels like a
            route instead of a black box.
          </p>
        </div>

        <div className="path-rail">
          {executionSteps.map((step) => (
            <article className={`path-step ${step.status}`} key={step.key}>
              <div className="path-node">
                <step.icon size={18} />
              </div>
              <div className="path-step-copy">
                <span>{step.title}</span>
                <strong>{step.key === 'wallet' && account ? shortAddress(account) : step.detail}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="probe-layout">
        <div className="probe-panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">
                <Fingerprint size={16} />
                Operator console
              </span>
              <h2>Launch the next Pulse Check</h2>
            </div>
            <p>
              Label the run, sign a Monad Testnet write and let the receipt populate the proof
              surface on the right.
            </p>
          </div>

          <label>
            Run label
            <input
              value={pulseLabel}
              onChange={(event) => setPulseLabel(event.target.value)}
              placeholder="Live execution probe"
              maxLength={64}
            />
          </label>

          <button
            type="button"
            className="primary-action wide"
            onClick={runPulseCheck}
            disabled={isTxPending || !isContractReady}
          >
            {isTxPending ? <Loader2 className="spin" size={18} /> : <Zap size={18} />}
            {isTxPending ? 'Waiting for receipt' : 'Run Pulse Check'}
          </button>

          {txStatus && <p className="tx-status">{txStatus}</p>}

          <div className="operator-grid">
            <article className="operator-card">
              <span>Wallet</span>
              <strong>{account ? shortAddress(account) : 'Not connected'}</strong>
              <p>Use the same address for repeated probes to build a visible execution history.</p>
            </article>
            <article className="operator-card">
              <span>Contract</span>
              <a href={explorerAddressUrl(pulseProofAddress)} target="_blank" rel="noreferrer">
                {shortAddress(pulseProofAddress)}
              </a>
              <p>Every pulse lands on the same contract, which keeps the path legible for demos.</p>
            </article>
          </div>
        </div>

        <div className="proof-panel">
          <div className="proof-topline">
            <div>
              <span className="eyebrow">
                <ReceiptText size={16} />
                Receipt proof
              </span>
              <h2>{proof ? proof.label : 'The next receipt will appear here'}</h2>
            </div>
            {proof && (
              <a href={explorerTxUrl(proof.hash)} target="_blank" rel="noreferrer" className="icon-link">
                <ArrowUpRight size={18} />
              </a>
            )}
          </div>

          <div className="proof-grid">
            {proofStats.map((item) => (
              <article key={item.label}>
                <item.icon size={18} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="proof-detail">
            <div>
              <span>Transaction hash</span>
              {proof ? (
                <a href={explorerTxUrl(proof.hash)} target="_blank" rel="noreferrer">
                  {shortAddress(proof.hash)}
                </a>
              ) : (
                <strong>Waiting for receipt</strong>
              )}
            </div>
            <div>
              <span>Runner</span>
              <strong>{proof ? shortAddress(proof.runner) : account ? shortAddress(account) : 'Connect wallet'}</strong>
            </div>
            <div>
              <span>Recorded at</span>
              <strong>{proof?.recordedAt ?? 'No receipt yet'}</strong>
            </div>
            <div>
              <span>Explorer path</span>
              <a href={explorerAddressUrl(pulseProofAddress)} target="_blank" rel="noreferrer">
                Open contract
              </a>
            </div>
          </div>

          <div className="proof-note">
            <strong>What this surface proves</strong>
            <p>
              This is not a mocked success state. The numbers above only appear after Monad Testnet
              returns a real receipt and the app binds it back into the visual path.
            </p>
          </div>
        </div>
      </section>

      <section className="history-band">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">
              <Clock3 size={16} />
              On-chain history
            </span>
            <h2>Recent PulseProof records</h2>
          </div>
          <p>
            The history reads like a lightweight event log: label, runner and observed block in the
            same frame.
          </p>
        </div>

        <div className="pulse-list">
          {recentPulses.map((pulse) => (
            <article className="pulse-card" key={pulse.id}>
              <div>
                <span>Pulse #{pulse.id}</span>
                <h3>{pulse.label}</h3>
              </div>
              <div className="pulse-meta">
                <div>
                  <span>Runner</span>
                  <strong>{shortAddress(pulse.runner)}</strong>
                </div>
                <div>
                  <span>Observed block</span>
                  <strong>{pulse.observedBlock}</strong>
                </div>
                <div>
                  <span>Recorded</span>
                  <strong>{formatPulseTime(pulse.createdAt)}</strong>
                </div>
              </div>
            </article>
          ))}

          {recentPulses.length === 0 && (
            <p className="empty-state">Run the first Pulse Check to generate your own on-chain history.</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
