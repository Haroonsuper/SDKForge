import { SpecValidationDiagnostic, NormalizedParam } from '../../types/spec';
import { safeHeaderName, safeVarName } from '../sanitize';
import { toCamelCase, toSnakeCase } from '../parser';

/** Header used for API-key auth (taken from the spec, already sanitized). */
export function apiKeyHeaderName(spec: SpecValidationDiagnostic): string {
  const scheme = spec.authSchemes.find(a => a.type === 'apiKey' && a.in !== 'query');
  return safeHeaderName(scheme?.name, 'X-API-KEY');
}

const RESERVED_ARGS = new Set(['payload', 'query', 'ctx', 'self', 'resolvedPath', 'path', 'params', 'relPath']);

/** camelCase identifier for a function argument (TS / Go). */
export function camelArg(p: NormalizedParam): string {
  let n = safeVarName(toCamelCase(p.name), 'param');
  if (RESERVED_ARGS.has(n)) n = `${n}Param`;
  return n;
}

/** snake_case identifier for a function argument (Python). */
export function snakeArg(p: NormalizedParam): string {
  let n = safeVarName(toSnakeCase(p.name), 'param');
  if (RESERVED_ARGS.has(n)) n = `${n}_param`;
  return n;
}

/** Quote an object-key only when it is not a plain identifier. */
export function tsKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

import { safeTypeName } from '../sanitize';
import { toPascalCase } from '../parser';

/** Valid, non-colliding client class name derived from the API title. */
export function clientClassNameFor(spec: SpecValidationDiagnostic): string {
  return safeTypeName(toPascalCase(spec.title.replace(/[^a-zA-Z0-9]/g, '')), 'Api') + 'Client';
}
