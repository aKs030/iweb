import { __test__ } from './functions/api/ai-agent.js';

const { resolveUserIdentity } = __test__;

const mockEnv = {
  JULES_MEMORY_KV: {
    get: async (key) => {
      console.log('KV GET:', key);
      if (key === 'username:thomas') return 'old-user-id-123';
      return null;
    },
    list: async (options) => {
      console.log('KV LIST:', options);
      return { keys: [], list_complete: true };
    },
    put: async () => {},
    delete: async () => {},
  },
};

async function runTest() {
  const request = {
    headers: {
      get: () => null,
    },
  };

  const result = await resolveUserIdentity(
    request,
    'new-random-user-id-456',
    'Ich bin Thomas',
    mockEnv,
    { memoryRetentionDays: 30 },
  );

  console.log('Identity Result:', result);
}

runTest();
