# Code Changes: Bug Fix for requests_per_minute Calculation

## File Modified: `src/storage/index.ts`

### Change 1: Added Helper Method (NEW CODE - Lines 262-270)

```typescript
+ private timeRangeToMinutes(timeRange: string): number {
+   const timeRangeMinutes: { [key: string]: number } = {
+     '1h': 60,
+     '24h': 1440,
+     '7d': 10080,
+     '30d': 43200
+   };
+   return timeRangeMinutes[timeRange] || 60;
+ }
```

**Purpose:** Properly converts time range strings to actual minutes.

---

### Change 2: Updated Calculation (Modified Line 302)

**BEFORE (Buggy):**
```typescript
  const stats: DomainStats = {
    domain: row.domain,
-   requests_per_minute: row.total_requests / (parseInt(timeRange) || 60),
    error_rate: (row.error_count / row.total_requests) * 100,
    avg_response_time: row.avg_response_time || 0,
    traffic_volume: row.total_bandwidth || 0,
    unique_ips: row.unique_ips || 0,
    health_score: row.health_score || 100
  };
```

**AFTER (Fixed):**
```typescript
  const stats: DomainStats = {
    domain: row.domain,
+   requests_per_minute: row.total_requests / this.timeRangeToMinutes(timeRange),
    error_rate: (row.error_count / row.total_requests) * 100,
    avg_response_time: row.avg_response_time || 0,
    traffic_volume: row.total_bandwidth || 0,
    unique_ips: row.unique_ips || 0,
    health_score: row.health_score || 100
  };
```

**Purpose:** Use the correct helper method instead of buggy parseInt().

---

## Complete Context

### Method: `getDomainStats()` (Full View After Fix)

```typescript
262  private timeRangeToMinutes(timeRange: string): number {
263    const timeRangeMinutes: { [key: string]: number } = {
264      '1h': 60,
265      '24h': 1440,
266      '7d': 10080,
267      '30d': 43200
268    };
269    return timeRangeMinutes[timeRange] || 60;
270  }
271
272  async getDomainStats(domainId: number, timeRange: string = '1h'): Promise<DomainStats | null> {
273    const timeRangeMap: { [key: string]: string } = {
274      '1h': '-1 hour',
275      '24h': '-24 hours',
276      '7d': '-7 days',
277      '30d': '-30 days'
278    };
279
280    const timeOffset = timeRangeMap[timeRange] || '-1 hour';
281
282    return new Promise((resolve, reject) => {
283      this.db.get(`
284        SELECT
285          d.name as domain,
286          COUNT(*) as total_requests,
287          COUNT(CASE WHEN l.status >= 400 THEN 1 END) as error_count,
288          AVG(l.response_time) as avg_response_time,
289          SUM(l.size) as total_bandwidth,
290          COUNT(DISTINCT l.ip) as unique_ips,
291          d.health_score
292        FROM logs l
293        JOIN domains d ON l.domain_id = d.id
294        WHERE l.domain_id = ?
295        AND l.timestamp >= datetime('now', ?)
296      `, [domainId, timeOffset], (err, row: any) => {
297        if (err) {
298          reject(err);
299        } else if (row && row.total_requests > 0) {
300          const stats: DomainStats = {
301            domain: row.domain,
302 ➜          requests_per_minute: row.total_requests / this.timeRangeToMinutes(timeRange),
303            error_rate: (row.error_count / row.total_requests) * 100,
304            avg_response_time: row.avg_response_time || 0,
305            traffic_volume: row.total_bandwidth || 0,
306            unique_ips: row.unique_ips || 0,
307            health_score: row.health_score || 100
308          };
309          resolve(stats);
310        } else {
311          resolve(null);
312        }
313      });
314    });
315  }
```

**Line 302 (marked with ➜)** is where the fix was applied.

---

## Summary of Changes

| Aspect | Count | Description |
|--------|-------|-------------|
| **Files Modified** | 1 | `src/storage/index.ts` |
| **Lines Added** | 9 | Helper method (262-270) |
| **Lines Modified** | 1 | Calculation fix (302) |
| **Total Changes** | 10 lines | Minimal, focused fix |
| **Breaking Changes** | 0 | Fully backward compatible |

---

## Verification

To see the diff in your repository:

```bash
git diff src/storage/index.ts
```

To verify the fix is working:

```bash
node test/unit-test-fix.js
```

---

## Integration Points

This fix affects the following calculated metric in `DomainStats`:

```typescript
interface DomainStats {
  domain: string;
  requests_per_minute: number;  // ← THIS VALUE IS NOW CORRECT
  error_rate: number;
  avg_response_time: number;
  traffic_volume: number;
  unique_ips: number;
  health_score: number;
}
```

All consumers of this interface automatically receive the corrected values.
