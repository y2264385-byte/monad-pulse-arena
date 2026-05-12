import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('BlitzBoardModule', (m) => {
  const blitzBoard = m.contract('BlitzBoard')

  return { blitzBoard }
})
