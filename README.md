# CROWDWISE — Predictive Crowd Digital Twin & Safety Lab

**CROWDWISE** is a real-time crowd digital twin built under **Theme 03: Simulation, Digital Twins & Synthetic Data** for the AfterHours 1.0 hackathon. It allows venue operators, event organizers, and permit officers to simulate pedestrian fluid dynamics, stress-test high-density choke points, and compare crowd management choices before gates open on event day.

### The Problem
Traditional venue safety plans rely on static 2D floor blueprints, while CCTV and drone heatmaps only alert operators after dangerous crowd densities (>5–6 people/m²) and compressive shockwaves have already developed. By the time a surge is visible on camera, physical intervention is often too late.

### Key Capabilities
* **Microscopic Agent-Based Physics:** Simulates individual pedestrian vectors (target drive, interpersonal repulsion, and boundary collision) to model real-world crowd movement at 60 FPS.
* **Dynamic Density & Shockwave Telemetry:** Real-time color transitions from safe flow (Green) to elevated friction (Amber) to critical crush-risk thresholds (Red).
* **Synthetic Scenario Lab:** Ingests synthetic surge profiles and tests operational failure modes, including sudden influx spikes and barcode scanner/turnstile slowdowns.
* **Side-by-Side Counterfactual Comparison:** Contrasts a failure-prone baseline scenario against an optimized alternative plan (dynamic gate metering, holding buffers, and auxiliary rerouting).
* **Actionable Decision Brief:** Outputs clear, comparative risk indicators—peak density, queue spillback distance, and ingress throughput—to support data-backed permit approvals and safety planning.
