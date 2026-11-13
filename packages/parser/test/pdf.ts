// pdf.js page text, extracted the way the web app does it (shared by the PDF tests).
/** Page text the way the web app will extract it: items joined, newline at each line end. */
export async function pdfPages(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it: any) => (it.str ?? "") + (it.hasEOL ? "\n" : "")).join(""));
  }
  return pages;
}
