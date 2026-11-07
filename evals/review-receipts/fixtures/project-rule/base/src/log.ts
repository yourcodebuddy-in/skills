export const lines: string[] = [];

export const log = {
  info(message: string): void {
    lines.push(message);
  },
};
