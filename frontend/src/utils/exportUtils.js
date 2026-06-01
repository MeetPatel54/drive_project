const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildFileName = (name, extension) => {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${name}-${stamp}.${extension}`;
};

const downloadBlob = (content, mimeType, fileName) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const tableHtml = ({ title, columns, rows }) => `
  <h2>${escapeHtml(title)}</h2>
  <table>
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${
        rows.length
          ? rows
              .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`)
              .join("")
          : `<tr><td colspan="${columns.length}">No data available</td></tr>`
      }
    </tbody>
  </table>
`;

const documentHtml = (title, sections) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 18px; }
        h2 { font-size: 16px; margin: 22px 0 8px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 700; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      ${sections.map(tableHtml).join("")}
    </body>
  </html>
`;

export const exportSectionsToExcel = ({ title, fileName, sections }) => {
  const html = documentHtml(title, sections);
  downloadBlob(html, "application/vnd.ms-excel;charset=utf-8", buildFileName(fileName, "xls"));
};

export const printSectionsAsPdf = ({ title, sections }) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  let didPrint = false;
  const printFrame = () => {
    if (didPrint) return;
    didPrint = true;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = printFrame;

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(documentHtml(title, sections));
  doc.close();
  setTimeout(printFrame, 250);
};
