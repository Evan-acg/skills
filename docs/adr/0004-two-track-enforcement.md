# Two-track enforcement

Constraints are enforced on two tracks. In-loop, the AI runs the smallest focused checks that can fail on the current change, giving an immediate correction signal while it still has the change in context. As a backstop, pre-commit and pre-push hooks run repository-wide checks that fire whether or not the AI acted on the first track. The in-loop track gives fast feedback; the hook track makes drift correction unavoidable when attention slips.
