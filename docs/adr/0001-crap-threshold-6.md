# CRAP threshold of 6

The enforced CRAP threshold is 6, not the classic 30. `CRAP = CC² × (1 − coverage)³ + CC`; 30 is the commonly cited risk line, but under AI-assisted test generation tests are cheap to mass-produce, so a much stricter bar is affordable and stops complex functions from hiding behind shallow coverage. This is a deliberate engineering policy of this workflow, not an industry standard, and a project may override it in its companion.
