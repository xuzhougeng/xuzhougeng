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

function rowInk(ctx, width, y) {
  const row = Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y)));
  const data = ctx.getImageData(0, row, width, 1).data;
  let ink = 0;
  for (let x = 0; x < width; x += 2) {
    const i = x * 4;
    if (data[i + 3] > 12 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) ink += 1;
  }
  return ink;
}

function findWhiteBreak(canvas, minY, maxY) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const width = canvas.width;
  const inkLimit = Math.max(4, width * 0.002);
  let run = 0;
  const floorMin = Math.ceil(minY);
  for (let y = Math.floor(maxY); y >= floorMin; y -= 1) {
    if (rowInk(ctx, width, y) <= inkLimit) {
      run += 1;
      if (run >= 4) return y + Math.floor(run / 2);
    } else {
      run = 0;
    }
  }
  return maxY;
}

function blockBoxes(root, canvas) {
  const rootRect = root.getBoundingClientRect();
  const scale = canvas.width / rootRect.width;
  return [...root.querySelectorAll("header, h2, h3, p, li, footer")].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      top: (rect.top - rootRect.top) * scale,
      bottom: (rect.bottom - rootRect.top) * scale,
      heading: /^H[1-6]$/.test(el.tagName),
    };
  }).sort((a, b) => a.top - b.top);
}

function keepWithHeading(boxes, y, minKeep) {
  const prev = [...boxes].reverse().find((box) => box.top < y - 1);
  if (prev && prev.heading && prev.top >= minKeep) return prev.top;
  return y;
}

function pageCuts(root, canvas, pagePx) {
  const boxes = blockBoxes(root, canvas);
  const height = canvas.height;
  const cuts = [0];
  let start = 0;
  while (start < height - 8) {
    const ideal = Math.min(start + pagePx, height);
    if (ideal >= height - 8) break;
    const minKeep = start + pagePx * 0.42;
    const split = boxes.find((box) => box.top < ideal - 2 && box.bottom > ideal + 2);
    let end = ideal;
    if (split) {
      end = split.top >= minKeep ? split.top : findWhiteBreak(canvas, Math.max(split.top, minKeep), ideal);
    } else {
      const after = boxes.filter((box) => !box.heading && box.bottom <= ideal && box.bottom >= minKeep).pop();
      if (after) end = after.bottom;
    }
    end = keepWithHeading(boxes, end, minKeep);
    end = Math.min(height, Math.max(start + 48, end));
    cuts.push(end);
    start = end;
  }
  if (cuts[cuts.length - 1] < height) cuts.push(height);
  return cuts;
}

function cropCanvas(canvas, y0, y1) {
  const y = Math.max(0, Math.floor(y0));
  const h = Math.max(1, Math.ceil(y1) - y);
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  slice.height = h;
  const ctx = slice.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, slice.width, h);
  ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
  return slice;
}

async function exportPdf(node, filename) {
  const { toCanvas } = await htmlToImage();
  const pdfMod = await jsPdf();
  const JsPDF = pdfMod.jsPDF || pdfMod.default;

  const host = document.createElement("div");
  host.className = "pdf-host";
  const clone = node.cloneNode(true);
  clone.querySelectorAll(".resume-tools, img[alt='visitors']").forEach((el) => el.remove());
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...clone.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await toCanvas(clone, captureOptions(2));
    const pdf = new JsPDF({ unit: "mm", format: "a4", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const imgW = pageW - margin * 2;
    const imgH = pageH - margin * 2;
    const pagePx = canvas.width * (imgH / imgW);
    const cuts = pageCuts(clone, canvas, pagePx);

    for (let i = 0; i < cuts.length - 1; i += 1) {
      if (i > 0) pdf.addPage();
      const slice = cropCanvas(canvas, cuts[i], cuts[i + 1]);
      const sliceH = (slice.height / slice.width) * imgW;
      pdf.addImage(slice, "PNG", margin, margin, imgW, sliceH, undefined, "FAST");
    }
    pdf.save(filename + ".pdf");
  } finally {
    host.remove();
  }
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
