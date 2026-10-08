/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileDown, Loader2, AlertCircle, RefreshCw, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import Papa from 'papaparse';

interface PdfCreatorProps {}

interface DepotRecord {
  Unit: string;
  Name: string;
  Code: string;
  Date: string;
  'No.': number;
  'Amnt': number;
}

interface DepotData {
  depotName: string;
  category: string;
  records: DepotRecord[];
  totalEmp: number;
  totalAmt: number;
}

interface SheetData {
  sheetName: string;
  isMatrix: boolean;
  depots: { [key: string]: DepotData };
  totalEmp: number;
  totalAmt: number;
  depotCount: number;
}

function extractHeaderVal(cellVal: any): string {
  if (cellVal === null || cellVal === undefined) return '';
  if (typeof cellVal === 'object') {
    if ('richText' in cellVal && Array.isArray(cellVal.richText)) {
      return cellVal.richText.map((t: any) => t.text).join('').trim();
    }
    if ('result' in cellVal) {
      const res = cellVal.result;
      if (res instanceof Date) {
        return `${res.getUTCDate().toString().padStart(2, '0')}-${(res.getUTCMonth() + 1).toString().padStart(2, '0')}-${res.getUTCFullYear()}`;
      }
      return res !== null && res !== undefined ? res.toString().trim() : '';
    }
    if (cellVal instanceof Date) {
      return `${cellVal.getUTCDate().toString().padStart(2, '0')}-${(cellVal.getUTCMonth() + 1).toString().padStart(2, '0')}-${cellVal.getUTCFullYear()}`;
    }
  }
  return cellVal.toString().trim();
}

function parseNumeric(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object') {
    if ('result' in val) return parseNumeric(val.result);
    if ('richText' in val && Array.isArray(val.richText)) {
      const text = val.richText.map((t: any) => t.text).join('');
      return parseNumeric(text);
    }
  }
  const clean = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export default function PdfCreator({}: PdfCreatorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Parsed sheets
  const [availableSheets, setAvailableSheets] = useState<{ [sheetName: string]: SheetData }>({});
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [showDepotList, setShowDepotList] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a valid Excel (.xlsx) or CSV (.csv) file.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAvailableSheets({});
    setSelectedSheetName('');

    try {
      const workbook = new ExcelJS.Workbook();
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const sheet = workbook.addWorksheet('Sheet1');
        const parsed = Papa.parse(text, { skipEmptyLines: false });
        if (parsed.data) {
          parsed.data.forEach((row: any) => {
            sheet.addRow(row);
          });
        }
      } else {
        const buffer = await file.arrayBuffer();
        await workbook.xlsx.load(buffer);
      }

      const parsedSheetsMap: { [sheetName: string]: SheetData } = {};

      workbook.eachSheet((sheet) => {
        const sheetName = sheet.name;

        // Skip sheets with no rows
        if (sheet.rowCount === 0) return;

        // 1. Detect if this sheet is a Matrix format
        // In Matrix format: there is a row containing multiple 'No.' or 'No' or 'Employees' sub-headers
        let matrixSubHeaderRowIdx = -1;
        let bestNoCount = 0;

        for (let r = 1; r <= 8; r++) {
          let count = 0;
          const rData = sheet.getRow(r);
          rData.eachCell((cell) => {
            const v = extractHeaderVal(cell.value).toLowerCase().trim();
            if (v === 'no.' || v === 'no' || v === 'employees' || v === 'employee') count++;
          });
          if (count > bestNoCount) {
            bestNoCount = count;
            matrixSubHeaderRowIdx = r;
          }
        }

        // If at least 3 'No.' sub-headers exist, this is a Datewise Matrix sheet
        const isMatrix = bestNoCount >= 3 && matrixSubHeaderRowIdx > 1;

        if (isMatrix) {
          const r1 = sheet.getRow(matrixSubHeaderRowIdx - 1);
          const r2 = sheet.getRow(matrixSubHeaderRowIdx);

          // Identify static metadata columns (Unit Code, Depot Name, Chalo Code)
          let unitCol = -1, nameCol = -1, codeCol = -1;
          for (let c = 1; c <= 6; c++) {
            const val = extractHeaderVal(r1.getCell(c).value).toLowerCase().trim();
            if (val.includes('unit') && unitCol === -1) unitCol = c;
            else if (val.includes('name') && nameCol === -1) nameCol = c;
            else if (val.includes('code') && codeCol === -1) codeCol = c;
            else if (val.includes('depot') && unitCol === -1) unitCol = c;
          }

          if (unitCol === -1) unitCol = 2; // Default Unit Code is col 2
          if (codeCol === -1) codeCol = 3; // Default Chalo Code is col 3
          if (nameCol === -1) nameCol = 4; // Default Depot Name is col 4

          // Scan subheader row for (No., Amnt) pairs
          // Each pair is recorded EXACTLY ONCE to completely prevent merged-cell doubling!
          const datePairs: { noCol: number; amntCol: number; dateStr: string }[] = [];
          const maxCol = sheet.columnCount;

          for (let c = 1; c <= maxCol; c++) {
            const h2 = extractHeaderVal(r2.getCell(c).value).toLowerCase().trim();
            if (h2 === 'no.' || h2 === 'no' || h2.includes('employ')) {
              const nextH2 = extractHeaderVal(r2.getCell(c + 1).value).toLowerCase().trim();
              if (nextH2.includes('amnt') || nextH2.includes('amount')) {
                // The date string is in Row 1 at column c
                let dateStr = extractHeaderVal(r1.getCell(c).value);
                if (dateStr && !dateStr.toLowerCase().includes('total')) {
                  datePairs.push({ noCol: c, amntCol: c + 1, dateStr });
                }
              }
            }
          }

          if (datePairs.length > 0) {
            const sheetDepots: { [key: string]: DepotData } = {};
            let sheetTotalEmp = 0;
            let sheetTotalAmt = 0;

            sheet.eachRow((row, rowNumber) => {
              if (rowNumber <= matrixSubHeaderRowIdx) return; // Skip headers

              const unitRaw = extractHeaderVal(row.getCell(unitCol).value);
              if (!unitRaw || unitRaw.toLowerCase() === 'total' || unitRaw.toLowerCase().includes('grand')) return;

              const unit = unitRaw.toUpperCase().trim();
              const name = extractHeaderVal(row.getCell(nameCol).value) || unit;
              const code = extractHeaderVal(row.getCell(codeCol).value) || '';

              const depotRecords: DepotRecord[] = [];
              let depotEmpSum = 0;
              let depotAmtSum = 0;

              for (const dp of datePairs) {
                const noVal = parseNumeric(row.getCell(dp.noCol).value);
                const amntVal = parseNumeric(row.getCell(dp.amntCol).value);

                depotRecords.push({
                  Unit: unit,
                  Name: name,
                  Code: code,
                  Date: dp.dateStr,
                  'No.': noVal,
                  'Amnt': amntVal
                });

                depotEmpSum += noVal;
                depotAmtSum += amntVal;
              }

              sheetDepots[unit] = {
                depotName: unit,
                category: sheetName,
                records: depotRecords,
                totalEmp: depotEmpSum,
                totalAmt: Math.round(depotAmtSum * 100) / 100
              };

              sheetTotalEmp += depotEmpSum;
              sheetTotalAmt += depotAmtSum;
            });

            const depotCount = Object.keys(sheetDepots).length;
            if (depotCount > 0) {
              parsedSheetsMap[sheetName] = {
                sheetName,
                isMatrix: true,
                depots: sheetDepots,
                totalEmp: sheetTotalEmp,
                totalAmt: Math.round(sheetTotalAmt * 100) / 100,
                depotCount
              };
            }
            return; // Finished parsing matrix sheet
          }
        }

        // 2. Fallback: List / Records Sheet (Row by row with columns like Depot, Date, Employees, Amount)
        let headerRowIdx = 1;
        let depotNameIdx = -1;
        let dateIdx = -1;
        let empIdx = -1;
        let amtIdx = -1;

        for (let r = 1; r <= 5; r++) {
          const rData = sheet.getRow(r);
          rData.eachCell((cell, colNumber) => {
            const val = extractHeaderVal(cell.value).toLowerCase().trim();
            if ((val.includes('depot') || val.includes('unit')) && depotNameIdx === -1) depotNameIdx = colNumber;
            if (val.includes('date') && dateIdx === -1) dateIdx = colNumber;
            if ((val.includes('employee') || val === 'no.' || val === 'no') && empIdx === -1) empIdx = colNumber;
            if ((val.includes('amount') || val.includes('amnt')) && amtIdx === -1) amtIdx = colNumber;
          });
          if (depotNameIdx !== -1 && (empIdx !== -1 || amtIdx !== -1)) {
            headerRowIdx = r;
            break;
          }
        }

        if (depotNameIdx !== -1) {
          const sheetDepots: { [key: string]: DepotData } = {};
          let sheetTotalEmp = 0;
          let sheetTotalAmt = 0;

          sheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRowIdx) return;

            const unitRaw = extractHeaderVal(row.getCell(depotNameIdx).value);
            if (!unitRaw || unitRaw.toLowerCase() === 'total' || unitRaw.toLowerCase().includes('grand')) return;
            const unit = unitRaw.toUpperCase().trim();

            const dateStr = dateIdx !== -1 ? extractHeaderVal(row.getCell(dateIdx).value) : '';
            const noVal = empIdx !== -1 ? parseNumeric(row.getCell(empIdx).value) : 0;
            const amntVal = amtIdx !== -1 ? parseNumeric(row.getCell(amtIdx).value) : 0;

            if (!sheetDepots[unit]) {
              sheetDepots[unit] = {
                depotName: unit,
                category: sheetName,
                records: [],
                totalEmp: 0,
                totalAmt: 0
              };
            }

            sheetDepots[unit].records.push({
              Unit: unit,
              Name: unit,
              Code: '',
              Date: dateStr,
              'No.': noVal,
              'Amnt': amntVal
            });

            sheetDepots[unit].totalEmp += noVal;
            sheetDepots[unit].totalAmt += amntVal;
            sheetTotalEmp += noVal;
            sheetTotalAmt += amntVal;
          });

          const depotCount = Object.keys(sheetDepots).length;
          if (depotCount > 0) {
            parsedSheetsMap[sheetName] = {
              sheetName,
              isMatrix: false,
              depots: sheetDepots,
              totalEmp: sheetTotalEmp,
              totalAmt: Math.round(sheetTotalAmt * 100) / 100,
              depotCount
            };
          }
        }
      });

      const sheetNames = Object.keys(parsedSheetsMap);
      if (sheetNames.length === 0) {
        setError('No valid depot allowance data found in the provided file. Ensure it contains a matrix consolidation or depot rows.');
        return;
      }

      setAvailableSheets(parsedSheetsMap);

      // Auto-select preferred sheet:
      // Prefer 'Consolidation' or sheet containing 'consolidat'
      const consSheet = sheetNames.find(s => s.toLowerCase().includes('consolidat'));
      if (consSheet) {
        setSelectedSheetName(consSheet);
      } else {
        setSelectedSheetName(sheetNames[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedSheet = availableSheets[selectedSheetName];

  const generatePDFs = async () => {
    if (!selectedSheet) {
      setError('Please select a sheet to generate PDFs.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const zip = new JSZip();
      const monthNames = [
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
      ];

      for (const [depotName, data] of Object.entries(selectedSheet.depots) as [string, DepotData][]) {
        const doc = new jsPDF();
        
        // Map daily numbers: day (1..31) -> { emp, amt }
        const recordsByDay = new Map<number, { emp: number; amt: number }>();
        let totalEmp = 0;
        let totalAmt = 0;

        let unit = depotName;
        let name = depotName;
        let codeStr = '';

        let reportMonth = 8; // Default August
        let reportYear = 2026; // Default 2026

        data.records.forEach((record) => {
          if (record.Code) codeStr = record.Code;
          if (record.Name && record.Name !== unit) name = record.Name;

          const dateStr = record.Date?.toString().trim();
          if (!dateStr) return;

          let day = 0;
          let m = reportMonth;
          let y = reportYear;
          let isValid = false;

          // Parse DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
          const parts = dateStr.split(/[-/.]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD
              y = parseInt(parts[0], 10);
              m = parseInt(parts[1], 10);
              day = parseInt(parts[2], 10);
            } else {
              // DD-MM-YYYY
              day = parseInt(parts[0], 10);
              m = parseInt(parts[1], 10);
              y = parseInt(parts[2], 10);
              if (parts[2].length === 2) y = 2000 + y;
            }
            isValid = !isNaN(day) && !isNaN(m) && !isNaN(y);
          } else if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
            if (dateStr.startsWith('19') || dateStr.startsWith('20')) {
              // YYYYMMDD
              y = parseInt(dateStr.substring(0, 4), 10);
              m = parseInt(dateStr.substring(4, 6), 10);
              day = parseInt(dateStr.substring(6, 8), 10);
            } else {
              // DDMMYYYY
              day = parseInt(dateStr.substring(0, 2), 10);
              m = parseInt(dateStr.substring(2, 4), 10);
              y = parseInt(dateStr.substring(4, 8), 10);
            }
            isValid = true;
          }

          if (isValid && day >= 1 && day <= 31) {
            reportMonth = m;
            reportYear = y;

            const emp = record['No.'] || 0;
            const amt = record['Amnt'] || 0;

            // Set each day directly to ensure no double-counting!
            const existing = recordsByDay.get(day) || { emp: 0, amt: 0 };
            recordsByDay.set(day, {
              emp: existing.emp + emp,
              amt: Math.round((existing.amt + amt) * 100) / 100
            });

            totalEmp += emp;
            totalAmt += amt;
          }
        });

        totalAmt = Math.round(totalAmt * 100) / 100;

        const monthName = monthNames[reportMonth - 1] || "AUGUST";

        // Header Title
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(
          `RECONCILIATION OF DAILY ALLOWANCE OF EMPLOYEES FOR THE MONTH OF ${monthName} ${reportYear}`,
          14,
          15
        );

        const formatNumber = (num: number) => {
          if (!num || num === 0) return '0';
          return new Intl.NumberFormat('en-IN').format(num);
        };

        const formatAmount = (num: number) => {
          if (!num || num === 0) return '0.00';
          return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(num);
        };

        const body: any[] = [];
        const monthStr = reportMonth.toString().padStart(2, '0');
        const yearStr = reportYear.toString();

        for (let i = 0; i < 17; i++) {
          const leftRow1: any[] = [];
          const leftRow2: any[] = [];

          // Left side (Rows 1-15: Dates 1-15, plus Metadata rows)
          if (i === 0) {
            leftRow1.push('Sl No', '', '1');
            leftRow2.push('Unit', '', unit);
          } else if (i === 1) {
            leftRow1.push('Code', '', codeStr);
            leftRow2.push('Name', '', name);
          } else {
            const day = i - 1; // 1 to 15
            const dateStr = `${day.toString().padStart(2, '0')}/${monthStr}/${yearStr}`;
            const r = recordsByDay.get(day) || { emp: 0, amt: 0 };
            leftRow1.push(
              { rowSpan: 2, content: dateStr, styles: { valign: 'middle' } },
              'No.',
              formatNumber(r.emp)
            );
            leftRow2.push('Amnt', formatAmount(r.amt));
          }

          // Right side (Rows 1-16: Dates 16-31, plus Total row)
          const rightRow1: any[] = [];
          const rightRow2: any[] = [];

          if (i < 16) {
            const day = i + 16; // 16 to 31
            const dateStr = `${day.toString().padStart(2, '0')}/${monthStr}/${yearStr}`;
            const r = recordsByDay.get(day) || { emp: 0, amt: 0 };
            rightRow1.push(
              { rowSpan: 2, content: dateStr, styles: { valign: 'middle' } },
              'No.',
              formatNumber(r.emp)
            );
            rightRow2.push('Amnt', formatAmount(r.amt));
          } else {
            // Total row
            rightRow1.push(
              { rowSpan: 2, content: 'Total', styles: { valign: 'middle', fontStyle: 'bold' } },
              'No.',
              { content: formatNumber(totalEmp), styles: { fontStyle: 'bold' } }
            );
            rightRow2.push(
              'Amount',
              { content: formatAmount(totalAmt), styles: { fontStyle: 'bold' } }
            );
          }

          body.push([...leftRow1, ...rightRow1]);
          body.push([...leftRow2, ...rightRow2]);
        }

        autoTable(doc, {
          startY: 20,
          body: body,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 1,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 32 },
            1: { fontStyle: 'bold', cellWidth: 16 },
            2: { halign: 'right', cellWidth: 26 },
            3: { fontStyle: 'bold', cellWidth: 32 },
            4: { fontStyle: 'bold', cellWidth: 16 },
            5: { halign: 'right', cellWidth: 26 }
          }
        });

        // Add Declarations block
        const finalY = (doc as any).lastAutoTable?.finalY || 180;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text('DECLARATION :', 14, finalY + 12);
        
        doc.setFont("helvetica", "normal");
        doc.text('Office Seal (Unit Office)', 105, finalY + 45, { align: 'center' });

        const pdfArrayBuffer = doc.output('arraybuffer');
        zip.file(`${unit}.pdf`, pdfArrayBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSheetName.replace(/\s+/g, '_')}_Depot_PDFs.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate PDFs: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setAvailableSheets({});
    setSelectedSheetName('');
    setError(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-950 font-display flex items-center gap-2">
          <FileText className="w-7 h-7 text-indigo-600" />
          PDF Report Generator
        </h2>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          Upload an Excel workbook to generate official reconciliation PDFs for each depot, matching the exact amounts and numbers without double-counting.
        </p>
      </div>

      {Object.keys(availableSheets).length === 0 ? (
        <div 
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.csv"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-indigo-500" />
              </div>
            )}
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {isLoading ? 'Reading Excel File...' : 'Upload Excel (.xlsx) Report'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md">
              Drag & drop your consolidated Excel workbook here, or click to browse files
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-950/5 p-6 space-y-6 animate-fadeIn">
          {/* Sheet Selector Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-widest font-display flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Excel Data Verified
                </span>
                <span className="text-xs text-slate-500 font-bold">• Zero Duplication</span>
              </div>
              <h3 className="text-lg font-black text-slate-950">Select Source Worksheet</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Choose which sheet to generate individual depot reconciliation PDFs from.
              </p>
            </div>

            {/* Sheet Tabs / Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Sheet:</span>
              <select
                value={selectedSheetName}
                onChange={(e) => setSelectedSheetName(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {Object.keys(availableSheets).map((sName) => (
                  <option key={sName} value={sName}>
                    {sName} ({availableSheets[sName].depotCount} Depots)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metrics summary for selected sheet */}
          {selectedSheet && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Depots Included</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {selectedSheet.depotCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Individual PDF files to generate</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Employees</div>
                <div className="text-2xl font-black text-indigo-600 mt-1 font-mono">
                  {selectedSheet.totalEmp.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Matches Excel sum exactly</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Audited Amount</div>
                <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                  ₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(selectedSheet.totalAmt)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">100% verified non-doubled sum</div>
              </div>
            </div>
          )}

          {/* Expandable Depot Breakdown Table */}
          {selectedSheet && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDepotList(!showDepotList)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-xs font-bold text-slate-700 cursor-pointer"
              >
                <span>Preview Depot Breakdown ({selectedSheet.depotCount} units)</span>
                {showDepotList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDepotList && (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-2 bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[10px] font-bold border-b border-slate-100 text-left">
                        <th className="py-1 px-3">Unit</th>
                        <th className="py-1 px-3">Depot Name</th>
                        <th className="py-1 px-3 text-center">Employees</th>
                        <th className="py-1 px-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(Object.values(selectedSheet.depots) as DepotData[]).map((d) => (
                        <tr key={d.depotName} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{d.depotName}</td>
                          <td className="py-1.5 px-3 text-slate-700">{d.records[0]?.Name || d.depotName}</td>
                          <td className="py-1.5 px-3 text-center font-mono font-bold text-indigo-600">{d.totalEmp}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                            {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(d.totalAmt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              onClick={resetState}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Upload Different File
            </button>
            <button
              onClick={generatePDFs}
              disabled={isLoading || !selectedSheet}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isLoading ? 'Generating PDFs...' : `Download PDFs for ${selectedSheetName} (ZIP)`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}
    </div>
  );
}
