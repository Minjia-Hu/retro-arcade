# CLAUDE.md

Project conventions for Claude Code. This file records **lessons learned that are not obvious from reading the code**; see `README.md` for general information.

## Workflow

Before making changes, write a spec, then a plan, using the filename format `YYYY-MM-DD-<topic>.md`.
Commit specs under `docs/design/`. Plans are implementation scaffolding, including large blocks of code,
and belong **only in the local**, gitignored `docs/plans/` directory. Do not commit them.
Record scope decisions, deliberate tradeoffs, and departures from the design in the spec. Otherwise,
the next contributor or session may mistake them for bugs and "fix" them back.

## Strict Conventions

### 1. Keep `logic.ts` and `index.ts` strictly separate

Within each game's `src/games/<id>/` directory, `logic.ts` contains pure logic (no DOM or Canvas,
fully unit-testable). `index.ts` handles only rendering and translating input into logic calls.

**Visual changes must never touch `logic.ts` or `tests/*-logic.test.ts`.** Verify with:

```bash
git diff --stat <baseline> -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'   # Must be empty
```

When rendering needs a constant that `logic.ts` does not export (such as brick row height),
**add a comment in `index.ts` identifying its source. Do not change the logic to accommodate rendering.**

### 2. Canvas colors and the page palette are separate

**The single source of truth for the page palette is `:root` in `src/styles/arcade.css`.**
TypeScript holds only the values that JavaScript must apply inline. Values shared by both sides
(the four accent colors and `--screen-ground`) have cross-reference comments in both locations.

**Canvas palettes live elsewhere.** The four dark-screen games (SNAKE / TETRIS / BREAKOUT / FLAPPY)
share `SCREEN` from `src/core/theme.ts`. The four light paper-board games (SUDOKU / 2048 / MINES / GOMOKU)
**each** keep a `PAPER` constant in their own `index.ts`. Their palettes differ; forcing them into
one table would create an abstraction that fits none of them. **Do not merge them.**

(History: all eight games once shared a canvas palette named `THEME`. Design handoff documents
repeatedly said to "replace THEME"; following that instruction would break compilation and paint
the canvas with the page background color. `THEME` was deleted after all eight games migrated away
from it. Any remaining references in the documentation are historical.)

### 3. Routes use `#/<id>`

Do not use `#/game/<id>`. Some design documents got this wrong; the code is authoritative.

### 4. Resolve design conflicts in favor of the artboard

The prose in `design_handoff_*/README.md` has conflicted with the artboards in `.dc.html` files
(for example, result button background colors). **The artboard is authoritative.** Record the
resolution in the spec so that later contributors do not read the prose and revert it.

`.dc.html` files are HTML prototypes, not production code to copy directly. They represent many
elements as DOM simply because the prototype itself is HTML. Decide case by case whether to
carry that implementation over.

## Common Pitfalls

- **Artboards are desktop designs and may omit touch controls.** The row of touch buttons on the
  Tetris canvas is absent from the design. Shrinking the canvas to match would remove mobile
  playability. Before a redesign, check whether the canvas contains interactive elements.
- **CSS inset shadows cannot cover the canvas.** They are painted above the background but below
  the content, and the canvas bitmap is the content. The screen well's vignette comes from the
  `.screen-glass` overlay with `pointer-events: none`. Do not delete it as an unnecessary empty div.
- **Set only `style.width` on the canvas, not its height.** Let the replaced element's intrinsic
  aspect ratio determine the height, together with `.screen-body canvas { height: auto }`.
  This prevents overflow on narrow screens; changing it can break the mobile layout.
- **Do not automatically focus result overlay buttons.** The game's Space handler is still
  listening. With a button focused, one Space press can trigger both a button click and the
  game's own restart handler.
- **Do not point an overlay button's `onPress` directly at the game's tap handler.** Tap handlers
  often debounce repeated input to guard against accidental canvas taps, which can swallow an
  intentional button click. Sharing the `paused` guard is sufficient.

## Testing

- Assert **behavior**, not merely "did not throw" or counts. After writing a test, ask whether
  deleting the line under test would make it fail. If unsure, introduce a regression to verify it.
- Do not hard-code random game content in assertions (food positions, piece sequences).
- When comparing order with `indexOf`, first assert that both items exist. A missing item returns
  `-1`, which is always less than any valid position.
- For CSS assertions, use regular expressions to check mappings rather than locking down the
  formatting of an entire rule.
- Vitest stubs CSS imports as empty strings by default. Tests that read the contents of
  `arcade.css` depend on `vite.config.ts` setting
  `test.css: true`.

## Commit Messages

Write all commit messages in English (both subject and body). Use the imperative mood and
explain "why" in the body.

## Commands

```bash
npm test         # Unit tests
npm run e2e      # End-to-end tests (required after rendering or DOM structure changes)
npx tsc --noEmit # Type checking
npm run build    # tsc + vite build
```

## Local Directories (Gitignored, Not Committed)

- `design_handoff_*/` — Design references (artboards and handoff notes), referenced in strict
  convention 4 above.
- `docs/plans/` — Implementation plans and scaffolding.
- `docs/posts/` — Promotional drafts and cover images for community posts.
  `docs/posts/README.md` indexes platforms, dates, and published links. Published posts are
  authoritative. Platform-specific wording in drafts (such as the intentionally shortened
  Chinese name for Tetris in the V2EX version) is deliberate; do not "correct" it as a typo.
