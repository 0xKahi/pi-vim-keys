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

const CAPITAL_LETTER_KEYS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
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

export const CapitalLetterKeySchema = z.enum(CAPITAL_LETTER_KEYS);
export type CapitalLetterKey = z.infer<typeof CapitalLetterKeySchema>;

export const SymbolKeySchema = z.enum(SYMBOL_KEYS);
export type SymbolKey = z.infer<typeof SymbolKeySchema>;

export const CharOnlyKeySchema = z.union([DigitKeySchema, LetterKeySchema, CapitalLetterKeySchema, SymbolKeySchema]);

export const SpecialKeySchema = z.enum(SPECIAL_KEYS);
export type SpecialKey = z.infer<typeof SpecialKeySchema>;

export const BaseKeyBindSchema = z.union([DigitKeySchema, LetterKeySchema, SymbolKeySchema, SpecialKeySchema]);
export type BaseKeyBind = z.infer<typeof BaseKeyBindSchema>;

//** BaseKey Schema with CapitalLetters */
export const VimBaseKeySchema = z.union([BaseKeyBindSchema, CapitalLetterKeySchema]);
//** BaseKey with CapitalLetters */
export type VimBaseKey = z.infer<typeof VimBaseKeySchema>;

export const ModifierKeySchema = z.enum(MODIFIER_KEYS);
export type ModifierKey = z.infer<typeof ModifierKeySchema>;

//** BaseKey multichar sequences e.g. `o` or `oe` */
export const VimBaseKeySequenceSchema = z.union([VimBaseKeySchema, z.templateLiteral([VimBaseKeySchema, VimBaseKeySchema])]);
export const KeybindWithLeaderKeySchema = z.templateLiteral([z.literal('<leader>'), VimBaseKeySequenceSchema]);

export const KeybindWithModifierSchema = z.templateLiteral([ModifierKeySchema, z.literal('+'), BaseKeyBindSchema]);
export const VimKeybindSchema = z.union([KeybindWithLeaderKeySchema, KeybindWithModifierSchema]);
