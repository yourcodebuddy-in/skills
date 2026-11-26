# Severity

Rate what would actually go wrong if nobody touched the code for a month, and for whom. Don't rate how bad the code looks or how sure you are.

## Use the project's own bar first

If the project writes down what blocks a release or a merge, in a review guide, contributing guide, or release checklist, that's the bar. A finding meets it only if it matches one of its points, and the finding names which. Severities below the bar still follow the definitions here.

## The default bar

Where the project has none, a finding is at the bar if, in realistic use, it gives:

- a security hole someone can reach, such as reading or changing another user's or tenant's data, running code, or getting a secret
- lost or corrupted data
- money charged, paid or recorded wrongly, or wrong results that people make decisions from, such as a report, an export or a calculation. A wrong figure that's only displayed, while the right one is charged or stored, is `high` at most
- an action done to someone who mustn't get it, such as a message, a charge, or a deletion, or done twice
- a crash or failure in a main workflow, or a deployment or upgrade that fails
- code that does something other than what its docs, API or UI promise, where the gap itself causes one of the harms above, such as a permission check the docs promise that the code never makes. A default or limit that differs from the docs is `medium`, or `high` if users will rely on it
- a main workflow that keyboard or screen reader users can't complete

## Severities

| Severity | Means | Examples |
| --- | --- | --- |
| `bar` | Meets the bar above. Needs proof to stay here | Any signed-in user can read another account's records. A retry can charge twice. A migration fails on a table with existing rows |
| `high` | A real defect with real reach, short of the bar, or something that will reach the bar with work already planned | A failure leaves a job stuck until someone notices. Missing role checks while every user is still an admin, with roles on the roadmap |
| `medium` | A real defect with limited reach, or a maintenance cost a senior engineer on this project would ask to fix | A rare edge case with a workaround. The same rule written in two places that must change together. A security control with no test. A test that would still pass with the code it's named for broken |
| `low` | True and worth fixing, but small | A misleading name. An unused export. A test that duplicates another |
| `nit` | Taste-adjacent tidiness with a concrete reason | An export used only in its own file. A stale comment that misleads nobody |

Not findings at all: personal preference with no cost, "could be cleaner", and anything that needs an attacker who already has the access they'd gain. A product choice the project made, such as not verifying email addresses, isn't a defect either. If you think it's wrong, question it as a decision, with evidence.

## Three checks before rating

- **Reach.** Can real input on a real path get there today? If only a future change could trigger it, say which change, and rate it no higher than `high`.
- **Difficulty.** How hard is it to trigger: any user, a signed-in user, an admin, a timing window, a crash at one exact moment? Harder lowers severity unless the damage is severe.
- **Context.** Rate in the setting the project states. If its docs say a part is a stand-in for development, or set an operating rule such as running one worker, a problem that only happens when that rule is broken isn't at the bar. Rate it by how likely the rule is to be broken, and say whether anything enforces it.
