// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Ambient Node types for a Deno npm specifier, never a runtime declaration import.
/// <reference path="./vendor/unpdf-npm.d.ts" />
/**
 * In-process extraction only. Document bytes are never sent to an AI or URL.
 * CSV/TXT use strict Unicode decoding; Office/PDF must pass binary parsers.
 * SheetJS is a locally vendored, integrity-pinned patched official distribution.
 * Deployments should cache the pinned PDF npm module before entering isolated mode.
 * Limits bound input, ZIP expansion and returned content, not every allocation or
 * CPU cycle inside the third-party XLS/PDF codecs. Keep runtime memory/time limits.
 */
export type LocalDocumentFormat = "txt" | "csv" | "xlsx" | "xls" | "pdf";
export type DocumentCell = string | number | boolean | null;

export interface DocumentWarning { code: string; message: string }
export interface DocumentRow { sheet: string; row: number; values: DocumentCell[] }
export interface DocumentEvidence {
  id: string;
  kind: "text" | "row" | "page";
  excerpt: string;
  sheet?: string;
  row?: number;
  page?: number;
}
export interface ParsedLocalDocument {
  format: LocalDocumentFormat;
  text: string;
  rows: DocumentRow[];
  tables: { name: string; rowCount: number; headerCandidate: string[] }[];
  evidence: DocumentEvidence[];
  warnings: DocumentWarning[];
  truncated: boolean;
  pageCount?: number;
}
export interface LocalDocumentLimits {
  maxBytes: number;
  maxRows: number;
  maxColumns: number;
  maxSheets: number;
  maxPages: number;
  maxTextChars: number;
  maxCellChars: number;
  maxZipEntries: number;
  maxUncompressedBytes: number;
  maxZipEntryBytes: number;
  maxCompressionRatio: number;
}
export const LOCAL_DOCUMENT_LIMITS: Readonly<LocalDocumentLimits> = Object.freeze({
  maxBytes: 30 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 100,
  maxSheets: 10,
  maxPages: 50,
  maxTextChars: 40_000,
  maxCellChars: 4000,
  maxZipEntries: 2000,
  maxUncompressedBytes: 32 * 1024 * 1024,
  maxZipEntryBytes: 16 * 1024 * 1024,
  maxCompressionRatio: 200,
});

export class LocalDocumentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LocalDocumentError";
    this.code = code;
  }
}

export interface WorkbookData {
  sheets: { name: string; rows: { row: number; values: unknown[] }[] }[];
  warnings?: DocumentWarning[];
}
export interface PdfTextChunk { items: { str?: string; hasEOL?: boolean }[] }
export interface LocalPdfPage {
  streamTextContent(): ReadableStream<PdfTextChunk>;
  cleanup?(): unknown;
}
export interface LocalPdfDocument {
  numPages: number;
  getPage(page: number): Promise<LocalPdfPage>;
  destroy(): Promise<unknown> | unknown;
}
export interface LocalDocumentAdapters {
  readWorkbook?(bytes: Uint8Array, limits: LocalDocumentLimits): Promise<WorkbookData>;
  openPdf?(bytes: Uint8Array): Promise<LocalPdfDocument>;
}
export interface LocalDocumentInput { fileName: string; bytes: Uint8Array; mimeType?: string }

export const SHEETJS_RUNTIME_VERSION = "0.20.3";
const fail = (code: string, message: string): never => { throw new LocalDocumentError(code, message); };
const invalidOffice = (): never => fail("invalid_office", "ملف Excel غير صالح أو غير مدعوم؛ لم يُقرأ كنص عادي.");
const hasPrefix = (bytes: Uint8Array, prefix: number[]) => prefix.every((v, i) => bytes[i] === v);
const isZip = (bytes: Uint8Array) => hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]);
const isCfb = (bytes: Uint8Array) => hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
function pdfHeaderOffset(bytes: Uint8Array): number {
  for (let i = 0; i < Math.min(bytes.length - 4, 1024); i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) return i;
  }
  return -1;
}

function getLimits(custom: Partial<LocalDocumentLimits> = {}): LocalDocumentLimits {
  const limits = { ...LOCAL_DOCUMENT_LIMITS };
  for (const key of Object.keys(custom) as (keyof LocalDocumentLimits)[]) {
    const value = custom[key];
    if (!Number.isSafeInteger(value) || value! <= 0 || value! > LOCAL_DOCUMENT_LIMITS[key]) {
      fail("invalid_limits", "حدود التحليل غير صالحة؛ يمكن خفض الحدود الافتراضية فقط.");
    }
    limits[key] = value!;
  }
  return limits;
}

function addWarning(result: ParsedLocalDocument, code: string, message: string, truncated = false) {
  if (!result.warnings.some((warning) => warning.code === code)) result.warnings.push({ code, message });
  if (truncated) result.truncated = true;
}

function appendText(result: ParsedLocalDocument, text: string, limits: LocalDocumentLimits): boolean {
  const remaining = limits.maxTextChars - result.text.length;
  if (text.length > remaining) {
    result.text += text.slice(0, Math.max(0, remaining));
    addWarning(result, "text_limit", "اقتصر الاستخراج على الحد المسموح من النص؛ النتائج جزئية.", true);
    return false;
  }
  result.text += text;
  return true;
}

function addEvidence(result: ParsedLocalDocument, evidence: Omit<DocumentEvidence, "id">) {
  if (result.evidence.length < 20) {
    result.evidence.push({ id: `e${result.evidence.length + 1}`, ...evidence, excerpt: evidence.excerpt.slice(0, 500) });
  }
}

function strictText(bytes: Uint8Array): string {
  if (isZip(bytes) || isCfb(bytes) || hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46]) || pdfHeaderOffset(bytes) >= 0) {
    fail("format_mismatch", "محتوى الملف ثنائي ولا يطابق امتداد الملف النصي.");
  }
  let encoding = "utf-8";
  if (hasPrefix(bytes, [0xff, 0xfe])) encoding = "utf-16le";
  if (hasPrefix(bytes, [0xfe, 0xff])) encoding = "utf-16be";
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { return fail("unsupported_encoding", "تعذّر قراءة ترميز النص؛ احفظ الملف بصيغة UTF-8 أو UTF-16."); }
  // Reject binary C0 controls, while permitting ordinary text line separators.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000e-\u001f]/u.test(text)) {
    fail("binary_text", "يحتوي الملف على بيانات ثنائية؛ لم تُستخدم قراءة نصية احتياطية.");
  }
  return text.replace(/^\uFEFF/, "");
}

/** Validate every ZIP member, including actual bounded expansion, before SheetJS. */
async function validateXlsxZip(bytes: Uint8Array, limits: LocalDocumentLimits): Promise<void> {
  if (!isZip(bytes)) invalidOffice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) invalidOffice();
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) ||
    count !== view.getUint16(end + 8, true) || count === 0xffff ||
    directorySize === 0xffffffff || directoryOffset === 0xffffffff ||
    directoryOffset + directorySize !== end) invalidOffice();
  if (!count || count > limits.maxZipEntries) fail("archive_limit", "عدد مكونات الملف المضغوط يتجاوز الحد الآمن.");
  let cursor = directoryOffset;
  let totalExpanded = 0;
  const names = new Set<string>();
  const ranges: { start: number; end: number }[] = [];
  for (let entry = 0; entry < count; entry++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) invalidOffice();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const expanded = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags & 1 || (method !== 0 && method !== 8) ||
      view.getUint16(cursor + 34, true) !== 0 || localOffset + 30 > directoryOffset) invalidOffice();
    if (compressed === 0xffffffff || expanded === 0xffffffff || localOffset === 0xffffffff) invalidOffice();
    if (expanded > limits.maxZipEntryBytes || totalExpanded + expanded > limits.maxUncompressedBytes ||
      expanded > Math.max(1, compressed) * limits.maxCompressionRatio) {
      fail("archive_limit", "حجم فك ضغط Excel يتجاوز الحد الآمن.");
    }
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name || names.has(name) || name.includes("\0") || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..")) invalidOffice();
    names.add(name);
    if (view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method ||
      view.getUint16(localOffset + 26, true) !== nameLength) invalidOffice();
    const dataStart = localOffset + 30 + nameLength + view.getUint16(localOffset + 28, true);
    if (dataStart + compressed > directoryOffset) invalidOffice();
    for (let i = 0; i < nameLength; i++) if (bytes[localOffset + 30 + i] !== bytes[cursor + 46 + i]) invalidOffice();
    if (!(flags & 8) && (view.getUint32(localOffset + 18, true) !== compressed || view.getUint32(localOffset + 22, true) !== expanded)) invalidOffice();
    ranges.push({ start: localOffset, end: dataStart + compressed });
    let actual = 0;
    if (method === 0) {
      actual = compressed;
    } else {
      let stream: DecompressionStream;
      try { stream = new DecompressionStream("deflate-raw"); }
      catch { return fail("parser_unavailable", "ميزة فك الضغط الآمن غير متاحة في بيئة التشغيل."); }
      const source = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(bytes.slice(dataStart, dataStart + compressed)); controller.close(); } });
      const reader = source.pipeThrough(stream).getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          actual += chunk.value.byteLength;
          if (actual > expanded || actual > limits.maxZipEntryBytes || totalExpanded + actual > limits.maxUncompressedBytes) {
            await reader.cancel().catch(() => {});
            fail("archive_limit", "تجاوز الحجم الفعلي لفك الضغط الحد الآمن.");
          }
        }
      } catch (error) {
        if (error instanceof LocalDocumentError) throw error;
        invalidOffice();
      } finally { reader.releaseLock(); }
    }
    if (actual !== expanded) invalidOffice();
    totalExpanded += actual;
    cursor = next;
  }
  ranges.sort((a, b) => a.start - b.start);
  if (ranges.some((range, i) => i > 0 && range.start < ranges[i - 1].end)) invalidOffice();
  if (cursor !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) invalidOffice();
}

async function defaultReadWorkbook(bytes: Uint8Array, limits: LocalDocumentLimits): Promise<WorkbookData> {
  // No readFile/URL API, external link resolution, macros, or formula calculation.
  let xlsx: typeof import("./vendor/sheetjs-0.20.3.mjs");
  try {
    // Literal local imports allow Deno's deploy bundler to include both modules.
    xlsx = await import("./vendor/sheetjs-0.20.3.mjs");
    xlsx.set_cptable(await import("./vendor/sheetjs-cpexcel-0.20.3.mjs"));
  } catch { return fail("parser_unavailable", "محلل Excel المحلي المحدّث غير متاح في بيئة التشغيل."); }
  return await createXlsxWorkbookAdapter(xlsx)(bytes, limits);
}

/** Reuses the production SheetJS options with a locally installed module in tests. */
export function createXlsxWorkbookAdapter(xlsx: {
  version: string;
  read(bytes: Uint8Array, options: Record<string, unknown>): { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
}): NonNullable<LocalDocumentAdapters["readWorkbook"]> {
  if (xlsx.version !== SHEETJS_RUNTIME_VERSION) {
    fail("dependency_blocked", "تعطّل تحليل Excel لأن نسخة المحلل لا تطابق النسخة المحلية المحدّثة المعتمدة.");
  }
  return async (bytes, limits) => {
  const workbook = xlsx.read(bytes, {
    type: "array", sheetRows: limits.maxRows + 1,
    sheets: Array.from({ length: limits.maxSheets + 1 }, (_, i) => i),
    cellFormula: true, cellHTML: false, cellText: false, cellStyles: false,
    cellDates: false, bookVBA: false, bookDeps: false, WTF: true,
  });
  if (!Array.isArray(workbook.SheetNames) || !workbook.Sheets) invalidOffice();
  const result: WorkbookData = { sheets: [], warnings: [] };
  let hasFormula = false;
  for (const name of workbook.SheetNames.slice(0, limits.maxSheets + 1)) {
    if (typeof name !== "string") invalidOffice();
    const sheet = workbook.Sheets[name];
    if (!sheet || typeof sheet !== "object") continue;
    const rows = new Map<number, unknown[]>();
    for (const address of Object.keys(sheet)) {
      const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address);
      if (!match) continue;
      const row = Number(match[2]);
      if (row > limits.maxRows + 1) continue;
      let col = 0;
      for (const character of match[1]) col = col * 26 + character.charCodeAt(0) - 64;
      const cell = sheet[address] as { f?: unknown; v?: unknown } | undefined;
      if (cell?.f) hasFormula = true;
      // Keep one sentinel column so the caller explicitly reports omitted columns.
      if (col > limits.maxColumns + 1) col = limits.maxColumns + 1;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row)![col - 1] = cell?.v ?? null;
    }
    result.sheets.push({ name, rows: [...rows].sort(([a], [b]) => a - b).map(([row, values]) => ({ row, values })) });
    if (typeof sheet["!fullref"] === "string" && sheet["!fullref"] !== sheet["!ref"]) {
      result.warnings!.push({ code: "row_limit", message: "تجاوزت الورقة حد الصفوف؛ النتائج جزئية." });
    }
  }
  if (workbook.SheetNames.length > limits.maxSheets) result.warnings!.push({ code: "sheet_limit", message: "تجاوز الملف حد الأوراق؛ النتائج جزئية." });
  if (hasFormula) result.warnings!.push({ code: "cached_formulas", message: "عُرضت القيم المحفوظة للصيغ فقط؛ لم تُنفّذ الصيغ وقد تكون القيم قديمة أو فارغة." });
  return result;
  };
}

async function defaultOpenPdf(bytes: Uint8Array): Promise<LocalPdfDocument> {
  let module;
  // Literal pinned import is visible to Deno's deployment dependency graph.
  try { module = await import("npm:unpdf@0.12.1"); }
  catch { return fail("parser_unavailable", "محلل PDF المحلي غير متاح في بيئة التشغيل."); }
  return await module.getDocumentProxy(bytes, {
    isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
    useWorkerFetch: false, disableAutoFetch: true, disableRange: true,
    disableStream: true, stopAtErrors: true, maxImageSize: 0, enableXfa: false,
  });
}

function appendRow(result: ParsedLocalDocument, sheet: string, row: number, cells: unknown[], limits: LocalDocumentLimits): boolean {
  if (cells.length > limits.maxColumns) addWarning(result, "column_limit", "حُذفت أعمدة تجاوزت الحد المسموح؛ النتائج جزئية.", true);
  let values: DocumentCell[] = Array.from({ length: Math.min(cells.length, limits.maxColumns) }, (_, i) => {
    const cell = cells[i];
    if (cell == null) return null;
    if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
    if (typeof cell === "boolean") return cell;
    if (typeof cell !== "string") return null;
    if (cell.length > limits.maxCellChars) addWarning(result, "cell_limit", "اقتُطعت قيم خلايا تجاوزت الحد المسموح؛ النتائج جزئية.", true);
    return cell.slice(0, limits.maxCellChars);
  });
  if (!values.some((value) => value !== null && String(value).trim() !== "")) return true;
  if (result.rows.length >= limits.maxRows) {
    addWarning(result, "row_limit", "اقتصر الاستخراج على الحد المسموح من الصفوف؛ النتائج جزئية.", true);
    return false;
  }
  let text = values.map((value) => value == null ? "" : String(value)).join("\t");
  let complete = true;
  // A wide row is retained as an explicitly partial row, never an unbounded object.
  if (result.text.length + text.length + (result.text ? 1 : 0) > limits.maxTextChars) {
    addWarning(result, "text_limit", "اقتصر الاستخراج على الحد المسموح من النص؛ النتائج جزئية.", true);
    let available = limits.maxTextChars - result.text.length - (result.text ? 1 : 0);
    const partial: DocumentCell[] = [];
    for (const value of values) {
      if (partial.length) available--;
      if (available <= 0) break;
      const valueText = value == null ? "" : String(value);
      if (valueText.length > available) {
        if (typeof value === "string") partial.push(value.slice(0, available));
        break;
      }
      partial.push(value);
      available -= valueText.length;
    }
    values = partial;
    if (!values.length) return false;
    text = values.map((value) => value == null ? "" : String(value)).join("\t");
    complete = false;
  }
  result.rows.push({ sheet, row, values });
  appendText(result, `${result.text ? "\n" : ""}${text}`, limits);
  addEvidence(result, { kind: "row", sheet, row, excerpt: text });
  return complete;
}

function parseCsv(text: string, result: ParsedLocalDocument, limits: LocalDocumentLimits) {
  let delimiter = ",";
  let startRow = 1;
  const directive = /^sep=([,;\t])\r?\n/i.exec(text);
  if (directive) { delimiter = directive[1]; text = text.slice(directive[0].length); startRow = 2; }
  else {
    const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
    let quoted = false;
    for (let i = 0; i < Math.min(text.length, 8192); i++) {
      if (text[i] === '"') {
        if (quoted && text[i + 1] === '"') { i++; continue; }
        quoted = !quoted;
      } else if (!quoted) {
        if (text[i] === "\n" || text[i] === "\r") break;
        if (counts.has(text[i])) counts.set(text[i], counts.get(text[i])! + 1);
      }
    }
    delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  }
  let field = "";
  let cells: string[] = [];
  let quoted = false;
  let closed = false;
  let row = startRow;
  let cellLength = 0;
  let columns = 0;
  const appendCharacter = (character: string) => {
    cellLength++;
    if (field.length < limits.maxCellChars) field += character;
    else addWarning(result, "cell_limit", "اقتُطعت قيم خلايا تجاوزت الحد المسموح؛ النتائج جزئية.", true);
  };
  const finishField = () => {
    columns++;
    if (cells.length < limits.maxColumns + 1) cells.push(field);
    if (columns > limits.maxColumns) addWarning(result, "column_limit", "حُذفت أعمدة تجاوزت الحد المسموح؛ النتائج جزئية.", true);
    field = ""; closed = false; cellLength = 0;
  };
  for (let i = 0; i <= text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === undefined) fail("invalid_csv", "CSV غير صالح: حقل مقتبس غير مغلق.");
      if (character === '"') {
        if (text[i + 1] === '"') { appendCharacter('"'); i++; }
        else { quoted = false; closed = true; }
      } else appendCharacter(character);
      continue;
    }
    if (character === '"') {
      if (cellLength || closed) fail("invalid_csv", "CSV غير صالح: علامة اقتباس في موضع غير متوقع.");
      quoted = true;
    } else if (character === delimiter) finishField();
    else if (character === "\r" || character === "\n" || character === undefined) {
      finishField();
      if (!appendRow(result, "CSV", row++, cells, limits)) return;
      cells = []; columns = 0;
      if (character === "\r" && text[i + 1] === "\n") i++;
    } else if (closed) {
      if (character !== " " && character !== "\t") fail("invalid_csv", "CSV غير صالح: نص بعد إغلاق الحقل المقتبس.");
    } else appendCharacter(character);
  }
}

async function parsePdf(bytes: Uint8Array, result: ParsedLocalDocument, limits: LocalDocumentLimits, adapter: NonNullable<LocalDocumentAdapters["openPdf"]>) {
  // Permit an ordinary PDF preamble without ever scanning binary bytes for words.
  const header = pdfHeaderOffset(bytes);
  if (header < 0) fail("invalid_pdf", "ترويسة PDF غير صالحة؛ لم يُقرأ الملف كنص عادي.");
  let pdf: LocalPdfDocument | undefined;
  try {
    pdf = await adapter(bytes.slice(header));
    if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages < 1) fail("invalid_pdf", "عدد صفحات PDF غير صالح.");
    result.pageCount = pdf.numPages;
    if (pdf.numPages > limits.maxPages) addWarning(result, "page_limit", "اقتصر الاستخراج على الحد المسموح من الصفحات؛ النتائج جزئية.", true);
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, limits.maxPages); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const reader = page.streamTextContent().getReader();
      let excerpt = "";
      let hasText = false;
      let stop = false;
      try {
        while (!stop) {
          const chunk = await reader.read();
          if (chunk.done) break;
          for (const item of chunk.value.items) {
            if (typeof item.str !== "string" || !item.str.trim()) continue;
            hasText = true;
            const text = `${item.str}${item.hasEOL ? "\n" : " "}`;
            const textStart = result.text.length;
            const complete = appendText(result, text, limits);
            if (excerpt.length < 500) excerpt += result.text.slice(textStart, textStart + 500 - excerpt.length);
            if (!complete) { stop = true; break; }
          }
        }
      } finally {
        if (stop) await reader.cancel().catch(() => {});
        reader.releaseLock();
        page.cleanup?.();
      }
      if (hasText) addEvidence(result, { kind: "page", page: pageNumber, excerpt: excerpt.trim() });
      else addWarning(result, "page_without_text", "توجد صفحات بلا نص قابل للاستخراج؛ قد تكون صوراً ممسوحة. OCR غير مدعوم محلياً.");
      if (stop) break;
      if (!appendText(result, "\n", limits)) break;
    }
  } catch (error) {
    if (error instanceof LocalDocumentError) throw error;
    fail("invalid_pdf", "تعذّر تحليل PDF محلياً؛ قد يكون تالفاً أو مشفراً. لم تُستخدم قراءة نصية احتياطية.");
  } finally {
    try { if (pdf) await pdf.destroy(); } catch { /* Cleanup must not hide an extraction error. */ }
  }
  if (!result.text.trim()) fail("ocr_unsupported", "لا يحتوي PDF على نص قابل للاستخراج ضمن الصفحات المفحوصة؛ الصور الممسوحة وOCR غير مدعومين في الوضع المحلي.");
}

export async function parseLocalDocument(input: LocalDocumentInput, options: { adapters?: LocalDocumentAdapters; limits?: Partial<LocalDocumentLimits> } = {}): Promise<ParsedLocalDocument> {
  const limits = getLimits(options.limits);
  if (!(input.bytes instanceof Uint8Array)) fail("invalid_input", "بيانات الملف غير صالحة.");
  if (input.bytes.byteLength > limits.maxBytes) fail("too_large", "حجم الملف يتجاوز الحد المسموح للتحليل المحلي.");
  if (!input.bytes.byteLength) fail("empty_file", "الملف فارغ.");
  const extension = /\.([a-z0-9]+)$/i.exec(input.fileName.trim())?.[1].toLowerCase();
  if (!extension || !["txt", "csv", "xlsx", "xls", "pdf"].includes(extension)) {
    fail("unsupported_format", "الصيغة غير مدعومة محلياً. الصيغ المدعومة: TXT وCSV وXLSX وXLS وPDF النصي. الصور وOCR غير مدعومين.");
  }
  const result: ParsedLocalDocument = { format: extension as LocalDocumentFormat, text: "", rows: [], tables: [], evidence: [], warnings: [], truncated: false };
  if (extension === "txt") {
    appendText(result, strictText(input.bytes).trim(), limits);
    if (result.text) addEvidence(result, { kind: "text", excerpt: result.text });
  } else if (extension === "csv") {
    parseCsv(strictText(input.bytes), result, limits);
  } else if (extension === "pdf") {
    await parsePdf(input.bytes, result, limits, options.adapters?.openPdf ?? defaultOpenPdf);
  } else {
    if (extension === "xlsx") await validateXlsxZip(input.bytes, limits);
    else if (!isCfb(input.bytes) && !(input.bytes.length >= 8 && input.bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(input.bytes[1]))) invalidOffice();
    let workbook: WorkbookData;
    try { workbook = await (options.adapters?.readWorkbook ?? defaultReadWorkbook)(input.bytes, limits); }
    catch (error) { if (error instanceof LocalDocumentError) throw error; return invalidOffice(); }
    if (!workbook || !Array.isArray(workbook.sheets) || !workbook.sheets.length) invalidOffice();
    for (const warning of workbook.warnings ?? []) addWarning(result, warning.code, warning.message, /^(row|sheet|column|cell|text)_limit$/.test(warning.code));
    if (workbook.sheets.length > limits.maxSheets) addWarning(result, "sheet_limit", "تجاوز الملف حد الأوراق؛ النتائج جزئية.", true);
    let stop = false;
    for (const sheet of workbook.sheets.slice(0, limits.maxSheets)) {
      if (typeof sheet.name !== "string" || !Array.isArray(sheet.rows)) invalidOffice();
      for (const row of sheet.rows) {
        if (!Number.isSafeInteger(row.row) || row.row < 1 || !Array.isArray(row.values)) invalidOffice();
        if (!appendRow(result, sheet.name, row.row, row.values, limits)) { stop = true; break; }
      }
      if (stop) break;
    }
    addWarning(result, "workbook_values_only", "استُخرجت قيم الخلايا فقط؛ التنسيق والرسوم والصور والتعليقات ليست ضمن التحليل.");
  }
  result.text = result.text.trim();
  if (!result.text) fail("no_text", "لم يُستخرج نص أو خلايا غير فارغة من الملف ضمن الحدود المسموحة.");
  for (const name of new Set(result.rows.map((row) => row.sheet))) {
    const rows = result.rows.filter((row) => row.sheet === name);
    result.tables.push({ name, rowCount: rows.length, headerCandidate: rows[0].values.map((cell) => cell == null ? "" : String(cell)) });
  }
  return result;
}

const ALLOWED_ROUTES = new Set(["donations", "store_master", "store_daily", "subscriptions", "campaigns", "gifts", "abandoned_carts", "bank_transfers", "failed_donations", "staff_duties", "reports", "profiles", "tasks", "other"]);

/** A factual extraction receipt matching the legacy analysis JSON, not an AI opinion. */
export function buildLocalDocumentAnalysis(document: ParsedLocalDocument, context: { fileName: string; detectedSchema?: string | null }) {
  const route = context.detectedSchema && ALLOWED_ROUTES.has(context.detectedSchema) ? context.detectedSchema : "other";
  const labels: Record<LocalDocumentFormat, string> = { txt: "ملف نصي", csv: "جدول CSV", xlsx: "مصنف Excel", xls: "مصنف Excel قديم", pdf: "مستند PDF نصي" };
  const point = document.rows.length ? `استُخرج ${document.rows.length} صفاً غير فارغ، بما في ذلك صفوف العناوين إن وجدت، من ${document.tables.length} جدول.` : `استُخرج ${document.text.length} حرفاً من النص.`;
  return {
    document_type: labels[document.format],
    route,
    route_reason: route === "other" ? "لم يُستنتج قسم من محتوى الملف؛ يحتاج التصنيف إلى مراجعة بشرية." : "احتُفظ بالتصنيف المسجّل للملف دون استنتاج تصنيف جديد.",
    summary: `استخراج محلي حتمي للملف «${context.fileName}». ${point} ${document.pageCount ? `عدد صفحات الملف: ${document.pageCount}. ` : ""}${document.truncated ? "النتيجة جزئية بسبب حدود الاستخراج. " : ""}لم يُنتج تقييم أعمال أو استنتاج دلالي.`,
    key_points: [point, ...document.tables.slice(0, 5).map((table) => `الجدول «${table.name}»: ${table.rowCount} صفاً مستخرجاً.`)],
    // Counts are extraction metadata, not financial or business metrics.
    numbers: [`أحرف النص المستخرج: ${document.text.length}`, ...(document.rows.length ? [`الصفوف المستخرجة (تشمل العناوين): ${document.rows.length}`] : []), ...(document.pageCount ? [`صفحات الملف: ${document.pageCount}`] : [])],
    strengths: [] as string[],
    gaps: [] as string[],
    recommendations: [] as string[],
    suggested_tasks: [] as string[],
    method: "local_deterministic_extraction",
    partial: document.truncated,
    evidence: document.evidence,
    warnings: document.warnings.map((warning) => warning.message),
  };
}
