import { memo } from 'react';

interface PrintManifestProps {
  workspaceName: string;
  dataLength: number;
}

export const PrintManifest = memo(({ workspaceName, dataLength }: PrintManifestProps) => {
  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body * { visibility: hidden; }
          #print-manifest, #print-manifest * { visibility: visible; }
          #print-manifest { position: absolute; left: 0; top: 0; width: 100%; font-family: ui-sans-serif, system-ui, sans-serif; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div id="print-manifest" className="hidden print:block w-full text-black bg-white" aria-hidden="true">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SCS Manifest</h1>
            <p className="text-sm text-slate-600 mt-1">Workspace: {workspaceName}</p>
          </div>
          <div className="text-right text-sm">
            <p>{new Date().toLocaleDateString()}</p>
            <p>{dataLength} Lines</p>
          </div>
        </div>
      </div>
    </>
  );
});

PrintManifest.displayName = 'PrintManifest';