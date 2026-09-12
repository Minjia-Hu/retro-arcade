# Contributing

Thanks for looking. This is a small project with a few firm conventions; they exist because each one
was learned the hard way. The same rules, with more war stories, live in `CLAUDE.md`.

## Before you change anything

Every round of work in this repo starts with a short design note, then a plan, then code:

- `docs/superpowers/specs/YYYY-MM-DD-<topic>.md` — what to build, scope decisions, deliberate
  trade-offs, and where the result departs from the mockups and why.
- `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` — the implementation broken into independently
  verifiable tasks.

Scope decisions and "why we didn't do the obvious thing" go in the spec. Otherwise the next person
reads the code, assumes it's a mistake, and "fixes" it back.

## The rules

### 1. `logic.ts` never touches the DOM or Canvas

Each game is `src/games/<id>/logic.ts` (pure state and rules, random sources injectable, fully
unit-tested) and `index.ts` (rendering and input translation). A visual change must not touch
`logic.ts` or `tests/*-logic.test.ts`:

```bash
git diff --stat <base> -- 'src/games/*/logic.ts' 'tests/*-logic.test.ts'   # must be empty
```

If rendering needs a constant that `logic.ts` doesn't export, add it in `index.ts` with a comment
pointing at the source — don't reshape the logic to suit the renderer.

### 2. Page palette and canvas palettes are different things

The page palette has one source of truth: `:root` in `src/styles/arcade.css`. TypeScript holds only
the values JavaScript must inline, and those carry cross-reference comments in both places.

Canvas colors are separate. The four dark-screen games share `SCREEN` from `src/core/theme.ts`;
the four paper-board games each keep their own `PAPER` constant in their `index.ts`. Their palettes
genuinely differ — don't merge them into one table.

### 3. Routes are `#/<id>`

Not `#/game/<id>`.

### 4. Things that look wrong but aren't

- `.screen-glass` is an empty overlay div. It's how the vignette gets painted *over* the canvas
  (CSS inset shadows draw beneath content). Don't delete it.
- Canvases set `style.width` only, never height. Height comes from the intrinsic ratio plus
  `.screen-body canvas { height: auto }`; that's what keeps narrow screens from overflowing.
- Overlay buttons are not auto-focused: the game's Space handler is still listening, and a focused
  button would fire twice.
- Overlay `onPress` handlers must not point straight at a game's tap handler, which usually has a
  debounce meant for accidental canvas taps. Share the `paused` guard instead.

## Tests

- Assert behavior, not "didn't throw" and not counts. Ask: if I delete the line under test, does this
  go red? If unsure, inject the regression and check.
- Never hard-code random game content (food position, piece sequence) into an assertion.
- CSS assertions match the mapping with a regex; don't lock the whole rule's formatting.

```bash
npm test          # Vitest
npm run e2e       # Playwright — run after any rendering or DOM change
npx tsc --noEmit
npm run build
```

## Commits

English commit messages, imperative mood, a body that says *why*. Feature branches merge into `main`.
