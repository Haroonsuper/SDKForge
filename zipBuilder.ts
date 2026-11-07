import JSZip from 'jszip';
import { SDKFile } from '../types/spec';

/**
 * Creates a downloadable ZIP archive from a list of generated SDK files.
 */
export async function createSDKZipBlob(files: SDKFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    // JSZip handles folder paths like "src/client.ts" automatically
    zip.file(file.path, file.content);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9
    }
  });
}

/**
 * Triggers a browser download of the generated ZIP file
 */
export function downloadZipBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Triggers a single file download
 */
export function downloadSingleFile(file: SDKFile): void {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
