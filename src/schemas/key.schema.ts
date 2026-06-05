import z from 'zod';

const DIGIT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

const LETTER_KEYS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
] as const;

const SYMBOL_KEYS = [
  '`',
  '-',
  '=',
  '[',
  ']',
  '\\',
  ';',
  "'",
  ',',
  '.',
  '/',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  '|',
  '~',
  '{',
  '}',
  ':',
  '<',
  '>',
  '?',
] as const;

const SPECIAL_KEYS = [
  'escape',
  'esc',
  'enter',
  'return',
  'tab',
  'space',
  'backspace',
  'delete',
  'insert',
  'clear',
  'home',
  'end',
  'pageUp',
  'pageDown',
  'up',
  'down',
  'left',
  'right',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
] as const;

const MODIFIER_KEYS = ['ctrl', 'shift', 'alt', 'super'] as const;

export const DigitKeySchema = z.enum(DIGIT_KEYS);
export type DigitKey = z.infer<typeof DigitKeySchema>;

export const LetterKeySchema = z.enum(LETTER_KEYS);
export type LetterKey = z.infer<typeof LetterKeySchema>;

export const SymbolKeySchema = z.enum(SYMBOL_KEYS);
export type SymbolKey = z.infer<typeof SymbolKeySchema>;

export const SpecialKeySchema = z.enum(SPECIAL_KEYS);
export type SpecialKey = z.infer<typeof SpecialKeySchema>;

export const BaseKeyBindSchema = z.union([DigitKeySchema, LetterKeySchema, SymbolKeySchema, SpecialKeySchema]);
export type BaseKeyBind = z.infer<typeof BaseKeyBindSchema>;

export const ModifierKeySchema = z.enum(MODIFIER_KEYS);
export type ModifierKey = z.infer<typeof ModifierKeySchema>;

export const KeybindWithLeaderKeySchema = z.templateLiteral([z.literal('<leader>'), BaseKeyBindSchema]);
export const KeybindWithModifierSchema = z.templateLiteral([ModifierKeySchema, z.literal('+'), BaseKeyBindSchema]);
export const VimKeybindSchema = z.union([BaseKeyBindSchema, KeybindWithLeaderKeySchema, KeybindWithModifierSchema]);
