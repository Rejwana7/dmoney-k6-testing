# DMoney results: FAIL

Mode: without-index; run: without-index-2026-10-12T19-05-21-690Z; planned workload: 120.00 seconds; observed: 120.36 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 87 | 1.45 | 0.72 | 41.11 | 56.28 | 92.29 | 1.15 | 1.15 | 98.85 |
| SendMoney | 87 | 0.97 | 0.72 | 41.81 | 66.20 | 99.02 | 0.00 | 0.00 | 100.00 |
| Payment | 205 | 1.71 | 1.71 | 37.01 | 54.30 | 102.43 | 0.49 | 0.49 | 99.51 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 58 | 1.93 | 0.48 | 39.68 | 52.98 | 67.46 | 0.00 | 0.00 | 100.00 |
| p2 | 87 | 2.90 | 0.72 | 43.04 | 64.25 | 102.43 | 0.00 | 0.00 | 100.00 |
| p3 | 116 | 3.87 | 0.97 | 40.79 | 59.53 | 71.98 | 1.72 | 1.72 | 98.28 |
| p4 | 118 | 3.93 | 0.98 | 34.10 | 43.75 | 82.16 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 29 | 0.97 | 0.24 | 39.45 | 50.01 | 56.80 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 29 | 0.97 | 0.24 | 39.91 | 59.12 | 67.46 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 29 | 0.97 | 0.24 | 43.62 | 68.21 | 99.02 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 29 | 0.97 | 0.24 | 42.44 | 53.73 | 92.29 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 29 | 0.97 | 0.24 | 43.07 | 61.18 | 102.43 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 58 | 1.93 | 0.48 | 40.45 | 55.29 | 69.42 | 1.72 | 1.72 | 98.28 |
| SendMoney / p3 | 29 | 0.97 | 0.24 | 42.37 | 69.16 | 71.98 | 0.00 | 0.00 | 100.00 |
| Payment / p3 | 29 | 0.97 | 0.24 | 39.87 | 52.35 | 59.10 | 3.45 | 3.45 | 96.55 |
| Payment / p4 | 118 | 3.93 | 0.98 | 34.10 | 43.75 | 82.16 | 0.00 | 0.00 | 100.00 |

Thresholds: 97/111 passed.

- Deposit: p2 -> p3, p95 change 2.91%, throughput change 100.00% (29/58 samples).
- SendMoney: p1 -> p2, p95 change 36.38%, throughput change 0.00% (29/29 samples).
- SendMoney: p2 -> p3, p95 change 1.40%, throughput change 0.00% (29/29 samples).
- Payment: p1 -> p2, p95 change 3.49%, throughput change 0.00% (29/29 samples).
- Payment: p2 -> p3, p95 change -14.44%, throughput change 0.00% (29/29 samples).
- Payment: p3 -> p4, p95 change -16.43%, throughput change 306.90% (29/118 samples).

Failed thresholds:

- transaction_http_failed{api:Deposit}: rate<0.01
- transaction_success{api:Deposit,phase:p3}: rate>=0.99
- transaction_success{phase:p3}: rate>=0.99
- transaction_http_failed{api:Deposit,phase:p3}: rate<0.01
- transaction_success{api:Payment,phase:p3}: rate>=0.99
- http_req_failed{api:Deposit}: rate<0.01
- checks{api:Deposit,kind:transaction}: rate>=0.99
- transaction_http_failed{api:Payment,phase:p3}: rate<0.01
- transaction_checks{api:Payment,phase:p3}: rate>=0.99
- transaction_success{api:Deposit}: rate>=0.99
- transaction_checks{phase:p3}: rate>=0.99
- transaction_checks{api:Deposit}: rate>=0.99
- transaction_checks{api:Deposit,phase:p3}: rate>=0.99
- transaction_http_failed{phase:p3}: rate<0.01

Limitations:

- Closed VU model: each response is followed by a one-second think time, capped at the phase boundary. Slower responses reduce throughput.
- Pacing differs from earlier start-to-start runs; changing pacing and indexes together cannot isolate an index effect.
- Customer limits were temporarily raised but remained active. See run-metadata.json for post-test restoration evidence; transfers and quota usage persist.
- NOT RUN means no transaction samples; INCOMPLETE means the planned workload was not fully observed. Neither is a performance pass.
- This two-minute local run is not a capacity benchmark; small API/phase samples limit tail-latency conclusions.
- API throughput uses active API seconds; whole-test throughput uses the full workload window.
- Authentication, provisioning and limit/balance preflight are excluded from transaction metrics.
- Runner verified without-index before execution. See run-metadata.json for index definitions before/after and ledger row counts.
- The runner does not add/drop indexes. An account index can reduce locking conflicts but cannot guarantee no deadlocks.
- Transfers, fees, history and quota usage persist between runs. Without matching DB snapshots, before/after results are observational, not an isolated index benchmark.
- Latency includes successful and failed responses; quick failures can make latency look better while reliability degrades.
