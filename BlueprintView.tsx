import React, { useState } from 'react';
import {
  Database,
  Calendar,
  DollarSign,
  Cpu,
  Layers,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Server
} from 'lucide-react';

const SQL_BLUEPRINT = `-- ==========================================================
-- SDKFORGE MULTI-TENANT DATABASE BLUEPRINT (PostgreSQL / Supabase)
-- High-Margin B2B SaaS Architecture
-- ==========================================================

-- 1. Users Table (Core authentication & role-based access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'developer', -- 'owner', 'admin', 'developer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Organizations / Teams Table (Multi-Tenant Core Isolation)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    stripe_subscription_id TEXT, -- Tracks Stripe MRR billing tier
    plan_tier TEXT DEFAULT 'Growth (Stripe Pro)',
    monthly_quota INTEGER DEFAULT 500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Projects Table (Each project models an isolated API specification)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    current_spec_version TEXT DEFAULT '1.0.0',
    spec_type TEXT NOT NULL, -- 'openapi_v3', 'swagger_v2', 'postman_v2'
    spec_raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Generated SDK Builds Table (Historical artifact tracking & S3 delivery)
CREATE TABLE sdk_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    language TEXT NOT NULL, -- 'typescript', 'python', 'go'
    version TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'building', 'completed', 'failed'
    s3_url TEXT, -- Permanent archive object URL in AWS S3
    zip_size_kb NUMERIC(8, 2),
    generated_files_count INTEGER,
    commit_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-Tenant Security: Row Level Security (RLS) Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdk_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_projects ON projects
    FOR ALL
    USING (org_id IN (
        SELECT id FROM organizations WHERE owner_id = auth.uid()
    ));
`;

export const BlueprintView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sql' | 'roadmap' | 'valuation'>('sql');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_BLUEPRINT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Blueprint Header */}
      <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Architecture Blueprint & Enterprise Valuation Engine
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tenant database schema, 4-week execution roadmap, and zero-hallucination compiler economics.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'sql'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SQL Blueprint
            </button>
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'roadmap'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              4-Week Roadmap
            </button>
            <button
              onClick={() => setActiveTab('valuation')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'valuation'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acquire.com Valuation
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'sql' && (
        <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Multi-Tenant Schema (PostgreSQL / Supabase with Row Level Security)</span>
            </div>
            <button
              onClick={handleCopySql}
              className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL' : 'Copy DDL Script'}</span>
            </button>
          </div>

          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
            <pre>{SQL_BLUEPRINT}</pre>
          </div>
        </div>
      )}

      {activeTab === 'roadmap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Week 1 */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Hafta 1</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Phase 1: Ingestion & Validation</h3>
            <p className="text-xs text-slate-400">
              POST /api/v1/projects/:id/generate endpoint with JSON schema validator to verify real OpenAPI/Swagger specifications.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-800">
              <div>✓ Postman v2.1 & OpenAPI 3.x ingestion</div>
              <div>✓ Path parameter extraction</div>
              <div>✓ Auth scheme classification</div>
            </div>
          </div>

          {/* Week 2 */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Hafta 2</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Phase 2A: AST Core Engine</h3>
            <p className="text-xs text-slate-400">
              Core algorithm scanning path objects, HTTP verbs, body models, and mapping clean function signatures.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-800">
              <div>✓ Normalized Endpoint AST</div>
              <div>✓ Schemas & models mapper</div>
              <div>✓ Method name generator</div>
            </div>
          </div>

          {/* Week 3 */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Hafta 3</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Phase 2B: Code Translation</h3>
            <p className="text-xs text-slate-400">
              Deterministic code generation into TypeScript (classes & types), Python (dataclasses & requests), and Go (structs).
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-800">
              <div>✓ TypeScript + Fetch/Axios</div>
              <div>✓ Python + Dataclasses</div>
              <div>✓ Go + net/http client</div>
            </div>
          </div>

          {/* Week 4 */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Hafta 4</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Phase 3: Automated ZIP Delivery</h3>
            <p className="text-xs text-slate-400">
              Auto-generate README.md with copy-paste installation instructions, zip bundle packaging, and cloud distribution.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-800">
              <div>✓ In-browser JSZip bundler</div>
              <div>✓ Auto-generated README & tests</div>
              <div>✓ GitHub Actions auto-publish</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Value Pillar 1 */}
            <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                1. Zero AI Dependence (Shartia 100% Accuracy)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kyunki yeh platform pure coding logic aur AST compiler design par chal raha hai (LLM generation par nahi), 
                is liye code generation mein <strong>zero hallucination</strong> aur guaranteed syntax compilation hoti hai. 
                Enterprises aur security-conscious buyers is predictability ke deewane hote hain.
              </p>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-400">
                Key metric for buyers: 100% deterministic builds with zero token drift or unexpected code mutations.
              </div>
            </div>

            {/* Value Pillar 2 */}
            <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                2. Server Ka Kharcha Zero (95%+ Profit Margin)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Isko chalane ke liye kisi mehngay GPU cluster ya continuous LLM token fee ki zaroorat nahi hai. 
                AST parsing aur code generation client-side ya normal lightweight CPU server par fractions of a second mein ho jati hai.
              </p>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-emerald-400 font-mono">
                Gross Margins: 95%+ · Cost per build: &lt; $0.0001
              </div>
            </div>
          </div>

          {/* Acquire.com M&A Multiples Card */}
          <div className="panel-3d border border-slate-800 rounded-xl bg-slate-900/80 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Acquire.com SaaS Valuation Multiple Framework
              </h3>
              <span className="text-xs font-mono text-slate-400">Target MRR: $10,000 - $50,000/mo</span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">B2B Developer SaaS Multiple</div>
                <div className="text-xl font-bold font-mono text-white">4.5x - 6.5x ARR</div>
                <p className="text-[11px] text-slate-500 mt-1">Based on pure deterministic infrastructure with high retention.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">Gross Margin Profile</div>
                <div className="text-xl font-bold font-mono text-emerald-400">&gt; 95% Margin</div>
                <p className="text-[11px] text-slate-500 mt-1">No AI inference tokens, zero cloud GPU overhead.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">Expansion Velocity</div>
                <div className="text-xl font-bold font-mono text-indigo-400">Multi-Tenant Core</div>
                <p className="text-[11px] text-slate-500 mt-1">One customer adds unlimited APIs & team members under Stripe subscription.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
