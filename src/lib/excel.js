import * as XLSX from 'xlsx';

export async function readSheet(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  // normalisasi header: huruf kecil, spasi -> _
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[String(k).trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    return o;
  });
}

export function downloadSheet(filename, rows, sheetName = 'Data', colWidths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
