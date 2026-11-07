import { pathToFileURL } from "node:url";
const { cartLine } = await import(pathToFileURL(`${process.cwd()}/src/cart.ts`).href);
const inline = (n, c, q) => {
  const t = c * q;
  return `${n} x${q}: $${Math.floor(t / 100)}.${String(t % 100).padStart(2, "0")}`;
};
for (const c of [0, 1, 5, 99, 100, 101, 1250, -1, -100, -250])
  for (const q of [0, 1, 2, 3]) if (cartLine("a", c, q) !== inline("a", c, q)) process.exit(1);
