export type Order = {
  id: string;
  customerId: string;
  dueDate: string;
  paidAt: string | null;
  cancelledAt: string | null;
  amountCents: number;
};

export type Customer = { id: string; name: string };
