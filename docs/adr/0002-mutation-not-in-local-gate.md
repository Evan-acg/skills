# Mutation testing is not in the local gate

Mutation testing is an optional hardener, not an enforced gate. It is slow and its results are environment-sensitive, so it does not fit the fast local loop. The local gate enforces CRAP only; mutation is run intermittently — for example before a release or during a hardening pass — when the project chooses to. The contract is kept in `references/quality-gates.md` so a project can adopt it later without re-deriving it.
