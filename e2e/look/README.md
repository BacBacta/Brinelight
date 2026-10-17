# The look references

The e2e `the look` (`e2e/account.e2e.ts`) compares 48 captures (every sheet, the top bar, the queue and the three celebrations, at 412 and 360 px) with the PNG files of this folder, at zero pixels, with no tolerance. The captures are taken standing still: no animation in the celebrations, and no transition anywhere (the bars fill in 300 ms of real time, which a capture would catch halfway).

## How they are made

1. Push the code whose look is the reference. The CI's e2e job writes every capture to `e2e/.shots/look/` and uploads it in its `e2e-screenshots` artifact, even when the test fails.
2. Download that artifact and copy its `look/*.png` here. Never make them on a developer's machine: text is drawn differently there (fontconfig settings), and every capture would differ in the CI.
3. Push them, and check that the next CI run compares at zero pixels.

`LOOK=update` writes the references from the machine it runs on: only useful to see what a capture looks like, not to commit.

## The one capture with two references

`captains-top-412` and `captains-top-360` also have a second reference, `captains-top-<size>.variant.png`. Some AMD machines of the CI (EPYC 9V74, 9V45) draw a variant: the left corners of the captain rows differ a little (32 and 16 pixels), with the same layout (`docs/decisions.md`, 17 October). The test prints which reference each of them matched ("References matched: …"), and the processor it ran on ("Drawn on: …"). Any other capture, or a third drawing of this one, fails.

The CI picks its machine at random, and a machine may draw the variant at one size only. **Whoever makes the references again (week 6, task 3, which changes the look) must collect both:** the usual drawing, and the variant of `captains-top` from any run that draws it, size by size. To tell them apart, compare the captures of several runs: the variant differs from the usual drawing only on those corners. Re-run the e2e job until both have been seen at both sizes.
