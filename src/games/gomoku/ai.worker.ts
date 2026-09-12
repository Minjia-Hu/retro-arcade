import { findBestMove } from './ai';

// Thin shell: receive {board, player, depth} → compute the best move → post idx back.
// Math.random is passed so the AI jitters between tied best moves instead of replaying the same game.
self.onmessage = (e: MessageEvent) => {
  const { board, player, depth, token } = e.data as {
    board: number[]; player: number; depth: number; token: number;
  };
  const idx = findBestMove(board, player, depth, Math.random);
  // Echo the token so the main thread can tell a stale reply (the player may have gone back to the menu / started over)
  (self as unknown as { postMessage(m: unknown): void }).postMessage({ idx, token });
};
