import jsPDF from "jspdf";

/** Slice at text/row boundaries; tall reports must not cut lines at page edges. */
export async function exportPaginatedPdf(element: HTMLElement, filename: string) {
  await document.fonts.ready;
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
  const origin = element.getBoundingClientRect(), scale = canvas.width / origin.width;
  const protectedRanges = Array.from(element.querySelectorAll("tr,p,li,h1,h2,h3,.meta")).map(node => {
    const rect = node.getBoundingClientRect();
    let bottom = rect.bottom;
    if (/^H[123]$/.test(node.tagName) && node.nextElementSibling) {
      const next = node.nextElementSibling.querySelector("tbody tr") || node.nextElementSibling.querySelector("tr,p,li") || node.nextElementSibling;
      bottom = Math.max(bottom, next.getBoundingClientRect().bottom);
    }
    return { top: Math.floor((rect.top - origin.top) * scale), bottom: Math.ceil((bottom - origin.top) * scale) };
  });
  const maxHeight = Math.floor((height - 22) * canvas.width / width), pages: Array<{ top: number; height: number }> = [];
  for (let top = 0; top < canvas.height;) {
    let end = Math.min(top + maxHeight, canvas.height);
    for (let attempt = 0; attempt < protectedRanges.length; attempt++) {
      const crossing = protectedRanges.filter(r => r.top < end && r.bottom > end && r.bottom - r.top < maxHeight && r.top > top + 10);
      if (!crossing.length) break;
      end = Math.min(...crossing.map(r => r.top));
    }
    pages.push({ top, height: end - top }); top = end;
  }
  pages.forEach((page, index) => {
    if (index) pdf.addPage();
    const slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = page.height;
    const context = slice.getContext("2d"); if (!context) throw new Error("PDF canvas unavailable");
    context.drawImage(canvas, 0, page.top, canvas.width, page.height, 0, 0, canvas.width, page.height);
    pdf.addImage(slice.toDataURL("image/jpeg", 0.94), "JPEG", 0, 10, width, page.height * width / canvas.width);
    pdf.setFontSize(9); pdf.setTextColor(100); pdf.text(`${index + 1} / ${pages.length}`, width / 2, height - 5, { align: "center" });
  });
  pdf.save(filename);
}
