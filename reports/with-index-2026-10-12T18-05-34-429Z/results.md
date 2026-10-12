# DMoney results: PASS

Mode: with-index; run: with-index-2026-10-12T18-05-34-429Z; planned workload: 120.00 seconds; observed: 120.23 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 90 | 1.50 | 0.75 | 19.17 | 39.60 | 42.04 | 0.00 | 0.00 | 100.00 |
| SendMoney | 90 | 1.00 | 0.75 | 20.15 | 27.39 | 39.30 | 0.00 | 0.00 | 100.00 |
| Payment | 210 | 1.75 | 1.75 | 18.82 | 23.88 | 37.02 | 0.00 | 0.00 | 100.00 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 60 | 2.00 | 0.50 | 21.44 | 29.69 | 32.97 | 0.00 | 0.00 | 100.00 |
| p2 | 90 | 3.00 | 0.75 | 19.46 | 27.01 | 42.04 | 0.00 | 0.00 | 100.00 |
| p3 | 120 | 4.00 | 1.00 | 19.41 | 28.00 | 40.68 | 0.00 | 0.00 | 100.00 |
| p4 | 120 | 4.00 | 1.00 | 17.71 | 21.68 | 27.28 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 30 | 1.00 | 0.25 | 21.39 | 28.93 | 31.96 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 30 | 1.00 | 0.25 | 21.49 | 30.59 | 32.97 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 30 | 1.00 | 0.25 | 19.54 | 25.79 | 27.90 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 30 | 1.00 | 0.25 | 19.37 | 32.26 | 42.04 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 30 | 1.00 | 0.25 | 19.45 | 30.65 | 37.02 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 60 | 2.00 | 0.50 | 19.06 | 39.18 | 40.68 | 0.00 | 0.00 | 100.00 |
| SendMoney / p3 | 30 | 1.00 | 0.25 | 19.51 | 24.92 | 39.30 | 0.00 | 0.00 | 100.00 |
| Payment / p3 | 30 | 1.00 | 0.25 | 20.00 | 26.13 | 29.47 | 0.00 | 0.00 | 100.00 |
| Payment / p4 | 120 | 4.00 | 1.00 | 17.71 | 21.68 | 27.28 | 0.00 | 0.00 | 100.00 |

Thresholds: 111/111 passed.

- Deposit: p2 -> p3, p95 change 21.43%, throughput change 100.00% (30/60 samples).
- SendMoney: p1 -> p2, p95 change -10.85%, throughput change 0.00% (30/30 samples).
- SendMoney: p2 -> p3, p95 change -3.39%, throughput change 0.00% (30/30 samples).
- Payment: p1 -> p2, p95 change 0.21%, throughput change 0.00% (30/30 samples).
- Payment: p2 -> p3, p95 change -14.76%, throughput change 0.00% (30/30 samples).
- Payment: p3 -> p4, p95 change -17.04%, throughput change 300.00% (30/120 samples).

Failed thresholds:

None.

Limitations:

- Closed VU model: each response is followed by a one-second think time, capped at the phase boundary. Slower responses reduce throughput.
- Pacing differs from earlier start-to-start runs; changing pacing and indexes together cannot isolate an index effect.
- Customer limits were temporarily raised but remained active. See run-metadata.json for post-test restoration evidence; transfers and quota usage persist.
- NOT RUN means no transaction samples; INCOMPLETE means the planned workload was not fully observed. Neither is a performance pass.
- This two-minute local run is not a capacity benchmark; small API/phase samples limit tail-latency conclusions.
- API throughput uses active API seconds; whole-test throughput uses the full workload window.
- Authentication, provisioning and limit/balance preflight are excluded from transaction metrics.
- Runner verified with-index before execution. See run-metadata.json for index definitions before/after and ledger row counts.
- The runner does not add/drop indexes. An account index can reduce locking conflicts but cannot guarantee no deadlocks.
- Transfers, fees, history and quota usage persist between runs. Without matching DB snapshots, before/after results are observational, not an isolated index benchmark.
- Latency includes successful and failed responses; quick failures can make latency look better while reliability degrades.
