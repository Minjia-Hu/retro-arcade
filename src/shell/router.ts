export type Route = { name: 'hub' } | { name: 'game'; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  return path === '' ? { name: 'hub' } : { name: 'game', id: path };
}

export function startRouter(onChange: (route: Route) => void): () => void {
  const fire = () => onChange(parseHash(location.hash));
  window.addEventListener('hashchange', fire);
  fire(); // render once for the current hash on startup
  return () => window.removeEventListener('hashchange', fire);
}
