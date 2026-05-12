export const pulseProofAbi = [
  {
    type: 'function',
    name: 'runPulse',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ name: 'pulseId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPulses',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'runner', type: 'address' },
          { name: 'label', type: 'string' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'observedBlock', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'pulseCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'pulseCountByRunner',
    stateMutability: 'view',
    inputs: [{ name: 'runner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'PulseRecorded',
    inputs: [
      { name: 'pulseId', type: 'uint256', indexed: true },
      { name: 'runner', type: 'address', indexed: true },
      { name: 'label', type: 'string', indexed: false },
      { name: 'observedBlock', type: 'uint256', indexed: false },
      { name: 'createdAt', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
] as const
