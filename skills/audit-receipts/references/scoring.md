# Scoring

A score is only useful if someone else, reading the same findings, would give about the same number. So scores come from verified findings and fixed anchors, never from an impression of the code.

## What to score

Score each part a reader would judge on its own: each package, app or service, plus the repo's infrastructure (build, CI, deployment) and its docs. Give one overall score as a weighted judgment of the parts, saying which parts weigh most and why.

## Anchors

Start at 10 and take points off for verified findings. Use these anchors to check the result.

| Score | Means |
| --- | --- |
| 10 | Nothing found above `nit`, and the code is easy to change |
| 8 | No `bar` or `high` findings. A few `medium` findings, and the structure would hold for the next year's work |
| 6 | One `high`, or many `medium` findings, or a recurring problem such as copied logic or missing tests across the area |
| 4 | Several `high` findings or one `bar` finding, or a design that makes common changes risky |
| 2 | Several `bar` findings, or the area does something other than what it promises |
| 0 | Doesn't work for its main purpose |

Rough costs, adjusted for reach:

- `bar`: 2 to 4 points each
- `high`: 1 to 2
- `medium`: 0.5 to 1, with repeated findings of one kind counted as one theme
- `low`: 0 to 0.5 together
- `nit`: nothing

## Rules

- Every point lost names the finding IDs behind it. The check rejects a score under 10 with none, or one that names a refuted finding.
- Unverified findings cost nothing. Say in the reason if they would change the score.
- Score what's there. A feature that isn't built yet isn't a defect unless the docs or UI say it works.
- Give scores in whole or half points.
- Say that scores compare areas within this repo. Without a benchmark of other codebases, they aren't a ranking against other projects.
