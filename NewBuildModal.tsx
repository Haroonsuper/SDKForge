import React, { useState } from 'react';
import { SDKGenOptions, SpecValidationDiagnostic } from '../types/spec';
import { generateSDKBundle } from '../engine/codeGen';
import { createSDKZipBlob, downloadZipBlob } from '../engine/zipBuilder';
import { useSaaS } from '../store/saasContext';
import { X, Download, Check, Sparkles, Box, Code2 } from 'lucide-react';

interface NewBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostic: SpecValidationDiagnostic;
  onBuildComplete: () => void;
}

export const NewBuildModal: React.FC<NewBuildModalProps> = ({
  isOpen,
  onClose,
  diagnostic,
  onBuildComplete
}) => {
  const { activeProject, activeOrg, addBuild } = useSaaS();

  const [language, setLanguage] = useState<'typescript' | 'python' | 'go'>('typescript');
  const [packageName, setPackageName] = useState(
    activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-sdk'
  );
  const [version, setVersion] = useState(activeProject.currentSpecVersion || '1.0.0');
  const [httpClient, setHttpClient] = useState<'fetch' | 'axios' | 'requests' | 'httpx' | 'net_http'>('fetch');
  const [includeGithubAction, setIncludeGithubAction] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);

  if (!isOpen) return null;

  const handleLanguageSelect = (lang: 'typescript' | 'python' | 'go') => {
    setLanguage(lang);
    if (lang === 'typescript') setHttpClient('fetch');
    else if (lang === 'python') setHttpClient('requests');
    else setHttpClient('net_http');
  };

  const handleBuildAndDownload = async () => {
    setIsBuilding(true);

    try {
      const opts: SDKGenOptions = {
        language,
        packageName,
        version,
        author: activeOrg.name,
        httpClient,
        includeTests: true,
        includeReadme: true,
        includeGithubAction,
        asyncMode: true
      };

      const files = generateSDKBundle(diagnostic, opts);
      const blob = await createSDKZipBlob(files);
      const zipName = `${packageName}-${language}-v${version}.zip`;
      downloadZipBlob(blob, zipName);

      // Record in SaaS build history
      addBuild({
        projectId: activeProject.id,
        language,
        version,
        status: 'completed',
        s3Url: `s3://sdkforge-artifacts-us-east-1/${activeOrg.id}/${zipName}`,
        zipSizeKb: Math.round((blob.size / 1024) * 10) / 10,
        generatedFilesCount: files.length,
        commitHash: Math.random().toString(36).substring(2, 9),
        durationMs: Math.floor(320 + Math.random() * 100),
        logs: [
          `Compiled ${diagnostic.endpoints.length} endpoints for ${language.toUpperCase()}.`,
          `Included CI/CD workflow: ${includeGithubAction ? 'Yes' : 'No'}.`,
          `Packaged ${files.length} files into S3 archive.`,
          `Ready for distribution.`
        ]
      });

      onBuildComplete();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Generate SDK & Package Bundle</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Target Language Selector */}
          <div>
            <label className="text-slate-400 font-semibold block mb-2">Target Language</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleLanguageSelect('typescript')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  language === 'typescript'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">TypeScript</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Typed fetch / Axios</div>
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSelect('python')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  language === 'python'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">Python</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Pydantic & requests</div>
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSelect('go')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  language === 'go'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">Go (Golang)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">net/http structs</div>
              </button>
            </div>
          </div>

          {/* Package Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Package Name</label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 font-semibold block mb-1">SemVer Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Transport Engine */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1">HTTP Client Engine</label>
            <select
              value={httpClient}
              onChange={(e) => setHttpClient(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {language === 'typescript' && (
                <>
                  <option value="fetch">Native Fetch (Standard Modern Web / Node 18+)</option>
                  <option value="axios">Axios Client Instance</option>
                </>
              )}
              {language === 'python' && (
                <>
                  <option value="requests">Requests (Synchronous Session)</option>
                  <option value="httpx">HTTPX (Modern Async / Sync)</option>
                </>
              )}
              {language === 'go' && (
                <option value="net_http">net/http with Context Support</option>
              )}
            </select>
          </div>

          {/* Included Features */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={includeGithubAction}
                onChange={(e) => setIncludeGithubAction(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span>Generate GitHub Actions Auto-Publish Workflow (.github/workflows)</span>
            </label>
          </div>

          <div className="text-[11px] text-slate-500">
            Source API: <span className="text-slate-300 font-medium">{diagnostic.title}</span> ({diagnostic.endpoints.length} routes, {diagnostic.schemas.length} schemas).
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBuildAndDownload}
            disabled={isBuilding}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isBuilding ? 'Building Package...' : 'Compile & Download ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
};
