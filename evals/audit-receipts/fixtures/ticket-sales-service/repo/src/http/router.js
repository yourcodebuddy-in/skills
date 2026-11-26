// A small method + path router. Paths use :name segments, and handlers receive the matched params.
export function createRouter() {
  const routes = [];

  const add = (method, pattern, handler) => {
    const names = [];
    const source = pattern
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        names.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    routes.push({ method, regex: new RegExp(`^${source}$`), names, handler });
  };

  const match = (method, path) => {
    let pathMatched = false;
    for (const route of routes) {
      const found = route.regex.exec(path);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.names.forEach((name, index) => {
        params[name] = decodeURIComponent(found[index + 1]);
      });
      return { handler: route.handler, params };
    }
    return { handler: null, pathMatched };
  };

  return {
    get: (pattern, handler) => add('GET', pattern, handler),
    post: (pattern, handler) => add('POST', pattern, handler),
    patch: (pattern, handler) => add('PATCH', pattern, handler),
    delete: (pattern, handler) => add('DELETE', pattern, handler),
    match,
  };
}
