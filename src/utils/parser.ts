/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Category, FileData } from '../types.ts';
import { DEPOT_CODE_MAPPING } from '../types.ts';

/**
 * Extracts only the base file name from a path (stripping all folder prefixes).
 */
export function extractBaseFileName(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || rawPath;
}

/**
 * Parses date strictly from the base text file name in DD-MM-YYYY format.
 * Supports:
 * - DDMMYYYY (e.g. 01082026_... -> 01-08-2026)
 * - YYYYMMDD (e.g. 20260801_... -> 01-08-2026)
 * - DD-MM-YYYY / DD_MM_YYYY / YYYY-MM-DD
 */
export function parseDateFromFileName(rawFileName: string): string {
  const baseName = extractBaseFileName(rawFileName).trim();

  // 1. Check for 8 digits at start of file name
  const eightDigitMatch = baseName.match(/^(\d{8})/);
  if (eightDigitMatch) {
    const dStr = eightDigitMatch[1];
    // If starts with 19xx or 20xx -> YYYYMMDD
    if (/^(19|20)\d{6}$/.test(dStr)) {
      const yyyy = dStr.substring(0, 4);
      const mm = dStr.substring(4, 6);
      const dd = dStr.substring(6, 8);
      return `${dd}-${mm}-${yyyy}`;
    }
    // If ends with 19xx or 20xx -> DDMMYYYY
    if (/^\d{4}(19|20)\d{2}$/.test(dStr)) {
      const dd = dStr.substring(0, 2);
      const mm = dStr.substring(2, 4);
      const yyyy = dStr.substring(4, 8);
      return `${dd}-${mm}-${yyyy}`;
    }
    // Default fallback: DDMMYYYY as per specification
    const dd = dStr.substring(0, 2);
    const mm = dStr.substring(2, 4);
    const yyyy = dStr.substring(4, 8);
    return `${dd}-${mm}-${yyyy}`;
  }

  // 2. Check for DD-MM-YYYY or DD_MM_YYYY or DD.MM.YYYY
  const dmyMatch = baseName.match(/^(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[1]}-${dmyMatch[2]}-${dmyMatch[3]}`;
  }

  // 3. Check for YYYY-MM-DD or YYYY_MM_DD
  const ymdMatch = baseName.match(/^(\d{4})[-_.](\d{2})[-_.](\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[3]}-${ymdMatch[2]}-${ymdMatch[1]}`;
  }

  return 'UNKNOWN';
}

/**
 * Extracts raw depot code from base filename (e.g. 01082026_VLD_... -> VLD)
 */
export function parseDepotFromFileName(rawFileName: string): string {
  const baseName = extractBaseFileName(rawFileName);
  const parts = baseName.split('_');

  if (parts.length >= 2 && parts[1].length >= 2 && parts[1].length <= 5) {
    return parts[1].toUpperCase();
  }

  // Fallback: search for 3-letter uppercase word
  const match = baseName.match(/(?:^|\_|\-)([A-Za-z]{3})(?:\_|\-|\.|$)/);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }

  return 'UNKNOWN';
}

/**
 * Parses a single text file's name and content to build a FileData record.
 */
export function parseFile(rawFileName: string, content: string): FileData {
  const baseName = extractBaseFileName(rawFileName);
  const lines = content.split(/\r?\n/);
  
  // Find non-empty lines to ensure we don't count empty files
  const activeLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  
  if (activeLines.length === 0) {
    throw new Error('File is empty or contains no content');
  }

  // Parse first line for consolidated amount
  const firstLine = activeLines[0];
  const firstLineParts = firstLine.split('#');
  let consolidatedAmount: number | null = null;
  
  if (firstLineParts.length >= 5) {
    const amtStr = firstLineParts[3].trim();
    const parsed = parseFloat(amtStr);
    if (!isNaN(parsed)) {
      consolidatedAmount = parsed;
    }
  }

  let auditedAmount = 0;
  let employeeCount = 0;

  // Process only non-empty lines after the first line
  for (let i = 1; i < activeLines.length; i++) {
    const line = activeLines[i];
    const parts = line.split('#');
    if (parts.length >= 6) {
      const amtStr = parts[4].trim();
      const amount = parseFloat(amtStr);
      if (!isNaN(amount)) {
        auditedAmount += amount;
        employeeCount++;
      }
    }
  }

  // Extract depot name and date from base file name (never from folder path)
  const depotRaw = parseDepotFromFileName(baseName);
  const date = parseDateFromFileName(baseName);
  
  // Map raw depot to standardized depot (e.g. VLD -> VND)
  const depotName = DEPOT_CODE_MAPPING[depotRaw] || depotRaw || 'UNKNOWN';

  // Categorize filename
  let category: Category;
  if (baseName.includes('_KSWIFT_')) {
    category = 'Chalo Swift';
  } else if (baseName.includes('_KURTC_')) {
    category = 'KURTC';
  } else if (baseName.endsWith('_bankallowances.txt')) {
    category = 'KSRTC';
  } else {
    category = 'Chalo';
  }

  // Check if audited and consolidated amount matches
  const hasMismatch = consolidatedAmount !== null && consolidatedAmount !== auditedAmount;

  return {
    id: Math.random().toString(36).substring(2, 9),
    fileName: baseName,
    depotName,
    date: date || 'UNKNOWN',
    employeeCount,
    consolidatedAmount,
    auditedAmount: Math.round(auditedAmount * 100) / 100, // round to 2 decimals
    category,
    hasMismatch,
    content,
    linesCount: activeLines.length
  };
}

/**
 * Groups raw files into a structured object indexed by date and category
 */
export function groupFilesByDateAndCategory(files: FileData[]): Record<string, Record<Category, FileData[]>> {
  const result: Record<string, Record<Category, FileData[]>> = {};

  for (const file of files) {
    const d = file.date;
    if (!result[d]) {
      result[d] = {
        'KSRTC': [],
        'Chalo': [],
        'Chalo Swift': [],
        'KURTC': []
      };
    }
    result[d][file.category].push(file);
  }

  return result;
}
