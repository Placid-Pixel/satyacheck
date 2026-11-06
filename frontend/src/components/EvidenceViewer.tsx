import React from 'react';
import { DocumentRecord, Finding, Application } from '../types';
import { RegulatoryWorkbench } from './RegulatoryWorkbench';

interface EvidenceViewerProps {
  document: DocumentRecord;
  application: Application;
  activeFinding?: Finding | null;
  onSelectFinding?: (f: Finding) => void;
  onBack?: () => void;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  document,
  application,
  activeFinding,
  onSelectFinding,
  onBack
}) => {
  return (
    <RegulatoryWorkbench
      document={document}
      application={application}
      activeFinding={activeFinding}
      onSelectFinding={onSelectFinding}
      onBack={onBack}
    />
  );
};

export default EvidenceViewer;
