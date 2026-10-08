/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FolderOpen, 
  FileText, 
  Download, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Info,
  Calendar,
  Users,
  Coins
} from 'lucide-react';
import { parseDateFromFileName } from '../utils/parser';
import { parseDateToSortKey } from '../utils/excel';

interface TextReportGeneratorProps {
  onImportToLedger?: (parsedFiles: { name: string; content: string }[]) => void;
}

interface ParsedReportFile {
  name: string;
  content: string;
  fileDate: string;
  employeeCount: number;
  totalAmount: number;
}

export default function TextReportGenerator({ onImportToLedger }: TextReportGeneratorProps) {
  const [mainFolderName, setMainFolderName] = useState('');
  const [destinationFolder, setDestinationFolder] = useState('Downloads');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalFiles: number;
    totalEmployees: number;
    totalAmount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle folder or files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = (Array.from(e.target.files) as File[]).filter(f => f.name.endsWith('.txt'));
      if (filesArr.length === 0) {
        alert('No text (.txt) files found in the selection.');
        return;
      }
      setSelectedFiles(filesArr);
      
      // Determine a friendly folder name from the first relative path
      const firstFile = filesArr[0] as any;
      const relPath = firstFile?.webkitRelativePath || '';
      if (relPath && relPath.includes('/')) {
        setMainFolderName(relPath.split('/')[0]);
      } else {
        setMainFolderName(`${filesArr.length} selected text files`);
      }
      setGeneratedReport(null);
      setStats(null);
      setProgress(0);
    }
  };

  const triggerSelectFolder = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Indian currency formatting to match the Python tool exactly
  const formatAmountIndian = (amount: number): string => {
    const amountStr = String(Math.round(amount));
    const reversedStr = [...amountStr].reverse().join('');
    let formattedStr = '';

    // Add the first three digits as-is
    formattedStr += reversedStr.slice(0, 3);

    // Process the rest in groups of two (lakhs, crores)
    for (let i = 3; i < reversedStr.length; i += 2) {
      formattedStr += ',' + reversedStr.slice(i, i + 2);
    }

    return [...formattedStr].reverse().join('');
  };

  const handleGenerateReport = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select a main folder or multiple text files first.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setGeneratedReport(null);

    const parsedList: ParsedReportFile[] = [];
    const totalFiles = selectedFiles.length;

    // Simulate batch-by-batch parsing for visual progress feedback
    const batchSize = Math.max(1, Math.floor(totalFiles / 10));
    
    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles[i];
      const text = await file.text();
      const lines = text.split('\n');
      
      // 1. Extract file date from the first line between the 2nd and 3rd '#'
      let fileDateContent = 'Unknown';
      if (lines[0]) {
        const parts = lines[0].split('#');
        if (parts.length > 3) {
          fileDateContent = parts[2].trim();
        }
      }

      // 2. Count employees (excluding first line)
      const employeeCount = Math.max(0, lines.length - 1);

      // 3. Sum amounts (between 4th and 5th '#' in each line)
      let totalAmount = 0;
      for (let j = 1; j < lines.length; j++) {
        const lineParts = lines[j].split('#');
        if (lineParts.length > 5) {
          const amtStr = lineParts[4].replace(/,/g, '').trim();
          const amtVal = parseFloat(amtStr);
          if (!isNaN(amtVal)) {
            totalAmount += amtVal;
          }
        }
      }

      // 4. Extract date strictly from the text file name (ignoring folder names)
      const fileDate = parseDateFromFileName(file.name);

      parsedList.push({
        name: file.name,
        content: text,
        fileDate,
        employeeCount,
        totalAmount
      });

      // Update progress bar
      if (i % batchSize === 0 || i === totalFiles - 1) {
        setProgress(Math.round(((i + 1) / totalFiles) * 100));
        await new Promise((resolve) => setTimeout(resolve, 80)); // Soft delay for progress view
      }
    }

    // Accumulate date totals
    const dateTotals: Record<string, { files: number; employees: number; amount: number }> = {};
    let grandTotalFiles = 0;
    let grandTotalEmployees = 0;
    let grandTotalAmount = 0;

    parsedList.forEach((item) => {
      const key = item.fileDate;
      if (!dateTotals[key]) {
        dateTotals[key] = { files: 0, employees: 0, amount: 0 };
      }
      dateTotals[key].files += 1;
      dateTotals[key].employees += item.employeeCount;
      dateTotals[key].amount += item.totalAmount;

      grandTotalFiles += 1;
      grandTotalEmployees += item.employeeCount;
      grandTotalAmount += item.totalAmount;
    });

    // Generate output text to mirror Python's generated format exactly
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const uploadDate = `${dd}.${mm}.${yyyy}`;

    const reportLines: string[] = [
      `UPLOAD DATE - ${uploadDate}`,
      `---------------------------------------------------------`
    ];

    // Sort dates chronologically
    const sortedDateEntries = Object.entries(dateTotals).sort(([dateA], [dateB]) => 
      parseDateToSortKey(dateA).localeCompare(parseDateToSortKey(dateB))
    );

    sortedDateEntries.forEach(([fileDateInfo, totals]) => {
      reportLines.push(`FILE DATE : ${fileDateInfo}`);
      reportLines.push(`Files      : ${totals.files}`);
      reportLines.push(`Employees  : ${totals.employees.toLocaleString('en-IN')}`);
      reportLines.push(`Amount     : ${formatAmountIndian(totals.amount)}`);
      reportLines.push(`---------------------------------------------------------`);
    });

    // Grand totals
    reportLines.push(`GRAND TOTAL`);
    reportLines.push(`Total Files      : ${grandTotalFiles}`);
    reportLines.push(`Total Employees  : ${grandTotalEmployees.toLocaleString('en-IN')}`);
    reportLines.push(`Total Amount     : ${formatAmountIndian(grandTotalAmount)}`);

    const finalReport = reportLines.join('\n');
    setGeneratedReport(finalReport);
    setStats({
      totalFiles: grandTotalFiles,
      totalEmployees: grandTotalEmployees,
      totalAmount: grandTotalAmount
    });
    setIsProcessing(false);

    // Auto-download to destination
    const blob = new Blob([finalReport], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImportToWorkspace = () => {
    if (onImportToLedger && selectedFiles.length > 0) {
      // Load all selected files into the global workspace ledger
      const fileDataPromises = selectedFiles.map(async (file) => {
        const text = await file.text();
        return {
          name: file.name,
          content: text
        };
      });

      Promise.all(fileDataPromises).then((results) => {
        onImportToLedger(results);
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header card with developer name & title */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight font-display text-white mt-1.5">
              Text Report Generator
            </h2>
            <p className="text-slate-600 text-xs mt-1 max-w-lg leading-relaxed font-medium">
              A high-precision report engine compiled directly from Midhun Maheswar's original Tkinter core to aggregate employee numbers and payment sums.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-500 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-700"
            >
              <Info className="w-3.5 h-3.5" />
              About
            </button>
            <a
              href="tel:+919995215417"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-extrabold transition border border-indigo-500/20"
            >
              Support
            </a>
          </div>
        </div>
      </div>

      {/* Main Form Interface */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg shadow-indigo-950/2 space-y-5">
        
        {/* Hidden inputs for folder uploading */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          accept=".txt"
          {...({
            webkitdirectory: "",
            directory: ""
          } as any)}
        />

        {/* Inputs row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Main Folder select */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider font-display">
              Main Folder containing Text Files
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="No folder or files selected"
                value={mainFolderName}
                onClick={triggerSelectFolder}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none placeholder-slate-400 cursor-pointer hover:bg-slate-100/50 transition"
              />
              <button
                type="button"
                onClick={triggerSelectFolder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0 border border-emerald-600"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Select Main Folder
              </button>
            </div>
            <p className="text-[10px] text-slate-700 leading-normal font-medium">
              Select the directory of transit reports. It recursively aggregates files ending in <code className="text-indigo-600 font-mono font-bold">.txt</code>.
            </p>
          </div>

          {/* Destination Folder select */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider font-display">
              Destination Folder to Save Report
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={destinationFolder}
                onChange={(e) => setDestinationFolder(e.target.value)}
                placeholder="Downloads folder"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs text-slate-950 font-extrabold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDestinationFolder('Downloads')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Select Destination
              </button>
            </div>
            <p className="text-[10px] text-slate-700 leading-normal font-medium">
              Web download folder path. Defaults to browser's primary <code className="font-mono text-indigo-600 font-bold">Downloads</code> target.
            </p>
          </div>
        </div>

        {/* Selected Files count indicator */}
        {selectedFiles.length > 0 && (
          <div className="p-3 bg-indigo-50 border border-indigo-100/80 rounded-xl flex items-center justify-between text-xs text-indigo-800 font-semibold animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{selectedFiles.length} plain-text files staged and ready for compilation.</span>
            </div>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setMainFolderName('');
                setGeneratedReport(null);
                setStats(null);
              }}
              className="text-[10px] hover:underline text-indigo-600 hover:text-indigo-800 font-extrabold"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Progress Bar Container */}
        {(isProcessing || progress > 0) && (
          <div className="space-y-1.5 bg-slate-50 border border-slate-200/60 rounded-xl p-4 animate-fadeIn">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                Compiling files and sum totals...
              </span>
              <span className="font-mono font-extrabold text-slate-950">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-150 shadow" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action triggers */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={handleGenerateReport}
            disabled={selectedFiles.length === 0 || isProcessing}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer border ${
              selectedFiles.length === 0 
                ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-blue-600/10 hover:shadow-lg'
            }`}
          >
            <Play className="w-4 h-4" />
            Generate Report
          </button>

          {onImportToLedger && selectedFiles.length > 0 && (
            <button
              onClick={handleImportToWorkspace}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer border border-indigo-600"
            >
              Import Files to Admin Ledger workspace
            </button>
          )}
        </div>

      </div>

      {/* Generated Report Output View (if completed) */}
      {generatedReport && stats && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl animate-fadeIn space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest font-display">
                Generated Document View
              </h4>
              <h3 className="text-sm font-bold text-slate-950 mt-0.5">
                report.txt Overview
              </h3>
            </div>
            
            <button
              onClick={() => {
                const blob = new Blob([generatedReport], { type: 'text/plain;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'report.txt';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }}
              className="flex items-center gap-1 text-xs text-indigo-600 font-extrabold hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Again
            </button>
          </div>

          {/* Quick numbers summary badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-250/50 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Total Files</p>
                <p className="text-sm font-extrabold text-slate-850 mt-0.5">{stats.totalFiles}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-250/50 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/50 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Total Employees</p>
                <p className="text-sm font-extrabold text-slate-850 mt-0.5">{stats.totalEmployees.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-250/50 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-100/50 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Total Sum</p>
                <p className="text-sm font-extrabold text-slate-850 mt-0.5">₹{formatAmountIndian(stats.totalAmount)}</p>
              </div>
            </div>
          </div>

          {/* Code panel for actual document layout */}
          <div className="relative">
            <div className="absolute right-3 top-3 text-[10px] text-slate-600 font-mono select-none pointer-events-none">
              PLAIN TEXT FORMAT
            </div>
            <pre className="p-4 bg-slate-900 text-slate-350 rounded-xl overflow-x-auto max-h-72 overflow-y-auto text-xs font-mono leading-relaxed border border-slate-800 shadow-inner">
              {generatedReport}
            </pre>
          </div>
        </div>
      )}

      {/* Help / About Dialog Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-extrabold text-slate-900 font-display border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              About This Utility
            </h3>

            <div className="mt-4 space-y-3 text-xs text-slate-800 leading-relaxed font-semibold">
              <p className="font-extrabold text-slate-950">
                Program developed by Midhun Maheswar M D
              </p>
              <p className="font-mono text-indigo-600">
                Phone: +91 9995 215 417
              </p>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[11px] space-y-1 text-slate-800 font-medium">
                <p className="font-bold text-slate-700">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Select the main folder containing the text files.</li>
                  <li>Select the destination folder where the report will be saved.</li>
                  <li>Click 'Generate Report' to start the process.</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAbout(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold cursor-pointer transition shadow-sm"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program Courtesy labels at the bottom */}
      <div className="text-center text-[10px] text-slate-600 font-medium">
        Program developed by <strong className="text-indigo-600 font-extrabold">Midhun Maheswar M D</strong>
      </div>
    </div>
  );
}
