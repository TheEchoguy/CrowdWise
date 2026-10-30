import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Header } from './components/layout/Header';
import { LeftControls } from './components/layout/LeftControls';
import { RightTelemetry } from './components/layout/RightTelemetry';
import { SimulationCanvas } from './components/canvas/SimulationCanvas';
import { DecisionModal } from './components/layout/DecisionModal';
import { BenchmarkModal } from './components/layout/BenchmarkModal';
import { useSimulationStore } from './state/useSimulationStore';
import { KSCA_STADIUM_SECTORS } from './engine/ChinnaswamyData';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full p-4 rounded-xl border border-rose-800 bg-rose-950/40 text-rose-200 flex flex-col items-center justify-center gap-3">
          <div className="text-sm font-bold text-rose-300">
            {this.props.fallbackTitle || 'Component Error'}
          </div>
          <p className="text-xs font-mono text-rose-400/80 max-w-sm text-center">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold text-xs"
          >
            Retry Component
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const currentView = useSimulationStore((s) => s.currentView);
  const selectedSector = (useSimulationStore((s) => s.selectedRoadSector) ||
    useSimulationStore((s) => s.selectedSector) ||
    'LINK_ROAD') as keyof typeof KSCA_STADIUM_SECTORS;
  const isBenchmarkOpen = useSimulationStore((s) => s.isBenchmarkOpen);
  const toggleBenchmark = useSimulationStore((s) => s.toggleBenchmark);

  const activeSectorData = KSCA_STADIUM_SECTORS[selectedSector] || KSCA_STADIUM_SECTORS.LINK_ROAD;

  const currentTitle =
    currentView === 'MACRO_STADIUM'
      ? 'M. Chinnaswamy Stadium — 35,000 Capacity Satellite Digital Twin'
      : `M. Chinnaswamy Stadium — ${activeSectorData.name}`;

  const currentSubtitle =
    currentView === 'MACRO_STADIUM'
      ? '23 Perimeter Gates, Central Cricket Pitch, 4 Arterial Roads & Grandstand Seating Blocks'
      : `${activeSectorData.roadLabel} ── Outer Frisking (E) & Inner Turnstile Banks (G)`;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080c14] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Header with System Badges and Export Brief Trigger */}
      <Header />

      {/* 2. 3-Column Tactical Workspace Layout */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 p-3.5 overflow-hidden">
        {/* Left Column: Simulation Control Station (3 Cols) */}
        <section className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <ErrorBoundary fallbackTitle="Controls Station Error">
            <LeftControls />
          </ErrorBoundary>
        </section>

        {/* Center Column: Interactive Simulation Canvas (6 Cols) */}
        <section className="lg:col-span-6 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Scenario Info Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            <div>
              <h2 className="text-xs font-bold text-slate-200 tracking-wide">
                {currentTitle}
              </h2>
              <p className="text-[10px] text-slate-400">
                {currentSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                SCALE: 20px = 1m
              </span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="flex-1 min-h-0 relative">
            <ErrorBoundary fallbackTitle="Simulation Canvas Error">
              <SimulationCanvas />
            </ErrorBoundary>
          </div>
        </section>

        {/* Right Column: Real-Time Telemetry & Safety Brief (3 Cols) */}
        <section className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col">
          <ErrorBoundary fallbackTitle="Telemetry Station Error">
            <RightTelemetry />
          </ErrorBoundary>
        </section>
      </main>

      {/* 3. Event Safety Decision Modal & Performance Benchmark Modal */}
      <DecisionModal />
      <BenchmarkModal isOpen={isBenchmarkOpen} onClose={toggleBenchmark} />
    </div>
  );
};

export default App;
