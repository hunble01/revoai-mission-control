# Mission Control QA + Rollout Checklist (Slice 33)

## Preflight
- [ ] Confirm `x-admin-token` is set in web/app environment and API.
- [ ] Confirm role headers are passed where required (`x-actor-role`, `x-actor-id` optional).
- [ ] Confirm provider tokens exist and are unexpired for active channels.

## Functional QA (End-to-End)
1. Research run creates leads and summary.
2. Lead can be promoted and draft generated.
3. Draft approval required before queue/send.
4. Queue processing executes and writes SENT/FAILED with reasons.
5. Manual retry requeues FAILED jobs.
6. Social posts: needs_approval -> approved -> scheduled -> posted.
7. Scheduled publisher posts due items for LinkedIn/Facebook.
8. Unified dashboard reflects queue + post history + activity feed.

## Safety QA
- [ ] `dry_run_mode` blocks outbound execution.
- [ ] Global pause blocks outbound execution.
- [ ] Channel toggle OFF blocks outbound execution.
- [ ] Channel kill-switch ON blocks outbound execution.
- [ ] LinkedIn daily cap enforces server-side limit.

## Permission QA
- [ ] Invalid `x-admin-token` rejected (401).
- [ ] Low-privilege roles blocked from mutating settings/safety actions.
- [ ] Read endpoints require valid token.

## Rollout Plan
1. Enable in dry-run mode with all outbound channels OFF.
2. Enable one channel (LinkedIn) for limited pilot users.
3. Monitor queue failure rate and feed alerts for 24h.
4. Enable Facebook next after stable metrics.
5. Enable email pipeline only after stability remains <20% failure rate.
6. Keep kill-switches available and tested before each rollout stage.

## Rollback
- Set global pause to true.
- Turn all outbound channel toggles OFF.
- Turn all kill-switches ON.
- Stop scheduler social publishing runs.
- Review recent failures in `social-posts/history` and `drafts/queue/overview`.
