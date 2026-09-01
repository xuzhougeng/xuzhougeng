const HTML_TO_IMAGE = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm";
const JSPDF = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

const zh = document.documentElement.lang.startsWith("zh");
const copy = zh
  ? { exporting: "导出中…", failed: "导出失败，请稍后重试" }
  : { exporting: "Exporting…", failed: "Export failed. Please try again." };

function keepNode(node) {
  if (!(node instanceof Element)) return true;
  if (node.classList.contains("resume-tools")) return false;
  if (node.getAttribute("alt") === "visitors") return false;
  return true;
}

function captureOptions(pixelRatio) {
  return {
    cacheBust: true,
    backgroundColor: "#ffffff",
    pixelRatio,
    filter: keepNode,
  };
}

let htmlToImageMod;
let jsPdfMod;

async function htmlToImage() {
  if (!htmlToImageMod) htmlToImageMod = await import(HTML_TO_IMAGE);
  return htmlToImageMod;
}

async function jsPdf() {
  if (!jsPdfMod) jsPdfMod = await import(JSPDF);
  return jsPdfMod;
}

function downloadDataUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function withCapture(fn) {
  document.body.classList.add("capturing");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await fn();
  } finally {
    document.body.classList.remove("capturing");
  }
}

async function exportPng(node, filename) {
  const { toPng } = await htmlToImage();
  const url = await withCapture(() => toPng(node, captureOptions(2)));
  downloadDataUrl(url, filename + ".png");
}

async function exportSvg(node, filename) {
  const { toSvg } = await htmlToImage();
  const url = await withCapture(() => toSvg(node, captureOptions(1)));
  downloadDataUrl(url, filename + ".svg");
}

async function exportPdf(node, filename) {
  const { toCanvas } = await htmlToImage();
  const pdfMod = await jsPdf();
  const JsPDF = pdfMod.jsPDF || pdfMod.default;
  const canvas = await withCapture(() => toCanvas(node, captureOptions(2)));
  const pdf = new JsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height / canvas.width) * imgW;
  const pageInner = pageH - margin * 2;
  const imgData = canvas.toDataURL("image/png");

  let offset = 0;
  let first = true;
  while (offset < imgH - 0.4) {
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(imgData, "PNG", margin, margin - offset, imgW, imgH, undefined, "FAST");
    offset += pageInner;
  }
  pdf.save(filename + ".pdf");
}

function setOpen(root, open) {
  const toggle = root.querySelector(".export-toggle");
  const menu = root.querySelector(".export-menu");
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  menu.hidden = !open;
}

function initExport() {
  const root = document.querySelector(".export");
  const node = document.querySelector(".container");
  if (!root || !node) return;

  const toggle = root.querySelector(".export-toggle");
  const menu = root.querySelector(".export-menu");
  const status = root.querySelector(".export-status");
  const filename = node.getAttribute("data-export-name") || (zh ? "徐洲更-简历" : "Zhou-Geng-Xu-CV");

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(root, menu.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) setOpen(root, false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(root, false);
  });

  menu.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-export]");
    if (!button) return;
    const format = button.getAttribute("data-export");
    const buttons = menu.querySelectorAll("[data-export]");
    buttons.forEach((el) => {
      el.disabled = true;
    });
    status.hidden = false;
    status.textContent = copy.exporting;
    setOpen(root, false);
    try {
      if (format === "pdf") await exportPdf(node, filename);
      else if (format === "png") await exportPng(node, filename);
      else if (format === "svg") await exportSvg(node, filename);
      status.hidden = true;
    } catch (err) {
      console.error(err);
      status.hidden = false;
      status.textContent = copy.failed;
      setOpen(root, true);
    } finally {
      buttons.forEach((el) => {
        el.disabled = false;
      });
    }
  });
}

initExport();
