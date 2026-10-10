/**
 * Tests for reconciliation module
 */

import { reconcile, groupByIdentity } from '../backend/reconcile.js';
import assert from 'assert';

// Test fixtures
const mockHostService = {
  identityKey: 'host:127.0.0.1:3000',
  source: 'host',
  type: 'tcp_listener',
  friendlyName: null,
  detectedName: 'node',
  address: '127.0.0.1',
  port: 3000,
  pid: 12345,
  containerId: null,
  containerName: null,
  imageName: null,
  httpStatus: 'responding',
  httpStatusCode: 200,
  httpLatency: 10,
  lastProbed: Date.now(),
  lastSeen: Date.now(),
  status: 'http_responding',
  sources: ['host'],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const mockDockerService = {
  identityKey: 'docker:abc123',
  source: 'docker',
  type: 'docker_container',
  friendlyName: null,
  detectedName: 'my-app',
  address: null,
  port: 3000,
  pid: null,
  containerId: 'abc123',
  containerName: 'my-app',
  imageName: 'my-image:latest',
  httpStatus: null,
  httpStatusCode: null,
  httpLatency: null,
  lastProbed: null,
  lastSeen: Date.now(),
  status: 'running',
  dockerHealth: { status: 'healthy' },
  sources: ['docker'],
  ports: [{ hostPort: 3000, containerPort: 3000, protocol: 'tcp' }],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// Test 1: Basic reconciliation - matching ports
const test1Host = [mockHostService];
const test1Docker = [mockDockerService];
const result1 = reconcile(test1Host, test1Docker);

assert.strictEqual(result1.length, 1, 'Should have 1 reconciled service');
assert.strictEqual(result1[0].sources.length, 2, 'Should have 2 sources');
assert.ok(result1[0].sources.includes('host'), 'Should include host source');
assert.ok(result1[0].sources.includes('docker'), 'Should include docker source');
assert.strictEqual(result1[0].containerName, 'my-app', 'Should have container name');
assert.strictEqual(result1[0].imageName, 'my-image:latest', 'Should have image name');
assert.strictEqual(result1[0].httpStatusCode, 200, 'Should preserve HTTP probe results');
console.log('✅ Test 1 passed: Basic reconciliation with matching ports');

// Test 2: Host service with no matching docker
const test2Host = [{
  ...mockHostService,
  identityKey: 'host:127.0.0.1:4000',
  port: 4000
}];
const test2Docker = [mockDockerService];
const result2 = reconcile(test2Host, test2Docker);

assert.strictEqual(result2.length, 2, 'Should have 2 services (no match)');
console.log('✅ Test 2 passed: Host service with no matching docker');

// Test 3: Docker service with no matching host
const test3Host = [mockHostService];
const test3Docker = [{
  ...mockDockerService,
  identityKey: 'docker:def456',
  ports: [{ hostPort: 5000, containerPort: 5000, protocol: 'tcp' }]
}];
const result3 = reconcile(test3Host, test3Docker);

assert.strictEqual(result3.length, 2, 'Should have 2 services (no match)');
console.log('✅ Test 3 passed: Docker service with no matching host');

// Test 4: Multiple docker ports - match on any
const test4Host = [{
  ...mockHostService,
  identityKey: 'host:127.0.0.1:8080',
  port: 8080
}];
const test4Docker = [{
  ...mockDockerService,
  identityKey: 'docker:multi',
  ports: [
    { hostPort: 3000, containerPort: 3000, protocol: 'tcp' },
    { hostPort: 8080, containerPort: 8080, protocol: 'tcp' }
  ]
}];
const result4 = reconcile(test4Host, test4Docker);

assert.strictEqual(result4.length, 1, 'Should match on one of multiple ports');
assert.ok(result4[0].sources.includes('docker'), 'Should include docker source');
console.log('✅ Test 4 passed: Multiple docker ports - match on any');

// Test 5: groupByIdentity function
const grouped = groupByIdentity(result1);
assert.ok(grouped['host:127.0.0.1:3000|docker:abc123'], 'Should have grouped key');
console.log('✅ Test 5 passed: groupByIdentity function');

console.log('\n🎉 All tests passed!');