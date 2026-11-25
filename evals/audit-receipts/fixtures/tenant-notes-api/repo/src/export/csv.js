const NEEDS_QUOTES = /[",\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const csvRow = (values) => values.map(csvCell).join(',');

export const toCsv = (header, rows) => `${[header, ...rows].map(csvRow).join('\r\n')}\r\n`;
