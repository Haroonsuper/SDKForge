import React, { useState, useMemo } from 'react';
import { SDKFile, SDKGenOptions, SpecValidationDiagnostic } from '../types/spec';
import { generateSDKBundle } from '../engine/codeGen';
import { createSDKZipBlob, downloadZipBlob, downloadSingleFile } from '../engine/zipBuilder';
import { useSaaS } from '../store/saasContext';
import {
  FileCode,
  FolderTree,
  Download,
  Copy,
  Check,
  Settings2,
  Terminal,
  ExternalLink,
  Layers,
  FileCheck2,
  Folder,
  FileText
} from 'lucide-react';

interface CodeStudioViewProps {
  diagnostic: SpecValidationDiagnostic;
  onOpenPlayground: () => void;
}

export const CodeStudioView: React.FC<CodeStudioViewProps> = ({
  diagnostic,
  onOpenPlayground
}) => {
  const { activeProject, activeOrg, addBuild } = useSaaS();

  const [options, setOptions] = useState<SDKGenOptions>({
    language: 'typescript',
    packageName: activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    version: activeProject.currentSpecVersion || '1.0.0',
    author: activeOrg.name,
    httpClient: 'fetch',
    includeTests: true,
    includeReadme: true,
    includeGithubAction: true,
    asyncMode: true
  });

  const [selectedFilePath, setSelectedFilePath] = useState<string>('src/client.ts');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [buildSavedNotice, setBuildSavedNotice] = useState<boolean>(false);

  // Generate files dynamically whenever diagnostic or options change
  const generatedFiles = useMemo(() => {
    const bundle = generateSDKBundle(diagnostic, options);
    return bundle;
  }, [diagnostic, options]);

  // Adjust selected file if switching languages
  React.useEffect(() => {
    if (generatedFiles.length > 0 && !generatedFiles.some(f => f.path === selectedFilePath)) {
      setSelectedFilePath(generatedFiles[0].path);
    }
  }, [options.language, generatedFiles]);

  const currentFile = generatedFiles.find(f => f.path === selectedFilePath) || generatedFiles[0];

  const handleCopyCode = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const blob = await createSDKZipBlob(generatedFiles);
      const zipName = `${options.packageName}-${options.language}-v${options.version}.zip`;
      downloadZipBlob(blob, zipName);

      // Save build to SaaS history
      addBuild({
        projectId: activeProject.id,
        language: options.language,
        version: options.version,
        status: 'completed',
        s3Url: `s3://sdkforge-artifacts-us-east-1/${activeOrg.id}/${zipName}`,
        zipSizeKb: Math.round((blob.size / 1024) * 10) / 10,
        generatedFilesCount: generatedFiles.length,
        commitHash: Math.random().toString(36).substring(2, 9),
        durationMs: Math.floor(280 + Math.random() * 150),
        logs: [
          `Target: ${options.language.toUpperCase()} client with ${options.httpClient}.`,
          `Compiled ${generatedFiles.length} project files.`,
          `ZIP archive created: ${zipName} (${Math.round(blob.size / 1024)} KB).`,
          `Published to multi-tenant artifact registry.`
        ]
      });

      setBuildSavedNotice(true);
      setTimeout(() => setBuildSavedNotice(false), 3500);
    } catch (err) {
      console.error('Failed to create ZIP', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleLanguageChange = (lang: 'typescript' | 'python' | 'go') => {
    let client: 'fetch' | 'axios' | 'requests' | 'httpx' | 'net_http' = 'fetch';
    if (lang === 'python') client = 'requests';
    if (lang === 'go') client = 'net_http';

    setOptions(prev => ({
      ...prev,
      language: lang,
      httpClient: client
    }));
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Bar */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Code Studio & AST CodeGen
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic code generation without AI hallucination. Compiles OpenAPI / Postman schemas to clean, typed language packages.
            </p>
          </div>

          {/* Language Switcher Buttons (Functional segmented control, no pill capsules) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => handleLanguageChange('typescript')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                options.language === 'typescript'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TypeScript
            </button>
            <button
              onClick={() => handleLanguageChange('python')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                options.language === 'python'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Python
            </button>
            <button
              onClick={() => handleLanguageChange('go')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                options.language === 'go'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Go (Golang)
            </button>
          </div>
        </div>

        {/* Options Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 text-[11px] font-medium">Package Identifier</label>
            <input
              type="text"
              value={options.packageName}
              onChange={(e) => setOptions({ ...options, packageName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 text-[11px] font-medium">SDK Version</label>
            <input
              type="text"
              value={options.version}
              onChange={(e) => setOptions({ ...options, version: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 text-[11px] font-medium">HTTP Transport Engine</label>
            <select
              value={options.httpClient}
              onChange={(e) => setOptions({ ...options, httpClient: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {options.language === 'typescript' && (
                <>
                  <option value="fetch">Native Fetch (Zero Dependencies)</option>
                  <option value="axios">Axios Client</option>
                </>
              )}
              {options.language === 'python' && (
                <>
                  <option value="requests">Requests (Standard Sync)</option>
                  <option value="httpx">HTTPX (Modern Sync/Async)</option>
                </>
              )}
              {options.language === 'go' && (
                <option value="net_http">net/http (Standard Library)</option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={options.includeGithubAction}
                onChange={(e) => setOptions({ ...options, includeGithubAction: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span>Include CI/CD Workflow</span>
            </label>
          </div>
        </div>
      </div>

      {/* Code Studio Workbench: Sidebar File Tree (4 cols) & Editor Canvas (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* File Tree Explorer (4 cols) */}
        <div className="lg:col-span-4 border border-slate-800 rounded-xl bg-slate-900/80 flex flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <FolderTree className="w-4 h-4 text-indigo-400" />
              <span>Project Files ({generatedFiles.length})</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 capitalize">
              {options.language}
            </span>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {generatedFiles.map((file) => {
              const isSelected = file.path === selectedFilePath;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {file.name.endsWith('.md') ? (
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : file.name.endsWith('.json') || file.name.endsWith('.toml') || file.name.endsWith('.mod') ? (
                      <FileCheck2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate">{file.path}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {Math.round(file.sizeBytes / 102.4) / 10} KB
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              {isZipping ? 'Bundling ZIP...' : 'Download Complete SDK (.ZIP)'}
            </button>

            {buildSavedNotice && (
              <div className="text-center text-[11px] text-emerald-400 font-medium animate-fade-in">
                ✓ Artifact archived & build recorded in S3 history.
              </div>
            )}
          </div>
        </div>

        {/* Code Viewer (8 cols) */}
        <div className="lg:col-span-8 border border-slate-800 rounded-xl bg-slate-900/80 flex flex-col overflow-hidden">
          {/* File Tab Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span className="text-slate-500">path:</span>
              <span className="font-semibold text-indigo-300">{currentFile?.path}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>

              {currentFile && (
                <button
                  onClick={() => downloadSingleFile(currentFile)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  <span>Download File</span>
                </button>
              )}
            </div>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
            <pre className="grid grid-cols-[auto_1fr] gap-x-4">
              {/* Line numbers */}
              <span className="select-none text-slate-600 text-right pr-2 border-r border-slate-800/80 font-mono text-[11px]">
                {currentFile?.content.split('\n').map((_, i) => (
                  <span key={i} className="block">
                    {i + 1}
                  </span>
                ))}
              </span>
              {/* Code content */}
              <code className="text-slate-200 overflow-x-auto whitespace-pre">
                {currentFile?.content}
              </code>
            </pre>
          </div>

          {/* Quick link to test in playground */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
            <span>Ready to test these generated methods?</span>
            <button
              onClick={onOpenPlayground}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              Open in API Playground
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
