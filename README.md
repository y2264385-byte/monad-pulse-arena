# Monad Pulse Lab

Monad Pulse Lab is a Monad Blitz demo that makes the transaction path visible.
It combines live gmonads network telemetry with a real Monad Testnet contract
call, then turns the transaction receipt into a compact execution proof.

## What It Shows

1. Read live Monad network state from gmonads: TPS, blocks per second, block time,
   validator count, epoch and recent TPS pulse.
2. Connect an EVM wallet and switch to Monad Testnet.
3. Run a Pulse Check by sending `runPulse(label)` to `PulseProof.sol`.
4. Wait for the receipt and display transaction hash, confirmation latency, gas
   used, receipt block and MonadVision links.
5. Load recent on-chain pulse records from the deployed contract.

## Why It Matters

The project is not a voting app or a generic dashboard. It is a small developer
experience probe for Monad: a user can see current network conditions, submit a
real transaction, and verify the result from both the UI and the block explorer.

## Live Demo

- App: https://monad-pulse-arena.vercel.app
- GitHub: https://github.com/y2264385-byte/monad-pulse-arena
- Contract: https://testnet.monadvision.com/address/0x35d42feD97705034BA4613f2e0bFE14309852472

## Tech Stack

- React + TypeScript + Vite
- Viem for wallet, contract calls and receipt reads
- Solidity `PulseProof.sol`
- Hardhat 3 + Ignition
- Monad Testnet: chain id `10143`
- gmonads public API for realtime network data

## Run Locally

```bash
npm install
npm run dev
```

## Deploy To Monad Testnet

Create `.env` from the example:

```bash
cp .env.example .env
```

Fill in `PRIVATE_KEY` and `MONAD_TESTNET_RPC_URL`, then compile and deploy:

```bash
npm run compile
npm run deploy:monad
```

After deployment, copy the deployed contract address into:

```env
VITE_PULSE_PROOF_ADDRESS=0xYourContractAddress
PULSE_PROOF_ADDRESS=0xYourContractAddress
```

Seed a few demo pulses if needed:

```bash
npm run seed:monad
```

## Current Monad Testnet Deployment

- `PulseProof`: `0x35d42feD97705034BA4613f2e0bFE14309852472`
- Seed records:
  - `Baseline wallet-to-receipt probe`
  - `gmonads telemetry context check`
  - `Live demo execution proof`

## Contract

`contracts/PulseProof.sol` stores:

- pulse id
- runner address
- run label
- created timestamp
- observed block number
- per-runner pulse count

Events:

- `PulseRecorded`

## Public Sources Used

- Monad docs: https://docs.monad.xyz/
- gmonads: https://www.gmonads.com/
