declare class LogSoulBenchmark {
    private parser;
    private storage;
    private analyzer;
    private results;
    constructor();
    runAllBenchmarks(): Promise<void>;
    private benchmark;
    private benchmarkLogParsing;
    private benchmarkMultiFormatParsing;
    private benchmarkDatabaseOperations;
    private benchmarkBulkInserts;
    private benchmarkDomainAnalysis;
    private benchmarkSecurityDetection;
    private benchmarkMemoryUsage;
    private printResults;
}
export { LogSoulBenchmark };
//# sourceMappingURL=benchmark.d.ts.map