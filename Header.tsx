import React, { useState } from 'react';
import { useSaaS } from '../store/saasContext';
import { ChevronDown, Plus, Sparkles, Building2, FolderGit2, Check } from 'lucide-react';

interface HeaderProps {
  currentTab: 'ingestion' | 'studio' | 'playground' | 'builds' | 'blueprint';
  onSelectTab: (tab: 'ingestion' | 'studio' | 'playground' | 'builds' | 'blueprint') => void;
  onTriggerBuildModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onTriggerBuildModal
}) => {
  const { organizations, activeOrg, setActiveOrg, projects, activeProject, setActiveProject } = useSaaS();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const orgProjects = projects.filter(p => p.orgId === activeOrg.id);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95 sticky top-0 z-40 backdrop-blur">
      {/* Zone 1 - 2 - 3 Top Bar Contract */}
      <div className="flex items-center justify-between gap-8 px-6 py-3.5 max-w-7xl mx-auto">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onSelectTab('ingestion'); }}
            className="text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span className="logo-cube mr-1" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
            SDKForge
          </a>
        </div>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => onSelectTab('ingestion')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
              currentTab === 'ingestion'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Spec Ingestion
          </button>
          <button
            onClick={() => onSelectTab('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
              currentTab === 'studio'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Code Studio
          </button>
          <button
            onClick={() => onSelectTab('playground')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
              currentTab === 'playground'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            API Playground
          </button>
          <button
            onClick={() => onSelectTab('builds')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
              currentTab === 'builds'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Builds & Delivery
          </button>
          <button
            onClick={() => onSelectTab('blueprint')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 ${
              currentTab === 'blueprint'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Architecture
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onTriggerBuildModal}
            className="btn-3d px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate SDK
          </button>
        </div>
      </div>

      {/* Contextual Multi-Tenant Workspace Strip */}
      <div className="border-t border-slate-900 bg-slate-900/60 px-6 py-2 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Organization Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setOrgDropdownOpen(!orgDropdownOpen); setProjectDropdownOpen(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-200 transition-colors border border-slate-700/60"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium text-slate-100">{activeOrg.name}</span>
                <span className="text-slate-500 text-[11px] ml-1">({activeOrg.planTier})</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
              </button>

              {orgDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg bg-slate-900 border border-slate-800 shadow-xl z-50 py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Switch Organization
                  </div>
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setActiveOrg(org);
                        setOrgDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                    >
                      <div>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-[11px] text-slate-500">{org.planTier} · {org.usedQuotaThisMonth}/{org.monthlyQuota} builds</div>
                      </div>
                      {org.id === activeOrg.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-slate-600">/</span>

            {/* Project Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setProjectDropdownOpen(!projectDropdownOpen); setOrgDropdownOpen(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-200 transition-colors border border-slate-700/60"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium text-slate-100">{activeProject.name}</span>
                <span className="text-slate-500 text-[11px] ml-1">v{activeProject.currentSpecVersion}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
              </button>

              {projectDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 rounded-lg bg-slate-900 border border-slate-800 shadow-xl z-50 py-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Select Project
                  </div>
                  {orgProjects.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setActiveProject(proj);
                        setProjectDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-slate-200 truncate">{proj.name}</div>
                        <div className="text-[11px] text-slate-500">{proj.endpointCount} endpoints · v{proj.currentSpecVersion}</div>
                      </div>
                      {proj.id === activeProject.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex items-center gap-1.5">
              <span>Monthly Quota:</span>
              <span className="font-mono text-slate-200 tabular-nums font-medium">
                {activeOrg.usedQuotaThisMonth} / {activeOrg.monthlyQuota}
              </span>
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <span>Engine:</span>
              <span className="text-slate-200 font-medium">Deterministic AST Parser</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
