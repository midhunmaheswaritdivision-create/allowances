/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Upload, FolderOpen, AlertCircle, FileText } from 'lucide-react';
import JSZip from 'jszip';

interface UploadZoneProps {
  onFilesSelected: (files: { name: string; content: string }[]) => void;
  isLoading: boolean;
}

export default function UploadZone({ onFilesSelected, isLoading }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'utf-8');
    });
  };

  const readAndProcessFiles = async (files: File[]) => {
    setProgress({ current: 0, total: 100 }); // Temporary initial state
    
    interface PendingFile {
      name: string;
      readContent: () => Promise<string>;
    }
    
    const pendingFiles: PendingFile[] = [];
    
    try {
      for (const file of files) {
        if (file.name.endsWith('.txt')) {
          pendingFiles.push({
            name: file.name,
            readContent: () => readFileContent(file)
          });
        } else if (file.name.endsWith('.zip')) {
          try {
            // Load zip archive using JSZip
            const zip = await JSZip.loadAsync(file);
            const entries: any[] = [];
            
            zip.forEach((relativePath, zipEntry) => {
              if (!zipEntry.dir && zipEntry.name.endsWith('.txt')) {
                entries.push(zipEntry);
              }
            });

            for (const entry of entries) {
              const parts = entry.name.split('/');
              const baseName = parts[parts.length - 1];
              pendingFiles.push({
                name: baseName,
                readContent: () => entry.async('string')
              });
            }
          } catch (err) {
            console.error(`Failed to parse ZIP file: ${file.name}`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error scanning uploaded files:', err);
      setErrorMessage('Error scanning uploaded files. Please try again.');
      setProgress(null);
      return;
    }

    if (pendingFiles.length === 0) {
      setErrorMessage('No text (.txt) files or ZIP archives containing .txt files were found.');
      setProgress(null);
      return;
    }

    // 2. Process pending files in chunks
    setProgress({ current: 0, total: pendingFiles.length });
    const loadedFiles: { name: string; content: string }[] = [];
    const chunkSize = 25;
    
    for (let i = 0; i < pendingFiles.length; i += chunkSize) {
      const chunk = pendingFiles.slice(i, i + chunkSize);
      const promises = chunk.map(async (pending) => {
        try {
          const text = await pending.readContent();
          return { name: pending.name, content: text };
        } catch (err) {
          console.error(`Failed to read content for: ${pending.name}`, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((r): r is { name: string; content: string } => r !== null);
      loadedFiles.push(...validResults);

      const currentProgress = Math.min(i + chunkSize, pendingFiles.length);
      setProgress({ current: currentProgress, total: pendingFiles.length });

      // Short delay to yield main thread and update state smoothly
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setProgress(null);
    onFilesSelected(loadedFiles);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (isLoading) return;

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setErrorMessage(null);
    
    // We trigger the parent's loading state by passing empty callback or wait until reading starts
    // But since isLoading is controlled by parent, we'll start processing
    const fileEntries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          fileEntries.push(entry);
        }
      }
    }

    if (fileEntries.length === 0) return;

    const allFoundFiles: File[] = [];

    const traverse = async (entry: any) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject);
        });
        if (file.name.endsWith('.txt') || file.name.endsWith('.zip')) {
          allFoundFiles.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        
        const readAllEntries = async (): Promise<any[]> => {
          let allEntries: any[] = [];
          while (true) {
            const batch: any[] = await new Promise((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            if (batch.length === 0) break;
            allEntries = allEntries.concat(batch);
          }
          return allEntries;
        };

        try {
          const children = await readAllEntries();
          for (const child of children) {
            await traverse(child);
          }
        } catch (err) {
          console.error('Error reading directory entries:', err);
        }
      }
    };

    try {
      // Set parent loading state via dummy callbacks or immediate local UI feedback
      // Let's recursively find all .txt and .zip files
      for (const entry of fileEntries) {
        await traverse(entry);
      }

      if (allFoundFiles.length === 0) {
        setErrorMessage('No text (.txt) or ZIP (.zip) files found in the dropped selection.');
        return;
      }

      await readAndProcessFiles(allFoundFiles);
    } catch (err) {
      console.error('Drop traversal error:', err);
      setErrorMessage('Failed to parse dropped directory. Try using "Select Folder" button.');
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMessage(null);

    const filesArray: File[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files.item(i);
      if (file) {
        filesArray.push(file);
      }
    }

    const allowedFiles = filesArray.filter((f) => f.name.endsWith('.txt') || f.name.endsWith('.zip'));
    if (allowedFiles.length === 0) {
      setErrorMessage('No text (.txt) or ZIP (.zip) files found in the selection.');
      return;
    }

    readAndProcessFiles(allowedFiles);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderSelect = () => {
    folderInputRef.current?.click();
  };

  return (
    <div id="upload-container" className="w-full max-w-4xl mx-auto bg-white/30 backdrop-blur-3xl border border-slate-200/80 rounded-2xl p-8 shadow-xl shadow-indigo-950/5">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 mb-2 font-display">Import Depot Reports</h2>
        <p className="text-slate-800 text-sm max-w-md mx-auto font-medium">
          Upload individual `.txt` reports, `.zip` folders, or select an entire workspace folder containing your transit logs.
        </p>
      </div>

      <div
        id="dropzone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer backdrop-blur-md ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200 shadow-xl'
            : 'border-slate-350 bg-slate-100/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] hover:border-indigo-400 hover:bg-slate-100/90 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.02)]'
        } ${isLoading || progress ? 'pointer-events-none opacity-50' : ''}`}
        onClick={triggerFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.zip"
          multiple
          className="hidden"
          onChange={handleFilesChange}
          id="file-upload-input"
        />
        {/* Folder input with webkitdirectory support */}
        <input
          ref={folderInputRef}
          type="file"
          accept=".txt,.zip"
          multiple
          className="hidden"
          onChange={handleFilesChange}
          id="folder-upload-input"
          {...{ webkitdirectory: '', directory: '' }}
        />

        {isLoading || progress ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-700 font-bold text-sm">Processing and parsing text files...</p>
            {progress && (
              <div className="w-full max-w-sm mt-4 px-4">
                <div className="flex justify-between text-xs text-slate-700 mb-1.5 font-mono font-bold">
                  <span>Progress</span>
                  <span className="text-indigo-600">{progress.current} / {progress.total} files</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full transition-all duration-150 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-700 mt-2 font-medium">
                  Yielding UI thread to maintain page responsiveness.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 mb-4 text-indigo-600 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-base text-slate-700 font-semibold mb-1">
              Drag & Drop your files or <strong className="text-indigo-600 font-extrabold">folders</strong> here, or <span className="text-indigo-600 underline hover:text-indigo-800 font-bold">Browse Files</span>
            </p>
            <p className="text-xs text-slate-700 mb-6 font-medium">Supported files include: Bank Allowances (KSRTC), Chalo, Chalo Swift, and KURTC files</p>
            
            <div className="flex flex-wrap gap-4 justify-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                id="select-files-btn"
                onClick={triggerFileSelect}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/45 hover:bg-white/70 text-slate-700 font-extrabold text-xs rounded-xl border border-white/60 shadow-sm hover:shadow transition duration-200 cursor-pointer backdrop-blur-md"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                Select Files
              </button>
              <button
                type="button"
                id="select-folder-btn"
                onClick={triggerFolderSelect}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600/85 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/20 transition duration-200 cursor-pointer border border-white/20 backdrop-blur-md"
              >
                <FolderOpen className="w-4 h-4" />
                Select Folder
              </button>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div id="error-banner" className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-rose-800 font-bold text-sm font-display">Upload Error</h4>
            <p className="text-rose-600 text-xs mt-1 font-semibold">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}


