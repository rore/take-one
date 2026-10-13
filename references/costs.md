# What a film costs

Keep one `costs.jsonl` ledger in each film project and track the full cost from planning through delivery. `scripts/cost.mjs` measures command execution time and exit status, and records manual usage or charges:

```text
node <installed skill directory>/scripts/cost.mjs run costs.jsonl <stage> -- <executable> [args...]
node <installed skill directory>/scripts/cost.mjs record costs.jsonl '<JSON object>'
node <installed skill directory>/scripts/cost.mjs report costs.jsonl
```

For `record`, pass one JSON object with `kind` and `status` (`actual`, `estimate`, or `unavailable`). Actual and estimated records include a nonnegative `value` and `unit`; add optional `stage`, `provider`, `model`, and `note` fields. For unavailable values, omit `value` and `unit` and explain why in `note`. Kinds include `money` (for example, unit `USD`), `credits`, `usage` (units such as `input_tokens`, `output_tokens`, and `cached_input_tokens`), `elapsed` (unit `seconds`), `user_time` (`minutes`), `storage` (`bytes`), `energy` (`kWh`), and `hardware` when unavailable. An unavailable provider usage record can state that the provider does not expose token counts without inventing a value.

Record provider/model token usage, including input, output and cached input tokens, only when the provider exposes actual usage. Never treat token counts as cash or estimate a price from unavailable usage. Separate subscription allocation from incremental cash paid; unknown allocation or charge is unavailable, never zero. Record paid-service charges in the currency billed and credits in their native credit unit. Do not convert or add unlike currencies and credits. Group records by kind, status, unit, provider and model; keep actuals and estimates separate.

Include measured render/generation execution time, retries and reviews, and the disk size of generated assets. `run` records execution seconds and exit code/signal, stage, and executable name; it omits command arguments. Record the overall elapsed film time separately when measured. Include the user's time only when they provide it. Mark unavailable any CPU/GPU time, electricity, subscription allocation, or billing value that cannot be measured or read; do not invent it. Reports sum command execution seconds, but parallel commands overlap, so that sum is not the film's total elapsed time.

`costs.jsonl` is the canonical record. Keep the existing `spend.md` as a readable summary of the same service charges and credits; each charge is recorded once in `costs.jsonl`, never entered twice. Report totals by currency, credit unit, and time; do not collapse them into one number. The pitch should state what is known, what is estimated, and what remains unavailable. The delivery reports actual totals with those limits.

Keep repository setup, helper porting, and qualification runs out of a film's ledger. They are development costs, not the cost of making that film.
