import { useState, useRef, useCallback } from 'react';
import Papa, { type ParseResult } from 'papaparse';
import type { LifecycleStatus, RiskLevel } from '@/features/bom/types';

type CsvParsedRow = Record<string, string | undefined>;

export function useCsvUpload(
  userId: string | undefined, 
  activeWorkspaceId: string | null, 
  existingMpns: Set<string>,
  onUploadSuccess: (payload: any[]) => void,
  onError: (title: string, error: unknown) => void
) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !activeWorkspaceId) return;
    
    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      onError('Invalid Format', 'Please ensure the file is saved as a .CSV spreadsheet.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    Papa.parse<CsvParsedRow>(file, {
      header: true, skipEmptyLines: true, worker: true,
      complete: (results: ParseResult<CsvParsedRow>) => {
        try {
          const payload = results.data.map((row) => {
            // ... (Your existing normalization logic here) ...
            const normalizedRow: Record<string, string> = {};
            for (const key in row) {
              if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined) {
                normalizedRow[key.trim().toLowerCase()] = row[key]!;
              }
            }
            const rawMpn = normalizedRow['manufacturer part number (mpn)'] || normalizedRow['mpn'];
            
            return {
              tenant_id: userId, 
              workspace_id: activeWorkspaceId,
              mpn: rawMpn ? String(rawMpn).trim() : 'UNKNOWN',
              // ... map the rest of the fields
            };
          }).filter((p) => p.mpn !== 'UNKNOWN');

          if (payload.length === 0) throw new Error('We could not find an MPN column.');
          
          // Duplicate checks...
          const duplicateMpns = payload.filter(p => existingMpns.has(p.mpn.toLowerCase()));
          if (duplicateMpns.length > 0) throw new Error('Duplicate parts detected.');

          onUploadSuccess(payload);
        } catch (err: unknown) {
          onError('File Parsing Failed', err);
          setIsUploading(false);
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: () => { 
        onError('Upload Interrupted', 'Failed to read the CSV file correctly.'); 
        setIsUploading(false); 
      }
    });
  }, [userId, activeWorkspaceId, existingMpns, onUploadSuccess, onError]);

  return { isUploading, fileInputRef, handleFileUpload, setIsUploading };
}