import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { send } from "./http.js";

const TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
});

const PAGES = Object.freeze({
  "/": "index.html",
  "/cart": "cart.html",
  "/checkout": "checkout.html",
  "/account": "account.html",
  "/admin": "admin.html",
});

// Serves apps/web/public. Returns false when there is no such file so the caller can 404.
export const createStaticHandler = (root) => {
  const base = resolve(root);

  return async (pathname, res) => {
    let relative = PAGES[pathname];
    if (!relative) {
      try {
        relative = decodeURIComponent(pathname).replace(/^\/+/, "");
      } catch {
        return false;
      }
    }
    const file = resolve(base, relative);
    if (!file.startsWith(base + sep) || relative.includes("\0")) {
      return false;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) {
        return false;
      }
      const body = await readFile(file);
      send(res, 200, body, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=300",
      });
      return true;
    } catch {
      return false;
    }
  };
};
