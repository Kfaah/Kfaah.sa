/** Minimal integration types for SheetJS CE 0.20.3's official codepage module. */
export const version: string;
export const utils: {
  decode(codepage: number, bytes: Uint8Array | number[]): string;
  encode(codepage: number, value: string): Uint8Array | number[];
};
