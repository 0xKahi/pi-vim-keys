import { COLOR_HEX_REGEX } from '../constants';

type ColorizeOptions = {
  bg?: string;
  fg?: string;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function fgAnsi(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bgAnsi(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

function colorize(text: string, { bg, fg }: ColorizeOptions = {}): string {
  const hasFg = fg !== undefined && COLOR_HEX_REGEX.test(fg);
  const hasBg = bg !== undefined && COLOR_HEX_REGEX.test(bg);

  if (!hasFg && !hasBg) {
    return text;
  }

  const prefix = `${hasBg ? bgAnsi(bg) : ''}${hasFg ? fgAnsi(fg) : ''}`;
  const suffix = `${hasFg ? '\x1b[39m' : ''}${hasBg ? '\x1b[49m' : ''}`;

  return `${prefix}${text}${suffix}`;
}

const ANSI_ESCAPE_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_REGEX, '');
}

export const crayon = {
  colorize(text: string, opts: ColorizeOptions = {}): string {
    return colorize(text, opts);
  },

  reverseVideo(text: string): string {
    return `\x1b[7m${text}\x1b[27m`;
  },

  stripAnsi(text: string): string {
    return stripAnsi(text);
  },
};
