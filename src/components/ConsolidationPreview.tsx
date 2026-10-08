/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Layers, CheckCircle2 } from 'lucide-react';
import { FileData, Category } from '../types';
import { DEPOT_MASTER_LIST, DEPOT_ALIAS_MAP } from '../data/depots';
import { determineMatrixDates, generateMatrixExcelReport, formatToDateColHeader } from '../utils/excel';

interface ConsolidationPreviewProps {
  files: FileData[];
}

export default function ConsolidationPreview({ files }: ConsolidationPreviewProps) {
  // Tabs: Consolidation (All 4 Combined in Each Date), KSRTC, Chalo, Chalo Swift, KURTC
  const [activeTab, setActiveTab] = useState<'Consolidation' | Category>('Consolidation');
  const [isExporting, setIsExporting] = useState(false);

  // Filter files based on active tab
  const activeFiles = activeTab === 'Consolidation'
    ? files // All 4 categories combined in each date!
    : files.filter(f => f.category === activeTab); // Specific category datewise

  // Get date columns in DD-MM-YYYY format
  const matrixDates = determineMatrixDates(files);

  // Map depot and date (key: DEPOT_DD-MM-YYYY)
  const depotDateMap = new Map<string, { employeeCount: number; auditedAmount: number; fileCount: number }>();
  activeFiles.forEach(f => {
    const rawDepot = f.depotName.toUpperCase();
    const mappedDepot = DEPOT_ALIAS_MAP[rawDepot] || rawDepot;
    const formattedDate = formatToDateColHeader(f.date);
    const key = `${mappedDepot}_${formattedDate}`;
    const existing = depotDateMap.get(key) || { employeeCount: 0, auditedAmount: 0, fileCount: 0 };
    depotDateMap.set(key, {
      employeeCount: existing.employeeCount + (f.employeeCount || 0),
      auditedAmount: existing.auditedAmount + (f.auditedAmount || 0),
      fileCount: existing.fileCount + 1
    });
  });

  // Calculate Date Totals for bottom Total row
  const dateTotals = matrixDates.map(d => {
    let no = 0;
    let amnt = 0;
    DEPOT_MASTER_LIST.forEach(depot => {
      const data = depotDateMap.get(`${depot.unitCode}_${d.raw}`);
      if (data) {
        no += data.employeeCount;
        amnt += data.auditedAmount;
      }
    });
    return { no, amnt: Math.round(amnt * 100) / 100 };
  });

  // Calculate Grand Totals
  let grandTotalNo = 0;
  let grandTotalAmnt = 0;
  activeFiles.forEach(f => {
    grandTotalNo += (f.employeeCount || 0);
    grandTotalAmnt += (f.auditedAmount || 0);
  });
  grandTotalAmnt = Math.round(grandTotalAmnt * 100) / 100;

  const formatAmnt = (val: number | null | undefined): string => {
    if (val === null || val === undefined || val === 0) return '0';
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(val);
  };

  const handleDownloadExcel = async () => {
    try {
      setIsExporting(true);
      const blob = await generateMatrixExcelReport(files, 'Consolidation_Report');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Depot_Consolidation_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner & Controls */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/90 rounded-2xl p-6 shadow-xl shadow-slate-950/5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-widest font-display">
                Datewise Matrix Format
              </span>
              <span className="text-xs text-slate-500 font-bold">• Dates as DD-MM-YYYY • 94 Master Units</span>
            </div>
            <h3 className="text-xl font-black text-slate-950 tracking-tight font-display flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
              {activeTab === 'Consolidation'
                ? 'Consolidation (All 4 in Each Date)'
                : `${activeTab} (Datewise)`}
            </h3>
            <p className="text-xs text-slate-600 mt-1 font-medium max-w-2xl">
              {activeTab === 'Consolidation'
                ? 'In each date, all 4 categories (KSRTC, Chalo, Chalo Swift, and KURTC) are combined and summed together.'
                : `Datewise breakdown for ${activeTab} allowances across all 94 depot units.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating Excel...' : 'Download Excel (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Category Sheet Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'Consolidation', label: 'Consolidation (All 4 in Each Date)' },
              { id: 'KSRTC', label: 'KSRTC (Datewise)' },
              { id: 'Chalo', label: 'Chalo (Datewise)' },
              { id: 'Chalo Swift', label: 'Chalo Swift (Datewise)' },
              { id: 'KURTC', label: 'KURTC (Datewise)' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metrics summary */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shrink-0">
            <div>
              <span className="text-slate-500 font-medium">Dates: </span>
              <span className="text-indigo-600 font-extrabold">{matrixDates.length} Days</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-medium">Total Employees: </span>
              <span className="text-slate-900 font-black">{grandTotalNo.toLocaleString('en-IN')}</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-medium">Total Audited: </span>
              <span className="text-emerald-600 font-black">₹{formatAmnt(grandTotalAmnt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Datewise Spreadsheet Matrix (Exact Peach Header #FCE5CD with DD-MM-YYYY Dates) */}
      <div className="bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[750px] relative scrollbar-thin">
          <table className="w-full text-xs border-collapse">
            {/* Header Row 1: Merged Titles and DD-MM-YYYY Date Headers */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#FCE5CD] text-slate-950 font-black divide-x divide-slate-300 border-b border-slate-300">
                <th rowSpan={2} className="px-2 py-2 text-center w-12 border-r border-slate-300 bg-[#FCE5CD] sticky left-0 z-30">
                  Sl No
                </th>
                <th rowSpan={2} className="px-2 py-2 text-center w-16 border-r border-slate-300 bg-[#FCE5CD] sticky left-12 z-30">
                  Unit Code
                </th>
                <th rowSpan={2} className="px-2 py-2 text-center w-16 border-r border-slate-300 bg-[#FCE5CD] sticky left-28 z-30">
                  Chalo Code
                </th>
                <th rowSpan={2} className="px-3 py-2 text-left w-44 border-r border-slate-300 bg-[#FCE5CD] sticky left-44 z-30">
                  Name
                </th>

                {/* Date Columns Header in DD-MM-YYYY format */}
                {matrixDates.map((d, idx) => (
                  <th
                    key={idx}
                    colSpan={2}
                    className="px-2 py-1.5 text-center font-bold tracking-tight border-r border-slate-300 bg-[#FCE5CD] whitespace-nowrap min-w-[110px]"
                  >
                    {d.display}
                  </th>
                ))}

                {/* Total Column Header */}
                <th colSpan={2} className="px-3 py-1.5 text-center font-black border-r border-slate-300 bg-[#FCE5CD] min-w-[130px]">
                  Total
                </th>
              </tr>

              {/* Header Row 2: Sub-headers No. and Amnt */}
              <tr className="bg-[#FCE5CD] text-slate-800 text-[10px] font-bold divide-x divide-slate-300 border-b-2 border-slate-400">
                {matrixDates.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th className="py-1 px-1.5 text-center border-r border-slate-300 bg-[#FCE5CD] w-12">No.</th>
                    <th className="py-1 px-2 text-right border-r border-slate-300 bg-[#FCE5CD] w-20">Amnt</th>
                  </React.Fragment>
                ))}
                <th className="py-1 px-1.5 text-center border-r border-slate-300 bg-[#FCE5CD] w-14 font-black">No.</th>
                <th className="py-1 px-2 text-right border-r border-slate-300 bg-[#FCE5CD] w-24 font-black">Amnt</th>
              </tr>
            </thead>

            {/* Table Body: 94 Depot Rows */}
            <tbody className="divide-y divide-slate-200 text-slate-900 bg-white">
              {DEPOT_MASTER_LIST.map((depot) => {
                let rowTotalNo = 0;
                let rowTotalAmnt = 0;

                return (
                  <tr key={depot.unitCode} className="hover:bg-amber-50/50 transition-colors divide-x divide-slate-200">
                    {/* Sl No */}
                    <td className="px-2 py-1 text-center font-mono text-slate-500 bg-slate-50 sticky left-0 z-10 border-r border-slate-200">
                      {depot.sl}
                    </td>

                    {/* Unit Code (with soft pink background for KTD, NTA, PSL matching image) */}
                    <td
                      className={`px-2 py-1 text-center font-bold font-mono sticky left-12 z-10 border-r border-slate-200 ${
                        depot.highlight ? 'bg-[#FADBD8] text-rose-950 font-black' : 'bg-slate-50 text-slate-900'
                      }`}
                    >
                      {depot.unitCode}
                    </td>

                    {/* Chalo Code */}
                    <td className="px-2 py-1 text-center font-mono text-slate-700 bg-slate-50 sticky left-28 z-10 border-r border-slate-200">
                      {depot.chaloCode}
                    </td>

                    {/* Depot Name */}
                    <td className="px-3 py-1 font-semibold text-slate-900 truncate max-w-[180px] bg-white sticky left-44 z-10 border-r border-slate-200" title={depot.name}>
                      {depot.name}
                    </td>

                    {/* Date values */}
                    {matrixDates.map((d, dIdx) => {
                      const data = depotDateMap.get(`${depot.unitCode}_${d.raw}`);
                      const hasData = data && (data.employeeCount > 0 || data.auditedAmount > 0);

                      if (hasData) {
                        rowTotalNo += data.employeeCount;
                        rowTotalAmnt += data.auditedAmount;
                      }

                      return (
                        <React.Fragment key={dIdx}>
                          <td className={`px-1 py-1 text-center font-mono text-[11px] ${hasData ? 'font-bold text-indigo-700 bg-indigo-50/40' : 'text-slate-300'}`}>
                            {hasData ? data.employeeCount : ''}
                          </td>
                          <td className={`px-2 py-1 text-right font-mono text-[11px] ${hasData ? 'font-bold text-slate-950 bg-emerald-50/40' : 'text-slate-300'}`}>
                            {hasData ? formatAmnt(data.auditedAmount) : ''}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Row Totals across dates for this depot */}
                    <td className="px-1.5 py-1 text-center font-black font-mono text-slate-900 bg-slate-50">
                      {rowTotalNo > 0 ? rowTotalNo : 0}
                    </td>
                    <td className="px-2 py-1 text-right font-black font-mono text-slate-950 bg-slate-50">
                      {rowTotalAmnt > 0 ? formatAmnt(rowTotalAmnt) : 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer: Total Row */}
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#FCE5CD] font-black text-slate-950 divide-x divide-slate-300 border-t-2 border-slate-400 border-b-4 border-slate-800">
                <td className="px-2 py-2 text-center bg-[#FCE5CD] sticky left-0 z-30"></td>
                <td className="px-2 py-2 text-center bg-[#FCE5CD] sticky left-12 z-30"></td>
                <td className="px-2 py-2 text-center bg-[#FCE5CD] sticky left-28 z-30"></td>
                <td className="px-3 py-2 text-center uppercase tracking-wider font-display bg-[#FCE5CD] sticky left-44 z-30">
                  Total
                </td>

                {dateTotals.map((tot, idx) => (
                  <React.Fragment key={idx}>
                    <td className="px-1 py-2 text-center font-mono text-[11px] bg-[#FCE5CD]">
                      {tot.no > 0 ? tot.no : 0}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px] bg-[#FCE5CD]">
                      {tot.amnt > 0 ? formatAmnt(tot.amnt) : 0}
                    </td>
                  </React.Fragment>
                ))}

                {/* Grand Totals */}
                <td className="px-1.5 py-2 text-center font-mono text-xs font-black bg-[#FCE5CD]">
                  {grandTotalNo}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs font-black bg-[#FCE5CD]">
                  {formatAmnt(grandTotalAmnt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
