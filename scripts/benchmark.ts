import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { LogParser } from '../src/parser';
import { Storage } from '../src/storage';
import { LogAnalyzer } from '../src/analyzer';

interface BenchmarkResult {
  name: string;
  description: string;
  duration: number; // milliseconds
  operations: number;
  opsPerSecond: number;
  memoryUsed: number; // MB
  success: boolean;
  error?: string;
}

class LogSoulBenchmark {
  private parser: LogParser;
  private storage: Storage;
  private analyzer: LogAnalyzer;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.parser = new LogParser();
    this.storage = new Storage(':memory:'); // Use in-memory database for benchmarks
    this.analyzer = new LogAnalyzer(this.storage);
  }

  async runAllBenchmarks(): Promise<void> {
    console.log('🚀 Starting LogSoul Performance Benchmarks...\n');

    // Parsing benchmarks
    await this.benchmarkLogParsing();
    await this.benchmarkMultiFormatParsing();
    
    // Storage benchmarks
    await this.benchmarkDatabaseOperations();
    await this.benchmarkBulkInserts();
    
    // Analysis benchmarks
    await this.benchmarkDomainAnalysis();
    await this.benchmarkSecurityDetection();
    
    // Memory benchmarks
    await this.benchmarkMemoryUsage();
    
    this.printResults();
  }

  private async benchmark(
    name: string,
    description: string,
    operation: () => Promise<number>
  ): Promise<void> {
    console.log(`📊 Running: ${name}...`);
    
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const startTime = performance.now();
    
    try {
      const operations = await operation();
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;
      const opsPerSecond = operations / (duration / 1000);
      
      this.results.push({
        name,
        description,
        duration,
        operations,
        opsPerSecond,
        memoryUsed,
        success: true
      });
      
      console.log(`   ✅ ${operations.toLocaleString()} ops in ${duration.toFixed(2)}ms (${opsPerSecond.toFixed(0)} ops/sec)`);
    } catch (error) {
      this.results.push({
        name,
        description,
        duration: 0,
        operations: 0,
        opsPerSecond: 0,
        memoryUsed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`   ❌ Failed: ${error}`);
    }
    
    console.log();
  }

  private async benchmarkLogParsing(): Promise<void> {
    await this.benchmark(
      'Nginx Log Parsing',
      'Parse 10,000 Nginx combined format log lines',
      async () => {
        const sampleLine = '192.168.1.100 - - [25/Dec/2023:10:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234 "https://example.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"';
        const format = {
          name: 'nginx_combined',
          pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)".*$/,
          fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
        };
        
        let operations = 0;
        for (let i = 0; i < 10000; i++) {
          const entry = this.parser.parseLine(sampleLine, 1, format);
          if (entry) operations++;
        }
        
        return operations;
      }
    );
  }

  private async benchmarkMultiFormatParsing(): Promise<void> {
    await this.benchmark(
      'Multi-Format Parsing',
      'Parse different log formats (Nginx, Apache, JSON)',
      async () => {
        const samples = [
          {
            line: '192.168.1.100 - - [25/Dec/2023:10:30:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0"',
            format: {
              name: 'nginx_combined',
              pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)".*$/,
              fields: ['ip', 'timestamp', 'method', 'path', 'status', 'size', 'referer', 'user_agent']
            }
          },
          {
            line: '{"timestamp":"2023-12-25T10:30:00Z","ip":"192.168.1.100","method":"GET","path":"/","status":200,"size":1234}',
            format: {
              name: 'json',
              pattern: /^{.+}$/,
              fields: ['json']
            }
          }
        ];
        
        let operations = 0;
        for (let i = 0; i < 5000; i++) {
          for (const sample of samples) {
            const entry = this.parser.parseLine(sample.line, 1, sample.format);
            if (entry) operations++;
          }
        }
        
        return operations;
      }
    );
  }

  private async benchmarkDatabaseOperations(): Promise<void> {
    await this.benchmark(
      'Database Operations',
      'Add domains and fetch operations',
      async () => {
        let operations = 0;
        
        // Add domains
        for (let i = 0; i < 100; i++) {
          await this.storage.addDomain(`example${i}.com`);
          operations++;
        }
        
        // Fetch domains
        for (let i = 0; i < 100; i++) {
          await this.storage.getDomains();
          operations++;
        }
        
        return operations;
      }
    );
  }

  private async benchmarkBulkInserts(): Promise<void> {
    await this.benchmark(
      'Bulk Log Inserts',
      'Insert 1,000 log entries in batches',
      async () => {
        // Ensure we have a domain
        await this.storage.addDomain('benchmark.com');
        
        const logs = [];
        for (let i = 0; i < 1000; i++) {
          logs.push({
            domain_id: 1,
            timestamp: new Date(),
            ip: `192.168.1.${(i % 254) + 1}`,
            method: 'GET',
            path: `/page${i}`,
            status: 200,
            size: 1024 + i,
            raw_line: `Sample log line ${i}`
          });
        }
        
        await this.storage.insertLogs(logs);
        return logs.length;
      }
    );
  }

  private async benchmarkDomainAnalysis(): Promise<void> {
    await this.benchmark(
      'Domain Analysis',
      'Analyze domain with 1,000 log entries',
      async () => {
        // Setup test data
        await this.storage.addDomain('analysis-test.com');
        
        const logs = [];
        for (let i = 0; i < 1000; i++) {
          logs.push({
            domain_id: 1,
            timestamp: new Date(Date.now() - (i * 60000)), // 1 minute intervals
            ip: `192.168.1.${(i % 254) + 1}`,
            method: i % 10 === 0 ? 'POST' : 'GET',
            path: `/page${i % 20}`,
            status: i % 50 === 0 ? 500 : (i % 20 === 0 ? 404 : 200),
            size: 1024 + (i * 10),
            response_time: 100 + (i % 1000),
            raw_line: `Log entry ${i}`
          });
        }
        
        await this.storage.insertLogs(logs);
        
        // Run analysis
        const analysis = await this.analyzer.analyzeDomain('analysis-test.com', '1h');
        
        return 1; // One analysis operation
      }
    );
  }

  private async benchmarkSecurityDetection(): Promise<void> {
    await this.benchmark(
      'Security Threat Detection',
      'Detect threats in 1,000 malicious log entries',
      async () => {
        await this.storage.addDomain('security-test.com');
        
        const attackPatterns = [
          '/admin/config.php?id=1\' OR \'1\'=\'1',
          '/search?q=<script>alert(\'xss\')</script>',
          '/../../../etc/passwd',
          '/login.php?redirect=javascript:alert(1)',
          '/api/users?id=1 UNION SELECT * FROM users'
        ];
        
        const logs = [];
        for (let i = 0; i < 1000; i++) {
          logs.push({
            domain_id: 1,
            timestamp: new Date(),
            ip: `185.220.101.${(i % 254) + 1}`,
            method: 'GET',
            path: attackPatterns[i % attackPatterns.length],
            status: 404,
            size: 500,
            user_agent: i % 3 === 0 ? 'sqlmap/1.5' : 'Mozilla/5.0...',
            raw_line: `Attack log ${i}`
          });
        }
        
        await this.storage.insertLogs(logs);
        
        const analysis = await this.analyzer.analyzeDomain('security-test.com', '1h');
        
        return analysis.securityThreats.length;
      }
    );
  }

  private async benchmarkMemoryUsage(): Promise<void> {
    await this.benchmark(
      'Memory Efficiency',
      'Process large dataset and measure memory growth',
      async () => {
        const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        
        // Process a large amount of data
        let operations = 0;
        for (let batch = 0; batch < 10; batch++) {
          const logs = [];
          for (let i = 0; i < 100; i++) {
            logs.push({
              domain_id: 1,
              timestamp: new Date(),
              ip: `10.0.0.${(i % 254) + 1}`,
              method: 'GET',
              path: `/batch${batch}/item${i}`,
              status: 200,
              size: 2048,
              raw_line: `Batch ${batch} item ${i} with some additional data to increase memory usage`
            });
          }
          
          await this.storage.insertLogs(logs);
          operations += logs.length;
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
        
        const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryGrowth = finalMemory - initialMemory;
        
        console.log(`   📊 Memory growth: ${memoryGrowth.toFixed(2)}MB`);
        
        return operations;
      }
    );
  }

  private printResults(): void {
    console.log('📋 Benchmark Results Summary\n');
    console.log('='.repeat(80));
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log('\n✅ Successful Benchmarks:');
      console.log('-'.repeat(80));
      console.log('| Test Name                    | Operations | Ops/Sec    | Duration(ms) | Memory(MB) |');
      console.log('-'.repeat(80));
      
      successful.forEach(result => {
        const name = result.name.padEnd(28);
        const ops = result.operations.toLocaleString().padStart(10);
        const opsPerSec = result.opsPerSecond.toFixed(0).padStart(10);
        const duration = result.duration.toFixed(2).padStart(12);
        const memory = result.memoryUsed.toFixed(2).padStart(10);
        
        console.log(`| ${name} | ${ops} | ${opsPerSec} | ${duration} | ${memory} |`);
      });
      
      console.log('-'.repeat(80));
      
      // Summary statistics
      const avgOpsPerSec = successful.reduce((sum, r) => sum + r.opsPerSecond, 0) / successful.length;
      const totalMemory = successful.reduce((sum, r) => sum + r.memoryUsed, 0);
      
      console.log(`\n📊 Performance Summary:`);
      console.log(`   Average Operations/Second: ${avgOpsPerSec.toFixed(0)}`);
      console.log(`   Total Memory Used: ${totalMemory.toFixed(2)}MB`);
      console.log(`   Success Rate: ${successful.length}/${this.results.length} (${((successful.length / this.results.length) * 100).toFixed(1)}%)`);
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Benchmarks:');
      console.log('-'.repeat(50));
      
      failed.forEach(result => {
        console.log(`   ${result.name}: ${result.error}`);
      });
    }
    
    // Performance targets check
    console.log('\n🎯 Performance Target Check:');
    console.log('-'.repeat(40));
    
    const parsingBench = successful.find(r => r.name === 'Nginx Log Parsing');
    if (parsingBench && parsingBench.opsPerSecond >= 10000) {
      console.log('   ✅ Log Parsing: >10,000 lines/sec');
    } else {
      console.log('   ❌ Log Parsing: <10,000 lines/sec');
    }
    
    const memoryBench = successful.find(r => r.name === 'Memory Efficiency');
    if (memoryBench && memoryBench.memoryUsed < 100) {
      console.log('   ✅ Memory Usage: <100MB for large datasets');
    } else {
      console.log('   ❌ Memory Usage: >100MB for large datasets');
    }
    
    console.log('\n🔮 LogSoul Benchmark Complete!');
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new LogSoulBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}

export { LogSoulBenchmark };