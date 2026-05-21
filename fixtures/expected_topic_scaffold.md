---
id: topic:runtime.session-gates
title: Session Gates
kind: topic
level: leaf
parent: topic:runtime
path: areas/01-runtime/01-session-gates.md
status: expanded
review_state: needs_revision

proposal_state: promoted_to_scaffold

coverage:
  concept_addressed: true
  concept_solved: false
  out_of_scope: false
  needs_design: true
  needs_reconciliation: true
  needs_code_review: false
  needs_implementation: true

depends_on:
  - topic:runtime.proposal-engine
feeds_into:
  - topic:agent-runtime.write-policy
  - topic:visual-plane.approval-actions
blocks:
  - topic:agent-runtime.autonomous-expansion

created_at: 2026-05-20
updated_at: 2026-05-20
last_reviewed: null
---

# Session Gates

## Purpose

What this topic/component is responsible for.

## Boundary

### Includes

- Human approval gates for session proposals

### Excludes

- Autonomous expansion without review
