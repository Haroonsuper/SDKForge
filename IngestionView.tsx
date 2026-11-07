import React, { useState, useMemo } from 'react';
import { SpecValidationDiagnostic } from '../types/spec';
import { SAMPLE_SPECS, SampleSpec } from '../engine/sampleSpecs';
import {
  UploadCloud,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';

interface IngestionViewProps {
  rawSpec: string;
  onUpdateSpec: (spec: string) => void;
  diagnostic: SpecValidationDiagnostic;
  onProceedToStudio: () => void;
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  rawSpec,
  onUpdateSpec,
  diagnostic,
  onProceedToStudio
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFileUpload = (file: File) => {
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert('File is too large. Maximum allowed size is 5 MB.');
      return;
    }
    if (!/\.(json|ya?ml)$/i.test(file.name)) {
      alert('Only .json, .yaml or .yml files (OpenAPI / Swagger / Postman) are supported.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onUpdateSpec(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawSpec);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawSpec);
      onUpdateSpec(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore if invalid
    }
  };

  const filteredEndpoints = useMemo(() => {
    return diagnostic.endpoints.filter(ep => {
      const matchesTag = selectedTag === 'all' || ep.tag.toLowerCase() === selectedTag.toLowerCase();
      const matchesSearch =
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.functionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [diagnostic.endpoints, selectedTag, searchQuery]);

  const methodColors: Record<string, string> = {
    GET: 'text-sky-400 bg-sky-950/60 border-sky-800/60',
    POST: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
    PUT: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
    PATCH: 'text-violet-400 bg-violet-950/60 border-violet-800/60',
    DELETE: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
  };

  return (
    <div className="space-y-6">
      {/* Hero Ingestion Header */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/60 p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              API Specification Ingestion & AST Validator
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Upload Postman Collection v2/v2.1 or OpenAPI/Swagger JSON. The AST Engine validates all HTTP paths, 
              maps schema components, and prepares typed client method signatures.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onProceedToStudio}
              disabled={!diagnostic.isValid || diagnostic.endpoints.length === 0}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              Configure & Generate SDK
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Sample Selector */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Load Enterprise Sample:</span>
          {SAMPLE_SPECS.map(sample => (
            <button
              key={sample.id}
              onClick={() => onUpdateSpec(sample.content)}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/50 transition-colors"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Column Split: Upload/Editor & AST Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Spec Editor & Upload (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/60 text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-300">
                <FileCode2 className="w-4 h-4 text-indigo-400" />
                <span>Raw Specification JSON</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFormatJson}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[11px]"
                >
                  Prettify JSON
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[11px] flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Drag and Drop Dropzone Strip */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`p-3 border-b text-center text-xs transition-colors ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300'
                  : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <label className="cursor-pointer inline-flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Drag & drop Swagger or Postman JSON file here, or <span className="text-indigo-400 underline">browse files</span></span>
                <input
                  type="file"
                  accept=".json,.yaml,.yml,application/json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </label>
            </div>

            {/* Textarea Code Editor */}
            <div className="p-3">
              <textarea
                value={rawSpec}
                onChange={(e) => onUpdateSpec(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full bg-slate-950 border border-slate-800/90 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-y leading-relaxed"
                placeholder="Paste OpenAPI 3.0 / 3.1, Swagger 2.0, or Postman Collection JSON here..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: AST Diagnostic Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                AST Diagnostic Report
              </h2>
              <div className="flex items-center gap-2">
                {diagnostic.isValid ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Valid Spec
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                    <XCircle className="w-4 h-4" />
                    Invalid Syntax
                  </span>
                )}
              </div>
            </div>

            {/* Meta summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Format Detected</div>
                <div className="font-semibold text-slate-200 mt-1 uppercase">
                  {diagnostic.specType.replace('_', ' ')}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="text-slate-400 text-[11px]">API Version</div>
                <div className="font-semibold font-mono text-slate-200 mt-1">
                  v{diagnostic.version}
                </div>
              </div>
            </div>

            {/* Metrics Counter Strip */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="card-3d p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-lg font-bold font-mono text-indigo-400 tabular-nums">
                  {diagnostic.stats.endpointCount}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Endpoints</div>
              </div>
              <div className="card-3d p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {diagnostic.stats.schemaCount}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Schemas</div>
              </div>
              <div className="card-3d p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                  {diagnostic.stats.tagCount}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Tags</div>
              </div>
              <div className="card-3d p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-lg font-bold font-mono text-sky-400 tabular-nums">
                  {diagnostic.stats.paramCount}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Params</div>
              </div>
            </div>

            {/* Authentication Schemes */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Detected Security & Auth
              </div>
              {diagnostic.authSchemes.length > 0 ? (
                <div className="space-y-1.5">
                  {diagnostic.authSchemes.map((auth, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-200 capitalize">{auth.type} Auth</span>
                      <span className="text-[11px] text-slate-500 font-mono">{auth.name || 'Authorization'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-3d p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-500">
                  No explicit securitySchemes declared. SDK will permit unauthenticated requests.
                </div>
              )}
            </div>

            {/* Warnings or Errors */}
            {diagnostic.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-rose-200">
                  <XCircle className="w-3.5 h-3.5" />
                  Errors to Fix:
                </div>
                {diagnostic.errors.map((err, i) => (
                  <div key={i} className="text-[11px] pl-5">{err}</div>
                ))}
              </div>
            )}

            {diagnostic.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Optimization Notices ({diagnostic.warnings.length}):
                </div>
                {diagnostic.warnings.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-[11px] pl-5 truncate">{w}</div>
                ))}
              </div>
            )}

            {/* Base URL */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400">Target Gateway URL: </span>
              <span className="font-mono text-indigo-300 break-all">{diagnostic.baseUrl || 'https://api.example.com'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapped Endpoints Matrix */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Parsed Endpoints Matrix ({filteredEndpoints.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These REST routes will compile into strongly-typed SDK methods.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter endpoints..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Tag Filter Segment */}
            {diagnostic.tags.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs overflow-x-auto">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                    selectedTag === 'all'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Tags
                </button>
                {diagnostic.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                      selectedTag === tag
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold w-24">Method</th>
                <th className="py-3 px-4 font-semibold">Endpoint Path</th>
                <th className="py-3 px-4 font-semibold">Generated Method Name</th>
                <th className="py-3 px-4 font-semibold">Parameters</th>
                <th className="py-3 px-4 font-semibold">Response Type</th>
                <th className="py-3 px-4 font-semibold">Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredEndpoints.length > 0 ? (
                filteredEndpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${methodColors[ep.method] || 'text-slate-400'}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {ep.path}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-indigo-400">
                      {ep.functionName}()
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400">
                      {ep.parameters.length > 0 ? (
                        <span>
                          {ep.parameters.length} param{ep.parameters.length > 1 ? 's' : ''} ({ep.parameters.map(p => p.name).join(', ')})
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">
                      {ep.responseType}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400">
                      {ep.tag}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No matching endpoints found for current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
