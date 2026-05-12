# Monad Pulse Arena

Monad Pulse Arena is a fresh Monad Blitz project built for a 5 minute live demo. It combines:

- a React dashboard that reads live Monad network stats from the public gmonads API
- a Solidity `BlitzBoard` contract for project registration and one-address-one-vote judging
- Hardhat 3 configuration for Monad Testnet deployment

## Demo Story

1. Open the app and show real Monad network activity: TPS, blocks per second, block time, validator count, epoch and recent TPS pulse.
2. Connect an EVM wallet and switch to Monad Testnet.
3. Register a project and vote. In demo mode it updates locally; after deployment it writes to `BlitzBoard.sol` on Monad Testnet.

## Tech Stack

- React + TypeScript + Vite
- Viem for wallet and contract calls
- Hardhat 3 + Ignition
- Monad Testnet: chain id `10143`, RPC `https://testnet-rpc.monad.xyz`
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

Fill in `PRIVATE_KEY`, then compile and deploy:

```bash
npm run compile
npm run deploy:monad
```

After deployment, copy the deployed contract address into:

```env
VITE_BLITZ_BOARD_ADDRESS=0xYourContractAddress
```

Restart `npm run dev`. The frontend will switch from local demo mode to on-chain mode.

## Current Monad Testnet Deployment

- `BlitzBoard`: `0x0d29f018EE2662597D431B237f26110cba8851c4`
- Seed projects: `PulseBoard`, `Validator Lens`, `Blitz Votes`

## Contract

`contracts/BlitzBoard.sol` stores:

- project id, creator, name, pitch, created timestamp
- vote count per project
- `hasVoted` mapping to enforce one vote per wallet

Events:

- `ProjectRegistered`
- `Voted`

## Public Sources Used

- Monad docs: https://docs.monad.xyz/
- gmonads: https://www.gmonads.com/
