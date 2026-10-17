# The look references

The e2e `the look` (`e2e/account.e2e.ts`) compares 42 captures (every sheet, the top bar and the queue, at 412 and 360 px) with the PNG files of this folder, at zero pixels, with no tolerance.

## How they are made

1. Push the code whose look is the reference. The CI's e2e job writes every capture to `e2e/.shots/look/` and uploads it in its `e2e-screenshots` artifact, even when the test fails.
2. Download that artifact and copy its `look/*.png` here. Never make them on a developer's machine: text is drawn differently there (fontconfig settings), and every capture would differ in the CI.
3. Push them, and check that the next CI run compares at zero pixels.

`LOOK=update` writes the references from the machine it runs on: only useful to see what a capture looks like, not to commit.

## The one capture with two references

`captains-top-412` and `captains-top-360` also have a second reference, `captains-top-<size>.amd-epyc-9v74.png`. The CI's AMD EPYC 9V74 machines draw the left corners of the captain rows a little differently (32 and 16 pixels), with the same layout (`docs/decisions.md`, 17 October). The test prints which reference each of them matched, and the processor it ran on ("Drawn on: …"). Any other capture, or a third drawing of this one, fails.

The CI picks its machine at random, so the variant only comes from a run that happened to land on an EPYC 9V74 ("Drawn on: AMD EPYC 9V74 80-Core Processor" in the e2e job's log). **Whoever makes the references again (week 6, task 3, which changes the look) must collect both:** the usual drawing from any other machine, and the 9V74 drawing of `captains-top` from a run on that processor, re-running the e2e job until one lands there.
