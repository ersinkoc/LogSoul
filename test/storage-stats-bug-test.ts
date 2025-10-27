/**
 * Test case for requests_per_minute calculation bug in Storage.getDomainStats()
 *
 * Bug: The method incorrectly used parseInt(timeRange) which returns the numeric
 * prefix (e.g., parseInt('24h') = 24) instead of converting to actual minutes (1440).
 *
 * This test fails with the buggy code and passes with the fix.
 */

import * as fs from 'fs';
import { Storage } from '../src/storage';
import { LogEntry } from '../src/types';

const TEST_DB_PATH = './test-storage-bug.db';

async function runTest() {
  console.log('🧪 Testing Storage.getDomainStats() requests_per_minute calculation\n');

  // Clean up any existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const storage = new Storage(TEST_DB_PATH);

  // Wait for database initialization
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    // Add a test domain
    const domainId = await storage.addDomain('test.example.com');
    console.log(`✓ Created test domain with ID: ${domainId}`);

    // Create test log entries
    // We'll insert exactly 1440 requests spread over the last 24 hours
    // This should give us exactly 1 request per minute
    const now = new Date();
    const logs: LogEntry[] = [];

    for (let i = 0; i < 1440; i++) {
      const timestamp = new Date(now.getTime() - (i * 60 * 1000)); // Each request 1 minute apart
      logs.push({
        domain_id: domainId,
        timestamp: timestamp,
        ip: '192.168.1.1',
        method: 'GET',
        path: '/test',
        status: 200,
        size: 1024,
        raw_line: 'test log line'
      });
    }

    await storage.insertLogs(logs);
    console.log(`✓ Inserted ${logs.length} test log entries\n`);

    // Test different time ranges
    const testCases = [
      { timeRange: '1h', totalRequests: 60, expectedRPM: 1.0, description: '60 requests in 1 hour' },
      { timeRange: '24h', totalRequests: 1440, expectedRPM: 1.0, description: '1440 requests in 24 hours' },
      { timeRange: '7d', totalRequests: 1440, expectedRPM: 1440 / (7 * 24 * 60), description: '1440 requests in 7 days' },
      { timeRange: '30d', totalRequests: 1440, expectedRPM: 1440 / (30 * 24 * 60), description: '1440 requests in 30 days' }
    ];

    let allTestsPassed = true;

    for (const testCase of testCases) {
      const stats = await storage.getDomainStats(domainId, testCase.timeRange);

      if (!stats) {
        console.log(`❌ FAIL: No stats returned for timeRange '${testCase.timeRange}'`);
        allTestsPassed = false;
        continue;
      }

      const actualRPM = stats.requests_per_minute;
      const expectedRPM = testCase.expectedRPM;

      // Allow for small floating point differences
      const tolerance = 0.01;
      const isCorrect = Math.abs(actualRPM - expectedRPM) < tolerance;

      console.log(`\nTest: ${testCase.description} (timeRange: '${testCase.timeRange}')`);
      console.log(`  Expected requests_per_minute: ${expectedRPM.toFixed(4)}`);
      console.log(`  Actual requests_per_minute:   ${actualRPM.toFixed(4)}`);

      if (isCorrect) {
        console.log(`  ✅ PASS - Calculation is correct!`);
      } else {
        console.log(`  ❌ FAIL - Calculation is incorrect!`);

        // Show what the buggy calculation would have produced
        const buggyResult = stats.requests_per_minute;
        console.log(`  💡 With the bug, this would have been off by ${((buggyResult / expectedRPM) - 1) * 100}%`);
        allTestsPassed = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
      console.log('✅ All tests PASSED! The bug is fixed.');
      console.log('='.repeat(60));
    } else {
      console.log('❌ Some tests FAILED! The bug still exists.');
      console.log('='.repeat(60));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    // Clean up
    await storage.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    console.log('\n🧹 Cleaned up test database');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
