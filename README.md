# CROWDWISE — Predictive Crowd Digital Twin & Counterfactual Safety Lab

**CROWDWISE** is a pre-event crowd-management planning and simulation platform. It allows event organizers, venue operators, and safety planners to configure a 2D digital twin venue, generate simulated crowd inflows, stress-test difficult operational scenarios (e.g., ticket scanner outages, sudden arrival surges, gate closures), observe how crowd conditions evolve in real time, compare management interventions using counterfactual analysis, and generate actionable planning reports.

---

## 🎯 Key Objectives & Differentiator

Organizers use CROWDWISE to answer critical pre-event safety questions:
1. **Arrival Dynamics:** At what times might arrival rates exceed nominal entrance throughput?
2. **Bottlenecks & Queues:** Where will perimeter queues spill back onto vehicular carriage-ways?
3. **Hardware & Gate Failures:** What happens when scanners fail or an entrance becomes unavailable?
4. **Internal Surges:** What happens when internal spectators rush towards a stage or viewing area simultaneously?
5. **Counterfactual Interventions:** Which management response (admission metering, auxiliary holding areas, transit staggering, route diversions) best reduces risk?
6. **Downstream Consequences:** *Does a proposed intervention inadvertently transfer the congestion somewhere else?*

> **Safety Notice:** CROWDWISE provides simulation-based estimates and planning decision support. It does not replace certified crowd safety assessments, professional crowd managers, police, or emergency services.

---

## 🏗️ Technology Stack

- **Frontend Framework:** React 18 + TypeScript + Vite
- **Styling & Design System:** Tailwind CSS (Dark Command Centre Palette: Deep Navy `#0B1020`, Cyan, Violet, Emerald, Amber, Rose)
- **State Management:** Zustand
- **Icons & Visuals:** Lucide React
- **Data Visualization & Charts:** Recharts
- **Simulation Engine:** Decoupled TypeScript engine with fixed time-step sub-stepping (20Hz), A* navigation graph, Weidmann velocity-density relations, and spatial hash grid collision avoidance
- **Rendering:** HTML5 Canvas 2D with layer toggles, zoom/pan transform, density heatmaps, flow arrows, and top-down pedestrian figures with walking stride kinematics
- **Testing:** Vitest

---

## 🏟️ Venue Profiles & Demonstrations

### 1. M. Chinnaswamy Stadium (Hypothetical Crowd Surge Scenario)
- **Profile Context:** Illustrative pre-event planning twin based on public context (ICC lists seating capacity as 40,000; public reporting concerning the June 4, 2025 RCB celebration tragedy referenced ~35,000 planning capacity and 21 stadium gates).
- **Perimeter Access:** 21 individually configurable perimeter gates (Gates 1 to 21).
- **Arterial Approaches:** Cubbon Road (North), Queen's Road (West), MG Road (South), and Kasturba Road (East).
- **Internal Concourses & Tiers:** North/South/East/West concourses, seating tiers, playing field, victory presentation stage, auxiliary holding staging zones, and medical posts.

### 2. Parkland Open Festival Grounds
- Non-ticketed public festival with central lawn, food promenades, family shelters, and perimeter transit portals.

### 3. Civic Boulevard Procession & Parade Corridor
- Linear urban thoroughfare with bridge bottlenecks, intersection choke-points, and emergency egress corridors.

---

## 🧪 Scenarios Tested in Scenario Lab

1. **Unexpected Arrival Surge:** Sharp inflow spikes exceeding nominal turnstile throughput.
2. **Scanner Hardware Failure (Gate 2 & 7):** 75% of optical scanners offline; queue wait times spike.
3. **Complete Gate Closure (Gate 1):** Entrance obstruction requiring route-aware crowd diversion.
4. **Perimeter Saturation (All Gates Congested):** Systemic perimeter overload testing admission pause and holding zone corral activation.
5. **Center Stage / Presentation Surge:** Spectator rush towards infield rails.
6. **Concourse Bottleneck:** Narrow radial corridor choking under bidirectional flow.
7. **Blocked Emergency Corridor:** Loss of primary ambulance route from Cubbon Road to pitch.
8. **Medical Emergency:** Acute casualty in dense concourse with responder pathfinding from first-aid base.
9. **External Crowd Overflow:** Un-ticketed external gatherings exceeding approach plaza capacities.
10. **Event-Ending Departure Surge:** Egress egress demand towards transit lines.

---

## ⚡ Quick Start & Installation

### Prerequisites
- Node.js (v18+ or v20+ or v22+)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone https://github.com/TheEchoguy/CrowdWise.git
cd CrowdWise

# Switch to development branch
git checkout crowdwise-development

# Install dependencies
npm install

# Run the interactive development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Production Build

```bash
# Run unit tests
npm test

# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## 📄 License
This project is developed for pre-event crowd safety research and planning simulations.
