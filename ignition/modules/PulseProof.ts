import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('PulseProofModule', (m) => {
  const pulseProof = m.contract('PulseProof')

  return { pulseProof }
})
