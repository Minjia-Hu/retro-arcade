import { findBestMove } from './ai';

// 薄壳：收 {board, player, depth} → 计算最佳落子 → 回传 idx。
// 传 Math.random 让 AI 在并列最优手间抖动，避免逐盘复刻同一棋谱。
self.onmessage = (e: MessageEvent) => {
  const { board, player, depth, token } = e.data as {
    board: number[]; player: number; depth: number; token: number;
  };
  const idx = findBestMove(board, player, depth, Math.random);
  // 回传 token 供主线程判定回复是否过期（玩家可能已返回菜单/另开新局）
  (self as unknown as { postMessage(m: unknown): void }).postMessage({ idx, token });
};
