import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from './store/simulationStore';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandCentre } from './components/dashboard/CommandCentre';
import { DigitalTwinView } from './components/map/DigitalTwinView';
import { CrowdInflowView } from './components/inflow/CrowdInflowView';
import { ScenarioLabView } from './components/scenarios/ScenarioLabView';
import { GateOperationsView } from './components/gates/GateOperationsView';
import { GateDetailView } from './components/gates/GateDetailView';
import { IncidentResponseView } from './components/incidents/IncidentResponseView';
import { ReportsHistoryView } from './components/reports/ReportsHistoryView';
import { SettingsView } from './components/settings/SettingsView';
import { GateClosureRecoveryView } from './components/modules/GateClosureRecoveryView';
import { CrowdModelValidationView } from './components/modules/CrowdModelValidationView';
import { MultiDirectionalFlowView } from './components/modules/MultiDirectionalFlowView';
import { SpatialRiskAnalysisView } from './components/modules/SpatialRiskAnalysisView';

export const App: React.FC = () => {
  const { activeTab, engine, isRunning, isPaused, syncFromEngine } = useSimulationStore();
  const lastTimeRef = useRef<number>(performance.now());
  const syncCounterRef = useRef<number>(0);

  // Master Simulation Engine Loop
  useEffect(() => {
    let animId: number;

    const loop = (currentTime: number) => {
      const realDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Bound delta to avoid sudden spikes when tab is backgrounded
      const clampedDt = Math.min(0.1, Math.max(0.001, realDt));

      if (isRunning && !isPaused) {
        engine.update(clampedDt);

        // Throttle UI synchronization to ~10Hz (every 6 animation frames) for optimal React performance
        syncCounterRef.current++;
        if (syncCounterRef.current % 6 === 0) {
          syncFromEngine();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [engine, isRunning, isPaused, syncFromEngine]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-900 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Collapsible Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Control Bar & Header */}
        <Header />

        {/* Dynamic View Router */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'command-centre' && <CommandCentre />}
          {activeTab === 'digital-twin' && <DigitalTwinView />}
          {activeTab === 'gate-detail' && <GateDetailView />}
          {activeTab === 'crowd-inflow' && <CrowdInflowView />}
          {activeTab === 'scenario-lab' && <ScenarioLabView />}
          {activeTab === 'gate-operations' && <GateOperationsView />}
          {activeTab === 'incident-response' && <IncidentResponseView />}
          {activeTab === 'gate-closure' && <GateClosureRecoveryView />}
          {activeTab === 'model-validation' && <CrowdModelValidationView />}
          {activeTab === 'multi-directional' && <MultiDirectionalFlowView />}
          {activeTab === 'spatial-risk' && <SpatialRiskAnalysisView />}
          {activeTab === 'reports-history' && <ReportsHistoryView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default App;
