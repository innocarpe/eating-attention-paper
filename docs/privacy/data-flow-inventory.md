# Privacy and data-flow inventory (v1)

## Zones

| Zone | May hold | Must not hold |
|---|---|---|
| Production learning origin | versioned local progress IDs/outcomes/revisions | raw answers, free explanations, python code/output/error bodies |
| PR preview origin | disposable test state | production secrets, durable learner data |
| RC origin | synthetic/consented validation state | production storage |
| Sandbox iframe/worker | current run memory only | network after READY, parent authority, persistence |
| Static host / CDN | transport metadata | app-derived learning sentinels |
| Analytics | **not deployed in v1** | any learner-derived payload |

## App-controlled persistence

`ProgressV1` local document may store:

- stable attempt/activity/evaluator IDs and revisions
- outcomes, hint level, variant id, local timestamps
- explanation evidence IDs only

Forbidden keys are enforced by `assertNoRawLearnerBodies`.

## Analytics gate

Default: off, no SDK, no endpoint.

Enable only with processor/transport/DPA/raw-log-off/retention≤90d evidence (`hasAnalyticsEnablementEvidence`).

## Network tests required before launch

Preview and production raw captures must show 0 learning sentinels in query/hash/referrer/headers/body before redaction.
