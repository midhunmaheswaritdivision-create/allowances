/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Category = 'KSRTC' | 'Chalo' | 'Chalo Swift' | 'KURTC';

export interface FileData {
  id: string;
  fileName: string;
  depotName: string;
  date: string;
  employeeCount: number;
  consolidatedAmount: number | null;
  auditedAmount: number;
  category: Category;
  hasMismatch: boolean;
  content: string;
  linesCount: number;
}

export interface DateGroupedData {
  [date: string]: {
    'KSRTC': FileData[];
    'Chalo': FileData[];
    'Chalo Swift': FileData[];
    'KURTC': FileData[];
  };
}

export interface ParsingError {
  fileName: string;
  error: string;
}

export const DEPOT_CODES = [
  'ADR', 'ALP', 'ALV', 'ANK', 'ARD', 'ARK', 'ATL', 'CDM', 'CGR', 'CHR', 'CHT', 'CLD', 'CNI', 'CTL', 'CTR', 'CTY', 'EDT', 'EKM', 
  'EMY', 'ETP', 'GVR', 'HPD', 'IJK', 'KDR', 'KGD', 'KHD', 'KKD', 'KKM', 'KLM', 'KLP', 'KMG', 'KMR', 'KMY', 'KNI', 'KNP',
  'KNR', 'KPM', 'KPT', 'KTD', 'KTM', 'KTP', 'KTR', 'KYM', 'MKD', 'MLA', 'MLP', 'MLT', 'MND', 'MNR', 'MPY', 'MVK', 'MVP',
  'NBR', 'NDD', 'NDM', 'NPR', 'NTA', 'PBR', 'PDK', 'PDM', 'PLA', 'PLD', 'PLK', 'PLR', 'PMN', 'PNI', 'PNK', 'PNR', 'PPD',
  'PPM', 'PRK', 'PSL', 'PTA', 'PVM', 'PVR', 'RNI', 'SBY', 'TDP', 'TDY', 'TLY', 'TPM', 'TSR', 'TSY', 'TVL', 'TVM', 'VDA',
  'VDK', 'VJD', 'VKB', 'VKM', 'VND', 'VRD', 'VTR', 'VZM'
];

export const DEPOT_CODE_MAPPING: Record<string, string> = {
  'VLD': 'VND'
};
