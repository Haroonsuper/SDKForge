import React, { createContext, useContext, useState, useEffect } from 'react';
import { SaaSOrganization, SaaSProject, SaaSSDKBuild, SaaSUser } from '../types/saas';
import { SAMPLE_SPECS } from '../engine/sampleSpecs';

interface SaaSContextType {
  currentUser: SaaSUser;
  organizations: SaaSOrganization[];
  activeOrg: SaaSOrganization;
  setActiveOrg: (org: SaaSOrganization) => void;
  projects: SaaSProject[];
  activeProject: SaaSProject;
  setActiveProject: (proj: SaaSProject) => void;
  builds: SaaSSDKBuild[];
  addBuild: (build: Omit<SaaSSDKBuild, 'id' | 'createdAt'>) => SaaSSDKBuild;
  updateProjectSpec: (projectId: string, rawSpec: string, endpointCount: number, version: string) => void;
  createProject: (name: string, description: string, specContent: string) => SaaSProject;
}

const INITIAL_USER: SaaSUser = {
  id: 'usr_01j9a42f',
  email: 'haroonmashkoor111@gmail.com',
  name: 'Haroon M.',
  role: 'owner',
  createdAt: '2026-01-15T09:00:00Z'
};

const INITIAL_ORGS: SaaSOrganization[] = [
  {
    id: 'org_enterprise_acme',
    name: 'Nexus FinTech Inc.',
    ownerId: 'usr_01j9a42f',
    stripeSubscriptionId: 'sub_1Oq298Fks029',
    planTier: 'Growth (Stripe Pro)',
    monthlyQuota: 500,
    usedQuotaThisMonth: 84,
    createdAt: '2026-01-15T09:12:00Z'
  },
  {
    id: 'org_indie_sandbox',
    name: 'Sandbox Developer Team',
    ownerId: 'usr_01j9a42f',
    stripeSubscriptionId: 'sub_free_tier',
    planTier: 'Starter',
    monthlyQuota: 20,
    usedQuotaThisMonth: 6,
    createdAt: '2026-02-01T14:30:00Z'
  }
];

const INITIAL_PROJECTS: SaaSProject[] = [
  {
    id: 'proj_nexus_pay',
    orgId: 'org_enterprise_acme',
    name: 'NexusPay Financial Gateway',
    description: 'Enterprise payment processing, customer balances, and webhook distribution.',
    currentSpecVersion: '2.4.0',
    specType: 'openapi_v3',
    specRaw: SAMPLE_SPECS[0].content,
    endpointCount: 5,
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-03-01T15:20:00Z'
  },
  {
    id: 'proj_petstore',
    orgId: 'org_enterprise_acme',
    name: 'Petstore Universal REST',
    description: 'Canonical Swagger 3.0 specification covering pets, orders, and store inventories.',
    currentSpecVersion: '1.0.19',
    specType: 'openapi_v3',
    specRaw: SAMPLE_SPECS[1].content,
    endpointCount: 5,
    createdAt: '2026-02-14T11:00:00Z',
    updatedAt: '2026-02-28T09:40:00Z'
  },
  {
    id: 'proj_postman_echo',
    orgId: 'org_indie_sandbox',
    name: 'Postman Echo Utility Service',
    description: 'Postman Collection v2.1 format parsing and multi-language client creation.',
    currentSpecVersion: '1.0.0',
    specType: 'postman_v2',
    specRaw: SAMPLE_SPECS[2].content,
    endpointCount: 3,
    createdAt: '2026-02-18T16:00:00Z',
    updatedAt: '2026-02-26T12:00:00Z'
  }
];

const INITIAL_BUILDS: SaaSSDKBuild[] = [
  {
    id: 'bld_9921',
    projectId: 'proj_nexus_pay',
    language: 'typescript',
    version: '2.4.0',
    status: 'completed',
    s3Url: 's3://sdkforge-artifacts-us-east-1/org_enterprise_acme/nexuspay-ts-2.4.0.zip',
    zipSizeKb: 14.8,
    generatedFilesCount: 7,
    commitHash: 'f48c90b',
    durationMs: 412,
    createdAt: '2026-03-01T15:22:10Z',
    logs: [
      'Validating OpenAPI 3.1.0 specification...',
      'AST Parser: 5 endpoints, 4 component schemas mapped.',
      'Generating TypeScript client classes and typed interfaces...',
      'Compiling package.json, README.md, and Vitest test fixtures...',
      'Packaging ZIP bundle and deploying artifact to S3 bucket [Completed].'
    ]
  },
  {
    id: 'bld_9920',
    projectId: 'proj_nexus_pay',
    language: 'python',
    version: '2.4.0',
    status: 'completed',
    s3Url: 's3://sdkforge-artifacts-us-east-1/org_enterprise_acme/nexuspay-py-2.4.0.zip',
    zipSizeKb: 12.4,
    generatedFilesCount: 6,
    commitHash: 'f48c90b',
    durationMs: 388,
    createdAt: '2026-03-01T15:21:40Z',
    logs: [
      'Validating OpenAPI 3.1.0 specification...',
      'AST Parser: 5 endpoints mapped.',
      'Generating Python dataclass models with PEP 621 pyproject.toml...',
      'Generating client.py with session management and APIError exception...',
      'Deploying bundle to S3 [Completed].'
    ]
  },
  {
    id: 'bld_9918',
    projectId: 'proj_nexus_pay',
    language: 'go',
    version: '2.4.0',
    status: 'completed',
    s3Url: 's3://sdkforge-artifacts-us-east-1/org_enterprise_acme/nexuspay-go-2.4.0.zip',
    zipSizeKb: 16.1,
    generatedFilesCount: 6,
    commitHash: 'e10287a',
    durationMs: 440,
    createdAt: '2026-03-01T14:10:00Z',
    logs: [
      'AST Parser: Mapping structs and endpoints...',
      'Generating Go structs with JSON omitempty tags...',
      'Creating net/http client with context.Context support...',
      'Module github.com/nexuspay/nexuspay-go verified.'
    ]
  }
];

// ---- Safe localStorage helpers: never crash on corrupted / blocked / full storage ----
function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable - app keeps working in memory
  }
}

const SaaSContext = createContext<SaaSContextType | undefined>(undefined);

export const SaaSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<SaaSOrganization[]>(() => {
    return loadStored('sdkforge_orgs', INITIAL_ORGS);
  });

  const [activeOrg, setActiveOrg] = useState<SaaSOrganization>(() => organizations[0] || INITIAL_ORGS[0]);

  const [projects, setProjects] = useState<SaaSProject[]>(() => {
    return loadStored('sdkforge_projects', INITIAL_PROJECTS);
  });

  const [activeProject, setActiveProject] = useState<SaaSProject>(() => {
    const orgProjects = projects.filter(p => p.orgId === activeOrg.id);
    return orgProjects[0] || projects[0] || INITIAL_PROJECTS[0];
  });

  const [builds, setBuilds] = useState<SaaSSDKBuild[]>(() => {
    return loadStored('sdkforge_builds', INITIAL_BUILDS);
  });

  useEffect(() => {
    saveStored('sdkforge_orgs', (organizations));
  }, [organizations]);

  useEffect(() => {
    saveStored('sdkforge_projects', (projects));
  }, [projects]);

  useEffect(() => {
    saveStored('sdkforge_builds', (builds));
  }, [builds]);

  // Keep active project in sync when org switches
  const handleSetActiveOrg = (org: SaaSOrganization) => {
    setActiveOrg(org);
    const orgProjects = projects.filter(p => p.orgId === org.id);
    if (orgProjects.length > 0) {
      setActiveProject(orgProjects[0]);
    }
  };

  const addBuild = (buildData: Omit<SaaSSDKBuild, 'id' | 'createdAt'>): SaaSSDKBuild => {
    const newBuild: SaaSSDKBuild = {
      ...buildData,
      id: `bld_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString()
    };

    setBuilds(prev => [newBuild, ...prev]);

    // Update organization quota count
    setOrganizations(prev =>
      prev.map(o =>
        o.id === activeOrg.id
          ? { ...o, usedQuotaThisMonth: o.usedQuotaThisMonth + 1 }
          : o
      )
    );

    return newBuild;
  };

  const updateProjectSpec = (projectId: string, rawSpec: string, endpointCount: number, version: string) => {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              specRaw: rawSpec,
              endpointCount,
              currentSpecVersion: version || p.currentSpecVersion,
              updatedAt: new Date().toISOString()
            }
          : p
      )
    );
    if (activeProject.id === projectId) {
      setActiveProject(prev => ({
        ...prev,
        specRaw: rawSpec,
        endpointCount,
        currentSpecVersion: version || prev.currentSpecVersion,
        updatedAt: new Date().toISOString()
      }));
    }
  };

  const createProject = (name: string, description: string, specContent: string): SaaSProject => {
    const newProj: SaaSProject = {
      id: `proj_${Math.random().toString(36).substring(2, 8)}`,
      orgId: activeOrg.id,
      name,
      description,
      currentSpecVersion: '1.0.0',
      specType: 'openapi_v3',
      specRaw: specContent,
      endpointCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setProjects(prev => [newProj, ...prev]);
    setActiveProject(newProj);
    return newProj;
  };

  return (
    <SaaSContext.Provider
      value={{
        currentUser: INITIAL_USER,
        organizations,
        activeOrg,
        setActiveOrg: handleSetActiveOrg,
        projects,
        activeProject,
        setActiveProject,
        builds,
        addBuild,
        updateProjectSpec,
        createProject
      }}
    >
      {children}
    </SaaSContext.Provider>
  );
};

export function useSaaS(): SaaSContextType {
  const ctx = useContext(SaaSContext);
  if (!ctx) throw new Error('useSaaS must be used within SaaSProvider');
  return ctx;
}
