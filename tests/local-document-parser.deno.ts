/**
 * Exact edge-runtime smoke tests. Cache npm:unpdf@0.12.1 first, then run offline:
 * deno test --cached-only --no-config --no-lock --node-modules-dir=none --deny-net tests/local-document-parser.deno.ts
 * No --allow-net, --allow-read, --allow-env, or --allow-run is needed at runtime.
 */
import assert from "node:assert/strict";
import { LocalDocumentError, parseLocalDocument, SHEETJS_RUNTIME_VERSION } from "../supabase/functions/_shared/local-document-parser.ts";
import * as xlsx from "../supabase/functions/_shared/vendor/sheetjs-0.20.3.mjs";
import * as cptable from "../supabase/functions/_shared/vendor/sheetjs-cpexcel-0.20.3.mjs";

xlsx.set_cptable(cptable);
const utf8 = (value: string) => new TextEncoder().encode(value);
const errorCode = (expected: string) => (error: unknown) => error instanceof LocalDocumentError && error.code === expected;

function pdfFixture(imageOnly = false): Uint8Array {
  const stream = imageOnly ? "q 10 0 0 10 0 0 cm /Im1 Do Q" : "BT /F1 12 Tf 20 100 Td (Local evidence 42) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << ${imageOnly ? "/XObject << /Im1 5 0 R >>" : "/Font << /F1 5 0 R >>"} >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    imageOnly ? "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\nabc\nendstream" : "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(file.length); file += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return utf8(file);
}

Deno.test("offline Deno: default vendored parser reads compressed XLSX and binary XLS", async () => {
  assert.equal(xlsx.version, SHEETJS_RUNTIME_VERSION);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([["الاسم", "المبلغ"], ["أحمد", 125]]), "تبرعات");
  for (const [extension, bookType] of [["xlsx", "xlsx"], ["xls", "biff8"]] as const) {
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType, compression: true }));
    const parsed = await parseLocalDocument({ fileName: `actual.${extension}`, bytes });
    assert.equal(parsed.rows[1].values[0], "أحمد");
    assert.equal(parsed.rows[1].values[1], 125);
    assert.equal(parsed.evidence[1].row, 2);
    assert.equal(parsed.truncated, false);
  }
});

Deno.test("offline Deno: the default pinned unpdf parser extracts a real text PDF", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = () => { attempts++; throw new Error("Runtime network forbidden"); };
  try {
    const parsed = await parseLocalDocument({ fileName: "actual.pdf", bytes: pdfFixture() });
    assert.equal(parsed.text, "Local evidence 42");
    assert.equal(parsed.pageCount, 1);
    assert.equal(parsed.evidence[0].page, 1);
    assert.equal(attempts, 0);
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("offline Deno: the default pinned unpdf parser rejects a real image-only PDF", async () => {
  await assert.rejects(parseLocalDocument({ fileName: "scan.pdf", bytes: pdfFixture(true) }), errorCode("ocr_unsupported"));
});

Deno.test("offline Deno: corrupt Office/PDF never use a text fallback", async () => {
  await assert.rejects(parseLocalDocument({ fileName: "bad.xlsx", bytes: new Uint8Array([0x50, 0x4b, 3, 4, ...utf8("Revenue 500 excellent results")]) }), errorCode("invalid_office"));
  await assert.rejects(parseLocalDocument({ fileName: "bad.pdf", bytes: utf8("%PDF-1.4\nRevenue 500 excellent results") }), errorCode("invalid_pdf"));
});

Deno.test("offline Deno: Unicode CSV remains local and bounded", async () => {
  const parsed = await parseLocalDocument({ fileName: "x.csv", bytes: utf8('الاسم,المبلغ\n"أحمد, علي",125\nفاطمة,250') }, { limits: { maxRows: 2 } });
  assert.equal(parsed.rows[1].values[0], "أحمد, علي");
  assert.ok(parsed.truncated);
  assert.ok(parsed.warnings.some((warning) => warning.code === "row_limit"));
});
