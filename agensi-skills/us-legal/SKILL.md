---
name: us-legal
description: Searches US bills, the Federal Register, court opinions, and regulator news through the connected US legal MCP server. Use when the user asks about a Congress bill, a public law, a regulation, a court opinion, the GENIUS Act, or the CLARITY Act.
---

# US legal lookups

The US legal MCP server must already be connected. If `search_congress_bills` is missing, stop and give the user the install block in README.md. Do not invent citations. Tool names use underscores, including `search_congress_bills`, not hyphens.

## Workflow

1. For the GENIUS Act or the CLARITY Act by name, call `get_genius_act_info` or `get_clarity_act_info`. Use `get_curated_act` with `genius-act` or `clarity-act` for the same records.
2. For any other bill, call `search_congress_bills`, then `get_bill_details`. Add `get_bill_actions` for the timeline and `get_bill_text` for version links. Use bill ids like `s1582-119` or `hr3633-119`.
3. For a public law, call `get_public_law_text` (GENIUS Act is `119-27`).
4. For regulations or executive orders, call `search_federal_register` or `get_recent_regulations`. For opinions, call `search_court_opinions` or `get_recent_court_opinions`.
5. For OCC, SEC, CFTC, Federal Reserve, Treasury, or FinCEN press releases, call `search_regulator_news` or `get_recent_regulator_news`.
6. Call `search_all_legal` or `search_digital_asset_regulation` when the user wants more than one of those collections in one pass.

## Output

- The citation the tool returned (bill id, public law number, docket, or document number)
- Title, date, and status
- A source link from the tool
- The tool that produced it

## Boundaries

Quote the tool's text. Do not give legal advice, and do not fill a gap with a citation you did not retrieve. Congress.gov, GovInfo, and CourtListener keys are the buyer's optional env vars. Without them, say when a tool reports that a source was skipped or rate-limited.
