import assert from "node:assert/strict";
import { test } from "node:test";
import { spendGiftCard } from "./giftcards.ts";
import { write } from "./store.ts";

test("spends from a balance", async () => {
  await write("giftcard:a", { balanceCents: 500 });
  assert.equal(await spendGiftCard("a", 200), 300);
});
