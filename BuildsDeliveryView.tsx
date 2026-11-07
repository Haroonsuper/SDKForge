import React, { useState } from 'react';
import { useSaaS } from '../store/saasContext';
import { SaaSSDKBuild } from '../types/saas';
import {
  History,
  GitBranch,
  Cloud,
  CheckCircle2,
  Download,
  Terminal,
  FileCheck,
  Workflow,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export const BuildsDeliveryView: React.FC = () => {
  const { builds, activeProject, activeOrg } = useSaaS();
  const [selectedBuild, setSelectedBuild] = useState<SaaSSDKBuild | null>(builds[0] || null);
  const [activeTab, setActiveTab] = useState<'builds' | 'cicd'>('builds');
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const projectBuilds = builds.filter(b => b.projectId === activeProject.id);

  const webhookUrl = `https://api.sdkforge.dev/v1/webhooks/${activeOrg.id}/${activeProject.id}/sync`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Builds, Artifact Registry & Delivery
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tenant build history, AWS S3 artifact archives, and GitHub Actions CI/CD workflows for automated distribution.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('builds')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'builds'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Build History
            </button>
            <button
              onClick={() => setActiveTab('cicd')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'cicd'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CI/CD Automation
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'builds' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Builds Table (7 cols) */}
          <div className="lg:col-span-7 border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden">
            <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Recorded SDK Builds ({projectBuilds.length})</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Project: {activeProject.name}
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 font-sans text-xs">
              {projectBuilds.length > 0 ? (
                projectBuilds.map((b) => {
                  const isSelected = selectedBuild?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBuild(b)}
                      className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-950/30 border-l-2 border-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 capitalize">
                            {b.language} SDK
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            v{b.version}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                          <span>{b.s3Url.split('/').pop()}</span>
                          <span>·</span>
                          <span className="tabular-nums">{b.zipSizeKb} KB</span>
                          <span>·</span>
                          <span className="tabular-nums">{b.durationMs}ms</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] font-mono text-slate-400">
                          {b.commitHash}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No builds recorded yet for this project. Use &quot;Generate SDK&quot; or Code Studio to build your first bundle.
                </div>
              )}
            </div>
          </div>

          {/* Build Details & Logs (5 cols) */}
          <div className="lg:col-span-5 border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2.5">
              Artifact Inspection & Cloud Storage
            </h2>

            {selectedBuild ? (
              <div className="space-y-4 text-xs">
                {/* S3 URI */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-indigo-400" />
                    AWS S3 Multi-Tenant Object URL
                  </div>
                  <div className="font-mono text-indigo-300 break-all text-[11px]">
                    {selectedBuild.s3Url}
                  </div>
                </div>

                {/* Build Stats */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-sm font-bold font-mono text-slate-200 tabular-nums">
                      {selectedBuild.durationMs} ms
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Compile Latency</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-sm font-bold font-mono text-slate-200 tabular-nums">
                      {selectedBuild.generatedFilesCount} Files
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Packaged Artifacts</div>
                  </div>
                </div>

                {/* Build Execution Logs */}
                <div>
                  <div className="text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    AST Engine Execution Logs
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                    {selectedBuild.logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-indigo-500 select-none">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                Select a build from the list to view artifact details.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CI/CD Automation Tab */
        <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Workflow className="w-5 h-5 text-indigo-400" />
              Automated Publishing with GitHub Actions & Webhooks
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Connect your repository or Postman Workspace. Whenever your API specification updates or a Git tag is pushed, 
              SDKForge deterministically regenerates all target SDKs and automatically publishes them to npm, PyPI, and Go proxies.
            </p>
          </div>

          {/* Webhook Endpoint */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Inbound Spec Synchronization Webhook
              </span>
              <button
                onClick={handleCopyWebhook}
                className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
              >
                {copiedWebhook ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedWebhook ? 'Copied' : 'Copy Webhook'}
              </button>
            </div>
            <div className="font-mono text-xs text-indigo-400 bg-slate-900/80 p-2.5 rounded border border-slate-800">
              {webhookUrl}
            </div>
            <p className="text-[11px] text-slate-500">
              Configure this webhook URL in your Postman collection integrations or GitHub repository settings to trigger instant automated SDK builds.
            </p>
          </div>

          {/* Workflow Example */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Embedded GitHub Actions CI/CD Workflow (<code className="text-indigo-400">.github/workflows/sdk-publish.yml</code>)
            </span>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
              <pre>{`name: Continuous SDK Distribution
on:
  push:
    tags: ['v*']
  repository_dispatch:
    types: [spec_updated]

jobs:
  distribute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate OpenAPI AST
        run: npx @sdkforge/cli validate ./openapi.json
      - name: Build TypeScript Client
        run: npm run build
      - name: Publish to npm Registry
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
      - name: Publish to Python PyPI
        run: python -m build && twine upload dist/*
        env:
          TWINE_PASSWORD: \${{ secrets.PYPI_TOKEN }}`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
