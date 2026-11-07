import { read, withRowLock, write } from "./store.ts";

type GiftCard = { balanceCents: number };

export function spendGiftCard(code: string, cents: number): Promise<number> {
  return withRowLock(`giftcard:${code}`, async () => {
    const card = await read<GiftCard>(`giftcard:${code}`);
    if (!card || card.balanceCents < cents) throw new Error("insufficient balance");
    const balanceCents = card.balanceCents - cents;
    await write(`giftcard:${code}`, { balanceCents });
    return balanceCents;
  });
}
