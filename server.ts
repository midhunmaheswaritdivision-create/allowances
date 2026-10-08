/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { DEPOT_MASTER_LIST, DEPOT_ALIAS_MAP } from './src/data/depots.ts';
import { parseDateFromFileName, parseDepotFromFileName, extractBaseFileName } from './src/utils/parser.ts';
import { generateMatrixExcelReport } from './src/utils/excel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware for parsing json and urlencoded data (supporting large log uploads)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // --- API Endpoints ---

  // Health and System Status
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'online',
      system: 'Depot Audit & Allowance Full-Stack Server',
      version: '1.2.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      author: 'Midhun Maheswar M D'
    });
  });

  // Backend Audit File Parser (UTF-8, # delimiter, Category Sheet Routing)
  app.post('/api/audit/parse', (req: Request, res: Response) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'Files array is required' });
      }

      const parsedRecords = files.map((f: { name?: string; fileName?: string; content?: string }) => {
        const rawFileName = f.name || f.fileName || 'unknown.txt';
        const baseName = extractBaseFileName(rawFileName);
        const content = f.content || '';
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length === 0) {
          return {
            fileName: baseName,
            error: 'File is empty or contains no valid content'
          };
        }

        // Top record: First line contains consolidated amount
        const firstLine = lines[0];
        const firstParts = firstLine.split('#');
        let consolidatedAmount: number | null = null;
        if (firstParts.length >= 5) {
          const amt = parseFloat(firstParts[3].trim());
          if (!isNaN(amt)) {
            consolidatedAmount = amt;
          }
        }

        let auditedAmount = 0;
        let employeeCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split('#');
          if (parts.length >= 6) {
            const amt = parseFloat(parts[4].trim());
            if (!isNaN(amt)) {
              auditedAmount += amt;
              employeeCount++;
            }
          }
        }

        // Automated Sheet Routing:
        // - File has _KSWIFT_ → Chalo Swift Sheet
        // - File has _KURTC_ → KURTC Sheet
        // - Ends with _bankallowances.txt → KSRTC Sheet
        // - Otherwise → Default Chalo Transit Sheet
        let category: 'KSRTC' | 'Chalo' | 'Chalo Swift' | 'KURTC';
        if (baseName.includes('_KSWIFT_')) {
          category = 'Chalo Swift';
        } else if (baseName.includes('_KURTC_')) {
          category = 'KURTC';
        } else if (baseName.endsWith('_bankallowances.txt')) {
          category = 'KSRTC';
        } else {
          category = 'Chalo';
        }

        const date = parseDateFromFileName(baseName);
        const depotRaw = parseDepotFromFileName(baseName);

        const hasMismatch = consolidatedAmount !== null && consolidatedAmount !== auditedAmount;

        return {
          id: Math.random().toString(36).substring(2, 9),
          fileName: baseName,
          depotName: DEPOT_ALIAS_MAP[depotRaw] || depotRaw || 'UNKNOWN',
          date,
          employeeCount,
          consolidatedAmount,
          auditedAmount: Math.round(auditedAmount * 100) / 100,
          category,
          hasMismatch,
          linesCount: lines.length
        };
      });

      return res.json({
        success: true,
        count: parsedRecords.length,
        data: parsedRecords
      });
    } catch (err: any) {
      console.error('Error in /api/audit/parse:', err);
      return res.status(500).json({ error: err?.message || 'Parsing failed on server' });
    }
  });

  // Backend Employee Search (faithfully mirroring Python search_and_copy_lines)
  app.post('/api/employee/search', (req: Request, res: Response) => {
    try {
      const { searchId, files } = req.body;
      if (!searchId) {
        return res.status(400).json({ error: 'searchId is required' });
      }
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'files array is required' });
      }

      const searchStr = String(searchId).trim();
      const uniqueLinesSet = new Set<string>();
      const results: Array<{
        fileName: string;
        lineNumber: number;
        content: string;
        parts: string[];
      }> = [];

      for (const file of files) {
        const fileName = file.fileName || file.name || 'report.txt';
        const content = file.content || '';
        const lines = content.split(/\r?\n/);

        lines.forEach((line: string, idx: number) => {
          if (line.includes(searchStr)) {
            const lineNumber = idx + 1;
            const stripped = line.trim();
            const uniqueKey = `Line ${lineNumber}: ${stripped}`;

            if (!uniqueLinesSet.has(uniqueKey)) {
              uniqueLinesSet.add(uniqueKey);
              results.push({
                fileName,
                lineNumber,
                content: stripped,
                parts: stripped.split('#')
              });
            }
          }
        });
      }

      return res.json({
        success: true,
        searchId: searchStr,
        totalMatches: results.length,
        results
      });
    } catch (err: any) {
      console.error('Error in /api/employee/search:', err);
      return res.status(500).json({ error: err?.message || 'Employee search failed' });
    }
  });

  // Backend Excel Search Report Generator
  app.post('/api/employee/export-excel', async (req: Request, res: Response) => {
    try {
      const { searchId, results } = req.body;
      if (!Array.isArray(results)) {
        return res.status(400).json({ error: 'results array is required' });
      }

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Search Results');

      ws.columns = [
        { header: 'File Path', key: 'filePath', width: 20 },
        { header: 'File Name', key: 'fileName', width: 35 },
        { header: 'Line Number', key: 'lineNumber', width: 15 },
        ...Array.from({ length: 20 }, (_, i) => ({
          header: `Part ${i + 1}`,
          key: `part${i + 1}`,
          width: 15
        }))
      ];

      results.forEach((r: any) => {
        const parts: string[] = r.content ? r.content.split('#') : (r.parts || []);
        const rowData: Record<string, any> = {
          filePath: 'Server/Depot',
          fileName: r.fileName,
          lineNumber: r.lineNumber
        };

        parts.forEach((p, idx) => {
          let val: string | number = p;
          if (idx === 4) {
            const num = parseFloat(p);
            if (!isNaN(num)) val = num;
          }
          rowData[`part${idx + 1}`] = val;
        });

        ws.addRow(rowData);
      });

      // Style Header
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Report_of_${searchId || 'employee'}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error('Error in /api/employee/export-excel:', err);
      return res.status(500).json({ error: err?.message || 'Excel generation failed' });
    }
  });

  // Backend Matrix Excel Generator (Matching attached official template)
  app.post('/api/audit/generate-matrix-excel', async (req: Request, res: Response) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'files array is required' });
      }

      const blob = await generateMatrixExcelReport(files, 'Consolidation');
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Depot_Consolidation_Matrix.xlsx"');
      return res.send(buffer);
    } catch (err: any) {
      console.error('Error in /api/audit/generate-matrix-excel:', err);
      return res.status(500).json({ error: err?.message || 'Matrix Excel generation failed' });
    }
  });

  // Backend Text Report (report.txt) generator with Indian numbering formatting
  app.post('/api/audit/generate-text-report', (req: Request, res: Response) => {
    try {
      const { files } = req.body;
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'files array is required' });
      }

      const dateTotals: Record<string, { files: number; employees: number; amount: number }> = {};
      let grandTotalFiles = 0;
      let grandTotalEmployees = 0;
      let grandTotalAmount = 0;

      files.forEach((file: any) => {
        let rawDate = file.date || '';
        if (/^\d{8}$/.test(rawDate)) {
          rawDate = `${rawDate.substring(6, 8)}/${rawDate.substring(4, 6)}/${rawDate.substring(0, 4)}`;
        }
        const fileDateInfo = rawDate || 'UNKNOWN';

        if (!dateTotals[fileDateInfo]) {
          dateTotals[fileDateInfo] = { files: 0, employees: 0, amount: 0 };
        }

        dateTotals[fileDateInfo].files += 1;
        dateTotals[fileDateInfo].employees += (file.employeeCount || 0);
        dateTotals[fileDateInfo].amount += (file.auditedAmount || 0);

        grandTotalFiles += 1;
        grandTotalEmployees += (file.employeeCount || 0);
        grandTotalAmount += (file.auditedAmount || 0);
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

      const formatAmount = (amount: number): string => {
        const rounded = Math.round(amount);
        const amountStr = String(rounded);
        const reversedStr = [...amountStr].reverse().join('');
        let formattedStr = '';

        formattedStr += reversedStr.slice(0, 3);
        for (let i = 3; i < reversedStr.length; i += 2) {
          formattedStr += ',' + reversedStr.slice(i, i + 2);
        }

        return [...formattedStr].reverse().join('');
      };

      Object.entries(dateTotals).forEach(([fileDateInfo, totals]) => {
        reportLines.push(`FILE DATE : ${fileDateInfo}`);
        reportLines.push(`Files      : ${totals.files}`);
        reportLines.push(`Employees  : ${totals.employees.toLocaleString('en-IN')}`);
        reportLines.push(`Amount     : ${formatAmount(totals.amount)}`);
        reportLines.push(`---------------------------------------------------------`);
      });

      reportLines.push(`GRAND TOTAL`);
      reportLines.push(`Total Files      : ${grandTotalFiles}`);
      reportLines.push(`Total Employees  : ${grandTotalEmployees.toLocaleString('en-IN')}`);
      reportLines.push(`Total Amount     : ${formatAmount(grandTotalAmount)}`);

      const text = reportLines.join('\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="report.txt"');
      return res.send(text);
    } catch (err: any) {
      console.error('Error in /api/audit/generate-text-report:', err);
      return res.status(500).json({ error: err?.message || 'Report generation failed' });
    }
  });

  // --- Vite Dev Integration & Production Static Serving ---
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Depot Audit Full-Stack Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});
