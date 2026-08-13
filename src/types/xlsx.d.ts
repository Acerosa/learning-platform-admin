declare module "xlsx" {
  export function read(data: ArrayBuffer, opts: { type: string }): { SheetNames: string[]; Sheets: Record<string, unknown> };
  export function writeFile(wb: unknown, path: string): void;
  export const utils: {
    book_new(): { SheetNames: string[]; Sheets: Record<string, unknown> };
    json_to_sheet(rows: unknown[]): unknown;
    book_append_sheet(wb: unknown, sheet: unknown, name: string): void;
    sheet_to_json(sheet: unknown, opts: { defval: string; raw: boolean }): Record<string, unknown>[];
  };
  const XLSX: {
    read: typeof read;
    writeFile: typeof writeFile;
    utils: typeof utils;
  };
  export default XLSX;
}
