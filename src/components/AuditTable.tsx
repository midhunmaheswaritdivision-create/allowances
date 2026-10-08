/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, FileText, ChevronDown, ChevronUp, Eye, SlidersHorizontal, Info } from 'lucide-react';
import { FileData, Category } from '../types';

interface AuditTableProps {
  files: FileData[];
  isFilteringMismatchOnly: boolean;
  onClearMismatchFilter: () => void;
}

export default function AuditTable({
  files,
  isFilteringMismatchOnly,
  onClearMismatchFilter
}: AuditTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Category | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Matches' | 'Mismatches'>('All');
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  // Sync state if coming from the Mismatch KPI filter
  const currentMismatchFilter = isFilteringMismatchOnly ? 'Mismatches' : statusFilter;

  const handleStatusFilterChange = (val: 'All' | 'Matches' | 'Mismatches') => {
    if (isFilteringMismatchOnly) {
      onClearMismatchFilter();
    }
    setStatusFilter(val);
  };

  // Extract all unique dates present in files, sorted descending
  const uniqueDates = Array.from(new Set(files.map(f => f.date))).sort((a, b) => {
    const parse = (d: string) => /^\d{8}$/.test(d) ? `${d.substring(4,8)}${d.substring(2,4)}${d.substring(0,2)}` : d;
    return parse(b).localeCompare(parse(a));
  });

  // 1. Filter and Search files
  const filteredFiles = files.filter((file) => {
    // Search query matches file name or depot code
    const matchesSearch =
      file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.depotName.toLowerCase().includes(searchQuery.toLowerCase());

    // Category tab matches
    const matchesTab = activeTab === 'All' || file.category === activeTab;

    // Status matches
    const filterToUse = isFilteringMismatchOnly ? 'Mismatches' : statusFilter;
    let matchesStatus = true;
    if (filterToUse === 'Matches') {
      matchesStatus = !file.hasMismatch;
    } else if (filterToUse === 'Mismatches') {
      matchesStatus = file.hasMismatch;
    }

    // Date filter matches
    const matchesDate = selectedDate === 'All' || file.date === selectedDate;

    return matchesSearch && matchesTab && matchesStatus && matchesDate;
  });

  const toggleRow = (id: string) => {
    setExpandedFileId(expandedFileId === id ? null : id);
  };

  const formatCurrency = (val: number | null) => {
    if (val === null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatDateString = (raw: string): string => {
    if (/^\d{8}$/.test(raw)) {
      // raw is YYYYMMDD (e.g. 20260720) -> DD-MM-YYYY (e.g. 20-07-2026)
      return `${raw.substring(6, 8)}-${raw.substring(4, 6)}-${raw.substring(0, 4)}`;
    }
    return raw.replace(/[/.]/g, '-');
  };

  const formatFileLines = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const parts = trimmed.split('#');
      return {
        lineNum: idx + 1,
        parts,
        isHeader: idx === 0
      };
    }).filter(l => l !== null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl overflow-hidden shadow-lg mb-8">
      {/* Header and Controls */}
      <div className="p-6 border-b border-white/40 bg-white/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-950 flex items-center gap-2 font-display">
              <FileText className="w-5 h-5 text-indigo-600" />
              Detailed Audit Ledger
            </h3>
            <p className="text-slate-800 text-xs mt-1 font-medium">
              Search, filter, and audit processed records. Click any row to inspect line-by-line file content.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
            <input
              type="text"
              id="ledger-search-input"
              placeholder="Search by depot or file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/20 text-slate-950 pl-10 pr-4 py-2 text-sm rounded-xl border border-white/60 focus:outline-none focus:border-indigo-500 transition shadow-sm font-semibold backdrop-blur-md"
            />
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-white/20 p-1 rounded-xl border border-white/40 shadow-sm backdrop-blur-sm">
            {(['All', 'KSRTC', 'Chalo', 'Chalo Swift', 'KURTC'] as const).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab.toLowerCase().replace(' ', '-')}`}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white/50 text-indigo-700 shadow-md font-extrabold backdrop-blur-sm'
                    : 'text-slate-800 hover:text-slate-900 hover:bg-white/10 font-semibold'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filters dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            
            {/* Status Filter */}
            <select
              id="ledger-status-filter"
              value={isFilteringMismatchOnly ? 'Mismatches' : statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as any)}
              className="bg-white/20 text-slate-750 text-xs rounded-xl px-3 py-1.5 border border-white/60 focus:outline-none focus:border-indigo-500 shadow-sm font-extrabold cursor-pointer backdrop-blur-md"
            >
              <option value="All">All Statuses</option>
              <option value="Matches">Matching Audits</option>
              <option value="Mismatches">Amount Mismatches</option>
            </select>

            {/* Date Filter */}
            <select
              id="ledger-date-filter"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/20 text-slate-750 text-xs rounded-xl px-3 py-1.5 border border-white/60 focus:outline-none focus:border-indigo-500 shadow-sm font-extrabold cursor-pointer backdrop-blur-md"
            >
              <option value="All">All Dates</option>
              {uniqueDates.map(d => (
                <option key={d} value={d}>{formatDateString(d)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isFilteringMismatchOnly && (
        <div id="mismatch-filter-indicator" className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800 font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
            Currently filtered to show mismatches only (activated via dashboard summary card).
          </div>
          <button
            onClick={onClearMismatchFilter}
            className="text-amber-600 hover:text-amber-800 underline font-extrabold cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" id="ledger-table">
          <thead>
            <tr className="bg-white/25 border-b border-white/40 text-slate-800 text-xs font-extrabold uppercase tracking-wider">
              <th className="px-6 py-3.5 w-12 text-center">Audit</th>
              <th className="px-6 py-3.5">File Name / Category</th>
              <th className="px-6 py-3.5 w-32 text-center">Depot</th>
              <th className="px-6 py-3.5 w-32 text-center">Date</th>
              <th className="px-6 py-3.5 w-24 text-center">Employees</th>
              <th className="px-6 py-3.5 text-right w-44">Consolidated Amt</th>
              <th className="px-6 py-3.5 text-right w-44">Audited Amt</th>
              <th className="px-6 py-3.5 text-center w-36">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 text-slate-700 text-sm">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-600 text-sm font-medium">
                  No matching audit files found. Try clearing filters or uploading new files.
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const isExpanded = expandedFileId === file.id;
                const diff = file.consolidatedAmount !== null ? file.consolidatedAmount - file.auditedAmount : 0;
                
                return (
                  <React.Fragment key={file.id}>
                    {/* Row Item */}
                    <tr
                      className={`hover:bg-white/10 cursor-pointer transition-all duration-200 ${
                        file.hasMismatch ? 'bg-amber-50/30 hover:bg-amber-50/50' : ''
                      } ${isExpanded ? 'bg-white/20' : ''}`}
                      onClick={() => toggleRow(file.id)}
                    >
                      <td className="px-6 py-4 text-center">
                        <button className="text-slate-600 hover:text-indigo-600 transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-950 truncate max-w-xs sm:max-w-md lg:max-w-lg" title={file.fileName}>
                          {file.fileName}
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5 font-semibold flex items-center gap-1.5">
                          <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 font-medium">
                            {file.category}
                          </span>
                          <span>Line count: {file.linesCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                        {file.depotName}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700 font-mono text-xs font-medium">
                        {formatDateString(file.date)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700">
                        {file.employeeCount}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-950">
                        {formatCurrency(file.consolidatedAmount)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-950">
                        {formatCurrency(file.auditedAmount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {file.hasMismatch ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Mismatch
                          </span>
                        ) : file.consolidatedAmount === null ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-150 text-slate-800 text-xs font-semibold border border-slate-200">
                            <Info className="w-3.5 h-3.5 text-slate-600" />
                            No Consol
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Line-by-Line Content */}
                    {isExpanded && (
                      <tr className="bg-white/10">
                        <td colSpan={8} className="p-0">
                          <div className="px-8 py-6 border-l-4 border-indigo-500 bg-white/20 backdrop-blur-lg shadow-inner animate-fadeIn">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-white/30">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 font-display">
                                <Eye className="w-4 h-4 text-indigo-500" />
                                File Parser Inspection (Raw View)
                              </h4>
                              {file.hasMismatch && (
                                <div className="text-xs font-extrabold text-amber-800 bg-amber-50/80 border border-amber-200 px-3 py-1 rounded">
                                  Auditor Alert: Discrepancy of {formatCurrency(Math.abs(diff))} detected
                                </div>
                              )}
                            </div>

                            {/* File lines rendering */}
                            <div className="font-mono text-xs overflow-x-auto bg-white/10 backdrop-blur-md border border-white/40 rounded-xl max-h-80 overflow-y-auto p-4 leading-relaxed shadow-inner text-slate-700">
                              {formatFileLines(file.content).map((lineData, lIdx) => {
                                if (!lineData) return null;
                                return (
                                  <div
                                    key={lIdx}
                                    className={`py-1 px-2 rounded flex items-start gap-4 hover:bg-slate-100 transition ${
                                      lineData.isHeader
                                        ? 'bg-indigo-50 border-l-2 border-indigo-500 text-indigo-700 font-bold'
                                        : 'border-l-2 border-transparent'
                                    }`}
                                  >
                                    <span className="text-slate-600 select-none text-right w-6 font-semibold">{lineData.lineNum}</span>
                                    
                                    <div className="flex-1 flex flex-wrap items-center gap-1">
                                      {lineData.parts.map((part, pIdx) => {
                                        // Highlight values based on role
                                        const isConsolidatedVal = lineData.isHeader && pIdx === 3;
                                        const isAuditedVal = !lineData.isHeader && pIdx === 4;

                                        return (
                                          <span key={pIdx} className="inline-flex items-center">
                                            <span
                                              className={`px-1 rounded ${
                                                isConsolidatedVal
                                                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold'
                                                  : isAuditedVal
                                                  ? 'bg-emerald-50 border border-emerald-150 text-emerald-700 font-bold'
                                                  : 'text-slate-800 font-medium'
                                              }`}
                                            >
                                              {part}
                                            </span>
                                            {pIdx < lineData.parts.length - 1 && (
                                              <span className="text-slate-600 font-bold px-0.5">#</span>
                                            )}
                                          </span>
                                        );
                                      })}
                                    </div>

                                    {lineData.isHeader && (
                                      <span className="text-[10px] bg-indigo-100 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded self-center font-bold">
                                        Head Header (Field 4 = Consolidated Amount: {file.consolidatedAmount})
                                      </span>
                                    )}
                                    {!lineData.isHeader && lineData.parts.length >= 6 && (
                                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded self-center font-semibold">
                                        Emp Record (Field 5 = Employee Amount: {lineData.parts[4]})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
