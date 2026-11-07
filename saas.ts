export interface SaaSUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'developer';
  createdAt: string;
}

export interface SaaSOrganization {
  id: string;
  name: string;
  ownerId: string;
  stripeSubscriptionId: string;
  planTier: 'Starter' | 'Growth (Stripe Pro)' | 'Enterprise Scale';
  monthlyQuota: number;
  usedQuotaThisMonth: number;
  createdAt: string;
}

export interface SaaSProject {
  id: string;
  orgId: string;
  name: string;
  description: string;
  currentSpecVersion: string;
  specType: 'openapi_v3' | 'swagger_v2' | 'postman_v2';
  specRaw: string;
  endpointCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaaSSDKBuild {
  id: string;
  projectId: string;
  language: 'typescript' | 'python' | 'go';
  version: string;
  status: 'completed' | 'building' | 'failed';
  s3Url: string;
  zipSizeKb: number;
  generatedFilesCount: number;
  commitHash: string;
  durationMs: number;
  createdAt: string;
  logs: string[];
}
