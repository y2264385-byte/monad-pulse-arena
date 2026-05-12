export const blitzBoardAbi = [
  {
    type: 'function',
    name: 'registerProject',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'pitch', type: 'string' },
    ],
    outputs: [{ name: 'projectId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'vote',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getProjects',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'pitch', type: 'string' },
          { name: 'votes', type: 'uint256' },
          { name: 'createdAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'projectCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasVoted',
    stateMutability: 'view',
    inputs: [{ name: 'voter', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'ProjectRegistered',
    inputs: [
      { name: 'projectId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'pitch', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Voted',
    inputs: [
      { name: 'projectId', type: 'uint256', indexed: true },
      { name: 'voter', type: 'address', indexed: true },
      { name: 'votes', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const
