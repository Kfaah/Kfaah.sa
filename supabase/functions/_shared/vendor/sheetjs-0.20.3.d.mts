/** Minimal integration types for the unmodified official SheetJS CE 0.20.3 ESM. */
export const version: string;
export interface WorkSheet { [address: string]: unknown }
export interface WorkBook { SheetNames: string[]; Sheets: Record<string, WorkSheet> }
export function read(bytes: Uint8Array, options: Record<string, unknown>): WorkBook;
export function write(workbook: WorkBook, options: Record<string, unknown>): ArrayBuffer;
export function set_cptable(table: unknown): void;
export const SSF: { parse_date_code(value: number): { y: number; m: number; d: number; H: number; M: number; S: number } | null };
export const utils: {
  sheet_to_json<T = Record<string, unknown>>(sheet: WorkSheet, options?: Record<string, unknown>): T[];
  book_new(): WorkBook;
  aoa_to_sheet(rows: unknown[][]): WorkSheet;
  book_append_sheet(workbook: WorkBook, sheet: WorkSheet, name: string): void;
};
