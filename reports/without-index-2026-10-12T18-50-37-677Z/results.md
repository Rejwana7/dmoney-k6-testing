# DMoney results: FAIL

Mode: without-index; run: without-index-2026-10-12T18-50-37-677Z; planned workload: 120.00 seconds; observed: 120.30 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 87 | 1.45 | 0.72 | 39.97 | 62.16 | 73.05 | 1.15 | 1.15 | 98.85 |
| SendMoney | 87 | 0.97 | 0.72 | 38.82 | 56.95 | 70.34 | 1.15 | 1.15 | 98.85 |
| Payment | 205 | 1.71 | 1.71 | 34.27 | 50.14 | 75.54 | 0.49 | 0.49 | 99.51 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 58 | 1.93 | 0.48 | 36.62 | 45.32 | 58.53 | 0.00 | 0.00 | 100.00 |
| p2 | 87 | 2.90 | 0.72 | 39.19 | 53.70 | 75.54 | 0.00 | 0.00 | 100.00 |
| p3 | 116 | 3.87 | 0.97 | 40.41 | 64.71 | 73.05 | 2.59 | 2.59 | 97.41 |
| p4 | 118 | 3.93 | 0.98 | 31.01 | 39.04 | 75.54 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 29 | 0.97 | 0.24 | 36.71 | 46.39 | 58.53 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 29 | 0.97 | 0.24 | 36.53 | 43.99 | 46.85 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 29 | 0.97 | 0.24 | 39.35 | 53.24 | 70.34 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 29 | 0.97 | 0.24 | 38.27 | 47.15 | 56.54 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 29 | 0.97 | 0.24 | 39.96 | 62.01 | 75.54 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 58 | 1.93 | 0.48 | 40.82 | 64.65 | 73.05 | 1.72 | 1.72 | 98.28 |
| SendMoney / p3 | 29 | 0.97 | 0.24 | 40.40 | 64.78 | 67.59 | 3.45 | 3.45 | 96.55 |
| Payment / p3 | 29 | 0.97 | 0.24 | 39.58 | 58.83 | 67.07 | 3.45 | 3.45 | 96.55 |
| Payment / p4 | 118 | 3.93 | 0.98 | 31.01 | 39.04 | 75.54 | 0.00 | 0.00 | 100.00 |

Thresholds: 89/111 passed.

- Deposit: p2 -> p3, p95 change 37.11%, throughput change 100.00% (29/58 samples).
- SendMoney: p1 -> p2, p95 change 14.77%, throughput change 0.00% (29/29 samples).
- SendMoney: p2 -> p3, p95 change 21.67%, throughput change 0.00% (29/29 samples).
- Payment: p1 -> p2, p95 change 40.95%, throughput change 0.00% (29/29 samples).
- Payment: p2 -> p3, p95 change -5.12%, throughput change 0.00% (29/29 samples).
- Payment: p3 -> p4, p95 change -33.64%, throughput change 306.90% (29/118 samples).

Failed thresholds:

- transaction_checks{api:Deposit}: rate>=0.99
- transaction_http_failed{api:Deposit}: rate<0.01
- transaction_checks{api:SendMoney}: rate>=0.99
- transaction_checks{api:Payment,phase:p3}: rate>=0.99
- transaction_success{api:SendMoney}: rate>=0.99
- http_req_failed{api:Deposit}: rate<0.01
- http_req_failed{api:SendMoney}: rate<0.01
- transaction_checks{api:Deposit,phase:p3}: rate>=0.99
- transaction_http_failed{api:SendMoney,phase:p3}: rate<0.01
- transaction_http_failed{phase:p3}: rate<0.01
- transaction_success{api:Deposit}: rate>=0.99
- transaction_success{api:Payment,phase:p3}: rate>=0.99
- checks{api:Deposit,kind:transaction}: rate>=0.99
- transaction_checks{phase:p3}: rate>=0.99
- transaction_success{api:Deposit,phase:p3}: rate>=0.99
- transaction_success{phase:p3}: rate>=0.99
- transaction_http_failed{api:Payment,phase:p3}: rate<0.01
- transaction_checks{api:SendMoney,phase:p3}: rate>=0.99
- checks{api:SendMoney,kind:transaction}: rate>=0.99
- transaction_http_failed{api:Deposit,phase:p3}: rate<0.01
- transaction_success{api:SendMoney,phase:p3}: rate>=0.99
- transaction_http_failed{api:SendMoney}: rate<0.01

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
