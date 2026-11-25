const ENTITIES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
const SPECIAL = /[&<>"']/g;

export const escapeHtml = (value) => String(value ?? "").replace(SPECIAL, (character) => ENTITIES[character]);
