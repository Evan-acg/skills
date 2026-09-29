# CRAP is calculated in-repo

CRAP is computed by a small in-repo script from a complexity tool and a coverage report, rather than by a dedicated CRAP package. No CRAP tool is reliably maintained across the supported stacks, so the formula is computed directly and the coverage denominator uses executable lines only, avoiding systematic overestimation on commented or well-covered functions. The cost is a small script the project must maintain, shipped per stack under `templates/`.
