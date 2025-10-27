/**
 * Demonstration of the bug in Storage.getDomainStats()
 * This script shows the difference between the buggy and fixed calculations
 */

console.log('=' .repeat(70));
console.log('BUG DEMONSTRATION: requests_per_minute calculation in getDomainStats()');
console.log('='.repeat(70));
console.log();

// Test cases with known request counts over different time periods
const testCases = [
  { timeRange: '1h', totalRequests: 1000, description: '1000 requests in 1 hour' },
  { timeRange: '24h', totalRequests: 1440, description: '1440 requests in 24 hours' },
  { timeRange: '7d', totalRequests: 10080, description: '10080 requests in 7 days' },
  { timeRange: '30d', totalRequests: 43200, description: '43200 requests in 30 days' }
];

// BUGGY implementation (what the code was doing before the fix)
function buggyCalculation(totalRequests, timeRange) {
  // This is what the old code did: parseInt(timeRange) || 60
  // For '24h', this returns 24 instead of 1440 minutes!
  return totalRequests / (parseInt(timeRange) || 60);
}

// CORRECT implementation (what the code does after the fix)
function correctCalculation(totalRequests, timeRange) {
  const timeRangeMinutes = {
    '1h': 60,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200
  };
  return totalRequests / (timeRangeMinutes[timeRange] || 60);
}

console.log('Comparing BUGGY vs FIXED calculations:\n');

for (const testCase of testCases) {
  const buggyResult = buggyCalculation(testCase.totalRequests, testCase.timeRange);
  const correctResult = correctCalculation(testCase.totalRequests, testCase.timeRange);
  const errorPercentage = ((buggyResult / correctResult) - 1) * 100;

  console.log(`Test: ${testCase.description}`);
  console.log(`  Time Range: ${testCase.timeRange}`);
  console.log(`  Total Requests: ${testCase.totalRequests}`);
  console.log(`  `);
  console.log(`  ❌ BUGGY calculation:   ${buggyResult.toFixed(4)} req/min`);
  console.log(`  ✅ CORRECT calculation: ${correctResult.toFixed(4)} req/min`);
  console.log(`  `);
  console.log(`  💥 ERROR: ${Math.abs(errorPercentage).toFixed(0)}% ${errorPercentage > 0 ? 'OVER' : 'UNDER'}estimation!`);
  console.log();
}

console.log('='.repeat(70));
console.log('WHY THE BUG OCCURRED:');
console.log('='.repeat(70));
console.log();
console.log('The buggy code used: parseInt(timeRange) || 60');
console.log('');
console.log('  parseInt("1h")   = 1    (should be 60 minutes)');
console.log('  parseInt("24h")  = 24   (should be 1440 minutes)');
console.log('  parseInt("7d")   = 7    (should be 10080 minutes)');
console.log('  parseInt("30d")  = 30   (should be 43200 minutes)');
console.log();
console.log('parseInt() extracts only the numeric prefix, ignoring the unit suffix!');
console.log();
console.log('='.repeat(70));
console.log('THE FIX:');
console.log('='.repeat(70));
console.log();
console.log('Added a helper method timeRangeToMinutes() that correctly maps:');
console.log('  "1h"  -> 60 minutes');
console.log('  "24h" -> 1440 minutes');
console.log('  "7d"  -> 10080 minutes');
console.log('  "30d" -> 43200 minutes');
console.log();
console.log('Location: src/storage/index.ts, line 262-270 (new helper method)');
console.log('          src/storage/index.ts, line 302 (updated calculation)');
console.log('='.repeat(70));
