/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import type { FileData, Category } from '../types.ts';
import { DEPOT_MASTER_LIST, DEPOT_ALIAS_MAP } from '../data/depots.ts';

/**
 * Parses a date string into a sortable key (YYYYMMDD).
 */
export function parseDateToSortKey(dateStr: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split('-');
    return `${yyyy}${mm}${dd}`;
  }
  if (/^\d{8}$/.test(dateStr)) {
    if (/^(19|20)\d{6}$/.test(dateStr)) return dateStr;
    const dd = dateStr.substring(0, 2);
    const mm = dateStr.substring(2, 4);
    const yyyy = dateStr.substring(4, 8);
    return `${yyyy}${mm}${dd}`;
  }
  return dateStr;
}

/**
 * Formats any raw date string to standardized DD-MM-YYYY.
 */
export function formatToDateColHeader(rawDate: string): string {
  if (!rawDate || rawDate === 'UNKNOWN') return rawDate || '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) return rawDate;

  if (/^\d{8}$/.test(rawDate)) {
    if (/^(19|20)\d{6}$/.test(rawDate)) {
      // YYYYMMDD -> DD-MM-YYYY
      return `${rawDate.substring(6, 8)}-${rawDate.substring(4, 6)}-${rawDate.substring(0, 4)}`;
    }
    // DDMMYYYY -> DD-MM-YYYY
    return `${rawDate.substring(0, 2)}-${rawDate.substring(2, 4)}-${rawDate.substring(4, 8)}`;
  }

  if (/^\d{2}[/]\d{2}[/]\d{4}$/.test(rawDate)) {
    return rawDate.replace(/\//g, '-');
  }

  return rawDate;
}

/**
 * Determines the list of date columns in DD-MM-YYYY format.
 * If all files belong to a specific month (e.g. 08-2026), generates all days in DD-MM-YYYY (01-08-2026 to 31-08-2026).
 * Otherwise, sorts all distinct uploaded dates chronologically in DD-MM-YYYY.
 */
export function determineMatrixDates(files: FileData[]): { raw: string; display: string }[] {
  if (files.length === 0) {
    const list: { raw: string; display: string }[] = [];
    for (let day = 1; day <= 31; day++) {
      const dd = String(day).padStart(2, '0');
      const dStr = `${dd}-08-2026`;
      list.push({ raw: dStr, display: dStr });
    }
    return list;
  }

  const rawDates = Array.from(new Set(files.map(f => f.date))).filter(Boolean);
  const formattedDates = rawDates.map(d => formatToDateColHeader(d));
  const uniqueFormatted = Array.from(new Set(formattedDates)).filter(d => /^\d{2}-\d{2}-\d{4}$/.test(d));

  // Check if all dates share the same MM-YYYY
  const monthYears = Array.from(new Set(uniqueFormatted.map(d => d.substring(3))));
  if (monthYears.length === 1) {
    const [mmStr, yyyyStr] = monthYears[0].split('-');
    const mm = parseInt(mmStr, 10);
    const yyyy = parseInt(yyyyStr, 10);
    const daysInMonth = new Date(yyyy, mm, 0).getDate();

    const fullMonthDates: { raw: string; display: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ddStr = String(d).padStart(2, '0');
      const dStr = `${ddStr}-${mmStr}-${yyyyStr}`;
      fullMonthDates.push({ raw: dStr, display: dStr });
    }
    return fullMonthDates;
  }

  // Sort distinct dates chronologically
  const sorted = uniqueFormatted.sort((a, b) => parseDateToSortKey(a).localeCompare(parseDateToSortKey(b)));
  return sorted.map(d => ({ raw: d, display: d }));
}

/**
 * Builds a Datewise Matrix Worksheet:
 * - Columns: Sl No, Unit Code, Chalo Code, Name, Date Columns (in DD-MM-YYYY format with No. and Amnt sub-headers)
 * - Row totals for each depot
 * - Bottom Total row for all dates and grand totals
 */
export function buildMatrixWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  files: FileData[],
  predefinedDates?: { raw: string; display: string }[]
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(sheetName);
  const matrixDates = predefinedDates || determineMatrixDates(files);

  const headerPeachFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFCE5CD' }
  };

  const highlightPinkFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFADBD8' }
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
  };

  // Configure Columns
  const columnsDef: Partial<ExcelJS.Column>[] = [
    { key: 'sl', width: 8 },
    { key: 'unitCode', width: 12 },
    { key: 'chaloCode', width: 12 },
    { key: 'name', width: 24 }
  ];

  matrixDates.forEach((d, idx) => {
    columnsDef.push({ key: `date_${idx}_no`, width: 8 });
    columnsDef.push({ key: `date_${idx}_amnt`, width: 14 });
  });

  columnsDef.push({ key: 'total_no', width: 10 });
  columnsDef.push({ key: 'total_amnt', width: 16 });

  ws.columns = columnsDef;

  // Row 1: Top header with DD-MM-YYYY date strings
  const row1Values: (string | null)[] = ['Sl No', 'Unit Code', 'Chalo Code', 'Name'];
  matrixDates.forEach(d => {
    row1Values.push(d.display);
    row1Values.push(null); // Merged pair
  });
  row1Values.push('Total');
  row1Values.push(null);

  const headerRow1 = ws.getRow(1);
  headerRow1.values = row1Values;
  headerRow1.height = 26;

  // Row 2: Sub-headers No. and Amnt
  const row2Values: (string | null)[] = [null, null, null, null];
  matrixDates.forEach(() => {
    row2Values.push('No.');
    row2Values.push('Amnt');
  });
  row2Values.push('No.');
  row2Values.push('Amnt');

  const headerRow2 = ws.getRow(2);
  headerRow2.values = row2Values;
  headerRow2.height = 20;

  // Merge static metadata columns vertically across rows 1 & 2
  ws.mergeCells('A1:A2');
  ws.mergeCells('B1:B2');
  ws.mergeCells('C1:C2');
  ws.mergeCells('D1:D2');

  // Merge date headers horizontally across 2 columns in row 1
  let colPointer = 5;
  matrixDates.forEach(() => {
    ws.mergeCells(1, colPointer, 1, colPointer + 1);
    colPointer += 2;
  });

  // Merge Total across 2 columns in row 1
  ws.mergeCells(1, colPointer, 1, colPointer + 1);

  // Style Header Rows (1 & 2)
  for (let r = 1; r <= 2; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = headerPeachFill;
      cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });
  }

  // Pre-aggregate data by depot code and DD-MM-YYYY date (combining all records for that date)
  const depotDateMap = new Map<string, { employeeCount: number; auditedAmount: number }>();
  files.forEach(f => {
    const rawDepot = f.depotName.toUpperCase();
    const mappedDepot = DEPOT_ALIAS_MAP[rawDepot] || rawDepot;
    const formattedDate = formatToDateColHeader(f.date);
    const key = `${mappedDepot}_${formattedDate}`;
    const existing = depotDateMap.get(key) || { employeeCount: 0, auditedAmount: 0 };
    depotDateMap.set(key, {
      employeeCount: existing.employeeCount + (f.employeeCount || 0),
      auditedAmount: existing.auditedAmount + (f.auditedAmount || 0)
    });
  });

  // Populate Data Rows (Rows 3 to 96 for all 94 master depots)
  DEPOT_MASTER_LIST.forEach((depot, idx) => {
    const rowNum = 3 + idx;
    const rowValues: any[] = [
      depot.sl,
      depot.unitCode,
      depot.chaloCode,
      depot.name
    ];

    let rowTotalNo = 0;
    let rowTotalAmnt = 0;

    matrixDates.forEach(d => {
      const data = depotDateMap.get(`${depot.unitCode}_${d.raw}`);
      if (data && (data.employeeCount > 0 || data.auditedAmount > 0)) {
        rowValues.push(data.employeeCount);
        rowValues.push(data.auditedAmount);
        rowTotalNo += data.employeeCount;
        rowTotalAmnt += data.auditedAmount;
      } else {
        rowValues.push('');
        rowValues.push('');
      }
    });

    rowValues.push(rowTotalNo > 0 ? rowTotalNo : 0);
    rowValues.push(rowTotalAmnt > 0 ? Math.round(rowTotalAmnt * 100) / 100 : 0);

    const dataRow = ws.getRow(rowNum);
    dataRow.values = rowValues;
    dataRow.height = 18;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { size: 9 };

      if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        const isAmntCol = (colNumber - 4) % 2 === 0;
        if (isAmntCol) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }

      if (colNumber === 2 && depot.highlight) {
        cell.fill = highlightPinkFill;
      }
    });
  });

  // Bottom Grand Total Row (Row 97)
  const totalRowNum = 3 + DEPOT_MASTER_LIST.length;
  const totalRowValues: any[] = ['', '', '', 'Total'];

  matrixDates.forEach((_, idx) => {
    let dateTotalNo = 0;
    let dateTotalAmnt = 0;
    DEPOT_MASTER_LIST.forEach(depot => {
      const data = depotDateMap.get(`${depot.unitCode}_${matrixDates[idx].raw}`);
      if (data) {
        dateTotalNo += data.employeeCount;
        dateTotalAmnt += data.auditedAmount;
      }
    });
    totalRowValues.push(dateTotalNo > 0 ? dateTotalNo : 0);
    totalRowValues.push(dateTotalAmnt > 0 ? Math.round(dateTotalAmnt * 100) / 100 : 0);
  });

  let grandTotalNo = 0;
  let grandTotalAmnt = 0;
  files.forEach(f => {
    grandTotalNo += f.employeeCount || 0;
    grandTotalAmnt += f.auditedAmount || 0;
  });

  totalRowValues.push(grandTotalNo);
  totalRowValues.push(Math.round(grandTotalAmnt * 100) / 100);

  const totalRow = ws.getRow(totalRowNum);
  totalRow.values = totalRowValues;
  totalRow.height = 22;

  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { bold: true, size: 9 };
    cell.fill = headerPeachFill;
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF808080' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
    };

    if (colNumber === 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNumber > 4) {
      const isAmntCol = (colNumber - 4) % 2 === 0;
      if (isAmntCol) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
  });

  return ws;
}

/**
 * Generates an Excel Workbook with:
 * 1. Sheet 1: Consolidation (In EACH date, all 4 categories combined in that date)
 * 2. Sheet 2: KSRTC (Datewise matrix for KSRTC)
 * 3. Sheet 3: Chalo (Datewise matrix for Chalo)
 * 4. Sheet 4: Chalo Swift (Datewise matrix for Chalo Swift)
 * 5. Sheet 5: KURTC (Datewise matrix for KURTC)
 * 6. Detailed audit records
 */
export async function generateMatrixExcelReport(
  files: FileData[],
  titlePrefix = 'Report'
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const matrixDates = determineMatrixDates(files);

  // 1. Primary Sheet: Consolidation (All 4 categories combined in each date)
  buildMatrixWorksheet(workbook, 'Consolidation', files, matrixDates);

  // 2. Individual Category Datewise Matrix Sheets
  const categories: Category[] = ['KSRTC', 'Chalo', 'Chalo Swift', 'KURTC'];
  categories.forEach(cat => {
    const catFiles = files.filter(f => f.category === cat);
    buildMatrixWorksheet(workbook, cat, catFiles, matrixDates);
  });

  // 3. Category Detailed Audit Sheets
  categories.forEach((category) => {
    const sheetData = files.filter(f => f.category === category);
    const ws = workbook.addWorksheet(`${category} Records`);

    ws.columns = [
      { header: 'Sl Number', key: 'sl', width: 12 },
      { header: 'File Name', key: 'fileName', width: 35 },
      { header: 'Depot Name', key: 'depotName', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'No. of Employees', key: 'employeeCount', width: 18 },
      { header: 'Consolidated Amount', key: 'consolidatedAmount', width: 22 },
      { header: 'Audited Amount', key: 'auditedAmount', width: 18 }
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.height = 24;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    sheetData.forEach((file, idx) => {
      const row = ws.addRow({
        sl: idx + 1,
        fileName: file.fileName,
        depotName: file.depotName,
        date: formatToDateColHeader(file.date),
        employeeCount: file.employeeCount,
        consolidatedAmount: file.consolidatedAmount ?? '',
        auditedAmount: file.auditedAmount
      });

      if (file.consolidatedAmount !== null && file.consolidatedAmount !== file.auditedAmount) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' }
          };
        });
      }
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const col6 = row.getCell(6);
        if (typeof col6.value === 'number') col6.numFmt = '#,##0.00';
        const col7 = row.getCell(7);
        if (typeof col7.value === 'number') col7.numFmt = '#,##0.00';
      }
    });
  });

  // Apply borders to records sheets
  workbook.worksheets.forEach(ws => {
    if (ws.name.includes('Records')) {
      ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'D3D3D3' } },
            left: { style: 'thin', color: { argb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
            right: { style: 'thin', color: { argb: 'D3D3D3' } }
          };
        });
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Generates an Excel report for a single date or batch.
 */
export async function generateExcelReport(
  date: string,
  groupedData: Record<Category, FileData[]>
): Promise<Blob> {
  const allFiles: FileData[] = [
    ...(groupedData['KSRTC'] || []),
    ...(groupedData['Chalo'] || []),
    ...(groupedData['Chalo Swift'] || []),
    ...(groupedData['KURTC'] || [])
  ];

  return generateMatrixExcelReport(allFiles, `Report_${date}`);
}
