/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet, Users, Wallet, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { FileData } from '../types';

interface MetricsCardsProps {
  files: FileData[];
  onFilterMismatchOnly: () => void;
  onResetFilters: () => void;
  isFilteringMismatch: boolean;
}

export default function MetricsCards({
  files,
  onFilterMismatchOnly,
  onResetFilters,
  isFilteringMismatch
}: MetricsCardsProps) {
  const totalFiles = files.length;
  const totalEmployees = files.reduce((acc, f) => acc + f.employeeCount, 0);
  const totalAudited = files.reduce((acc, f) => acc + f.auditedAmount, 0);
  
  // Total consolidated is sum of non-null consolidated amounts
  const totalConsolidated = files.reduce((acc, f) => acc + (f.consolidatedAmount ?? 0), 0);
  
  // Count of mismatches
  const mismatches = files.filter(f => f.hasMismatch);
  const mismatchCount = mismatches.length;

  // Calculate sum of absolute differences in mismatches
  const totalDiff = mismatches.reduce((acc, f) => {
    if (f.consolidatedAmount !== null) {
      return acc + Math.abs(f.consolidatedAmount - f.auditedAmount);
    }
    return acc;
  }, 0);

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl mx-auto mb-8">
      {/* Total Files Card */}
      <div id="metric-files" className="bg-white/20 backdrop-blur-md border border-white/50 rounded-xl p-5 shadow-lg flex items-center gap-4 hover:border-indigo-300/60 hover:bg-white/30 hover:shadow-xl transition duration-300">
        <div className="w-12 h-12 rounded-lg bg-indigo-50/80 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-700 text-xs font-semibold uppercase tracking-wider font-display">Total Files</p>
          <h3 className="text-2xl font-bold text-slate-950 mt-1">{totalFiles}</h3>
          <p className="text-slate-600 text-[11px] font-medium mt-0.5">Parsed & structured successfully</p>
        </div>
      </div>

      {/* Total Employees Card */}
      <div id="metric-employees" className="bg-white/20 backdrop-blur-md border border-white/50 rounded-xl p-5 shadow-lg flex items-center gap-4 hover:border-emerald-300/60 hover:bg-white/30 hover:shadow-xl transition duration-300">
        <div className="w-12 h-12 rounded-lg bg-emerald-50/80 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-700 text-xs font-semibold uppercase tracking-wider font-display">Total Employees</p>
          <h3 className="text-2xl font-bold text-slate-950 mt-1">{totalEmployees}</h3>
          <p className="text-slate-600 text-[11px] font-medium mt-0.5">Aggregated employee count</p>
        </div>
      </div>

      {/* Audited / Consolidated Amount Card */}
      <div id="metric-amounts" className="bg-white/20 backdrop-blur-md border border-white/50 rounded-xl p-5 shadow-lg flex items-center gap-4 hover:border-cyan-300/60 hover:bg-white/30 hover:shadow-xl transition duration-300">
        <div className="w-12 h-12 rounded-lg bg-cyan-50/80 border border-cyan-100 flex items-center justify-center text-cyan-600 shadow-sm">
          <Wallet className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-700 text-xs font-semibold uppercase tracking-wider font-display">Total Audited</p>
          <h3 className="text-xl font-bold text-slate-950 mt-0.5 truncate">{formatCurrency(totalAudited)}</h3>
          <p className="text-slate-600 text-[10px] truncate font-semibold">
            Consolidated: <span className="text-slate-800 font-extrabold">{formatCurrency(totalConsolidated)}</span>
          </p>
        </div>
      </div>

      {/* Mismatch Card */}
      <div
        id="metric-mismatches"
        className={`border rounded-xl p-5 shadow-lg flex items-center gap-4 cursor-pointer transition duration-300 ${
          mismatchCount > 0
            ? isFilteringMismatch
              ? 'bg-amber-50/70 backdrop-blur-md border-amber-400 ring-2 ring-amber-100 shadow-xl'
              : 'bg-amber-50/30 backdrop-blur-md border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-xl'
            : 'bg-white/20 backdrop-blur-md border border-white/50 hover:border-slate-300 hover:bg-white/30 hover:shadow-xl'
        }`}
        onClick={mismatchCount > 0 ? (isFilteringMismatch ? onResetFilters : onFilterMismatchOnly) : undefined}
      >
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${
          mismatchCount > 0
            ? 'bg-amber-100/90 border border-amber-200 text-amber-700 animate-pulse'
            : 'bg-emerald-50/90 border border-emerald-100 text-emerald-600'
        }`}>
          {mismatchCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6 text-emerald-600" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-slate-700 text-xs font-semibold uppercase tracking-wider font-display">Mismatches</p>
            {mismatchCount > 0 && (
              <span className="text-[10px] bg-amber-100 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                {isFilteringMismatch ? 'Active' : 'Click to Filter'}
              </span>
            )}
          </div>
          <h3 className={`text-2xl font-bold mt-1 ${mismatchCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {mismatchCount}
          </h3>
          <p className="text-slate-600 text-[11px] font-semibold mt-0.5 truncate">
            {mismatchCount > 0 ? `Diff: ${formatCurrency(totalDiff)}` : 'All records audit perfectly'}
          </p>
        </div>
      </div>
    </div>
  );
}
