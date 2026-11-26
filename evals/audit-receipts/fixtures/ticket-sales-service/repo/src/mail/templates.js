import { formatMoney } from '../lib/money.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: system-ui, sans-serif; color: #1d1d1f; max-width: 560px; margin: 0 auto; padding: 24px;">
${bodyHtml}
<p style="color: #6e6e73; font-size: 13px;">Sent by Box Office on behalf of the organiser.</p>
</body>
</html>`;
}

export function ticketsEmail({ order, event, tier, tickets, publicUrl }) {
  const link = `${publicUrl}/orders/${order.token}`;
  const total = formatMoney(order.total_cents, order.currency);
  const codes = tickets.map((ticket) => ticket.code);
  const text = [
    `Hi ${order.buyer_name},`,
    '',
    `Here are your tickets for ${event.title} at ${event.venue}, ${event.starts_at}.`,
    `${order.quantity} x ${tier.name}, ${total} in total.`,
    '',
    ...codes.map((code) => `  ${code}`),
    '',
    `Your order: ${link}`,
  ].join('\n');
  const html = layout(
    event.title,
    `<p>Hi ${escapeHtml(order.buyer_name)},</p>
<p>Here are your tickets for <strong>${escapeHtml(event.title)}</strong> at ${escapeHtml(event.venue)}, ${escapeHtml(event.starts_at)}.</p>
<p>${order.quantity} &times; ${escapeHtml(tier.name)}, ${escapeHtml(total)} in total.</p>
<ul>${codes.map((code) => `<li><code>${code}</code></li>`).join('')}</ul>
<p><a href="${escapeHtml(link)}">View your order</a></p>`,
  );
  return { kind: 'tickets', to: order.buyer_email, subject: `Your tickets for ${event.title}`, text, html };
}

export function refundEmail(plan) {
  const amount = formatMoney(plan.amountCents, plan.currency);
  const what = plan.quantity > 0 ? `${plan.quantity} ticket${plan.quantity === 1 ? '' : 's'}` : 'your order';
  const text = `Hi ${plan.buyerName},\n\nWe've refunded ${amount} for ${what} to ${plan.eventTitle}. It can take up to 10 days to reach your account.`;
  const html = layout(
    plan.eventTitle,
    `<p>Hi ${escapeHtml(plan.buyerName)},</p>
<p>We've refunded ${escapeHtml(amount)} for ${escapeHtml(what)} to <strong>${escapeHtml(plan.eventTitle)}</strong>.
It can take up to 10 days to reach your account.</p>`,
  );
  return { kind: 'refund', to: plan.buyerEmail, subject: `Refund for ${plan.eventTitle}`, text, html };
}

export function eventCancelledEmail({ event, buyer }) {
  const text = `Hi ${buyer.name},\n\n${event.title} on ${event.starts_at} has been cancelled by the organiser. You'll get a full refund, including the booking fee, in a separate email.`;
  const html = layout(
    event.title,
    `<p>Hi ${escapeHtml(buyer.name)},</p>
<p><strong>${escapeHtml(event.title)}</strong> on ${escapeHtml(event.starts_at)} has been cancelled by the organiser.
You'll get a full refund, including the booking fee, in a separate email.</p>`,
  );
  return { kind: 'event_cancelled', to: buyer.email, subject: `Cancelled: ${event.title}`, text, html };
}
