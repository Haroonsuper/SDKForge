import React, { useState, useEffect } from 'react';
import { NormalizedEndpoint, SpecValidationDiagnostic } from '../types/spec';
import { simulateEndpointCall } from '../engine/mockSimulator';
import { toSnakeCase, toPascalCase } from '../engine/parser';
import {
  Play,
  Send,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Clock,
  CheckCircle2,
  Sliders,
  ShieldAlert
} from 'lucide-react';

interface PlaygroundViewProps {
  diagnostic: SpecValidationDiagnostic;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({ diagnostic }) => {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(
    diagnostic.endpoints[0]?.id || ''
  );

  const [languageSnippet, setLanguageSnippet] = useState<'typescript' | 'python' | 'go'>('typescript');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bearerToken, setBearerToken] = useState<string>('sec_live_98ab42cde8');
  const [requestBody, setRequestBody] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  const [responseResult, setResponseResult] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    headers: Record<string, string>;
    data: any;
  } | null>(null);

  const selectedEndpoint: NormalizedEndpoint | undefined =
    diagnostic.endpoints.find(e => e.id === selectedEndpointId) || diagnostic.endpoints[0];

  // Whenever endpoint changes, re-initialize parameters and mock body
  useEffect(() => {
    if (!selectedEndpoint) return;

    const initialPathParams: Record<string, string> = {};
    const initialQueryParams: Record<string, string> = {};

    selectedEndpoint.parameters.forEach(p => {
      if (p.in === 'path') {
        initialPathParams[p.name] = p.example || `${p.name}_101`;
      } else if (p.in === 'query') {
        initialQueryParams[p.name] = p.example || (p.type === 'number' ? '20' : 'active');
      }
    });

    setPathParams(initialPathParams);
    setQueryParams(initialQueryParams);

    // Initial mock payload if schema exists
    if (selectedEndpoint.requestBodySchema) {
      const schema = diagnostic.schemas.find(s => s.name === selectedEndpoint.requestBodySchema);
      if (schema) {
        const sample: Record<string, any> = {};
        schema.properties.forEach(prop => {
          if (prop.name === 'id') sample[prop.name] = 'cus_test_992';
          else if (prop.type === 'number') sample[prop.name] = 10000;
          else if (prop.type === 'boolean') sample[prop.name] = true;
          else sample[prop.name] = `sample_${prop.name}`;
        });
        setRequestBody(JSON.stringify(sample, null, 2));
      } else {
        setRequestBody('{}');
      }
    } else if (selectedEndpoint.requestBodyProperties) {
      const sample: Record<string, any> = {};
      selectedEndpoint.requestBodyProperties.forEach(p => {
        sample[p.name] = p.type === 'number' ? 50 : `sample_${p.name}`;
      });
      setRequestBody(JSON.stringify(sample, null, 2));
    } else {
      setRequestBody('');
    }

    setResponseResult(null);
  }, [selectedEndpointId, selectedEndpoint, diagnostic.schemas]);

  const handleExecute = () => {
    if (!selectedEndpoint) return;
    setIsExecuting(true);

    setTimeout(() => {
      const result = simulateEndpointCall(
        selectedEndpoint,
        diagnostic.schemas,
        pathParams,
        queryParams,
        requestBody
      );
      setResponseResult(result);
      setIsExecuting(false);
    }, 200);
  };

  // Generate code snippet for calling this method
  const generateSnippet = () => {
    if (!selectedEndpoint) return '';
    const fn = selectedEndpoint.functionName;
    const pathArgs = selectedEndpoint.parameters
      .filter(p => p.in === 'path')
      .map(p => `"${pathParams[p.name] || p.name}"`);

    if (languageSnippet === 'typescript') {
      const argsList = [...pathArgs];
      if (selectedEndpoint.requestBodySchema || selectedEndpoint.requestBodyProperties) {
        argsList.push(`/* payload */ ${requestBody ? requestBody.replace(/\n/g, ' ') : '{}'}`);
      }
      if (selectedEndpoint.parameters.some(p => p.in === 'query')) {
        argsList.push(`/* query */ ${JSON.stringify(queryParams)}`);
      }
      return `import { APIClient } from './src';

const client = new APIClient({
  baseUrl: "${diagnostic.baseUrl || 'https://api.example.com'}",
  bearerToken: "${bearerToken}"
});

const response = await client.${fn}(${argsList.join(', ')});
console.log("Success:", response);`;
    }

    if (languageSnippet === 'python') {
      const pyFn = toSnakeCase(fn);
      const argsList = [...pathArgs];
      if (selectedEndpoint.requestBodySchema || selectedEndpoint.requestBodyProperties) {
        argsList.push(`payload=${requestBody ? requestBody.replace(/\n/g, ' ') : '{}'}`);
      }
      return `from api_client_sdk import APIClient

client = APIClient(
    base_url="${diagnostic.baseUrl || 'https://api.example.com'}",
    bearer_token="${bearerToken}"
)

response = client.${pyFn}(${argsList.join(', ')})
print("Result:", response)`;
    }

    // Go snippet
    const goFn = toPascalCase(fn);
    return `package main

import (
    "context"
    "fmt"
    sdk "github.com/company/apisdk"
)

func main() {
    client := sdk.NewClient(
        sdk.WithBaseURL("${diagnostic.baseUrl || 'https://api.example.com'}"),
        sdk.WithBearerToken("${bearerToken}"),
    )

    resp, err := client.${goFn}(context.Background(), ${pathArgs.join(', ')})
    if err != nil {
        panic(err)
    }
    fmt.Printf("Response: %+v\\n", resp)
}`;
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(generateSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleCopyResponse = () => {
    if (!responseResult) return;
    navigator.clipboard.writeText(JSON.stringify(responseResult.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Playground Header */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Interactive SDK Playground & Test Runner
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate API calls with real headers and parameters. Inspect exact SDK method invocations in TypeScript, Python, and Go.
            </p>
          </div>

          <button
            onClick={handleExecute}
            disabled={isExecuting || !selectedEndpoint}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isExecuting ? 'Sending Request...' : 'Execute Method Call'}
          </button>
        </div>

        {/* Endpoint Selector Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-400">Target Endpoint:</label>
          <select
            value={selectedEndpointId}
            onChange={(e) => setSelectedEndpointId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {diagnostic.endpoints.map(ep => (
              <option key={ep.id} value={ep.id}>
                [{ep.method}] {ep.path} → {ep.functionName}()
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Parameters & Snippet (Left, 6 cols) vs Response Output (Right, 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Parameters & Code Invocation Snippet (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Parameters Form */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Request Parameters
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {selectedEndpoint?.method} {selectedEndpoint?.path}
              </span>
            </div>

            {/* Auth Bearer Token */}
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Authorization Bearer Token</label>
              <input
                type="text"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Bearer token or API key..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Path Parameters */}
            {selectedEndpoint && selectedEndpoint.parameters.filter(p => p.in === 'path').length > 0 && (
              <div className="space-y-2">
                <label className="text-slate-400 text-[11px] font-medium block">Path Variables</label>
                {selectedEndpoint.parameters
                  .filter(p => p.in === 'path')
                  .map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="w-28 text-xs font-mono text-indigo-400 truncate">
                        {`{${p.name}}`}:
                      </span>
                      <input
                        type="text"
                        value={pathParams[p.name] || ''}
                        onChange={(e) => setPathParams({ ...pathParams, [p.name]: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Query Parameters */}
            {selectedEndpoint && selectedEndpoint.parameters.filter(p => p.in === 'query').length > 0 && (
              <div className="space-y-2">
                <label className="text-slate-400 text-[11px] font-medium block">Query Parameters</label>
                {selectedEndpoint.parameters
                  .filter(p => p.in === 'query')
                  .map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="w-28 text-xs font-mono text-slate-300 truncate">
                        {p.name}:
                      </span>
                      <input
                        type="text"
                        value={queryParams[p.name] || ''}
                        onChange={(e) => setQueryParams({ ...queryParams, [p.name]: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Request Body JSON */}
            {(selectedEndpoint?.requestBodySchema || selectedEndpoint?.requestBodyProperties) && (
              <div>
                <label className="text-slate-400 text-[11px] font-medium block mb-1">
                  Request Payload JSON ({selectedEndpoint.requestBodySchema || 'Object'})
                </label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Generated Code Snippet */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-300">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>Generated SDK Code Snippet</span>
              </div>

              {/* Language Switch */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded">
                <button
                  onClick={() => setLanguageSnippet('typescript')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    languageSnippet === 'typescript' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  TS
                </button>
                <button
                  onClick={() => setLanguageSnippet('python')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    languageSnippet === 'python' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => setLanguageSnippet('go')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                    languageSnippet === 'go' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Go
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto relative group">
              <button
                onClick={handleCopySnippet}
                className="absolute right-3 top-3 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-opacity opacity-80 group-hover:opacity-100"
              >
                {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedSnippet ? 'Copied' : 'Copy'}
              </button>
              <pre className="text-slate-300 leading-relaxed">{generateSnippet()}</pre>
            </div>
          </div>
        </div>

        {/* Right: Response Output & Simulation Result (6 cols) */}
        <div className="lg:col-span-6 border border-slate-800 rounded-xl bg-slate-900/80 flex flex-col overflow-hidden min-h-[500px]">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulated Response Output</span>
            </div>

            {responseResult && (
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {responseResult.status} {responseResult.statusText}
                </span>
                <span className="text-slate-500 font-mono flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  {responseResult.durationMs}ms
                </span>
                <button
                  onClick={handleCopyResponse}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
                >
                  {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedResponse ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 bg-slate-950 overflow-auto font-mono text-xs">
            {responseResult ? (
              <div className="space-y-4">
                {/* Headers */}
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">Response Headers</div>
                  {Object.entries(responseResult.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-indigo-400">{k}:</span>
                      <span className="text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div>
                  <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1.5">Payload Body</div>
                  <pre className="text-emerald-300 whitespace-pre leading-relaxed overflow-x-auto">
                    {JSON.stringify(responseResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 font-sans">
                <Play className="w-8 h-8 text-slate-700 mb-3" />
                <div className="font-medium text-slate-400">No request sent yet</div>
                <div className="text-xs text-slate-600 mt-1 max-w-xs">
                  Click &quot;Execute Method Call&quot; above to simulate an HTTP invocation with the generated SDK client logic.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
