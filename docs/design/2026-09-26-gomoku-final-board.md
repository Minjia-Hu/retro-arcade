# Gomoku final-board review

## Problem

The result overlay obscures the decisive move and only offers a new game or exit.
Players cannot dismiss it to inspect the final board.

## Behavior

- Retain the result announcement, with VIEW BOARD as the primary action and NEW
  GAME as the secondary action. Space/Enter or a board tap after the existing
  400 ms accidental-input guard also dismisses the result into review.
- Review preserves all stones and disallows moves. Show the result and a native
  NEW GAME button above the board, without covering any intersections.
- Mark the last move with a ring and draw the winning line(s) through it. Draws
  retain the last-move marker without a winning line.
- The mode menu offers VIEW BOARD for a completed game, so opening the menu does
  not force players to abandon the final position. Choosing a mode starts fresh.
- Restore normal turn chips and hints for a new game. Taps on the reviewed board
  do not restart; players use the explicit new-game/menu controls.
- Reuse existing head controls and palette. This intentionally extends the
  original result-card design to support review on desktop and touch screens.

## Scope and validation

Only Gomoku presentation/input changes; game rules, AI and Worker scheduling are
unchanged. Test black and white wins, draw review, read-only board, mode-menu
round trips, new-game reset, and keyboard interaction. Check desktop and mobile
layout and rendered markers. Run unit tests, Playwright and production build.
