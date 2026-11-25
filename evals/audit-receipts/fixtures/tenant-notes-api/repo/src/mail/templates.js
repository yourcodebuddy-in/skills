const MAX_DIGEST_ITEMS = 25;

const ROLE_PHRASE = { viewer: 'a viewer', editor: 'an editor', owner: 'an owner' };

export function memberAddedEmail({ to, inviterName, teamName, role, url }) {
  return {
    to,
    subject: `You've been added to ${teamName}`,
    text: [
      `${inviterName} added you to ${teamName} as ${ROLE_PHRASE[role]}.`,
      '',
      `Open the team: ${url}`,
      '',
      "If you didn't expect this, you can leave the team from its members page.",
    ].join('\n'),
  };
}

export function digestEmail({ to, name, notes, publicUrl }) {
  const byTeam = new Map();
  for (const note of notes.slice(0, MAX_DIGEST_ITEMS)) {
    const list = byTeam.get(note.team_name) ?? [];
    list.push(note);
    byTeam.set(note.team_name, list);
  }

  const lines = [`Hi ${name},`, '', "Here's what changed in your teams in the last 24 hours."];
  for (const [team, items] of byTeam) {
    lines.push('', team);
    for (const note of items) {
      lines.push(`  - ${note.title}: ${publicUrl}/teams/${note.team_id}/notes/${note.id}`);
    }
  }
  if (notes.length > MAX_DIGEST_ITEMS) {
    lines.push('', `…and ${notes.length - MAX_DIGEST_ITEMS} more.`);
  }
  lines.push('', 'You can turn this email off in your account settings.');

  const count = notes.length === 1 ? '1 note' : `${notes.length} notes`;
  return { to, subject: `Your daily digest: ${count} changed`, text: lines.join('\n') };
}
