// Routes are "METHOD /path/:param". Params match one path segment.

const compile = (pattern) => {
  const names = [];
  const source = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        names.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}$`), names };
};

export const createRouter = () => {
  const routes = [];

  const add = (method, pattern, handler, options = {}) => {
    routes.push({ method, pattern, handler, auth: options.auth ?? null, ...compile(pattern) });
  };

  return {
    get: (pattern, handler, options) => add("GET", pattern, handler, options),
    post: (pattern, handler, options) => add("POST", pattern, handler, options),
    patch: (pattern, handler, options) => add("PATCH", pattern, handler, options),
    delete: (pattern, handler, options) => add("DELETE", pattern, handler, options),

    // Returns the route and its params, or which methods the path allows when only the method is wrong.
    match: (method, pathname) => {
      const allowed = [];
      for (const route of routes) {
        const found = route.regex.exec(pathname);
        if (!found) {
          continue;
        }
        if (route.method !== method) {
          allowed.push(route.method);
          continue;
        }
        const params = {};
        route.names.forEach((name, index) => {
          params[name] = decodeURIComponent(found[index + 1]);
        });
        return { route, params };
      }
      return { route: null, allowed };
    },
  };
};
