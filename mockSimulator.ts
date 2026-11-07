import { NormalizedEndpoint, NormalizedSchema } from '../types/spec';

/**
 * Generates realistic mock responses according to endpoint specifications
 */
export function simulateEndpointCall(
  endpoint: NormalizedEndpoint,
  schemas: NormalizedSchema[],
  pathParams: Record<string, string>,
  queryParams: Record<string, string>,
  requestBody?: string
): {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  data: any;
} {
  const durationMs = Math.floor(45 + Math.random() * 85);

  // If path is delete
  if (endpoint.method === 'DELETE') {
    return {
      status: 200,
      statusText: 'OK',
      durationMs,
      headers: {
        'content-type': 'application/json',
        'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`,
        'x-ratelimit-remaining': '994'
      },
      data: {
        success: true,
        message: `Resource at ${endpoint.path} successfully removed.`,
        deletedAt: new Date().toISOString()
      }
    };
  }

  // If schema matched
  const targetSchema = schemas.find(s => s.name === endpoint.responseType || s.name === endpoint.requestBodySchema);

  if (targetSchema) {
    const mockObj: Record<string, any> = {};
    for (const p of targetSchema.properties) {
      if (p.name === 'id') {
        mockObj[p.name] = pathParams[p.name] || `${p.name}_${Math.random().toString(36).substring(2, 8)}`;
      } else if (p.type === 'string') {
        if (p.enum && p.enum.length > 0) {
          mockObj[p.name] = p.enum[0];
        } else if (p.name.toLowerCase().includes('email')) {
          mockObj[p.name] = 'alex.developer@example.com';
        } else if (p.name.toLowerCase().includes('date') || p.name.toLowerCase().includes('at')) {
          mockObj[p.name] = new Date().toISOString();
        } else {
          mockObj[p.name] = `sample_${p.name}`;
        }
      } else if (p.type === 'number' || p.type === 'integer') {
        mockObj[p.name] = p.name.includes('Cents') ? 12500 : 42;
      } else if (p.type === 'boolean') {
        mockObj[p.name] = true;
      } else if (p.type.endsWith('[]')) {
        mockObj[p.name] = ['item_1', 'item_2'];
      } else {
        mockObj[p.name] = null;
      }
    }

    if (endpoint.responseType.endsWith('[]')) {
      return {
        status: endpoint.responseStatus || 200,
        statusText: 'OK',
        durationMs,
        headers: {
          'content-type': 'application/json',
          'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`
        },
        data: [
          mockObj,
          { ...mockObj, id: 'cus_sample_02' }
        ]
      };
    }

    return {
      status: endpoint.responseStatus || 200,
      statusText: endpoint.responseStatus === 201 ? 'Created' : 'OK',
      durationMs,
      headers: {
        'content-type': 'application/json',
        'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`
      },
      data: mockObj
    };
  }

  // Generic fallback response
  return {
    status: endpoint.responseStatus || 200,
    statusText: 'OK',
    durationMs,
    headers: {
      'content-type': 'application/json',
      'x-request-id': `req_${Math.random().toString(36).substring(2, 9)}`
    },
    data: {
      status: 'success',
      endpoint: `${endpoint.method} ${endpoint.path}`,
      function: endpoint.functionName,
      timestamp: new Date().toISOString(),
      receivedParams: {
        path: pathParams,
        query: queryParams
      },
      parsedPayload: requestBody ? (() => { try { return JSON.parse(requestBody); } catch { return requestBody; } })() : null
    }
  };
}
