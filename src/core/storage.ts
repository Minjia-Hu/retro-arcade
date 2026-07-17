export interface KVBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryBackend(): KVBackend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
  };
}

function defaultBackend(): KVBackend {
  try {
    const ls = window.localStorage;
    ls.setItem('arcade.__probe', '1');
    ls.removeItem('arcade.__probe');
    return ls;
  } catch {
    // 隐私模式等场景下 localStorage 不可用，降级为内存存储
    return memoryBackend();
  }
}

export class ArcadeStorage {
  constructor(private backend: KVBackend = defaultBackend()) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.backend.getItem(`arcade.${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.backend.setItem(`arcade.${key}`, JSON.stringify(value));
    } catch {
      // 写入失败不影响游戏
    }
  }
}
