import 'dotenv/config'
import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem'
import { configVariable, defineConfig } from 'hardhat/config'

const solidityProfile = {
  version: '0.8.28',
  settings: {
    evmVersion: 'prague',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
} as const

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: solidityProfile,
    },
  },
  networks: {
    hardhatMainnet: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    monadTestnet: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('MONAD_TESTNET_RPC_URL'),
      accounts: [configVariable('PRIVATE_KEY')],
    },
    monadMainnet: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('MONAD_MAINNET_RPC_URL'),
      accounts: [configVariable('PRIVATE_KEY')],
    },
  },
})
