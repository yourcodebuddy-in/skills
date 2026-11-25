const splitPath = (path) => path.split('/').filter(Boolean);

function matchParts(parts, segments) {
  if (parts.length !== segments.length) {
    return null;
  }
  const params = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const segment = segments[index];
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(segment);
      } catch {
        return null;
      }
    } else if (part !== segment) {
      return null;
    }
  }
  return params;
}

export function createRouter() {
  const routes = [];

  return {
    add(method, pattern, handler) {
      routes.push({ method, pattern, parts: splitPath(pattern), handler });
    },

    match(method, pathname) {
      const segments = splitPath(pathname);
      let pathExists = false;
      for (const route of routes) {
        const params = matchParts(route.parts, segments);
        if (!params) {
          continue;
        }
        if (route.method === method) {
          return { route, params };
        }
        pathExists = true;
      }
      return pathExists ? { methodNotAllowed: true } : null;
    },
  };
}
