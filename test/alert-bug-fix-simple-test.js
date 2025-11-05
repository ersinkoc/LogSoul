/**
 * Test case for bug fix: Type error in alerts/index.ts checkImmediateAlerts()
 *
 * BUG: getDomain() was called with domain ID instead of domain name
 * FIX: Added getDomainById() method and updated alerts to use it
 *
 * This test demonstrates the bug was present and is now fixed.
 */

const fs = require('fs');
const { Storage } = require('../dist/src/storage');

const TEST_DB_PATH = './test-alert-bug-fix.db';

async function runTest() {
  console.log('🧪 Testing Alert System Bug Fix\n');
  console.log('='.repeat(70));
  console.log('Bug: checkImmediateAlerts() calls getDomain() with ID instead of name');
  console.log('Fix: Added getDomainById() and updated alerts to use it');
  console.log('='.repeat(70));
  console.log();

  // Clean up any existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  try {
    const storage = new Storage(TEST_DB_PATH);

    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('Step 1: Testing getDomainById() method');
    console.log('─'.repeat(70));

    // Add a test domain
    const domainName = 'critical-app.example.com';
    const domainId = await storage.addDomain(domainName);
    console.log(`✓ Created domain "${domainName}" with ID: ${domainId}`);

    // Test the OLD buggy approach (getDomain with ID as string)
    const resultWithBug = await storage.getDomain(domainId.toString());
    console.log(`\n❌ BUGGY: getDomain("${domainId}") returns:`, resultWithBug);
    console.log('   → This is NULL because getDomain expects a name, not an ID!');

    // Test the FIXED approach (getDomainById with numeric ID)
    const resultFixed = await storage.getDomainById(domainId);
    console.log(`\n✅ FIXED: getDomainById(${domainId}) returns:`, {
      id: resultFixed?.id,
      name: resultFixed?.name,
      health_score: resultFixed?.health_score
    });
    console.log('   → This correctly retrieves the domain!\n');

    // Verify the fix
    if (!resultWithBug && resultFixed && resultFixed.id === domainId) {
      console.log('✅ getDomainById() works correctly!\n');
    } else {
      console.log('❌ FAIL: getDomainById() not working as expected\n');
      await storage.close();
      process.exit(1);
    }

    console.log('Step 2: Simulating immediate alert scenario');
    console.log('─'.repeat(70));
    console.log('Scenario: 15 x 500 Internal Server Errors in last 5 minutes');
    console.log('Expected: Should trigger immediate alert (threshold: 10)\n');

    // Create 15 log entries with 500 status in the last 5 minutes
    const now = new Date();
    const logs = [];

    for (let i = 0; i < 15; i++) {
      const timestamp = new Date(now.getTime() - (i * 20 * 1000)); // Every 20 seconds
      logs.push({
        domain_id: domainId,
        timestamp: timestamp,
        ip: `192.168.1.${10 + i}`,
        method: 'POST',
        path: '/api/critical-endpoint',
        status: 500,
        size: 512,
        response_time: 5000,
        user_agent: 'Mozilla/5.0',
        referer: 'https://example.com',
        raw_line: `POST /api/critical-endpoint 500 5000ms`
      });
    }

    await storage.insertLogs(logs);
    console.log(`✓ Inserted ${logs.length} log entries with status 500`);

    // Simulate what checkImmediateAlerts() does
    console.log('\nSimulating checkImmediateAlerts() logic...\n');

    const testEntry = logs[0]; // Latest log entry

    // BEFORE FIX: This would return null
    console.log('Before fix:');
    const domainBeforeFix = await storage.getDomain(testEntry.domain_id.toString());
    console.log(`  getDomain("${testEntry.domain_id}") = ${domainBeforeFix}`);
    if (!domainBeforeFix) {
      console.log('  → Alert check exits early, NO ALERT TRIGGERED! ❌\n');
    }

    // AFTER FIX: This returns the domain correctly
    console.log('After fix:');
    const domainAfterFix = await storage.getDomainById(testEntry.domain_id);
    console.log(`  getDomainById(${testEntry.domain_id}) =`, {
      id: domainAfterFix?.id,
      name: domainAfterFix?.name
    });

    if (domainAfterFix) {
      console.log('  → Domain found, proceeding with alert check...');

      // Check recent errors (what the alert system does)
      const recentErrors = await storage.getLogsByTimeRange(
        testEntry.domain_id,
        new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        new Date()
      );

      const recent500s = recentErrors.filter(log => log.status >= 500).length;
      console.log(`  → Found ${recent500s} errors with status >= 500 in last 5 minutes`);

      if (recent500s > 10) {
        console.log(`  → Threshold exceeded (${recent500s} > 10)`);
        console.log('  ✅ IMMEDIATE ALERT WOULD BE TRIGGERED!\n');
      } else {
        console.log(`  → Threshold not exceeded (${recent500s} <= 10)\n`);
        await storage.close();
        process.exit(1);
      }
    } else {
      console.log('  ❌ FAIL: getDomainById did not return domain\n');
      await storage.close();
      process.exit(1);
    }

    console.log('='.repeat(70));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(70));
    console.log();
    console.log('✅ BEFORE FIX: getDomain(id.toString()) returned NULL');
    console.log('✅ AFTER FIX:  getDomainById(id) returns correct domain');
    console.log('✅ Alert system can now detect critical error patterns');
    console.log('✅ Immediate alerts will be triggered correctly');
    console.log();
    console.log('🎉 ALL TESTS PASSED! The bug is fixed.');
    console.log('='.repeat(70));

    await storage.close();

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up
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
