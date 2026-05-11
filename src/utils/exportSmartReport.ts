import jsPDF from "jspdf";

export interface SmartReportPayload {
  report: {
    title: string;
    executive_summary: string;
    key_metrics: { label: string; value: string; note?: string }[];
    sections: { heading: string; body: string; bullets?: string[] }[];
    conclusion: string;
  };
  meta: {
    org_name: string;
    suggestion_title: string;
    category: string;
    audience: string;
    totals: { donations: number; expenses: number; allocated: number; fully_spent_donors: number; donors: number };
  };
}

const fmtSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " SAR";

// jsPDF default fonts don't render Arabic. We render an HTML element off-screen and rasterize it.
export async function exportSmartReportPdf(payload: SmartReportPayload) {
  const { report, meta } = payload;
  const html2canvas = (await import("html2canvas")).default;

  const wrap = document.createElement("div");
  wrap.dir = "rtl";
  wrap.style.cssText = `
    position: fixed; top: -10000px; left: 0; width: 794px; padding: 48px;
    background: #ffffff; color: #0f172a; font-family: 'Cairo','Tajawal','Segoe UI',sans-serif;
    line-height: 1.7; font-size: 14px;
  `;

  wrap.innerHTML = `
    <div style="border-bottom:4px solid #0d7a5f;padding-bottom:16px;margin-bottom:24px">
      <div style="font-size:12px;color:#64748b">${meta.org_name}</div>
      <h1 style="margin:6px 0 4px;font-size:26px;color:#0d7a5f;font-weight:800">${escape(report.title)}</h1>
      <div style="font-size:12px;color:#475569">للجمهور: ${escape(meta.audience)} • ${new Date().toLocaleDateString("ar-SA-u-nu-latn")}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
      ${kpi("إجمالي التبرعات", fmtSAR(meta.totals.donations), "#10b981")}
      ${kpi("إجمالي المصروفات", fmtSAR(meta.totals.expenses), "#0d7a5f")}
      ${kpi("المصروف للمتبرعين", fmtSAR(meta.totals.allocated), "#0284c7")}
      ${kpi("متبرعون أُكمل صرفهم", `${meta.totals.fully_spent_donors}/${meta.totals.donors}`, "#7c3aed")}
    </div>

    <section style="margin-bottom:20px">
      <h2 style="font-size:16px;color:#0d7a5f;border-right:4px solid #0d7a5f;padding-right:10px;margin-bottom:8px">الملخص التنفيذي</h2>
      <p style="margin:0;white-space:pre-wrap">${escape(report.executive_summary)}</p>
    </section>

    <section style="margin-bottom:20px">
      <h2 style="font-size:16px;color:#0d7a5f;border-right:4px solid #0d7a5f;padding-right:10px;margin-bottom:8px">المؤشرات الرئيسية</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${report.key_metrics.map(m => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
            <div style="font-size:11px;color:#64748b">${escape(m.label)}</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${escape(m.value)}</div>
            ${m.note ? `<div style="font-size:11px;color:#475569;margin-top:2px">${escape(m.note)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </section>

    ${report.sections.map(s => `
      <section style="margin-bottom:20px;page-break-inside:avoid">
        <h2 style="font-size:16px;color:#0d7a5f;border-right:4px solid #0d7a5f;padding-right:10px;margin-bottom:8px">${escape(s.heading)}</h2>
        <div style="white-space:pre-wrap">${escape(s.body)}</div>
        ${s.bullets?.length ? `<ul style="margin:8px 24px 0 0;padding:0">${s.bullets.map(b => `<li style="margin-bottom:4px">${escape(b)}</li>`).join("")}</ul>` : ""}
      </section>
    `).join("")}

    <section style="margin-top:24px;background:linear-gradient(135deg,#0d7a5f 0%,#10b981 100%);color:#fff;padding:18px;border-radius:10px">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">الخلاصة</div>
      <div style="white-space:pre-wrap;font-size:13px">${escape(report.conclusion)}</div>
    </section>

    <div style="margin-top:18px;text-align:center;font-size:10px;color:#94a3b8">
      تم توليد هذا التقرير تلقائياً من منصة Charity CRM
    </div>
  `;

  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let pos = 0;
    let remaining = imgH;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(img, "JPEG", 0, pos, imgW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      pos -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, pos, imgW, imgH);
      remaining -= pageH;
    }
    pdf.save(`${report.title}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}

function kpi(label: string, value: string, color: string) {
  return `<div style="background:${color};color:#fff;border-radius:10px;padding:12px;text-align:center">
    <div style="font-size:10px;opacity:.85">${escape(label)}</div>
    <div style="font-size:15px;font-weight:800;margin-top:4px">${escape(value)}</div>
  </div>`;
}

function escape(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}