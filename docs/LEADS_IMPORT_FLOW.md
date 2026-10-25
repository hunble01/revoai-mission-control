# Leads Import Flow (Campaigns → Upload Center)

## Mapping rules
- CSV upload is required before import.
- Button stays disabled until:
  - at least 1 column is mapped, and
  - at least one required field is mapped: `name` or `company`.
- Inline readiness indicator:
  - `Mapped: X/Y columns`
  - `Ready to import` or mapping guidance message.

## Import status states
- `Validating` — mapping and payload checks before/around request execution.
- `Importing` — request in flight.
- `Complete` — request succeeded and summary is shown.
- `Failed` — request failed and error message is shown.

## Error behavior
- Prefer backend `message` from response payload.
- If response is non-JSON text, surface that text.
- Fallback to generic + HTTP code when message is unavailable.

## Preview safeguards
- Duplicate preview warning is shown for CSV rows when duplicate email/phone values are detected.
- Warning displays duplicate counts before import.

## Summary display
Import summary is rendered as structured rows:
- Imported
- Skipped duplicates
- Invalid rows
- Total rows

## Screenshot references
- `docs/shots/import-button-state.png`
- Current run screenshot (external capture): `/home/mike/.openclaw/media/browser/876d19ed-02b3-432b-b5e9-e04cb4d196d1.png`
