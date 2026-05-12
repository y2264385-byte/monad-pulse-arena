import {
  Activity,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
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
  createWalletClient,
  custom,
  getContract,
  http,
  type Address,
  type Hash,
} from 'viem'
import './App.css'
import { PulseCanvas } from './components/PulseCanvas'
import { pulseProofAbi } from './lib/abi'
import { formatCompact, formatNumber, shortAddress } from './lib/format'
import { fetchGmonadsSnapshot, type GmonadsSnapshot } from './lib/gmonads'
import { monadTestnet, switchToMonadTestnet } from './lib/monad'

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

  const isContractReady = pulseProofAddress !== defaultContractAddress
  const latestPulse = pulses.at(-1)

  const metrics = useMemo(
    () => [
      {
        label: 'TPS',
        value: formatNumber(snapshot.avgTps, 2),
        icon: Activity,
        tone: 'green',
      },
      {
        label: 'Blocks / sec',
        value: formatNumber(snapshot.avgBps, 2),
        icon: Radio,
        tone: 'purple',
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
        tone: 'blue',
      },
    ],
    [snapshot],
  )

  const proofStats = [
    {
      label: 'Last confirmation',
      value: proof ? formatLatency(proof.latencyMs) : 'Run a pulse',
      icon: TimerReset,
    },
    {
      label: 'Gas used',
      value: proof ? formatCompact(Number(proof.gasUsed)) : 'Waiting',
      icon: Gauge,
    },
    {
      label: 'Receipt block',
      value: proof ? proof.blockNumber.toString() : latestPulse?.observedBlock.toString() ?? 'None',
      icon: Blocks,
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

    const contract = getContract({
      address: pulseProofAddress,
      abi: pulseProofAbi,
      client: publicClient,
    })
    const rawPulses = await contract.read.getPulses()
    setPulses(
      rawPulses.map((pulse) => ({
        id: Number(pulse.id),
        runner: pulse.runner,
        label: pulse.label,
        createdAt: Number(pulse.createdAt),
        observedBlock: Number(pulse.observedBlock),
      })),
    )
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

  const connectWallet = async () => {
    if (!window.ethereum) {
      const message =
        'No wallet detected. Open the live site in a browser with MetaMask or another EVM wallet installed.'
      setWalletStatus(message)
      setTxStatus(message)
      return undefined
    }

    setIsWalletPending(true)
    setWalletStatus('Requesting wallet permission...')

    try {
      const [address] = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as Address[]
      setAccount(address)
      setWalletStatus('Switching to Monad Testnet...')
      await switchToMonadTestnet()
      setWalletStatus(`Wallet connected: ${shortAddress(address)}`)
      return address
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed. Please try again.'
      setWalletStatus(message)
      setTxStatus(message)
      return undefined
    } finally {
      setIsWalletPending(false)
    }
  }

  const getWalletClient = (activeAccount: Address) => {
    if (!window.ethereum) throw new Error('No wallet detected')

    return createWalletClient({
      account: activeAccount,
      chain: monadTestnet,
      transport: custom(window.ethereum),
    })
  }

  const runPulseCheck = async () => {
    if (!isContractReady) {
      setTxStatus('PulseProof contract is not configured yet.')
      return
    }

    let activeAccount = account
    if (!activeAccount) {
      activeAccount = await connectWallet()
      if (!activeAccount) return
    }

    setIsTxPending(true)
    setTxStatus('Sending Pulse Check to Monad Testnet...')

    try {
      const label = pulseLabel.trim() || 'Live execution probe'
      const walletClient = getWalletClient(activeAccount)
      const startedAt = performance.now()
      const hash = await walletClient.writeContract({
        account: activeAccount,
        address: pulseProofAddress,
        abi: pulseProofAbi,
        functionName: 'runPulse',
        args: [label],
      })
      setTxStatus(`Transaction submitted: ${shortAddress(hash)}`)

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
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
      await loadPulses()
      setTxStatus(`Confirmed in ${formatLatency(latencyMs)} on block ${receipt.blockNumber}.`)
    } catch (error) {
      setTxStatus(error instanceof Error ? error.message : 'Pulse Check failed.')
    } finally {
      setIsTxPending(false)
    }
  }

  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div>
            <div className="eyebrow">
              <CircleDot size={16} />
              Monad execution probe
            </div>
            <h1>Monad Pulse Lab</h1>
            <p>
              A live developer probe that combines gmonads network telemetry with a real
              Monad Testnet transaction, then turns the receipt into a readable execution proof.
            </p>
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
                Contract
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
            <button type="button" onClick={refreshSnapshot} disabled={isLoadingSnapshot} title="Refresh">
              {isLoadingSnapshot ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
            </button>
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

      <section className="section-band">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <Sparkles size={16} />
              Technical path
            </span>
            <h2>From live network state to verifiable execution proof</h2>
          </div>
          <p>
            The app makes Monad observable in one loop: read the current network pulse, submit
            one transaction, wait for the receipt, and expose the proof trail.
          </p>
        </div>
        <div className="feature-row">
          <article>
            <Activity size={24} />
            <h3>Telemetry context</h3>
            <p>gmonads supplies TPS, BPS, block time, validator state and the recent pulse chart.</p>
          </article>
          <article>
            <Zap size={24} />
            <h3>Real transaction</h3>
            <p>A wallet signs `runPulse(label)` against PulseProof on Monad Testnet.</p>
          </article>
          <article>
            <ReceiptText size={24} />
            <h3>Receipt proof</h3>
            <p>The UI reports transaction hash, confirmation latency, gas used and receipt block.</p>
          </article>
        </div>
      </section>

      <section className="probe-layout">
        <div className="probe-panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">
                <TimerReset size={16} />
                Pulse Check
              </span>
              <h2>Send one observable Monad transaction</h2>
            </div>
            <p>
              Label the run, send it to the PulseProof contract, then watch the receipt become
              a compact execution proof.
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
        </div>

        <div className="proof-panel">
          <div className="proof-topline">
            <div>
              <span className="eyebrow">
                <CheckCircle2 size={16} />
                Execution proof
              </span>
              <h2>{proof ? proof.label : 'No pulse yet'}</h2>
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
              <span>Contract</span>
              <a href={explorerAddressUrl(pulseProofAddress)} target="_blank" rel="noreferrer">
                {shortAddress(pulseProofAddress)}
              </a>
            </div>
            <div>
              <span>Runner</span>
              <strong>{proof ? shortAddress(proof.runner) : account ? shortAddress(account) : 'Connect wallet'}</strong>
            </div>
            <div>
              <span>Tx hash</span>
              {proof ? (
                <a href={explorerTxUrl(proof.hash)} target="_blank" rel="noreferrer">
                  {shortAddress(proof.hash)}
                </a>
              ) : (
                <strong>Waiting</strong>
              )}
            </div>
            <div>
              <span>Recorded</span>
              <strong>{proof?.recordedAt ?? 'Not yet'}</strong>
            </div>
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
          <p>{pulses.length} pulse checks are stored in the current contract.</p>
        </div>
        <div className="pulse-list">
          {[...pulses].reverse().slice(0, 6).map((pulse) => (
            <article className="pulse-card" key={pulse.id}>
              <div>
                <span>#{pulse.id}</span>
                <h3>{pulse.label}</h3>
              </div>
              <div>
                <span>Runner</span>
                <strong>{shortAddress(pulse.runner)}</strong>
              </div>
              <div>
                <span>Observed block</span>
                <strong>{pulse.observedBlock}</strong>
              </div>
            </article>
          ))}
          {pulses.length === 0 && <p className="empty-state">Run the first Pulse Check to create history.</p>}
        </div>
      </section>
    </main>
  )
}

export default App
