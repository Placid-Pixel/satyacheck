import React from 'react';
import { DocketConsoleView } from './DocketConsoleView';

interface DashboardViewProps {
  onSelectApplication: (appId: number) => void;
  onOpenWorkbench?: (appId: string | number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectApplication,
  onOpenWorkbench
}) => {
  return (
    <DocketConsoleView
      onOpenWorkbench={(appId) => {
        if (onOpenWorkbench) {
          onOpenWorkbench(appId);
        } else if (typeof appId === 'number') {
          onSelectApplication(appId);
        } else {
          const num = parseInt(String(appId).replace(/\D/g, ''), 10) || 105;
          onSelectApplication(num);
        }
      }}
      onSelectApplication={onSelectApplication}
    />
  );
};

export default DashboardView;
