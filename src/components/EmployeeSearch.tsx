import React, { useState } from 'react';
import { Search, FileText, Download, UserSearch, FileSpreadsheet } from 'lucide-react';
import { FileData } from '../types';
import ExcelJS from 'exceljs';

interface EmployeeSearchProps {
  files: FileData[];
}

export default function EmployeeSearch({ files }: EmployeeSearchProps) {
  const [searchId, setSearchId] = useState('');
  const [lastSearchId, setLastSearchId] = useState('');
  const [searchResults, setSearchResults] = useState<{ file: FileData; lineNumber: number; content: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchId.trim() || files.length === 0) return;
    setIsSearching(true);
    setHasSearched(true);
    setLastSearchId(searchId.trim());

    try {
      // Connect to full-stack backend endpoint
      const response = await fetch('/api/employee/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchId: searchId.trim(),
          files: files.map(f => ({ fileName: f.fileName, content: f.content }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          const matchedResults = data.results.map((r: any) => {
            const matchedFile = files.find(f => f.fileName === r.fileName) || files[0];
            return {
              file: matchedFile,
              lineNumber: r.lineNumber,
              content: r.content
            };
          });
          setSearchResults(matchedResults);
          setIsSearching(false);
          return;
        }
      }
    } catch {
      // Seamless fallback to client-side search
    }

    // Client-side execution
    setTimeout(() => {
      const results: { file: FileData; lineNumber: number; content: string }[] = [];
      const uniqueLinesSet = new Set<string>();

      files.forEach(file => {
        const lines = file.content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes(searchId.trim())) {
            const lineNumber = index + 1;
            const lineContent = `Line ${lineNumber}: ${line.trim()}`;
            if (!uniqueLinesSet.has(lineContent)) {
              uniqueLinesSet.add(lineContent);
              results.push({
                file,
                lineNumber,
                content: line.trim()
              });
            }
          }
        });
      });

      setSearchResults(results);
      setIsSearching(false);
    }, 200);
  };

  const handleExportTxt = () => {
    if (searchResults.length === 0) return;
    
    const lines = searchResults.map(r => `${r.file.fileName} - Line ${r.lineNumber}: ${r.content}`);
    const reportText = lines.join('\n');
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_of_${lastSearchId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExportExcel = async () => {
    if (searchResults.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Search Results");

      const columns: any[] = [
        { header: 'File Path', key: 'filePath', width: 15 },
        { header: 'File Name', key: 'fileName', width: 35 },
        { header: 'Line Number', key: 'lineNumber', width: 15 }
      ];

      for (let i = 1; i <= 20; i++) {
        columns.push({ header: `Part ${i}`, key: `part${i}`, width: 15 });
      }
      ws.columns = columns;

      searchResults.forEach(r => {
        const parts = r.content.split('#');
        const rowData: any = {
          filePath: 'Browser/Local',
          fileName: r.file.fileName,
          lineNumber: r.lineNumber
        };
        
        parts.forEach((p, idx) => {
          let val: string | number = p;
          if (idx === 4) { // 5th part (0-indexed) becomes 8th column equivalent
            const num = parseFloat(p);
            if (!isNaN(num)) val = num;
          }
          rowData[`part${idx + 1}`] = val;
        });
        
        ws.addRow(rowData);
      });

      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_of_${lastSearchId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('An error occurred while generating the Excel report.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-teal-600/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight font-display text-white mt-1.5 flex items-center gap-2">
              <UserSearch className="w-6 h-6 text-teal-400" />
              Employee Allowance Search
            </h2>
            <p className="text-slate-400 text-xs mt-1 max-w-lg leading-relaxed font-medium">
              Search for specific employee records across all imported files and export the results to Text or Excel.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Employee ID No..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-white/60 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm backdrop-blur-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchId.trim() || files.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
      </div>

      {hasSearched && (
        <div className="bg-white/20 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-lg animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-display flex items-center gap-2">
                Search Results for "{lastSearchId}"
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Found {searchResults.length} {searchResults.length === 1 ? 'record' : 'records'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportTxt}
                disabled={searchResults.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/70 hover:bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold border border-slate-200/60 shadow-sm transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Export TXT
              </button>
              <button
                onClick={handleExportExcel}
                disabled={searchResults.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold border border-emerald-500 shadow-sm shadow-emerald-600/20 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Excel
              </button>
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="bg-white/50 border border-slate-200/60 rounded-xl overflow-hidden shadow-inner">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 z-10">
                    <tr className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">File Name</th>
                      <th className="px-4 py-3 w-16 text-center">Line</th>
                      <th className="px-4 py-3">Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {searchResults.map((result, idx) => (
                      <tr key={idx} className="hover:bg-white/60 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {result.file.fileName}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 text-center">
                          {result.lineNumber}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 truncate max-w-md" title={result.content}>
                          {result.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white/30 rounded-xl border border-white/50">
              <UserSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">No records found</p>
              <p className="text-xs text-slate-500 mt-1">Try searching for a different Employee ID.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
