export interface OfficeReport {
  title: string; organization: string; period: string; summary?: string;
  sections: Array<{ title: string; headers: string[]; rows: string[][] }>;
  recommendations?: string[];
}

export async function exportReportOffice(report: OfficeReport, format: "docx" | "xlsx") {
  const filename = `${report.organization}_${report.title}`.replace(/[\\/:*?"<>|]/g, "-");
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const rows: string[][] = [[report.title], [report.organization], [report.period], []];
    if (report.summary) rows.push(["الملخص التنفيذي"], [report.summary], []);
    for (const section of report.sections) rows.push([section.title], section.headers, ...section.rows, []);
    if (report.recommendations?.length) rows.push(["التوصيات"], ...report.recommendations.map(value => [value]));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 45 }, { wch: 30 }, { wch: 95 }];
    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(workbook, sheet, "التقرير");
    XLSX.writeFile(workbook, filename + ".xlsx");
    return;
  }
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = await import("docx");
  const paragraph = (text: string, bold = false) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 140 }, children: [new TextRun({ text, bold, font: "Arial", size: bold ? 28 : 22, rightToLeft: true })] });
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [paragraph(report.title, true), paragraph(report.organization), paragraph(report.period)];
  if (report.summary) children.push(paragraph("الملخص التنفيذي", true), paragraph(report.summary));
  for (const section of report.sections) {
    children.push(paragraph(section.title, true), new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true,
      rows: [section.headers, ...section.rows].map((cells, index) => new TableRow({ cantSplit: true, tableHeader: index === 0, children: cells.map(text => new TableCell({ children: [paragraph(text, index === 0)], shading: index === 0 ? { fill: "EAF4EF" } : undefined })) })),
    }));
  }
  if (report.recommendations?.length) children.push(paragraph("التوصيات الاستراتيجية", true), ...report.recommendations.map((text, index) => paragraph(`${index + 1}. ${text}`)));
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }] });
  const url = URL.createObjectURL(await Packer.toBlob(document));
  const link = window.document.createElement("a"); link.href = url; link.download = filename + ".docx"; window.document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
