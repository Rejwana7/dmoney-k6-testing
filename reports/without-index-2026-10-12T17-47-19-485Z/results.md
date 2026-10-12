# DMoney results: FAIL

Mode: without-index; run: without-index-2026-10-12T17-47-19-485Z; planned workload: 120.00 seconds; observed: 120.21 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 89 | 1.48 | 0.74 | 30.44 | 42.60 | 56.44 | 1.12 | 1.12 | 98.88 |
| SendMoney | 89 | 0.99 | 0.74 | 29.80 | 37.34 | 47.58 | 1.12 | 1.12 | 98.88 |
| Payment | 209 | 1.74 | 1.74 | 27.40 | 38.51 | 61.34 | 0.48 | 0.48 | 99.52 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 60 | 2.00 | 0.50 | 29.24 | 33.10 | 49.17 | 0.00 | 0.00 | 100.00 |
| p2 | 90 | 3.00 | 0.75 | 29.65 | 36.75 | 50.12 | 0.00 | 0.00 | 100.00 |
| p3 | 117 | 3.90 | 0.97 | 30.91 | 44.62 | 56.44 | 2.56 | 2.56 | 97.44 |
| p4 | 120 | 4.00 | 1.00 | 25.40 | 33.91 | 61.34 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 30 | 1.00 | 0.25 | 28.98 | 32.10 | 40.93 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 30 | 1.00 | 0.25 | 29.50 | 33.35 | 49.17 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 30 | 1.00 | 0.25 | 29.68 | 38.46 | 47.58 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 30 | 1.00 | 0.25 | 29.48 | 34.01 | 37.38 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 30 | 1.00 | 0.25 | 29.79 | 41.38 | 50.12 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 59 | 1.97 | 0.49 | 30.93 | 45.24 | 56.44 | 1.69 | 1.69 | 98.31 |
| SendMoney / p3 | 29 | 0.97 | 0.24 | 30.76 | 37.30 | 44.60 | 3.45 | 3.45 | 96.55 |
| Payment / p3 | 29 | 0.97 | 0.24 | 31.02 | 43.71 | 48.46 | 3.45 | 3.45 | 96.55 |
| Payment / p4 | 120 | 4.00 | 1.00 | 25.40 | 33.91 | 61.34 | 0.00 | 0.00 | 100.00 |

Thresholds: 89/111 passed.

- Deposit: p2 -> p3, p95 change 33.01%, throughput change 96.67% (30/59 samples).
- SendMoney: p1 -> p2, p95 change 19.81%, throughput change 0.00% (30/30 samples).
- SendMoney: p2 -> p3, p95 change -3.03%, throughput change -3.33% (30/29 samples).
- Payment: p1 -> p2, p95 change 24.07%, throughput change 0.00% (30/30 samples).
- Payment: p2 -> p3, p95 change 5.65%, throughput change -3.33% (30/29 samples).
- Payment: p3 -> p4, p95 change -22.43%, throughput change 313.79% (29/120 samples).

Failed thresholds:

- checks{api:SendMoney,kind:transaction}: rate>=0.99
- transaction_http_failed{api:SendMoney,phase:p3}: rate<0.01
- checks{api:Deposit,kind:transaction}: rate>=0.99
- transaction_checks{api:Deposit,phase:p3}: rate>=0.99
- transaction_checks{api:Payment,phase:p3}: rate>=0.99
- transaction_success{api:Deposit,phase:p3}: rate>=0.99
- transaction_checks{api:SendMoney,phase:p3}: rate>=0.99
- transaction_http_failed{api:SendMoney}: rate<0.01
- transaction_http_failed{phase:p3}: rate<0.01
- transaction_success{phase:p3}: rate>=0.99
- transaction_http_failed{api:Payment,phase:p3}: rate<0.01
- transaction_success{api:Deposit}: rate>=0.99
- transaction_checks{api:Deposit}: rate>=0.99
- http_req_failed{api:Deposit}: rate<0.01
- transaction_http_failed{api:Deposit,phase:p3}: rate<0.01
- transaction_success{api:SendMoney}: rate>=0.99
- transaction_success{api:SendMoney,phase:p3}: rate>=0.99
- transaction_checks{api:SendMoney}: rate>=0.99
- transaction_checks{phase:p3}: rate>=0.99
- transaction_success{api:Payment,phase:p3}: rate>=0.99
- http_req_failed{api:SendMoney}: rate<0.01
- transaction_http_failed{api:Deposit}: rate<0.01

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
