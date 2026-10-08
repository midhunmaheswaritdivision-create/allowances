/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  AlertCircle,
  Calendar,
  LayoutDashboard,
  FileText,
  Table,
  Clock,
  Sparkles,
  ChevronRight,
  LogOut,
  FolderSync,
  FileDown,
  UserSearch
} from 'lucide-react';
import JSZip from 'jszip';

import { FileData } from './types';
import { parseFile } from './utils/parser';
import { generateExcelReport, generateMatrixExcelReport, formatToDateColHeader, parseDateToSortKey } from './utils/excel';

import UploadZone from './components/UploadZone';
import MetricsCards from './components/MetricsCards';
import VisualCharts from './components/VisualCharts';
import AuditTable from './components/AuditTable';
import ConsolidationPreview from './components/ConsolidationPreview';
import LoginPage from './components/LoginPage';
import TextReportGenerator from './components/TextReportGenerator';
import EmployeeSearch from './components/EmployeeSearch';
import PdfCreator from './components/PdfCreator';

function formatDateString(raw: string): string {
  return formatToDateColHeader(raw);
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('depot_auth') === 'true';
  });

  const [files, setFiles] = useState<FileData[]>([]);
  const [parsingErrors, setParsingErrors] = useState<{ fileName: string; error: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active view inside the workspace
  // 'welcome' is the initial blank page requested by the user
  const [activeTab, setActiveTab] = useState<'welcome' | 'extractor' | 'generator' | 'pdf_creator' | 'employee_search' | 'dashboard' | 'ledger' | 'consolidation'>('welcome');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All');
  const [isFilteringMismatch, setIsFilteringMismatch] = useState(false);

  // Handle files parsed from UploadZone
  const handleFilesSelected = (selectedFiles: { name: string; content: string }[]) => {
    setIsLoading(true);
    const parsedList: FileData[] = [];
    const errors: { fileName: string; error: string }[] = [];

    selectedFiles.forEach((f) => {
      try {
        const parsed = parseFile(f.name, f.content);
        parsedList.push(parsed);
      } catch (err: any) {
        errors.push({
          fileName: f.name,
          error: err?.message || 'Unknown parsing error'
        });
      }
    });

    setFiles(parsedList);
    setParsingErrors(errors);
    setIsLoading(false);
    setSelectedDateFilter('All');
    // Once files are uploaded, auto navigate to the consolidation matrix tab matching the attached format
    setActiveTab('consolidation');
  };

  // Download full Matrix Spreadsheet matching attached template
  const handleDownloadMatrixExcel = async () => {
    try {
      if (files.length === 0) return;
      const blob = await generateMatrixExcelReport(files);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Matrix_Consolidation_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export Matrix Excel:', err);
      alert('An error occurred while generating the Matrix Excel file.');
    }
  };

  // Reset the application to initial state
  const handleReset = () => {
    setFiles([]);
    setParsingErrors([]);
    setSelectedDateFilter('All');
    setIsFilteringMismatch(false);
    setActiveTab('welcome');
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('depot_auth');
    setIsAuthenticated(false);
    handleReset();
  };

  // Handle successful login
  const handleLoginSuccess = () => {
    sessionStorage.setItem('depot_auth', 'true');
    setIsAuthenticated(true);
    setActiveTab('welcome'); // Show the blank page initially as requested
  };

  // Filter files based on date picker
  const dateFilteredFiles = files.filter((file) => {
    return selectedDateFilter === 'All' || file.date === selectedDateFilter;
  });

  // Get list of unique dates for dropdown
  const uniqueDates: string[] = Array.from(new Set(files.map((file) => file.date))).sort((a, b) => {
    return parseDateToSortKey(b as string).localeCompare(parseDateToSortKey(a as string));
  }) as string[];

  // Export a single date's Excel file
  const handleExportSingleDate = async (date: string) => {
    try {
      const dateFiles = files.filter((f) => f.date === date);
      if (dateFiles.length === 0) return;

      const grouped = {
        'KSRTC': dateFiles.filter((f) => f.category === 'KSRTC'),
        'Chalo': dateFiles.filter((f) => f.category === 'Chalo'),
        'Chalo Swift': dateFiles.filter((f) => f.category === 'Chalo Swift'),
        'KURTC': dateFiles.filter((f) => f.category === 'KURTC')
      };

      const blob = await generateExcelReport(date, grouped);
      
      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('An error occurred while generating the Excel report.');
    }
  };

  // Export all dates in a ZIP archive
  const handleExportAllAsZip = async () => {
    try {
      if (uniqueDates.length === 0) return;

      const zip = new JSZip();

      for (const date of uniqueDates) {
        const dateFiles = files.filter((f) => f.date === date);
        const grouped = {
          'KSRTC': dateFiles.filter((f) => f.category === 'KSRTC'),
          'Chalo': dateFiles.filter((f) => f.category === 'Chalo'),
          'Chalo Swift': dateFiles.filter((f) => f.category === 'Chalo Swift'),
          'KURTC': dateFiles.filter((f) => f.category === 'KURTC')
        };

        const blob = await generateExcelReport(date, grouped);
        zip.file(`report_${date}.xlsx`, blob);
      }

      // Generate zip blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `depot_audit_reports.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to generate ZIP archive:', err);
      alert('An error occurred while generating the ZIP folder.');
    }
  };

  // Generate text report based on Python report generator logic
  const handleGenerateTextReport = () => {
    try {
      if (files.length === 0) return;

      const dateTotals: Record<string, { files: number; employees: number; amount: number }> = {};
      let grandTotalFiles = 0;
      let grandTotalEmployees = 0;
      let grandTotalAmount = 0;

      files.forEach((file) => {
        const fileDateInfo = formatDateString(file.date);
        
        if (!dateTotals[fileDateInfo]) {
          dateTotals[fileDateInfo] = { files: 0, employees: 0, amount: 0 };
        }
        
        dateTotals[fileDateInfo].files += 1;
        dateTotals[fileDateInfo].employees += file.employeeCount;
        dateTotals[fileDateInfo].amount += file.auditedAmount;

        grandTotalFiles += 1;
        grandTotalEmployees += file.employeeCount;
        grandTotalAmount += file.auditedAmount;
      });

      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const uploadDate = `${dd}.${mm}.${yyyy}`;

      const reportLines: string[] = [
        `UPLOAD DATE - ${uploadDate}`,
        `---------------------------------------------------------`
      ];

      // Format amount using the Indian numbering system as in Python
      const formatAmount = (amount: number): string => {
        const rounded = Math.round(amount);
        const amountStr = String(rounded);
        const reversedStr = [...amountStr].reverse().join('');
        let formattedStr = '';

        // Add first three digits
        formattedStr += reversedStr.slice(0, 3);

        // Process rest in groups of two
        for (let i = 3; i < reversedStr.length; i += 2) {
          formattedStr += ',' + reversedStr.slice(i, i + 2);
        }

        return [...formattedStr].reverse().join('');
      };

      // Add each file date's summary to the report
      Object.entries(dateTotals).forEach(([fileDateInfo, totals]) => {
        reportLines.push(`FILE DATE : ${fileDateInfo}`);
        reportLines.push(`Files      : ${totals.files}`);
        reportLines.push(`Employees  : ${totals.employees.toLocaleString('en-IN')}`);
        reportLines.push(`Amount     : ${formatAmount(totals.amount)}`);
        reportLines.push(`---------------------------------------------------------`);
      });

      // Add grand total
      reportLines.push(`GRAND TOTAL`);
      reportLines.push(`Total Files      : ${grandTotalFiles}`);
      reportLines.push(`Total Employees  : ${grandTotalEmployees.toLocaleString('en-IN')}`);
      reportLines.push(`Total Amount     : ${formatAmount(grandTotalAmount)}`);

      const reportText = reportLines.join('\n');

      // Download file
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'report.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to generate Text Report:', err);
      alert('An error occurred while generating the text report.');
    }
  };

  // Render Login view if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen gradient-4-color text-slate-950 flex flex-col md:flex-row font-sans relative overflow-hidden">
      
      {/* Background radial soft spectrum glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-emerald-500/15 via-cyan-500/15 to-transparent blur-[120px] pointer-events-none" />

      {/* Persistent Left Sidebar Panel (Glassy with Spectrum Accent) */}
      <aside 
        id="app-sidebar"
        className="w-full md:w-72 bg-white/20 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-white/40 flex flex-col shrink-0 relative z-30 shadow-xl"
      >
        {/* Leftmost Vertical Spectrum Ribbon Accent */}
        <div className="hidden md:block absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 animate-spectrum" style={{ backgroundSize: '200% 200%' }} />

        {/* Brand / Logo Section */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-[1.5px] flex items-center justify-center shadow-md shadow-indigo-950/10">
              <div className="w-full h-full rounded-xl bg-white flex items-center justify-center text-indigo-600">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 font-display">
                Midhun Maheswar M D
              </h1>
              <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider">
                Admin Workspace
              </p>
            </div>
          </div>
          
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse md:hidden" title="System Active" />
        </div>

        {/* Sidebar Nav Actions List */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          
          {/* Main Module Category */}
          <div className="space-y-2">
            <p className="px-3 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest font-display">
              Extractors & Ingestion
            </p>
            
            {/* Google Sheet Extractor Button */}
            <button
              id="sidebar-extractor-btn"
              onClick={() => {
                setActiveTab('extractor');
                setIsFilteringMismatch(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer group ${
                activeTab === 'extractor'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                  : 'bg-transparent text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderSync className={`w-4 h-4 transition-transform group-hover:rotate-12 ${
                  activeTab === 'extractor' ? 'text-white' : 'text-slate-600'
                }`} />
                <span className="font-display">Google Sheet Extractor</span>
              </div>
              <span className={`w-2 h-2 rounded-full transition-all duration-200 ${
                activeTab === 'extractor' ? 'bg-white scale-110' : 'bg-indigo-500 opacity-0 group-hover:opacity-100'
              }`} />
            </button>

            {/* Text Report Generator Button */}
            <button
              id="sidebar-generator-btn"
              onClick={() => {
                setActiveTab('generator');
                setIsFilteringMismatch(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer group ${
                activeTab === 'generator'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/10'
                  : 'bg-transparent text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className={`w-4 h-4 transition-transform group-hover:rotate-12 ${
                  activeTab === 'generator' ? 'text-white' : 'text-slate-600'
                }`} />
                <span className="font-display">Text Report Generator</span>
              </div>
              <span className={`w-2 h-2 rounded-full transition-all duration-200 ${
                activeTab === 'generator' ? 'bg-white scale-110' : 'bg-violet-500 opacity-0 group-hover:opacity-100'
              }`} />
            </button>

            
            {/* Employee Allowance Search Button */}
            <button
              id="sidebar-employee-search-btn"
              onClick={() => {
                setActiveTab('employee_search');
                setIsFilteringMismatch(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer group ${
                activeTab === 'employee_search'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/10'
                  : 'bg-transparent text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserSearch className={`w-4 h-4 transition-transform group-hover:rotate-12 ${
                  activeTab === 'employee_search' ? 'text-white' : 'text-slate-600'
                }`} />
                <span className="font-display">Employee Search</span>
              </div>
              <span className={`w-2 h-2 rounded-full transition-all duration-200 ${
                activeTab === 'employee_search' ? 'bg-white scale-110' : 'bg-teal-500 opacity-0 group-hover:opacity-100'
              }`} />
            </button>


            {/* PDF Report Generator */}
            <button
              id="sidebar-pdf-generator-btn"
              onClick={() => {
                setActiveTab('pdf_creator');
                setIsFilteringMismatch(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer group ${
                activeTab === 'pdf_creator'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/10'
                  : 'bg-transparent text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileDown className={`w-4 h-4 transition-transform group-hover:rotate-12 ${
                  activeTab === 'pdf_creator' ? 'text-white' : 'text-slate-600'
                }`} />
                <span className="font-display">PDF Report Generator</span>
              </div>
              <span className={`w-2 h-2 rounded-full transition-all duration-200 ${
                activeTab === 'pdf_creator' ? 'bg-white scale-110' : 'bg-rose-500 opacity-0 group-hover:opacity-100'
              }`} />
            </button>
          </div>

          {/* Report Analytics View Section - Always visible in the sidepanel */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest font-display">
                Analytics & Audit
              </p>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                files.length > 0
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200/60'
              }`}>
                {files.length > 0 ? `${files.length} Files` : '0 Files'}
              </span>
            </div>

            <div className="space-y-2">
              {/* Analytics Dashboard */}
              <button
                id="sidebar-dashboard-btn"
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsFilteringMismatch(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10'
                    : 'text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-600'}`} />
                  <span>Analytics Dashboard</span>
                </div>
                {files.length > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'dashboard' ? 'bg-white' : 'bg-emerald-500'}`} />
                )}
              </button>

              {/* Audit Ledger */}
              <button
                id="sidebar-ledger-btn"
                onClick={() => {
                  setActiveTab('ledger');
                  setIsFilteringMismatch(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/10'
                    : 'text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-white' : 'text-slate-600'}`} />
                  <span>Audit Ledger</span>
                </div>
                {files.length > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ledger' ? 'bg-white' : 'bg-amber-500'}`} />
                )}
              </button>

              {/* Consolidation Preview */}
              <button
                id="sidebar-consolidation-btn"
                onClick={() => {
                  setActiveTab('consolidation');
                  setIsFilteringMismatch(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 border cursor-pointer ${
                  activeTab === 'consolidation'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/10'
                    : 'text-slate-800 hover:text-slate-900 hover:bg-white/30 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Table className={`w-4 h-4 ${activeTab === 'consolidation' ? 'text-white' : 'text-slate-600'}`} />
                  <span>Consolidation Preview</span>
                </div>
                {files.length > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'consolidation' ? 'bg-white' : 'bg-sky-500'}`} />
                )}
              </button>
            </div>
          </div>

          {/* Export utility container - Always visible in the sidepanel */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="px-3 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest mb-2 font-display">
              Actions & Export
            </p>

            {/* Matrix Spreadsheet Download (Attached Format) */}
            <button
              id="sidebar-matrix-excel-btn"
              onClick={handleDownloadMatrixExcel}
              disabled={files.length === 0}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-200 border ${
                files.length === 0
                  ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/15 cursor-pointer border-emerald-500'
              }`}
              title={files.length === 0 ? 'Upload data to download Matrix Excel' : 'Download Matrix Spreadsheet (.xlsx)'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Matrix Excel (.xlsx)
            </button>
            
            {/* Text Report Generator side panel button */}
            <button
              id="sidebar-txt-report-btn"
              onClick={handleGenerateTextReport}
              disabled={files.length === 0}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-extrabold rounded-xl transition-all duration-200 border ${
                files.length === 0
                  ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 cursor-pointer border-white/20'
              }`}
              title={files.length === 0 ? 'Upload data to generate text report' : 'Generate Text Report (report.txt)'}
            >
              <FileText className="w-3.5 h-3.5" />
              Generate Text Report (report.txt)
            </button>

            <button
              id="sidebar-zip-btn"
              onClick={handleExportAllAsZip}
              disabled={files.length === 0}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer border ${
                files.length === 0
                  ? 'bg-slate-100/70 text-slate-400 border-slate-200/50 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-900 text-white shadow-md shadow-slate-850/10 border-transparent'
              }`}
              title={files.length === 0 ? 'Upload data to download ZIP archive' : 'Download All (ZIP)'}
            >
              <Download className="w-3.5 h-3.5" />
              Download All (ZIP)
            </button>

            {selectedDateFilter !== 'All' && (
              <button
                id="sidebar-excel-btn"
                onClick={() => handleExportSingleDate(selectedDateFilter)}
                disabled={files.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-extrabold rounded-xl shadow-sm transition cursor-pointer border bg-white hover:bg-slate-100 text-slate-800 border-slate-300"
                title={`Download single date report for ${formatDateString(selectedDateFilter)}`}
              >
                <Download className="w-3.5 h-3.5" />
                Date Report ({formatDateString(selectedDateFilter)})
              </button>
            )}

            {files.length === 0 && (
              <p className="text-[10px] text-slate-500 text-center px-2 py-1 leading-tight font-medium">
                Import reports to activate batch exports
              </p>
            )}
          </div>

        </div>

        {/* Sidebar Footer Details */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="font-bold">Admin: admin</span>
            <button
              id="sidebar-logout-btn"
              onClick={handleLogout}
              className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 transition cursor-pointer border border-slate-200/40"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* Developed and designed by Midhun Maheswar M D */}
          <div className="pt-2 border-t border-slate-100 text-center md:text-left">
            <p className="text-[10px] text-slate-600 font-medium">
              Developed and designed by:
            </p>
            <p className="text-[11px] text-indigo-600 font-extrabold tracking-wide mt-0.5">
              Midhun Maheswar M D
            </p>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Workspace Sub-Header / Info Bar */}
        <header className="border-b border-white/30 bg-white/30 backdrop-blur-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 z-20 shrink-0 shadow-sm">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 font-display tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-red-500 to-indigo-500 animate-pulse" />
              Depot Audit Engine
            </h2>
            <p className="text-[11px] text-slate-800 font-bold mt-0.5">
              Enterprise allowance matching framework
            </p>
          </div>

          {/* Active Batch Filtering controls */}
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter Selector */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-slate-700 font-bold">Date Filter:</span>
                <select
                  id="workspace-date-filter"
                  value={selectedDateFilter}
                  onChange={(e) => {
                    setSelectedDateFilter(e.target.value);
                    setIsFilteringMismatch(false);
                  }}
                  className="bg-transparent text-slate-950 font-extrabold focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-white text-slate-950">All Dates ({uniqueDates.length})</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d} className="bg-white text-slate-950">
                      {formatDateString(d)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset state */}
              <button
                id="workspace-reset-btn"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200/60 transition cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                Clear Batch
              </button>
            </div>
          )}
        </header>

        {/* Primary Content Renderer */}
        <main className="flex-1 p-6 md:p-8 relative z-10">
          
          {/* 1. Blank Welcome Page (Initial view upon sign in as admin) */}
          {activeTab === 'welcome' && (
            <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto py-12 animate-fadeIn text-center">
              
              {/* Pulsing visual element with Spectrum borders */}
              <div className="relative rounded-full p-[2px] mb-8 overflow-hidden shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 via-purple-500 via-pink-500 to-red-500 animate-spectrum" style={{ backgroundSize: '200% 200%' }} />
                <div className="relative bg-white rounded-full w-20 h-20 flex items-center justify-center text-indigo-600 border border-slate-200/60">
                  <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display mb-3">
                Midhun Maheswar M D Activated
              </h3>
              
              <p className="text-sm text-slate-800 max-w-md mx-auto leading-relaxed mb-8">
                Welcome to the administration workspace. This secure utility was developed and designed to audit daily allowances, Chalo Swift, and KURTC reports.
              </p>

              {/* Action Invitation Card */}
              <div className="w-full relative p-[1.5px] rounded-2xl overflow-hidden shadow-lg mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
                <div className="relative bg-white/40 backdrop-blur-lg rounded-2xl p-6 text-left border border-white/40 shadow-inner">
                  <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-widest mb-1 font-display">
                    Ready to begin?
                  </h4>
                  <h5 className="text-sm font-bold text-slate-950 mb-2 font-display">
                    Access the Google Sheet Extractor
                  </h5>
                  <p className="text-xs text-slate-700 leading-relaxed mb-4 font-semibold">
                    Click the <strong>Google Sheet Extractor</strong> option in your side panel. This will open the report ingestion window where you can drag and drop your daily transport text files.
                  </p>
                  
                  <button
                    onClick={() => setActiveTab('extractor')}
                    className="inline-flex items-center gap-1 text-xs text-indigo-700 font-extrabold hover:text-indigo-900 group cursor-pointer bg-white/40 hover:bg-white/60 px-3 py-1.5 rounded-lg border border-white/50 transition-all shadow-sm"
                  >
                    Go to Extractor
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Developer Attribution Card */}
              <div className="w-full bg-white/30 backdrop-blur-md border border-white/50 rounded-2xl p-4 text-xs text-slate-800 leading-normal font-semibold shadow-sm">
                Designed, developed, and maintained by{' '}
                <strong className="text-indigo-700 font-extrabold">Midhun Maheswar M D</strong>. All systems operating securely.
              </div>
            </div>
          )}

          {/* 2. Google Sheet Extractor File Upload View */}
          {activeTab === 'extractor' && (
            <div className="h-full flex flex-col justify-center py-6 animate-fadeIn">
              <UploadZone onFilesSelected={handleFilesSelected} isLoading={isLoading} />
            </div>
          )}

          {/* 2b. Text Report Generator View (Always available!) */}
          {activeTab === 'generator' && (
            <div className="py-6 animate-fadeIn">
              <TextReportGenerator onImportToLedger={handleFilesSelected} />
            </div>
          )}

          
          {/* 2d. Employee Search View */}
          {activeTab === 'employee_search' && (
            <div className="py-6 animate-fadeIn h-full flex flex-col justify-center">
              <EmployeeSearch files={files} />
            </div>
          )}


          {/* 2c. PDF Creator View (Always available!) */}
          {activeTab === 'pdf_creator' && (
            <div className="py-6 animate-fadeIn h-full flex flex-col justify-center">
              <PdfCreator />
            </div>
          )}

          {/* 3. Empty State for Analytics & Audit views if accessed before uploading files */}
          {files.length === 0 && ['dashboard', 'ledger', 'consolidation'].includes(activeTab) && (
            <div className="h-full flex flex-col justify-center items-center max-w-lg mx-auto py-16 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 font-display mb-2">
                No Reports Loaded Yet
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium">
                To view the {activeTab === 'dashboard' ? 'Analytics Dashboard' : activeTab === 'ledger' ? 'Audit Ledger' : 'Consolidation Preview'}, please import your transit logs using the Google Sheet Extractor.
              </p>
              <button
                onClick={() => setActiveTab('extractor')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition cursor-pointer"
              >
                <FolderSync className="w-4 h-4" />
                Go to Google Sheet Extractor
              </button>
            </div>
          )}

          {/* 4. Batch Analytical Views (Available when files are loaded) */}
          {files.length > 0 && ['dashboard', 'ledger', 'consolidation'].includes(activeTab) && (
            <div className="animate-fadeIn">
              
              {/* Error list for corrupted files if any */}
              {parsingErrors.length > 0 && (
                <div className="w-full max-w-7xl mx-auto mb-8 p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-sm shadow-rose-950/5">
                  <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5 mb-2 font-display">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Corrupted Files Skipped ({parsingErrors.length})
                  </h4>
                  <ul className="divide-y divide-rose-100 text-xs text-rose-700 max-h-32 overflow-y-auto pr-2 space-y-1">
                    {parsingErrors.map((err, idx) => (
                      <li key={idx} className="py-1 flex items-center justify-between">
                        <span className="font-semibold">{err.fileName}</span>
                        <span className="text-[10px] text-rose-500 font-mono italic font-semibold">{err.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prominent Date Filter Panel */}
              <div className="w-full max-w-7xl mx-auto mb-6 bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-lg shadow-indigo-950/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest font-display">Active Date Filter</h3>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {selectedDateFilter === 'All' ? 'All Dates Combined' : `Date: ${formatDateString(selectedDateFilter)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs shrink-0 focus-within:border-indigo-500/50 transition shadow-sm">
                      <span className="text-slate-700 font-bold">Select Date:</span>
                      <select
                        id="content-date-filter"
                        value={selectedDateFilter}
                        onChange={(e) => {
                          setSelectedDateFilter(e.target.value);
                          setIsFilteringMismatch(false);
                        }}
                        className="bg-transparent text-slate-950 font-extrabold focus:outline-none cursor-pointer pr-4"
                      >
                        <option value="All" className="bg-white text-slate-950">All Dates ({uniqueDates.length})</option>
                        {uniqueDates.map((d) => (
                          <option key={d} value={d} className="bg-white text-slate-950">
                            {formatDateString(d)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedDateFilter !== 'All' && (
                      <button
                        onClick={() => setSelectedDateFilter('All')}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/60 text-indigo-600 rounded-xl text-xs font-extrabold transition flex items-center gap-1 cursor-pointer"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick select pills row (for 500 files, we might have multiple dates. Let's show up to the 8 most recent or all if <= 10) */}
                {uniqueDates.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2.5 font-display">
                      Quick Filter by Date:
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                      <button
                        onClick={() => {
                          setSelectedDateFilter('All');
                          setIsFilteringMismatch(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedDateFilter === 'All'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-950/30 font-extrabold'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60 shadow-sm shadow-indigo-950/2'
                        }`}
                      >
                        All ({files.length})
                      </button>
                      {uniqueDates.map((d) => {
                        const count = files.filter((f) => f.date === d).length;
                        return (
                          <button
                            key={d}
                            onClick={() => {
                              setSelectedDateFilter(d);
                              setIsFilteringMismatch(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              selectedDateFilter === d
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-950/30 font-extrabold'
                                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60 shadow-sm shadow-indigo-950/2'
                            }`}
                          >
                            {formatDateString(d)} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Core summary metrics bar */}
              <MetricsCards
                files={dateFilteredFiles}
                onFilterMismatchOnly={() => {
                  setIsFilteringMismatch(true);
                  setActiveTab('ledger');
                }}
                onResetFilters={() => {
                  setIsFilteringMismatch(false);
                }}
                isFilteringMismatch={isFilteringMismatch}
              />

              {/* View components renderer */}
              {activeTab === 'dashboard' && (
                <VisualCharts files={dateFilteredFiles} />
              )}

              {activeTab === 'ledger' && (
                <AuditTable
                  files={dateFilteredFiles}
                  isFilteringMismatchOnly={isFilteringMismatch}
                  onClearMismatchFilter={() => setIsFilteringMismatch(false)}
                />
              )}

              {activeTab === 'consolidation' && (
                <ConsolidationPreview files={dateFilteredFiles} />
              )}

              {/* Multi-date batch assistance block */}
              {activeTab === 'dashboard' && uniqueDates.length > 1 && (
                <div className="w-full max-w-7xl mx-auto bg-white border border-slate-200/80 rounded-2xl p-6 mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md shadow-indigo-950/2">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">Multi-Date Directory Loaded</h4>
                      <p className="text-xs text-slate-800 leading-relaxed mt-1 font-medium">
                        You successfully imported reports spanning <span className="text-indigo-600 font-extrabold">{uniqueDates.length} distinct dates</span>.
                        Filter analytics using the date dropdown in the header, or download the entire batch as a ZIP folder.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    id="helper-zip-download-btn"
                    onClick={handleExportAllAsZip}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow transition shrink-0 cursor-pointer animate-fadeIn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download ZIP archive
                  </button>
                </div>
              )}

            </div>
          )}

        </main>

        {/* Global footer inside main panel */}
        <footer className="border-t border-slate-200 py-6 bg-white/20 backdrop-blur-2xl text-center text-slate-700 text-xs mt-auto shrink-0 z-20">
          <div className="px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-7xl mx-auto font-medium">
            <p>© {new Date().getFullYear()} Depot Audit Suite. Secure administrative portal.</p>
            <p className="font-semibold text-slate-800">
              Developed and designed by <span className="text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text font-extrabold">Midhun Maheswar M D</span>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
