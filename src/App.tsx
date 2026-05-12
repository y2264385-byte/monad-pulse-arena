import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CircleDot,
  Code2,
  Database,
  GitBranch,
  Loader2,
  Medal,
  Network,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  Wallet,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  getContract,
  http,
  type Address,
} from 'viem'
import './App.css'
import { PulseCanvas } from './components/PulseCanvas'
import { blitzBoardAbi } from './lib/abi'
import { formatCompact, formatNumber, formatPercent, shortAddress } from './lib/format'
import { fetchGmonadsSnapshot, type GmonadsSnapshot } from './lib/gmonads'
import { monadTestnet, switchToMonadTestnet } from './lib/monad'

const contractAddress = import.meta.env.VITE_BLITZ_BOARD_ADDRESS as Address | undefined

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

type Project = {
  id: number
  name: string
  pitch: string
  creator: Address
  votes: number
}

const demoProjects: Project[] = [
  {
    id: 0,
    name: 'PulseBoard',
    pitch: '把 gmonads 实时指标变成适合现场投屏的 Monad 网络健康面板。',
    creator: '0x6fC1D9829dD4E4496c9a3529dD42469b02BFDd6a',
    votes: 18,
  },
  {
    id: 1,
    name: 'Validator Lens',
    pitch: '面向验证者的轻量榜单，跟踪 active stake、commission 和 epoch 变化。',
    creator: '0x2AF8b683D8f5a2b11bfe557883b9514A5eE1C78a',
    votes: 13,
  },
  {
    id: 2,
    name: 'Blitz Votes',
    pitch: '把项目登记和一人一票评委投票部署到 Monad Testnet。',
    creator: '0x9a4D5E408F58a9c71d21934dC52F587E49cD9280',
    votes: 9,
  },
]

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
})

function App() {
  const [snapshot, setSnapshot] = useState<GmonadsSnapshot>(fallbackSnapshot)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true)
  const [snapshotError, setSnapshotError] = useState('')
  const [account, setAccount] = useState<Address>()
  const [projects, setProjects] = useState<Project[]>(demoProjects)
  const [form, setForm] = useState({ name: '', pitch: '' })
  const [txStatus, setTxStatus] = useState('')
  const [isTxPending, setIsTxPending] = useState(false)

  const isChainEnabled = Boolean(contractAddress)
  const totalVotes = projects.reduce((sum, project) => sum + project.votes, 0)
  const leader = [...projects].sort((a, b) => b.votes - a.votes)[0]

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

  const refreshSnapshot = async () => {
    setIsLoadingSnapshot(true)
    setSnapshotError('')
    try {
      const next = await fetchGmonadsSnapshot('mainnet')
      setSnapshot(next)
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : '无法读取 gmonads 数据')
      setSnapshot(fallbackSnapshot)
    } finally {
      setIsLoadingSnapshot(false)
    }
  }

  const loadProjects = async () => {
    if (!contractAddress) return

    const contract = getContract({
      address: contractAddress,
      abi: blitzBoardAbi,
      client: publicClient,
    })
    const rawProjects = await contract.read.getProjects()
    setProjects(
      rawProjects.map((project) => ({
        id: Number(project.id),
        name: project.name,
        pitch: project.pitch,
        creator: project.creator,
        votes: Number(project.votes),
      })),
    )
  }

  useEffect(() => {
    const initialize = async () => {
      await Promise.allSettled([refreshSnapshot(), loadProjects()])
    }

    void initialize()

    const timer = window.setInterval(() => {
      void refreshSnapshot()
      void loadProjects()
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  const connectWallet = async () => {
    if (!window.ethereum) {
      setTxStatus('请先安装 MetaMask 或兼容 EVM 钱包。')
      return
    }

    const [address] = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as Address[]
    setAccount(address)
    await switchToMonadTestnet()
  }

  const getWalletClient = (activeAccount: Address) => {
    if (!window.ethereum) throw new Error('没有检测到钱包')

    return createWalletClient({
      account: activeAccount,
      chain: monadTestnet,
      transport: custom(window.ethereum),
    })
  }

  const registerProject = async () => {
    if (!contractAddress) {
      const nextProject: Project = {
        id: projects.length,
        name: form.name || 'Untitled Blitz',
        pitch: form.pitch || '现场演示项目，等待部署到 Monad Testnet。',
        creator: account ?? demoProjects[0].creator,
        votes: 0,
      }
      setProjects((current) => [nextProject, ...current])
      setForm({ name: '', pitch: '' })
      setTxStatus('演示模式已添加。本项目部署合约后会写入 Monad Testnet。')
      return
    }

    let activeAccount = account
    if (!activeAccount) {
      await connectWallet()
      const accounts = (await window.ethereum?.request({
        method: 'eth_accounts',
      })) as Address[] | undefined
      activeAccount = accounts?.[0]
      if (!activeAccount) {
        setTxStatus('钱包未连接，无法发送交易。')
        return
      }
      setAccount(activeAccount)
    }
    setIsTxPending(true)
    setTxStatus('正在发送项目登记交易...')

    try {
      const walletClient = getWalletClient(activeAccount)
      const hash = await walletClient.writeContract({
        account: activeAccount,
        address: contractAddress,
        abi: blitzBoardAbi,
        functionName: 'registerProject',
        args: [form.name, form.pitch],
      })
      setTxStatus(`交易已提交：${shortAddress(hash)}`)
      await publicClient.waitForTransactionReceipt({ hash })
      setForm({ name: '', pitch: '' })
      await loadProjects()
      setTxStatus('项目已写入 Monad Testnet。')
    } catch (error) {
      setTxStatus(error instanceof Error ? error.message : '交易失败')
    } finally {
      setIsTxPending(false)
    }
  }

  const voteForProject = async (projectId: number) => {
    if (!contractAddress) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, votes: project.votes + 1 } : project,
        ),
      )
      setTxStatus('演示模式已投票。部署合约后会执行链上投票。')
      return
    }

    let activeAccount = account
    if (!activeAccount) {
      await connectWallet()
      const accounts = (await window.ethereum?.request({
        method: 'eth_accounts',
      })) as Address[] | undefined
      activeAccount = accounts?.[0]
      if (!activeAccount) {
        setTxStatus('钱包未连接，无法发送交易。')
        return
      }
      setAccount(activeAccount)
    }
    setIsTxPending(true)
    setTxStatus(`正在为 #${projectId} 投票...`)

    try {
      const walletClient = getWalletClient(activeAccount)
      const hash = await walletClient.writeContract({
        account: activeAccount,
        address: contractAddress,
        abi: blitzBoardAbi,
        functionName: 'vote',
        args: [BigInt(projectId)],
      })
      setTxStatus(`投票交易已提交：${shortAddress(hash)}`)
      await publicClient.waitForTransactionReceipt({ hash })
      await loadProjects()
      setTxStatus('投票已在 Monad Testnet 确认。')
    } catch (error) {
      setTxStatus(error instanceof Error ? error.message : '投票失败')
    } finally {
      setIsTxPending(false)
    }
  }

  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow">
            <CircleDot size={16} />
            Monad Blitz project
          </div>
          <h1>Monad Pulse Arena</h1>
          <p>
            一个把 Monad 实时网络状态、项目登记和评委投票放在同一屏的 5 分钟演示应用。
            数据来自 gmonads，合约可部署到 Monad Testnet。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-action" onClick={connectWallet}>
              <Wallet size={18} />
              {account ? shortAddress(account) : '连接钱包'}
            </button>
            <a href="https://docs.monad.xyz/" target="_blank" rel="noreferrer" className="ghost-action">
              <Code2 size={18} />
              Monad Docs
            </a>
          </div>
        </div>
        <div className="live-panel" aria-label="Monad live network dashboard">
          <div className="panel-topline">
            <span>
              <Network size={16} />
              gmonads live feed
            </span>
            <button type="button" onClick={refreshSnapshot} disabled={isLoadingSnapshot}>
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
              <Database size={16} />
              Product meaning
            </span>
            <h2>把 Monad 的速度变成现场可感知的产品</h2>
          </div>
          <p>
            评委看到的不只是链上概念，而是实时吞吐、验证者状态，以及直接写入 Monad 的登记与投票流程。
          </p>
        </div>
        <div className="feature-row">
          <article>
            <BarChart3 size={24} />
            <h3>实时网络视图</h3>
            <p>每 30 秒读取 gmonads 的区块和验证者 API，适合演示 Monad 主网正在发生的事。</p>
          </article>
          <article>
            <Vote size={24} />
            <h3>链上项目登记</h3>
            <p>参赛项目名称、简介和创建者地址由 Solidity 合约保存，部署后可公开验证。</p>
          </article>
          <article>
            <Users size={24} />
            <h3>一人一票评审</h3>
            <p>合约限制同一地址只能投一次，投票事件可被浏览器和索引器追踪。</p>
          </article>
        </div>
      </section>

      <section className="arena-layout">
        <div className="submission-panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">
                <Sparkles size={16} />
                Submit
              </span>
              <h2>登记一个 Monad Blitz 项目</h2>
            </div>
            <p>{isChainEnabled ? '当前会写入 Monad Testnet。' : '当前为演示模式，部署合约后自动切换链上写入。'}</p>
          </div>
          <label>
            项目名称
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="例如 PulseBoard"
              maxLength={48}
            />
          </label>
          <label>
            一句话亮点
            <textarea
              value={form.pitch}
              onChange={(event) => setForm((current) => ({ ...current, pitch: event.target.value }))}
              placeholder="说明它如何用到 Monad 的速度、EVM 兼容或实时数据。"
              maxLength={180}
            />
          </label>
          <button
            type="button"
            className="primary-action wide"
            onClick={registerProject}
            disabled={isTxPending || (!form.name && !form.pitch)}
          >
            {isTxPending ? <Loader2 className="spin" size={18} /> : <GitBranch size={18} />}
            提交项目
          </button>
          {txStatus && <p className="tx-status">{txStatus}</p>}
        </div>

        <div className="leaderboard">
          <div className="leader-card">
            <Medal size={30} />
            <div>
              <span>当前领先</span>
              <strong>{leader?.name}</strong>
            </div>
            <b>{leader?.votes ?? 0} votes</b>
          </div>
          <div className="project-list">
            {projects.map((project) => {
              const share = totalVotes ? (project.votes / totalVotes) * 100 : 0

              return (
                <article className="project-card" key={project.id}>
                  <div className="project-head">
                    <div>
                      <span>#{project.id}</span>
                      <h3>{project.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => voteForProject(project.id)}
                      disabled={isTxPending}
                      title="Vote"
                    >
                      <Vote size={17} />
                    </button>
                  </div>
                  <p>{project.pitch}</p>
                  <div className="vote-meter" aria-label={`${project.name} vote share`}>
                    <span style={{ width: `${Math.max(share, 4)}%` }} />
                  </div>
                  <div className="project-meta">
                    <span>{shortAddress(project.creator)}</span>
                    <strong>
                      {project.votes} votes · {formatPercent(share)}
                    </strong>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="deploy-band">
        <div>
          <span className="eyebrow">
            <ArrowUpRight size={16} />
            Monad deployment
          </span>
          <h2>演示路径</h2>
        </div>
        <ol>
          <li>展示主网 TPS、BPS、验证者数量来自 gmonads API。</li>
          <li>连接钱包并切换 Monad Testnet。</li>
          <li>部署 `BlitzBoard.sol` 后登记项目、投票，交易可在 MonadVision 查看。</li>
        </ol>
      </section>
    </main>
  )
}

export default App
