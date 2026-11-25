# Severity

Rate what would actually go wrong if nobody touched the code for a month, and for whom. Don't rate how bad the code looks or how sure you are.

## Use the project's own bar first

If the project writes down what blocks a release or a merge, in a review guide, contributing guide, or release checklist, that's the bar. A finding meets it only if it matches one of its points, and the finding names which. Severities below the bar still follow the definitions here.

## The default bar

Where the project has none, a finding is at the bar if, in realistic use, it gives:

- a security hole someone can reach, such as reading or changing another user's or tenant's data, running code, or getting a secret
- lost or corrupted data
- wrong money or wrong results that people rely on
- an action done to someone who mustn't get it, such as a message, a charge, or a deletion, or done twice
- a crash or failure in a main workflow, or a deployment or upgrade that fails
- code that does something other than what its docs, API or UI promise, in a way people rely on
- a main workflow that keyboard or screen reader users can't complete

## Severities

| Severity | Means | Examples |
| --- | --- | --- |
| `bar` | Meets the bar above. Needs proof to stay here | Any signed-in user can read another account's records. A retry can charge twice. A migration fails on a table with existing rows |
| `high` | A real defect with real reach, short of the bar, or something that will reach the bar with work already planned | A failure leaves a job stuck until someone notices. Missing role checks while every user is still an admin, with roles on the roadmap |
| `medium` | A real defect with limited reach, or a maintenance cost a senior engineer on this project would ask to fix | A rare edge case with a workaround. The same rule written in two places that must change together. A security control with no test |
| `low` | True and worth fixing, but small | A misleading name. An unused export. A test that duplicates another |
| `nit` | Taste-adjacent tidiness with a concrete reason | An export used only in its own file. A stale comment that misleads nobody |

Not findings at all: personal preference with no cost, "could be cleaner", and anything that needs an attacker who already has the access they'd gain.

## Two checks before rating

- **Reach.** Can real input on a real path get there today? If only a future change could trigger it, say which change, and rate it no higher than `high`.
- **Difficulty.** How hard is it to trigger: any user, a signed-in user, an admin, a timing window, a crash at one exact moment? Harder lowers severity unless the damage is severe.
