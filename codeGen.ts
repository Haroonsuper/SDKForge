import { SDKFile, SDKGenOptions, SpecValidationDiagnostic } from '../types/spec';
import { generateTypeScriptSDK } from './generators/typescript';
import { generatePythonSDK } from './generators/python';
import { generateGoSDK } from './generators/go';
import { generateCicdWorkflow } from './generators/cicd';
import { safePackageName, safeVersion, safeAuthor } from './sanitize';

export function generateSDKBundle(
  spec: SpecValidationDiagnostic,
  rawOpts: SDKGenOptions
): SDKFile[] {
  let files: SDKFile[] = [];
  // Sanitize user-supplied form values before they reach any template
  const opts: SDKGenOptions = {
    ...rawOpts,
    packageName: safePackageName(rawOpts.packageName),
    version: safeVersion(rawOpts.version),
    author: safeAuthor(rawOpts.author)
  };

  switch (opts.language) {
    case 'typescript':
      files = generateTypeScriptSDK(spec, opts);
      break;
    case 'python':
      files = generatePythonSDK(spec, opts);
      break;
    case 'go':
      files = generateGoSDK(spec, opts);
      break;
    default:
      files = generateTypeScriptSDK(spec, opts);
  }

  if (opts.includeGithubAction) {
    files.push(generateCicdWorkflow(spec, opts));
  }

  return files;
}
