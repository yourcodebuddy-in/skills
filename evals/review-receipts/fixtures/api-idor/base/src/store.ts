export type Invoice = { id: string; accountId: string; amountCents: number; notes: string };

const invoices = new Map<string, Invoice>();

export function seed(list: Invoice[]): void {
  invoices.clear();
  for (const invoice of list) invoices.set(invoice.id, { ...invoice });
}

export function listByAccount(accountId: string): Invoice[] {
  return [...invoices.values()].filter((invoice) => invoice.accountId === accountId);
}

export function findById(id: string): Invoice | undefined {
  return invoices.get(id);
}

export function updateNotes(id: string, notes: string): void {
  const invoice = invoices.get(id);
  if (invoice) invoice.notes = notes;
}
