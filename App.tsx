/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SaaSProvider, useSaaS } from './store/saasContext';
import { Header } from './components/Header';
import { IngestionView } from './components/IngestionView';
import { CodeStudioView } from './components/CodeStudioView';
import { PlaygroundView } from './components/PlaygroundView';
import { BuildsDeliveryView } from './components/BuildsDeliveryView';
import { BlueprintView } from './components/BlueprintView';
import { NewBuildModal } from './components/NewBuildModal';
import { parseAndValidateSpec } from './engine/parser';

function AppContent() {
  const { activeProject, updateProjectSpec } = useSaaS();
  const [currentTab, setCurrentTab] = useState<'ingestion' | 'studio' | 'playground' | 'builds' | 'blueprint'>('ingestion');
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);

  // Compute live AST diagnostic for active project's raw specification
  const diagnostic = useMemo(() => {
    return parseAndValidateSpec(activeProject.specRaw);
  }, [activeProject.specRaw]);

  const handleUpdateSpec = (newRaw: string) => {
    const updatedDiag = parseAndValidateSpec(newRaw);
    updateProjectSpec(
      activeProject.id,
      newRaw,
      updatedDiag.endpoints.length,
      updatedDiag.version
    );
  };

  return (
    <div className="scene-3d min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onTriggerBuildModal={() => setIsBuildModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {currentTab === 'ingestion' && (
          <IngestionView
            rawSpec={activeProject.specRaw}
            onUpdateSpec={handleUpdateSpec}
            diagnostic={diagnostic}
            onProceedToStudio={() => setCurrentTab('studio')}
          />
        )}

        {currentTab === 'studio' && (
          <CodeStudioView
            diagnostic={diagnostic}
            onOpenPlayground={() => setCurrentTab('playground')}
          />
        )}

        {currentTab === 'playground' && (
          <PlaygroundView diagnostic={diagnostic} />
        )}

        {currentTab === 'builds' && (
          <BuildsDeliveryView />
        )}

        {currentTab === 'blueprint' && (
          <BlueprintView />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">SDKForge</span>
            <span>·</span>
            <span>Deterministic AST Code Generation Platform</span>
          </div>
          <div>
            Built with pure TypeScript, Python, and Go compilers · Zero AI token dependence
          </div>
        </div>
      </footer>

      {/* New Build Dialog Modal */}
      <NewBuildModal
        isOpen={isBuildModalOpen}
        onClose={() => setIsBuildModalOpen(false)}
        diagnostic={diagnostic}
        onBuildComplete={() => setCurrentTab('builds')}
      />
    </div>
  );
}

export default function App() {
  return (
    <SaaSProvider>
      <AppContent />
    </SaaSProvider>
  );
}
