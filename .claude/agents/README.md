# Because Agent Pipelines

## Quick Reference

| Pipeline | Command | When to Use | Stages |
|----------|---------|-------------|--------|
| **Feature** | `@bc-orchestrator` | New feature touching 3+ files | planner -> architect -> implementor -> tester -> reviewer |
| **Bugfix** | `@bc-bug-orchestrator` | Bug report, unknown root cause | triager -> fixer -> tester -> reviewer |
| **Hotfix** | `@bc-hotfix-orchestrator` | Bug with known root cause, needs fast fix | fixer -> reviewer |
| **Refactor** | `@bc-refactor-orchestrator` | Restructure code, preserve behavior | analyzer -> executor -> tester -> reviewer |

## How Pipelines Work

### 1. You describe the work

Tell the orchestrator what you need in natural language:

```
@bc-orchestrator Add bookmark sharing -- generate a shareable link for any saved item
@bc-bug-orchestrator Exported JSON backup is missing topic data
@bc-hotfix-orchestrator The escapeHtml function in app.js doesn't handle backticks
@bc-refactor-orchestrator Extract all toast functions from app.js into a toast.js module
```

### 2. The orchestrator creates a work directory

Each pipeline type has its own directory:

```
.planning/
  features/{slug}/      -- feature pipeline
  bugs/{slug}/          -- bugfix pipeline
  hotfixes/{slug}/      -- hotfix pipeline
  refactors/{slug}/     -- refactor pipeline
```

### 3. Agents run in sequence

The orchestrator spawns one agent at a time. Each agent:
- Reads its instructions from `.claude/agents/bc-{name}.md`
- Reads predecessor artifacts from the work directory
- Does its work (investigation, code changes, testing, review)
- Writes its output artifact to the work directory
- Reports status: `complete`, `blocked`, or `failed`

### 4. Artifacts pass between agents

Agents communicate through markdown files with YAML frontmatter:

```yaml
---
feature: bookmark-sharing
stage: planner
status: complete
produced_by: bc-planner
consumed_by: bc-architect
---
```

The orchestrator tracks everything in `PIPELINE-STATE.md`:

```
| # | Stage | Agent | Status | Started | Completed | Artifact |
|---|-------|-------|--------|---------|-----------|----------|
| 1 | Plan | bc-planner | complete | 12:00 | 12:02 | 01-SPEC.md |
| 2 | Architect | bc-architect | running | 12:02 | | 02-ARCHITECTURE.md |
| 3 | Implement | bc-implementor | pending | | | 03-IMPLEMENTATION.md |
```

### 5. The reviewer decides the outcome

Every pipeline ends with the reviewer. Three possible verdicts:
- **pass** -- ship it
- **pass-with-warnings** -- ship it, but address the warnings
- **fail** -- the orchestrator determines which stage to re-run

## Running Individual Agents

You can run any agent standalone without a pipeline:

```
# Investigation only
@bc-bug-triager Investigate why exported JSON is missing topics

# Code review only
@bc-reviewer Review api/segment.js against project conventions

# Quick analysis
@bc-refactor-analyzer Map all dependencies of app.js and identify extraction candidates

# Direct implementation
@bc-implementor Add a new API endpoint for batch topic classification
```

When running standalone, tell the agent where to write its output.

## Choosing the Right Pipeline

```
"I need a new feature"                    -> @bc-orchestrator (feature)
"Something is broken, not sure why"       -> @bc-bug-orchestrator (bugfix)
"Something is broken, I know the cause"   -> @bc-hotfix-orchestrator (hotfix)
"I want to restructure this code"         -> @bc-refactor-orchestrator (refactor)
"Single-file fix, trivial change"         -> just do it directly, no pipeline needed
```

## Coverage

Every development workflow is covered by either a pipeline or a direct action:

| Workflow | Covered? | How |
|----------|----------|-----|
| Build a new feature | yes | Feature pipeline |
| Fix a bug (unknown cause) | yes | Bugfix pipeline |
| Fix a bug (known cause, fast) | yes | Hotfix pipeline |
| Restructure / refactor code | yes | Refactor pipeline |
| Code review | yes | `@bc-reviewer` standalone |
| Investigation only | yes | `@bc-bug-triager` standalone |
| Dependency analysis | yes | `@bc-refactor-analyzer` standalone |
| Single-file edit | yes | Direct edit, no pipeline needed |
| Config / env changes | yes | Direct edit, no pipeline needed |
| CI/CD, deployment | no | Infrastructure -- outside agent scope |
| Documentation | no | Not enough stages to justify a pipeline |

## Agent Inventory

### Feature Pipeline (5 agents)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `bc-orchestrator` | Coordinates feature pipeline | No |
| `bc-planner` | Writes feature spec | No |
| `bc-architect` | Designs technical approach | No |
| `bc-implementor` | Implements all code (JS, CSS, HTML, API) | Yes |
| `bc-tester` | Tests and verifies | Yes (test plans) |
| `bc-reviewer` | Reviews all changes | No (read-only) |

### Bugfix Pipeline (3 new + reuses tester, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `bc-bug-orchestrator` | Coordinates bugfix pipeline | No |
| `bc-bug-triager` | Investigates root cause | No (read-only) |
| `bc-bug-fixer` | Implements minimal fix | Yes |

### Refactor Pipeline (3 new + reuses tester, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `bc-refactor-orchestrator` | Coordinates refactor pipeline | No |
| `bc-refactor-analyzer` | Maps dependencies, plans steps | No (read-only) |
| `bc-refactor-executor` | Executes refactor changes | Yes |

### Hotfix Pipeline (1 new + reuses bug-fixer, reviewer)
| Agent | Role | Writes Code? |
|-------|------|-------------|
| `bc-hotfix-orchestrator` | Fast-track fix, skip triage | No |

**Total: 13 agent files, 4 pipelines**

## Shared Agents

Some agents are reused across pipelines:

| Agent | Used By |
|-------|---------|
| `bc-tester` | feature, bugfix, refactor |
| `bc-reviewer` | feature, bugfix, hotfix, refactor |
| `bc-bug-fixer` | bugfix, hotfix |
