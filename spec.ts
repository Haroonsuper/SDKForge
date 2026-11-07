export interface NormalizedParam {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
  example?: any;
}

export interface NormalizedField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  itemsType?: string;
}

export interface NormalizedSchema {
  name: string;
  description?: string;
  properties: NormalizedField[];
}

export interface NormalizedEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  functionName: string;
  summary: string;
  description?: string;
  tag: string;
  parameters: NormalizedParam[];
  requestBodySchema?: string;
  requestBodyProperties?: NormalizedField[];
  responseType: string;
  responseStatus: number;
}

export interface SpecValidationDiagnostic {
  isValid: boolean;
  specType: 'openapi_v3' | 'swagger_v2' | 'postman_v2' | 'unknown';
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  authSchemes: {
    type: 'bearer' | 'apiKey' | 'basic' | 'oauth2' | 'none';
    name?: string;
    in?: 'header' | 'query';
    description?: string;
  }[];
  endpoints: NormalizedEndpoint[];
  schemas: NormalizedSchema[];
  tags: string[];
  warnings: string[];
  errors: string[];
  stats: {
    endpointCount: number;
    schemaCount: number;
    tagCount: number;
    paramCount: number;
  };
}

export interface SDKFile {
  name: string;
  path: string;
  content: string;
  language: 'typescript' | 'python' | 'go' | 'json' | 'yaml' | 'markdown' | 'text';
  sizeBytes: number;
}

export interface SDKGenOptions {
  language: 'typescript' | 'python' | 'go';
  packageName: string;
  version: string;
  author: string;
  httpClient: 'fetch' | 'axios' | 'requests' | 'httpx' | 'net_http';
  includeTests: boolean;
  includeReadme: boolean;
  includeGithubAction: boolean;
  asyncMode: boolean;
}
