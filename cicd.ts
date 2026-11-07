import { SDKFile, SDKGenOptions, SpecValidationDiagnostic } from '../../types/spec';

export function generateCicdWorkflow(
  spec: SpecValidationDiagnostic,
  opts: SDKGenOptions
): SDKFile {
  let content = '';

  if (opts.language === 'typescript') {
    content = `name: Publish TypeScript SDK to npm

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build Type Definitions & Distribution
        run: npm run build

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
  } else if (opts.language === 'python') {
    content = `name: Build and Publish Python SDK to PyPI

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  publish-pypi:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Build Tooling
        run: |
          python -m pip install --upgrade pip
          pip install build pytest

      - name: Run Pytest Suite
        run: pytest tests/

      - name: Build Wheel & Tarball
        run: python -m build

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: \${{ secrets.PYPI_API_TOKEN }}
`;
  } else {
    content = `name: Tag and Release Go SDK

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  verify-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Go 1.22
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Download Modules
        run: go mod download

      - name: Run Go Tests & Vet
        run: |
          go vet ./...
          go test -v -race ./...

      - name: Publish Go Proxy Verification
        run: |
          GOPROXY=https://proxy.golang.org go list -m github.com/${opts.author || 'apidev'}/${opts.packageName || 'apisdk'}@\${{ github.ref_name }} || true
`;
  }

  return {
    name: 'sdk-publish.yml',
    path: '.github/workflows/sdk-publish.yml',
    content,
    language: 'yaml',
    sizeBytes: new TextEncoder().encode(content).length
  };
}
