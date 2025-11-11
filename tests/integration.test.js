const http = require('http');
const assert = require('assert');
const { registerDevice } = require('../src/deviceManager');

describe('Integration Test', () => {
  it('should register device and return signature', async () => {
    const uuid = 'test-uuid-123';
    const signature = await registerDevice(uuid);
    assert.ok(signature);
  });
});
