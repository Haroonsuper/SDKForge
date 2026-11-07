import {
  NormalizedEndpoint,
  NormalizedField,
  NormalizedParam,
  NormalizedSchema,
  SpecValidationDiagnostic
} from '../types/spec';
import { parse as parseYaml } from 'yaml';
import {
  MAX_SPEC_BYTES, MAX_ENDPOINTS, MAX_SCHEMAS, MAX_DEPTH, DEFAULT_BASE_URL,
  safeText, safeIdent, safeVarName, safeTypeName, safePathParamName, safeWireName,
  safeBaseUrl, safePath, safeHeaderName, isSafeEnumValue, derefNode
} from './sanitize';

/**
 * Sanitizes identifier names into camelCase or PascalCase
 */
export function toCamelCase(str: string): string {
  if (!str) return 'endpoint';
  return str
    .replace(/[^a-zA-Z0-9_-]/g, ' ')
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toSnakeCase(str: string): string {
  if (!str) return 'endpoint';
  return str
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Resolves $ref path like "#/components/schemas/Pet"
 */
function resolveSchemaName(ref: string): string {
  if (!ref) return 'unknown';
  let name = String(ref).replace(/^#\/(?:components\/schemas|definitions)\//, '');
  try { name = decodeURIComponent(name); } catch { /* keep raw */ }
  name = name.replace(/~1/g, '/').replace(/~0/g, '~');
  return safeTypeName(name);
}

/**
 * Map primitive OpenAPI/Swagger types to clean language-neutral types
 */
function normalizeType(prop: any, depth = 0): string {
  if (!prop || typeof prop !== 'object' || depth > MAX_DEPTH) return 'any';
  if (prop.$ref) return resolveSchemaName(prop.$ref);
  if (prop.type === 'integer' || prop.type === 'number') return 'number';
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'string') {
    if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0 && prop.enum.length <= 50 && prop.enum.every(isSafeEnumValue)) {
      return prop.enum.map((e: string) => JSON.stringify(e)).join(' | ');
    }
    return 'string';
  }
  if (prop.type === 'array') {
    const itemType = prop.items ? normalizeType(prop.items, depth + 1) : 'any';
    return itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`;
  }
  if (prop.type === 'object') return 'Record<string, any>';
  return 'any';
}

/**
 * Parses an OpenAPI 3.x document
 */
function parseOpenApiV3(doc: any): SpecValidationDiagnostic {
  const warnings: string[] = [];
  const errors: string[] = [];

  const title = doc.info?.title || 'API Client';
  const version = doc.info?.version || '1.0.0';
  const description = doc.info?.description || 'Auto-generated API SDK client.';
  
  // Base URL
  let baseUrl = 'https://api.example.com';
  if (doc.servers && Array.isArray(doc.servers) && doc.servers.length > 0) {
    baseUrl = doc.servers[0].url || baseUrl;
  }

  // Auth Schemes
  const authSchemes: SpecValidationDiagnostic['authSchemes'] = [];
  const securitySchemes = doc.components?.securitySchemes || {};
  for (const [key, scheme] of Object.entries<any>(securitySchemes)) {
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      authSchemes.push({
        type: 'bearer',
        name: key,
        description: scheme.description || 'Bearer JWT Token'
      });
    } else if (scheme.type === 'apiKey') {
      authSchemes.push({
        type: 'apiKey',
        name: scheme.name || key,
        in: scheme.in === 'query' ? 'query' : 'header',
        description: scheme.description || `API Key in ${scheme.in || 'header'}`
      });
    } else if (scheme.type === 'basic' || (scheme.type === 'http' && scheme.scheme === 'basic')) {
      authSchemes.push({
        type: 'basic',
        name: key,
        description: scheme.description || 'HTTP Basic Auth'
      });
    } else if (scheme.type === 'oauth2') {
      authSchemes.push({
        type: 'oauth2',
        name: key,
        description: scheme.description || 'OAuth2 authentication'
      });
    }
  }

  // Schemas / Components
  const schemas: NormalizedSchema[] = [];
  const rawSchemas = doc.components?.schemas || {};
  for (const [name, rawSchema] of Object.entries<any>(rawSchemas)) {
    const properties: NormalizedField[] = [];
    const requiredList = rawSchema.required || [];

    if (rawSchema.properties) {
      for (const [propName, propVal] of Object.entries<any>(rawSchema.properties)) {
        properties.push({
          name: propName,
          type: normalizeType(propVal),
          required: requiredList.includes(propName),
          description: propVal.description,
          enum: propVal.enum,
          itemsType: propVal.items ? normalizeType(propVal.items) : undefined
        });
      }
    }

    schemas.push({
      name,
      description: rawSchema.description,
      properties
    });
  }

  // Endpoints
  const endpoints: NormalizedEndpoint[] = [];
  const tagsSet = new Set<string>();
  const paths = doc.paths || {};

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    const supportedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of supportedMethods) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;

      const tag = (op.tags && op.tags.length > 0) ? String(op.tags[0]) : 'General';
      tagsSet.add(tag);

      // Generate function name if operationId missing
      let functionName = op.operationId;
      if (!functionName) {
        warnings.push(`Endpoint [${method.toUpperCase()} ${pathKey}] is missing operationId. Auto-generated name.`);
        const pathSegments = pathKey.replace(/\{([^}]+)\}/g, 'By_$1').split('/').filter(Boolean);
        const namePart = pathSegments.map(toPascalCase).join('');
        functionName = `${method}${namePart}`;
      } else {
        functionName = toCamelCase(functionName);
      }

      // Parameters
      const parameters: NormalizedParam[] = [];
      const combinedParams = [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []), ...(Array.isArray(op.parameters) ? op.parameters : [])];
      for (const rawP of combinedParams) {
        const p = derefNode(doc, rawP);
        if (!p || typeof p.name !== 'string' || !['path', 'query', 'header', 'cookie'].includes(p.in)) continue;
        parameters.push({
          name: p.name,
          in: p.in,
          required: Boolean(p.required || p.in === 'path'),
          type: normalizeType(p.schema || p),
          description: p.description,
          example: p.example || p.schema?.example
        });
      }

      // Request Body
      let requestBodySchema: string | undefined;
      const requestBodyProps: NormalizedField[] = [];
      const reqBody = derefNode(doc, op.requestBody);
      if (reqBody) {
        const jsonContent = reqBody.content?.['application/json'];
        if (jsonContent?.schema) {
          if (jsonContent.schema.$ref) {
            requestBodySchema = resolveSchemaName(jsonContent.schema.$ref);
          } else if (jsonContent.schema.properties) {
            const reqList = jsonContent.schema.required || [];
            for (const [k, v] of Object.entries<any>(jsonContent.schema.properties)) {
              requestBodyProps.push({
                name: k,
                type: normalizeType(v),
                required: reqList.includes(k),
                description: v.description
              });
            }
          }
        }
      }

      // Response
      let responseType = 'void';
      let responseStatus = 200;
      if (op.responses) {
        const successCode = Object.keys(op.responses).find(k => k.startsWith('2')) || '200';
        responseStatus = parseInt(successCode, 10) || 200;
        const successResp = derefNode(doc, op.responses[successCode]);
        const respJson = successResp?.content?.['application/json'];
        if (respJson?.schema) {
          responseType = normalizeType(respJson.schema);
        }
      }

      endpoints.push({
        id: `${method.toUpperCase()}_${pathKey}`,
        method: method.toUpperCase() as any,
        path: pathKey,
        functionName,
        summary: op.summary || `${method.toUpperCase()} ${pathKey}`,
        description: op.description,
        tag,
        parameters,
        requestBodySchema,
        requestBodyProperties: requestBodyProps.length > 0 ? requestBodyProps : undefined,
        responseType,
        responseStatus
      });
    }
  }

  if (endpoints.length === 0) {
    warnings.push('No valid HTTP path endpoints detected in this specification.');
  }

  let totalParams = 0;
  for (const ep of endpoints) {
    totalParams += ep.parameters.length;
  }

  return {
    isValid: errors.length === 0,
    specType: 'openapi_v3',
    title,
    version,
    description,
    baseUrl,
    authSchemes,
    endpoints,
    schemas,
    tags: Array.from(tagsSet),
    warnings,
    errors,
    stats: {
      endpointCount: endpoints.length,
      schemaCount: schemas.length,
      tagCount: tagsSet.size,
      paramCount: totalParams
    }
  };
}

/**
 * Parses Swagger 2.0
 */
function parseSwaggerV2(doc: any): SpecValidationDiagnostic {
  const warnings: string[] = [];
  const errors: string[] = [];

  const title = doc.info?.title || 'Swagger API';
  const version = doc.info?.version || '1.0.0';
  const description = doc.info?.description || 'Auto-generated API SDK client.';

  const host = doc.host || 'api.example.com';
  const basePath = doc.basePath || '';
  const scheme = (doc.schemes && doc.schemes[0]) || 'https';
  const baseUrl = `${scheme}://${host}${basePath}`;

  // Security Definitions
  const authSchemes: SpecValidationDiagnostic['authSchemes'] = [];
  const secDefs = doc.securityDefinitions || {};
  for (const [key, schemeObj] of Object.entries<any>(secDefs)) {
    if (schemeObj.type === 'apiKey') {
      authSchemes.push({
        type: 'apiKey',
        name: schemeObj.name || key,
        in: schemeObj.in === 'query' ? 'query' : 'header',
        description: schemeObj.description || `API Key in ${schemeObj.in}`
      });
    } else if (schemeObj.type === 'basic') {
      authSchemes.push({
        type: 'basic',
        name: key,
        description: 'Basic HTTP Auth'
      });
    } else if (schemeObj.type === 'oauth2') {
      authSchemes.push({
        type: 'oauth2',
        name: key,
        description: 'OAuth2 Authentication'
      });
    }
  }

  // Definitions (schemas)
  const schemas: NormalizedSchema[] = [];
  const rawDefs = doc.definitions || {};
  for (const [name, rawSchema] of Object.entries<any>(rawDefs)) {
    const properties: NormalizedField[] = [];
    const requiredList = rawSchema.required || [];

    if (rawSchema.properties) {
      for (const [propName, propVal] of Object.entries<any>(rawSchema.properties)) {
        properties.push({
          name: propName,
          type: normalizeType(propVal),
          required: requiredList.includes(propName),
          description: propVal.description
        });
      }
    }

    schemas.push({
      name,
      description: rawSchema.description,
      properties
    });
  }

  // Paths
  const endpoints: NormalizedEndpoint[] = [];
  const tagsSet = new Set<string>();
  const paths = doc.paths || {};

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    const supportedMethods = ['get', 'post', 'put', 'delete', 'patch'] as const;

    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of supportedMethods) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;

      const tag = (op.tags && op.tags.length > 0) ? String(op.tags[0]) : 'General';
      tagsSet.add(tag);

      let functionName = op.operationId;
      if (!functionName) {
        warnings.push(`Endpoint [${method.toUpperCase()} ${pathKey}] is missing operationId.`);
        const segments = pathKey.replace(/\{([^}]+)\}/g, 'By_$1').split('/').filter(Boolean);
        functionName = `${method}${segments.map(toPascalCase).join('')}`;
      } else {
        functionName = toCamelCase(functionName);
      }

      const parameters: NormalizedParam[] = [];
      let requestBodySchema: string | undefined;

      const swaggerParams = [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []), ...(Array.isArray(op.parameters) ? op.parameters : [])];
      for (const rawP of swaggerParams) {
        const p = derefNode(doc, rawP);
        if (!p || typeof p.in !== 'string') continue;
        if (p.in === 'body') {
          if (p.schema?.$ref) {
            requestBodySchema = resolveSchemaName(p.schema.$ref);
          }
        } else if (typeof p.name === 'string' && ['path', 'query', 'header'].includes(p.in)) {
          parameters.push({
            name: p.name,
            in: p.in,
            required: Boolean(p.required || p.in === 'path'),
            type: normalizeType(p),
            description: p.description
          });
        }
      }

      let responseType = 'void';
      let responseStatus = 200;
      if (op.responses) {
        const successCode = Object.keys(op.responses).find(k => k.startsWith('2')) || '200';
        responseStatus = parseInt(successCode, 10) || 200;
        const successResp = derefNode(doc, op.responses[successCode]);
        if (successResp?.schema) {
          responseType = normalizeType(successResp.schema);
        }
      }

      endpoints.push({
        id: `${method.toUpperCase()}_${pathKey}`,
        method: method.toUpperCase() as any,
        path: pathKey,
        functionName,
        summary: op.summary || `${method.toUpperCase()} ${pathKey}`,
        description: op.description,
        tag,
        parameters,
        requestBodySchema,
        responseType,
        responseStatus
      });
    }
  }

  let totalParams = 0;
  for (const ep of endpoints) {
    totalParams += ep.parameters.length;
  }

  return {
    isValid: errors.length === 0,
    specType: 'swagger_v2',
    title,
    version,
    description,
    baseUrl,
    authSchemes,
    endpoints,
    schemas,
    tags: Array.from(tagsSet),
    warnings,
    errors,
    stats: {
      endpointCount: endpoints.length,
      schemaCount: schemas.length,
      tagCount: tagsSet.size,
      paramCount: totalParams
    }
  };
}

/**
 * Parses Postman Collection v2 / v2.1
 */
function parsePostmanCollection(doc: any): SpecValidationDiagnostic {
  const warnings: string[] = [];
  const errors: string[] = [];

  const title = doc.info?.name || 'Postman Collection';
  const version = '1.0.0';
  const description = doc.info?.description || 'Imported Postman collection API.';

  const endpoints: NormalizedEndpoint[] = [];
  const tagsSet = new Set<string>();
  const authSchemes: SpecValidationDiagnostic['authSchemes'] = [];
  let detectedBaseUrl = DEFAULT_BASE_URL;

  function traverseItems(items: any[], currentTag: string, depth = 0) {
    if (depth > MAX_DEPTH) return;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (item.item && Array.isArray(item.item)) {
        // Folder / Tag group
        const groupTag = item.name || currentTag;
        traverseItems(item.item, groupTag, depth + 1);
      } else if (item.request) {
        // Request item
        const req = item.request;
        const tag = currentTag || 'General';
        tagsSet.add(tag);

        const method = (req.method || 'GET').toUpperCase() as any;
        let path = '/';
        let fullUrl = '';

        if (typeof req.url === 'string') {
          fullUrl = req.url;
          try {
            const u = new URL(req.url);
            path = u.pathname;
            detectedBaseUrl = `${u.protocol}//${u.host}`;
          } catch {
            path = req.url.startsWith('/') ? req.url : `/${req.url}`;
          }
          path = path.split('?')[0];
        } else if (req.url && typeof req.url === 'object') {
          fullUrl = req.url.raw || '';
          if (Array.isArray(req.url.path)) {
            path = '/' + req.url.path.join('/');
          }
          if (Array.isArray(req.url.host) && req.url.protocol) {
            detectedBaseUrl = `${req.url.protocol}://${req.url.host.join('.')}`;
          }
          // Postman variables like {{baseUrl}} are not real URLs; sanitizer falls back to a safe default
        }

        // Detect parameters
        const parameters: NormalizedParam[] = [];
        if (req.url?.query && Array.isArray(req.url.query)) {
          for (const q of req.url.query) {
            if (q.key) {
              parameters.push({
                name: q.key,
                in: 'query',
                required: false,
                type: 'string',
                description: q.description || undefined,
                example: q.value
              });
            }
          }
        }

        // Path parameters (e.g. /:id or /{{id}} or /{id}) - only whole path segments count
        const cleanedPath = path
          .split('/')
          .map(seg => {
            const m = seg.match(/^(?::([A-Za-z0-9_]+)|\{\{([A-Za-z0-9_]+)\}\}|\{([A-Za-z0-9_]+)\})$/);
            if (!m) return seg;
            const paramName = m[1] || m[2] || m[3];
            if (!parameters.some(p => p.name === paramName && p.in === 'path')) {
              parameters.push({ name: paramName, in: 'path', required: true, type: 'string' });
            }
            return `{${paramName}}`;
          })
          .join('/');

        // Auth detection
        if (req.auth) {
          if (req.auth.type === 'bearer' && !authSchemes.some(a => a.type === 'bearer')) {
            authSchemes.push({
              type: 'bearer',
              name: 'Authorization',
              description: 'Bearer Token'
            });
          } else if (req.auth.type === 'apikey' && !authSchemes.some(a => a.type === 'apiKey')) {
            authSchemes.push({
              type: 'apiKey',
              name: 'apiKey',
              in: 'header'
            });
          }
        }

        // Request Body
        const requestBodyProps: NormalizedField[] = [];
        if (req.body?.mode === 'raw' && req.body.raw) {
          try {
            const parsedBody = JSON.parse(req.body.raw);
            if (typeof parsedBody === 'object' && parsedBody !== null) {
              for (const [k, v] of Object.entries(parsedBody)) {
                requestBodyProps.push({
                  name: k,
                  type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
                  required: true,
                  description: `Example: ${JSON.stringify(v)}`
                });
              }
            }
          } catch {
            // raw text body
          }
        }

        // Clean function name
        const itemName = item.name || `${method} ${cleanedPath}`;
        const functionName = toCamelCase(String(itemName));

        endpoints.push({
          id: `${method}_${cleanedPath}_${endpoints.length}`,
          method,
          path: cleanedPath,
          functionName,
          summary: item.name || `${method} ${cleanedPath}`,
          description: req.description || item.description,
          tag,
          parameters,
          requestBodyProperties: requestBodyProps.length > 0 ? requestBodyProps : undefined,
          responseType: 'Record<string, any>',
          responseStatus: 200
        });
      }
    }
  }

  if (doc.item && Array.isArray(doc.item)) {
    traverseItems(doc.item, 'Core');
  }

  let totalParams = 0;
  for (const ep of endpoints) {
    totalParams += ep.parameters.length;
  }

  return {
    isValid: errors.length === 0,
    specType: 'postman_v2',
    title,
    version,
    description,
    baseUrl: detectedBaseUrl,
    authSchemes,
    endpoints,
    schemas: [],
    tags: Array.from(tagsSet),
    warnings,
    errors,
    stats: {
      endpointCount: endpoints.length,
      schemaCount: 0,
      tagCount: tagsSet.size,
      paramCount: totalParams
    }
  };
}

/**
 * Main AST Spec Parser & Ingestion Entry Point
 */
function parseRaw(rawContent: string): SpecValidationDiagnostic {
  if (!rawContent || !rawContent.trim()) {
    return {
      isValid: false,
      specType: 'unknown',
      title: 'Empty Specification',
      version: '0.0.0',
      description: 'No content provided.',
      baseUrl: '',
      authSchemes: [],
      endpoints: [],
      schemas: [],
      tags: [],
      warnings: [],
      errors: ['Specification text is empty. Upload or paste a valid OpenAPI, Swagger, or Postman JSON.'],
      stats: { endpointCount: 0, schemaCount: 0, tagCount: 0, paramCount: 0 }
    };
  }

  let parsed: any;
  try {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      parsed = JSON.parse(trimmed);
    } else {
      // YAML specs. maxAliasCount blocks "billion laughs" alias-expansion attacks.
      parsed = parseYaml(trimmed, { maxAliasCount: 50, prettyErrors: false, strict: true });
    }
  } catch (err: any) {
    return {
      isValid: false,
      specType: 'unknown',
      title: 'Invalid JSON',
      version: '0.0.0',
      description: 'Syntax error in JSON/YAML document.',
      baseUrl: '',
      authSchemes: [],
      endpoints: [],
      schemas: [],
      tags: [],
      warnings: [],
      errors: [`Parse Error (JSON/YAML): ${err.message || 'Malformed syntax'}`],
      stats: { endpointCount: 0, schemaCount: 0, tagCount: 0, paramCount: 0 }
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalidDiagnostic('Unsupported format. The JSON root must be an object (OpenAPI, Swagger or Postman).');
  }

  // Detect format
  if (parsed.openapi && typeof parsed.openapi === 'string') {
    return parseOpenApiV3(parsed);
  }
  if (parsed.swagger && typeof parsed.swagger === 'string') {
    return parseSwaggerV2(parsed);
  }
  if (parsed.info && ((typeof parsed.info.schema === 'string' && parsed.info.schema.includes('postman')) || parsed.item)) {
    return parsePostmanCollection(parsed);
  }

  // Fallback attempt: if has paths, assume openapi
  if (parsed.paths && typeof parsed.paths === 'object') {
    return parseOpenApiV3(parsed);
  }

  return {
    isValid: false,
    specType: 'unknown',
    title: parsed.info?.title || 'Unrecognized Schema',
    version: parsed.info?.version || '1.0.0',
    description: 'Could not detect standard OpenAPI (openapi: 3.x), Swagger (swagger: 2.0), or Postman Collection.',
    baseUrl: '',
    authSchemes: [],
    endpoints: [],
    schemas: [],
    tags: [],
    warnings: [],
    errors: ['Unsupported format. Expected OpenAPI 3.0/3.1, Swagger 2.0, or Postman Collection v2.1.'],
    stats: { endpointCount: 0, schemaCount: 0, tagCount: 0, paramCount: 0 }
  };
}


function invalidDiagnostic(message: string): SpecValidationDiagnostic {
  return {
    isValid: false,
    specType: 'unknown',
    title: 'Invalid Specification',
    version: '0.0.0',
    description: message,
    baseUrl: '',
    authSchemes: [],
    endpoints: [],
    schemas: [],
    tags: [],
    warnings: [],
    errors: [message],
    stats: { endpointCount: 0, schemaCount: 0, tagCount: 0, paramCount: 0 }
  };
}

const SAFE_TYPE_RE = /^[A-Za-z0-9_<>\[\], |"\-.:/]{1,500}$/;
function sanitizeType(t: unknown): string {
  const s = String(t ?? 'any');
  return SAFE_TYPE_RE.test(s) ? s : 'any';
}

/**
 * Final security pass: after this, every string in the diagnostic is safe to embed in
 * generated TypeScript, Python, Go, YAML, TOML, JSON and Markdown.
 */
function sanitizeDiagnostic(d: SpecValidationDiagnostic): SpecValidationDiagnostic {
  d.title = safeText(d.title, 100) || 'API';
  d.version = safeText(d.version, 30) || '1.0.0';
  d.description = safeText(d.description, 300);
  d.baseUrl = d.baseUrl ? safeBaseUrl(d.baseUrl) : '';

  d.tags = Array.from(new Set((d.tags || []).map(t => safeText(t, 50) || 'General')));

  d.authSchemes = (d.authSchemes || []).map(a => ({
    type: a.type,
    name: a.type === 'apiKey' ? safeHeaderName(a.name, 'X-API-KEY') : safeText(a.name, 60),
    in: a.in === 'query' ? 'query' : (a.in ? 'header' : undefined),
    description: a.description ? safeText(a.description, 120) : undefined
  }));

  // Schemas
  const seenSchemas = new Set<string>();
  const schemas: NormalizedSchema[] = [];
  for (const sc of d.schemas || []) {
    const name = safeTypeName(sc.name);
    if (seenSchemas.has(name)) continue;
    seenSchemas.add(name);
    const seenProps = new Set<string>();
    const properties: NormalizedField[] = [];
    for (const p of sc.properties || []) {
      const pname = safeWireName(p.name);
      if (seenProps.has(pname)) continue;
      seenProps.add(pname);
      properties.push({
        name: pname,
        type: sanitizeType(p.type),
        required: Boolean(p.required),
        description: p.description ? safeText(p.description, 200) : undefined,
        enum: Array.isArray(p.enum) ? p.enum.filter(isSafeEnumValue) : undefined,
        itemsType: p.itemsType ? sanitizeType(p.itemsType) : undefined
      });
    }
    schemas.push({ name, description: sc.description ? safeText(sc.description, 200) : undefined, properties });
    if (schemas.length >= MAX_SCHEMAS) {
      d.warnings.push(`Only the first ${MAX_SCHEMAS} schemas were processed.`);
      break;
    }
  }
  d.schemas = schemas;

  // Endpoints
  if (d.endpoints.length > MAX_ENDPOINTS) {
    d.warnings.push(`Only the first ${MAX_ENDPOINTS} endpoints were processed.`);
    d.endpoints = d.endpoints.slice(0, MAX_ENDPOINTS);
  }
  const usedNames = new Set<string>();
  const usedIds = new Set<string>();
  const endpoints: NormalizedEndpoint[] = [];
  for (const ep of d.endpoints) {
    const path = safePath(ep.path);
    const method = (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(ep.method) ? ep.method : 'GET') as NormalizedEndpoint['method'];

    let fn = safeVarName(toCamelCase(String(ep.functionName || '')), 'endpoint');
    fn = fn.charAt(0).toLowerCase() + fn.slice(1);
    let unique = fn;
    for (let i = 2; usedNames.has(unique); i++) unique = `${fn}${i}`;
    if (unique !== fn) d.warnings.push(`Duplicate operation name "${fn}" renamed to "${unique}".`);
    usedNames.add(unique);

    // parameters
    const params: NormalizedParam[] = [];
    const seenParams = new Set<string>();
    for (const p of ep.parameters || []) {
      const isPath = p.in === 'path';
      const name = isPath ? safePathParamName(p.name) : safeWireName(p.name, 'param');
      const key = `${p.in}:${name}`;
      if (seenParams.has(key)) continue;
      seenParams.add(key);
      let ex: any = p.example;
      if (typeof ex === 'string') ex = safeText(ex, 80);
      else if (typeof ex !== 'number' && typeof ex !== 'boolean') ex = undefined;
      params.push({
        name,
        in: p.in,
        required: isPath ? true : Boolean(p.required),
        type: sanitizeType(p.type),
        description: p.description ? safeText(p.description, 160) : undefined,
        example: ex
      });
    }
    // every {placeholder} in the path must have a matching path parameter
    for (const m of path.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
      if (!params.some(p => p.in === 'path' && p.name === m[1])) {
        params.push({ name: m[1], in: 'path', required: true, type: 'string' });
      }
    }
    // path params first so generated signatures are stable
    params.sort((a, b) => Number(b.in === 'path') - Number(a.in === 'path'));

    const bodyProps = ep.requestBodyProperties
      ? ep.requestBodyProperties.map(f => ({
          name: safeWireName(f.name),
          type: sanitizeType(f.type),
          required: Boolean(f.required),
          description: f.description ? safeText(f.description, 160) : undefined
        }))
      : undefined;

    let id = `${method}_${path}`;
    for (let i = 2; usedIds.has(id); i++) id = `${method}_${path}_${i}`;
    usedIds.add(id);

    endpoints.push({
      id,
      method,
      path,
      functionName: unique,
      summary: safeText(ep.summary, 120) || `${method} ${path}`,
      description: ep.description ? safeText(ep.description, 300) : undefined,
      tag: safeText(ep.tag, 50) || 'General',
      parameters: params,
      requestBodySchema: ep.requestBodySchema ? safeTypeName(ep.requestBodySchema) : undefined,
      requestBodyProperties: bodyProps && bodyProps.length > 0 ? bodyProps : undefined,
      responseType: sanitizeType(ep.responseType),
      responseStatus: Number.isInteger(ep.responseStatus) && ep.responseStatus >= 100 && ep.responseStatus < 600 ? ep.responseStatus : 200
    });
  }
  d.endpoints = endpoints;

  d.stats = {
    endpointCount: endpoints.length,
    schemaCount: schemas.length,
    tagCount: d.tags.length,
    paramCount: endpoints.reduce((n, e) => n + e.parameters.length, 0)
  };
  d.warnings = d.warnings.map(w => safeText(w, 200));
  d.errors = d.errors.map(e => safeText(e, 200));
  return d;
}

/**
 * Main AST Spec Parser & Ingestion Entry Point (hardened).
 * Never throws; every string in the result is sanitized.
 */
export function parseAndValidateSpec(rawContent: string): SpecValidationDiagnostic {
  try {
    if (typeof rawContent === 'string' && rawContent.length > MAX_SPEC_BYTES) {
      return invalidDiagnostic(`Specification is too large (limit ${Math.round(MAX_SPEC_BYTES / 1024 / 1024)} MB).`);
    }
    return sanitizeDiagnostic(parseRaw(rawContent));
  } catch (err: any) {
    return invalidDiagnostic(`Could not process this specification: ${safeText(err?.message || 'unexpected structure', 150)}`);
  }
}
