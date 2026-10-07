import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  buildLocalDocumentAnalysis,
  createXlsxWorkbookAdapter,
  LOCAL_DOCUMENT_LIMITS,
  LocalDocumentError,
  parseLocalDocument,
  SHEETJS_RUNTIME_VERSION,
} from "../supabase/functions/_shared/local-document-parser.ts";
import type { LocalDocumentAdapters, LocalPdfDocument, PdfTextChunk } from "../supabase/functions/_shared/local-document-parser.ts";

const utf8 = (text: string) => new TextEncoder().encode(text);
const code = (expected: string) => (error: unknown) => error instanceof LocalDocumentError && error.code === expected;
const cfbHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

/** Small real ZIP builder also permits deliberately forged expansion metadata. */
function zip(entries: { name: string; text: string; deflate?: boolean; declaredSize?: number }[]): Uint8Array {
  const local: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const original = Buffer.from(entry.text);
    const data = entry.deflate ? deflateRawSync(original) : original;
    const expanded = entry.declaredSize ?? original.length;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    header.writeUInt32LE(crc32(original), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(expanded, 22);
    header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(original), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(expanded, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    local.push(header, name, data);
    directory.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, central, end]));
}

function fakePdf(pages: string[][], state = { destroyed: false, cleaned: 0, requested: [] as number[] }): LocalPdfDocument {
  return {
    numPages: pages.length,
    async getPage(page) {
      state.requested.push(page);
      return {
        streamTextContent() {
          return new ReadableStream<PdfTextChunk>({ start(controller) {
            controller.enqueue({ items: pages[page - 1].map((str) => ({ str, hasEOL: true })) });
            controller.close();
          } });
        },
        cleanup() { state.cleaned++; },
      };
    },
    destroy() { state.destroyed = true; },
  };
}

function realPdf(image = false): Uint8Array {
  const stream = image ? "q 10 0 0 10 0 0 cm /Im1 Do Q" : "BT /F1 12 Tf 20 100 Td (Local evidence 42) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << ${image ? "/XObject << /Im1 5 0 R >>" : "/Font << /F1 5 0 R >>"} >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    image ? "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\nabc\nendstream" : "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let file = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(file.length); file += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return utf8(file);
}

test("TXT preserves Arabic text and creates source evidence without semantic inference", async () => {
  const parsed = await parseLocalDocument({ fileName: "ملاحظات.txt", bytes: utf8("تقرير التبرعات ١٢٣\nroute: donations") });
  assert.equal(parsed.text, "تقرير التبرعات ١٢٣\nroute: donations");
  assert.equal(parsed.evidence[0].kind, "text");
  const analysis = buildLocalDocumentAnalysis(parsed, { fileName: "ملاحظات.txt" });
  assert.equal(analysis.route, "other");
  assert.equal(analysis.method, "local_deterministic_extraction");
  for (const field of [analysis.strengths, analysis.gaps, analysis.recommendations, analysis.suggested_tasks]) assert.deepEqual(field, []);
  assert.equal(buildLocalDocumentAnalysis(parsed, { fileName: "x.txt", detectedSchema: "donations" }).route, "donations");
  assert.equal(buildLocalDocumentAnalysis(parsed, { fileName: "x.txt", detectedSchema: "invented" }).route, "other");
});

test("CSV supports quoted commas, escaped quotes, embedded newlines and stable source rows", async () => {
  const parsed = await parseLocalDocument({ fileName: "test.csv", bytes: utf8('\uFEFFname,amount,note\r\n"أحمد, علي",0012,"سطر\nثان ""اقتباس"""\r\n') });
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[1], { sheet: "CSV", row: 2, values: ["أحمد, علي", "0012", 'سطر\nثان "اقتباس"'] });
  assert.deepEqual(parsed.tables[0].headerCandidate, ["name", "amount", "note"]);
  assert.equal(parsed.truncated, false);
});

test("CSV supports semicolon directives and tab-separated first rows", async () => {
  const semi = await parseLocalDocument({ fileName: "semi.csv", bytes: utf8("sep=;\na;b\n1;2") });
  assert.deepEqual(semi.rows.map((r) => r.row), [2, 3]);
  assert.deepEqual(semi.rows[1].values, ["1", "2"]);
  const tabs = await parseLocalDocument({ fileName: "tab.csv", bytes: utf8("a\tb\n1\t2") });
  assert.deepEqual(tabs.rows[1].values, ["1", "2"]);
});

test("CSV rejects malformed quoting", async () => {
  for (const value of ['name,"unterminated', 'name,ab"cd', '"closed"illegal,next']) {
    await assert.rejects(parseLocalDocument({ fileName: "bad.csv", bytes: utf8(value) }), code("invalid_csv"));
  }
});

test("Unicode decoding is strict and UTF-16 BOMs are supported", async () => {
  const le = new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("مرحبا", "utf16le")]));
  assert.equal((await parseLocalDocument({ fileName: "utf16.txt", bytes: le })).text, "مرحبا");
  await assert.rejects(parseLocalDocument({ fileName: "bad.txt", bytes: new Uint8Array([0xc3, 0x28]) }), code("unsupported_encoding"));
  await assert.rejects(parseLocalDocument({ fileName: "binary.txt", bytes: new Uint8Array([65, 0, 66]) }), code("binary_text"));
});

test("renamed binary documents are never decoded as text", async () => {
  for (const bytes of [utf8("%PDF-1.7 raw decoy words"), utf8("preamble\n%PDF-1.7 raw decoy words"), cfbHeader, new Uint8Array([0x50, 0x4b, 3, 4, 65])]) {
    await assert.rejects(parseLocalDocument({ fileName: "fake.txt", bytes }), code("format_mismatch"));
  }
  await assert.rejects(parseLocalDocument({ fileName: "fake.xlsx", bytes: utf8("name,amount\nplain,42") }), code("invalid_office"));
  await assert.rejects(parseLocalDocument({ fileName: "fake.xls", bytes: utf8("plain decoy should not become a workbook") }), code("invalid_office"));
  await assert.rejects(parseLocalDocument({ fileName: "fake.pdf", bytes: utf8("ordinary words are not PDF evidence") }), code("invalid_pdf"));
});

test("unsupported Office, images, URLs and zero bytes fail explicitly", async () => {
  for (const name of ["x.docx", "x.pptx", "x.png", "https://example.org/report"]) {
    await assert.rejects(parseLocalDocument({ fileName: name, bytes: utf8("decoy") }), code("unsupported_format"));
  }
  await assert.rejects(parseLocalDocument({ fileName: "empty.csv", bytes: new Uint8Array() }), code("empty_file"));
});

test("byte limits precede parsing and callers cannot increase security ceilings", async () => {
  await assert.rejects(parseLocalDocument({ fileName: "large.txt", bytes: utf8("abcdef") }, { limits: { maxBytes: 5 } }), code("too_large"));
  for (const maxRows of [0, -1, 1.5, NaN, LOCAL_DOCUMENT_LIMITS.maxRows + 1]) {
    await assert.rejects(parseLocalDocument({ fileName: "x.txt", bytes: utf8("x") }, { limits: { maxRows } }), code("invalid_limits"));
  }
});

test("row, column, cell and text bounds are explicit and finite", async () => {
  const rows = await parseLocalDocument({ fileName: "x.csv", bytes: utf8("h\n1\n2") }, { limits: { maxRows: 2 } });
  assert.equal(rows.rows.length, 2);
  assert.ok(rows.warnings.some((w) => w.code === "row_limit"));
  const exact = await parseLocalDocument({ fileName: "x.csv", bytes: utf8("h\n1\n") }, { limits: { maxRows: 2 } });
  assert.equal(exact.truncated, false);
  const columns = await parseLocalDocument({ fileName: "x.csv", bytes: utf8("a,b,c\n1,2,3") }, { limits: { maxColumns: 2 } });
  assert.equal(columns.rows[0].values.length, 2);
  assert.ok(columns.warnings.some((w) => w.code === "column_limit"));
  const cells = await parseLocalDocument({ fileName: "x.csv", bytes: utf8("abcdef,z") }, { limits: { maxCellChars: 3 } });
  assert.equal(cells.rows[0].values[0], "abc");
  assert.ok(cells.truncated);
  const text = await parseLocalDocument({ fileName: "x.txt", bytes: utf8("abcdefghij") }, { limits: { maxTextChars: 5 } });
  assert.equal(text.text, "abcde");
  assert.ok(text.truncated);
  const wide = await parseLocalDocument({ fileName: "x.csv", bytes: utf8("abcdef,ghijkl") }, { limits: { maxTextChars: 9 } });
  assert.equal(wide.text, "abcdef\tgh");
  assert.deepEqual(wide.rows[0].values, ["abcdef", "gh"]);
  assert.ok(wide.truncated);
});

test("bad Office ZIP fails before the binary parser and never falls back to decoy plaintext", async () => {
  let called = false;
  const adapters = { readWorkbook: async () => { called = true; throw new Error("must not execute"); } };
  const invalid = new Uint8Array([0x50, 0x4b, 3, 4, ...utf8("Revenue 100000 strong performance")]);
  await assert.rejects(parseLocalDocument({ fileName: "bad.xlsx", bytes: invalid }, { adapters }), code("invalid_office"));
  const disguisedDocx = zip([{ name: "[Content_Types].xml", text: "<Types/>" }, { name: "word/document.xml", text: "decoy words" }]);
  await assert.rejects(parseLocalDocument({ fileName: "bad.xlsx", bytes: disguisedDocx }, { adapters }), code("invalid_office"));
  assert.equal(called, false);
});

test("ZIP expansion limits use real streamed bytes, not only claimed metadata", async () => {
  let called = false;
  const adapters = { readWorkbook: async () => { called = true; throw new Error("must not execute"); } };
  const expansion = zip([{ name: "[Content_Types].xml", text: "<Types/>" }, { name: "xl/workbook.xml", text: "A".repeat(50_000), deflate: true }]);
  await assert.rejects(parseLocalDocument({ fileName: "bomb.xlsx", bytes: expansion }, { adapters }), code("archive_limit"));
  const forged = zip([{ name: "[Content_Types].xml", text: "<Types/>" }, { name: "xl/workbook.xml", text: "abcdef".repeat(1000), deflate: true, declaredSize: 8 }]);
  await assert.rejects(parseLocalDocument({ fileName: "forged.xlsx", bytes: forged }, { adapters }), code("archive_limit"));
  assert.equal(called, false);
});

test("duplicate and path-traversal ZIP entries fail safely", async () => {
  for (const path of ["../xl/workbook.xml", "[Content_Types].xml"]) {
    const bytes = zip([{ name: "[Content_Types].xml", text: "x" }, { name: path, text: "x" }]);
    await assert.rejects(parseLocalDocument({ fileName: "bad.xlsx", bytes }), code("invalid_office"));
  }
});

test("injected workbook extraction preserves typed values, source rows and sheet boundaries", async () => {
  const bytes = zip([{ name: "[Content_Types].xml", text: "<Types/>" }, { name: "xl/workbook.xml", text: "<workbook/>" }]);
  const parsed = await parseLocalDocument({ fileName: "x.xlsx", bytes }, { adapters: { readWorkbook: async () => ({ sheets: [
    { name: "Arabic", rows: [{ row: 2, values: ["المبلغ", "الحالة"] }, { row: 3, values: [125, true] }] },
    { name: "Second", rows: [{ row: 1, values: ["Other"] }] },
  ] }) } });
  assert.equal(parsed.tables.length, 2);
  assert.equal(parsed.rows[0].row, 2);
  assert.deepEqual(parsed.rows[1].values, [125, true]);
  assert.equal(parsed.evidence[1].sheet, "Arabic");
});

test("parser exceptions and missing dependencies cannot produce fabricated analysis", async () => {
  await assert.rejects(parseLocalDocument({ fileName: "bad.xls", bytes: cfbHeader }, { adapters: { readWorkbook: async () => { throw new Error("damaged"); } } }), code("invalid_office"));
  await assert.rejects(parseLocalDocument({ fileName: "x.xls", bytes: cfbHeader }, { adapters: { readWorkbook: async () => { throw new LocalDocumentError("parser_unavailable", "unavailable"); } } }), code("parser_unavailable"));
});

test("PDF streams text with page evidence and releases resources", async () => {
  const state = { destroyed: false, cleaned: 0, requested: [] as number[] };
  const parsed = await parseLocalDocument({ fileName: "x.pdf", bytes: utf8("%PDF-1.4 decoy binary") }, { adapters: { openPdf: async () => fakePdf([["Actual text 42"], ["الصفحة الثانية"]], state) } });
  assert.equal(parsed.pageCount, 2);
  assert.equal(parsed.evidence[1].page, 2);
  assert.ok(parsed.text.includes("Actual text 42"));
  assert.ok(!parsed.text.includes("decoy"));
  assert.deepEqual(state, { destroyed: true, cleaned: 2, requested: [1, 2] });
});

test("scanned PDF is explicitly unsupported, regardless of text-looking binary bytes", async () => {
  const state = { destroyed: false, cleaned: 0, requested: [] as number[] };
  await assert.rejects(parseLocalDocument({ fileName: "scan.pdf", bytes: utf8("%PDF-1.4 fake visible words not extracted from pages") }, { adapters: { openPdf: async () => fakePdf([[]], state) } }), code("ocr_unsupported"));
  assert.ok(state.destroyed);
  assert.equal(state.cleaned, 1);
});

test("PDF page and streamed text limits stop extraction and mark partial output", async () => {
  const state = { destroyed: false, cleaned: 0, requested: [] as number[] };
  const pages = await parseLocalDocument({ fileName: "x.pdf", bytes: realPdf() }, { limits: { maxPages: 1 }, adapters: { openPdf: async () => fakePdf([["first"], ["not reached"]], state) } });
  assert.deepEqual(state.requested, [1]);
  assert.ok(pages.warnings.some((w) => w.code === "page_limit"));
  const text = await parseLocalDocument({ fileName: "x.pdf", bytes: realPdf() }, { limits: { maxTextChars: 5 }, adapters: { openPdf: async () => fakePdf([["abcdefghijk"]]) } });
  assert.equal(text.text, "abcde");
  assert.equal(text.evidence[0].excerpt, "abcde");
  assert.ok(text.truncated);
});

test("mixed image/text PDF reports missing text without inventing OCR", async () => {
  const parsed = await parseLocalDocument({ fileName: "x.pdf", bytes: realPdf() }, { adapters: { openPdf: async () => fakePdf([[], ["text"]]) } });
  assert.equal(parsed.text, "text");
  assert.ok(parsed.warnings.some((w) => w.code === "page_without_text"));
  assert.equal(parsed.evidence[0].page, 2);
});

test("local parsers never fetch user URLs or send file data over fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error("network forbidden"); };
  try {
    const parsed = await parseLocalDocument({ fileName: "x.txt", bytes: utf8("Fetch https://attacker.invalid/private now") });
    assert.ok(parsed.text.includes("https://attacker.invalid/private"));
    await parseLocalDocument({ fileName: "x.pdf", bytes: realPdf() }, { adapters: { openPdf: async () => fakePdf([["https://attacker.invalid/private"]]) } });
    assert.equal(fetched, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("vendored SheetJS bytes match the pinned official 0.20.3 distribution", async () => {
  const vendor = new URL("../supabase/functions/_shared/vendor/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("sheetjs-0.20.3.source.json", vendor), "utf8"));
  assert.equal(manifest.version, "0.20.3");
  assert.equal(manifest.source, "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz");
  const hashes = {
    "sheetjs-0.20.3.mjs": "1a0fb062ee9781b13f6687371b202aaefc53b6ce55b530c027e01f9c087b77db",
    "sheetjs-cpexcel-0.20.3.mjs": "7a7bba23b6b6f23b5c69fbb631f78d1d455f74b57e4aa54e9a2f81a8ab844964",
    "sheetjs-0.20.3.LICENSE": "4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64",
    "sheetjs-cpexcel-0.20.3.LICENSE": "4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64",
  };
  for (const [file, expected] of Object.entries(hashes)) {
    assert.equal(createHash("sha256").update(await readFile(new URL(file, vendor))).digest("hex"), expected);
  }
  const xlsx = await import("../supabase/functions/_shared/vendor/sheetjs-0.20.3.mjs");
  assert.equal(xlsx.version, SHEETJS_RUNTIME_VERSION);
  assert.equal(xlsx.version, "0.20.3");
});

test("the production SheetJS adapter rejects the vulnerable legacy dependency", () => {
  let parsed = false;
  assert.throws(() => createXlsxWorkbookAdapter({ version: "0.18.5", read() { parsed = true; throw new Error("must not parse"); } }), code("dependency_blocked"));
  assert.equal(parsed, false);
});

test("real XLSX and binary XLS round trips use the exact vendored production path", async () => {
  const xlsx = await import("../supabase/functions/_shared/vendor/sheetjs-0.20.3.mjs");
  xlsx.set_cptable(await import("../supabase/functions/_shared/vendor/sheetjs-cpexcel-0.20.3.mjs"));
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([["الاسم", "المبلغ", "الصيغة"], ["أحمد", 125, 250]]);
  sheet.C2 = { t: "n", v: 250, f: "B2*2" };
  xlsx.utils.book_append_sheet(workbook, sheet, "تبرعات");
  for (const [extension, bookType] of [["xlsx", "xlsx"], ["xls", "biff8"]] as const) {
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType, compression: true }));
    const parsed = await parseLocalDocument({ fileName: `actual.${extension}`, bytes });
    assert.equal(parsed.rows[1].values[0], "أحمد");
    assert.equal(parsed.rows[1].values[1], 125);
    assert.equal(parsed.rows[1].values[2], 250);
    // The BIFF8 writer may emit cached values without this formula.
    if (extension === "xlsx") assert.ok(parsed.warnings.some((w) => w.code === "cached_formulas"));
  }
});

test("vendored SheetJS limits sparse dimensions and preserves missing formula-cache values", async () => {
  const xlsx = await import("../supabase/functions/_shared/vendor/sheetjs-0.20.3.mjs");
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([["name", "value"], ["row", 12], ["omitted", 44]]);
  sheet.C2 = { t: "n", f: "1+1" };
  sheet["!ref"] = "A1:C3";
  xlsx.utils.book_append_sheet(workbook, sheet, "test");
  const parsed = await parseLocalDocument({ fileName: "bounded.xlsx", bytes: new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" })) }, { limits: { maxRows: 2 } });
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.truncated);
  assert.notEqual(parsed.rows[1].values[2], 2);
});

test("real PDF.js parses text PDF and rejects image-only PDF without network access", async (t) => {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try { pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); }
  catch { t.skip("Real PDF.js package unavailable; integration test not run."); return; }
  const adapters: LocalDocumentAdapters = { openPdf: async (bytes) => await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, disableAutoFetch: true, disableRange: true, disableStream: true, stopAtErrors: true, maxImageSize: 0, enableXfa: false, verbosity: 0 }).promise };
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw new Error("network forbidden"); };
  try {
    const text = await parseLocalDocument({ fileName: "actual.pdf", bytes: realPdf() }, { adapters });
    assert.equal(text.text, "Local evidence 42");
    assert.equal(text.evidence[0].page, 1);
    await assert.rejects(parseLocalDocument({ fileName: "actual-scan.pdf", bytes: realPdf(true) }, { adapters }), code("ocr_unsupported"));
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = originalFetch; }
});
