# Architecture Decision Records

Each record is 1-3 sentences.
Status is one of: Proposed, Accepted, Superseded (by ADR-N).
Newest records go at the bottom.

## ADR-001 - Focus on agent legibility

2026-09-24 - Accepted.
Of the three problems in the posting, we build the demo around making agent work legible.
It is the product's core promise, it shows timing, hierarchy, and progressive disclosure directly, and it can be demoed with scripted data.

## ADR-002 - Treat Glass as inferred DNA for Kay

2026-09-24 - Accepted.
The Kay docs were unreachable from this environment, so Kay's vocabulary and surfaces come from search snippets, with Ramp's Glass as the likely ancestor.
Anything inferred from Glass is labeled as inferred and must be checked against docs.meetkay.ai before the interview.

## ADR-003 - The user's input never moves

2026-09-24 - Accepted.
The compose field keeps its size and position while typing, dictating, or streaming, and streamed output never pushes the input down.
People proofread as they type, so layout shifts break their place.

## ADR-004 - Recognition over recall for skills

2026-09-24 - Accepted.
Typing `/` shows a filterable list of skills inline, and the chosen skill appears as a visible chip before sending.
Users never need to memorize skill names or wait for "loading skill" to confirm.

## ADR-005 - Summaries are views over structured events

2026-09-24 - Proposed.
The agent records typed events (tool called, file changed, message sent), and every summary is rendered from those events, with each line linking to its evidence.
We avoid a second model narrating the first after the fact, because that narration can drop or invent details.

## ADR-006 - Outcomes first, steps second

2026-09-24 - Proposed.
Agent work is shown by what changed in the world (sent, changed, spent, waiting on you), with the step-by-step trace one disclosure layer down.

## ADR-007 - Confirmation weight matches irreversibility

2026-09-24 - Proposed.
Reversible actions take a tap; irreversible ones use hold-to-confirm, with the hold getting longer as the consequence grows.
The playful interaction doubles as a signal of how much the action matters.

## ADR-008 - Legible work becomes remixable work

2026-09-24 - Proposed.
A finished run renders as a reactive recipe (like marimo) where editing an upstream step re-runs the steps after it, and any run can be saved as a skill.
This ties legibility to the success metric: users creating their own workflows and skills.
