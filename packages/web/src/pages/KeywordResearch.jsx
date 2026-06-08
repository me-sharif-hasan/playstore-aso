import React from 'react';
import { useTrackedApps } from '../hooks/useApp.js';
import KeywordResearchPanel from '../components/KeywordResearchPanel.jsx';

export default function KeywordResearch() {
  const { apps } = useTrackedApps();
  const primaryApp = apps[0]?.appId;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
      <p className="text-sm text-gray-500">
        Search keywords → Track to monitor rank daily, Save to bookmark for reference.
      </p>
      <KeywordResearchPanel appId={primaryApp} apps={apps} />
    </div>
  );
}
