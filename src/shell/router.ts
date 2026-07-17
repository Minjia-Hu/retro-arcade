export type Route = { name: 'hub' } | { name: 'game'; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  return path === '' ? { name: 'hub' } : { name: 'game', id: path };
}

export function startRouter(onChange: (route: Route) => void): () => void {
  const fire = () => onChange(parseHash(location.hash));
  window.addEventListener('hashchange', fire);
  fire(); // 启动时按当前 hash 渲染一次
  return () => window.removeEventListener('hashchange', fire);
}
