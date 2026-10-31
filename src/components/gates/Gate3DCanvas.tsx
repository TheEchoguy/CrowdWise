import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSimulationStore } from '../../store/simulationStore';
import { Gate, CrowdAgent, ScannerCounter, OverflowDoorConfig } from '../../types';

export type CameraPresetType = 'isometric' | 'top-down' | 'approach' | 'concourse';

interface Gate3DCanvasProps {
  gateId: string;
  cameraPreset?: CameraPresetType;
  onPresetChange?: (preset: CameraPresetType) => void;
}

interface CameraTarget {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
}

const PRESET_CONFIGS: Record<CameraPresetType, CameraTarget> = {
  isometric: {
    pos: new THREE.Vector3(20, 24, 30),
    lookAt: new THREE.Vector3(1.5, 1.5, 6),
  },
  'top-down': {
    pos: new THREE.Vector3(1.5, 38, 8),
    lookAt: new THREE.Vector3(1.5, 0, 7.9),
  },
  approach: {
    pos: new THREE.Vector3(1.5, 3.4, 32),
    lookAt: new THREE.Vector3(1.5, 2.0, 4),
  },
  concourse: {
    pos: new THREE.Vector3(1.5, 3.4, -12),
    lookAt: new THREE.Vector3(1.5, 2.0, 3),
  },
};

// Lane X coordinates: Lane 1, Lane 2, Lane 3, and Lane 4 (Overflow Door)
const LANE_X = [-3.2, 0.0, 3.2, 6.4];

export const Gate3DCanvas: React.FC<Gate3DCanvasProps> = ({
  gateId,
  cameraPreset = 'isometric',
  onPresetChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { engine, currentVenue, simTimeSecs } = useSimulationStore();

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Camera transition state
  const targetCamRef = useRef<CameraTarget | null>(null);
  const isTransitioningRef = useRef(false);

  // References to dynamic scene objects
  const signMeshRef = useRef<THREE.Mesh | null>(null);
  const laneSignsRef = useRef<THREE.Mesh[]>([]);
  const beaconLightsRef = useRef<THREE.PointLight[]>([]);
  const beaconPillarsRef = useRef<THREE.Mesh[]>([]);
  const scannerBeamsRef = useRef<THREE.Mesh[]>([]);
  const pedestriansGroupRef = useRef<THREE.Group | null>(null);

  // Overflow Door 3D References
  const overflowLeftDoorRef = useRef<THREE.Mesh | null>(null);
  const overflowRightDoorRef = useRef<THREE.Mesh | null>(null);
  const overflowSignRef = useRef<THREE.Mesh | null>(null);
  const overflowBeaconLightRef = useRef<THREE.PointLight | null>(null);
  const overflowBeaconPillarRef = useRef<THREE.Mesh | null>(null);
  const overflowBeamRef = useRef<THREE.Mesh | null>(null);
  const extremeAlertBannerRef = useRef<THREE.Mesh | null>(null);

  // Agent mesh pool: map from agentId to 3D Group
  const activeAgentMeshesRef = useRef<Map<number, THREE.Group>>(new Map());
  // Recent admitted agents buffer to allow them to walk into concourse
  const admittedVisualBufferRef = useRef<Map<number, { agent: CrowdAgent; admittedAt: number; initialZ: number }>>(new Map());

  // Current gate reference
  const currentGate = currentVenue.gates.find((g) => g.id === gateId) || currentVenue.gates[0];

  // Helper to create procedural tile texture
  const createTileTexture = useCallback((baseColor: string, lineColor: string, tileSize = 64) => {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, tileSize, tileSize);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, tileSize, tileSize);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  // Helper to create dynamic overhead gate signboard canvas texture
  const createGateSignTexture = useCallback((gate: Gate) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 1024, 0);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 256);

      // Cyan accent border
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, 1004, 236);

      // Inner subtle border
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 984, 216);

      // Gate ID badge
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 70px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gate.name.toUpperCase(), 512, 95);

      // Subtitle
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 34px system-ui, -apple-system, sans-serif';
      const sideText = gate.stadiumSide ? `${gate.stadiumSide} STAND ENTRY` : 'STADIUM ENTRANCE';
      const typeText = '• 3 SCANNER LANES + 4TH OVERFLOW PASSAGE';
      ctx.fillText(`${sideText} ${typeText}`, 512, 155);

      // Bottom status bar
      ctx.fillStyle = gate.status === 'OPERATIONAL' ? '#10b981' : '#ef4444';
      ctx.fillRect(320, 195, 384, 8);

      ctx.fillStyle = gate.status === 'OPERATIONAL' ? '#34d399' : '#f87171';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(
        gate.status === 'OPERATIONAL' ? '● ALL GATES OPERATIONAL' : '▲ SCANNER ADMISSION RESTRICTED',
        512,
        228
      );
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Helper to create lane header texture
  const createLaneSignTexture = useCallback((laneNum: number, counterName: string, status: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = status === 'OPERATIONAL' ? '#0f172a' : '#450a0a';
      ctx.fillRect(0, 0, 512, 180);

      ctx.strokeStyle = status === 'OPERATIONAL' ? '#10b981' : '#ef4444';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 500, 168);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`LANE ${laneNum}`, 256, 60);

      ctx.fillStyle = status === 'OPERATIONAL' ? '#34d399' : '#f87171';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`${counterName.toUpperCase()}`, 256, 110);

      ctx.fillStyle = status === 'OPERATIONAL' ? '#10b981' : '#ef4444';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(status === 'OPERATIONAL' ? '● ONLINE (60 p/m)' : '▲ COUNTER OFFLINE', 256, 150);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Helper to create dynamic Overflow Door signboard texture
  const createOverflowSignTexture = useCallback((door?: OverflowDoorConfig) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const isOpen = door?.status === 'OPEN';
    const isOpening = door?.status === 'OPENING';
    const isClosing = door?.status === 'CLOSING';

    if (ctx) {
      ctx.fillStyle = isOpen ? '#064e3b' : isOpening || isClosing ? '#78350f' : '#3f0c0c';
      ctx.fillRect(0, 0, 512, 200);

      ctx.strokeStyle = isOpen ? '#10b981' : isOpening || isClosing ? '#f59e0b' : '#ef4444';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, 500, 188);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OVERFLOW ENTRY DOOR', 256, 62);

      ctx.fillStyle = isOpen ? '#34d399' : isOpening || isClosing ? '#fbbf24' : '#f87171';
      ctx.font = 'bold 28px system-ui, sans-serif';
      const statusText = isOpen
        ? '● OVERFLOW ACTIVE'
        : isOpening
        ? '▲ OPENING IN PROGRESS...'
        : isClosing
        ? '▲ RECOVERY CLOSING...'
        : '■ NORMALLY CLOSED';
      ctx.fillText(statusText, 256, 118);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 20px monospace';
      ctx.fillText(isOpen ? 'AUTHORIZED THROUGHPUT: 60 p/m' : 'STANDBY: EXTREME CONGESTION ONLY', 256, 165);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Helper to create hazard stripe door texture for overflow door barrier
  const createHazardDoorTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 512);

      // Diagonal safety stripes
      ctx.lineWidth = 28;
      ctx.strokeStyle = '#eab308';
      for (let y = -256; y < 768; y += 56) {
        ctx.beginPath();
        ctx.moveTo(-50, y);
        ctx.lineTo(306, y + 356);
        ctx.stroke();
      }

      // Border and metallic lock plate
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 240, 496);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, 220, 176, 72);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 220, 176, 72);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EMERGENCY', 128, 252);
      ctx.fillText('OVERFLOW', 128, 278);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Update sign textures whenever gate or counters change
  useEffect(() => {
    if (!currentGate) return;

    if (signMeshRef.current) {
      const mat = signMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.dispose();
      mat.map = createGateSignTexture(currentGate);
      mat.needsUpdate = true;
    }

    laneSignsRef.current.forEach((mesh, idx) => {
      const counter = currentGate.counters?.[idx];
      const status = counter?.status || 'OPERATIONAL';
      const cName = counter?.name || `Counter ${idx + 1}`;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.dispose();
      mat.map = createLaneSignTexture(idx + 1, cName, status);
      mat.needsUpdate = true;
    });

    if (overflowSignRef.current) {
      const mat = overflowSignRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.dispose();
      mat.map = createOverflowSignTexture(currentGate.overflowDoor);
      mat.needsUpdate = true;
    }
  }, [currentGate, createGateSignTexture, createLaneSignTexture, createOverflowSignTexture]);

  // Set camera target when preset changes
  useEffect(() => {
    const config = PRESET_CONFIGS[cameraPreset];
    if (config) {
      targetCamRef.current = {
        pos: config.pos.clone(),
        lookAt: config.lookAt.clone(),
      };
      isTransitioningRef.current = true;
    }
  }, [cameraPreset]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.012);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.2, 500);
    const initialConfig = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.isometric;
    camera.position.copy(initialConfig.pos);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 4;
    controls.maxDistance = 100;
    controls.target.copy(initialConfig.lookAt);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x232d48, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x405580, 0x151b2e, 0.55);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    sunLight.position.set(24, 38, 28);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 120;
    const shadowD = 28;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Concourse interior floodlight
    const concourseLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    concourseLight.position.set(2, 15, -15);
    scene.add(concourseLight);

    // 6. Build Physical Environment Structures
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // --- Ground Planes ---
    // Exterior Approach Plaza Ground (Z: 10 to 52, expanded width X: -18 to 20)
    const plazaTileTex = createTileTexture('#131a2c', '#1e293b', 64);
    plazaTileTex.repeat.set(19, 21);
    const plazaGeo = new THREE.PlaneGeometry(38, 42);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTileTex,
      roughness: 0.85,
      metalness: 0.1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(1.5, 0, 31);
    plazaMesh.receiveShadow = true;
    worldGroup.add(plazaMesh);

    // Distribution Area Marking Strip (Z: 10 to 14)
    const distGeo = new THREE.PlaneGeometry(20, 4);
    const distCanvas = document.createElement('canvas');
    distCanvas.width = 640;
    distCanvas.height = 128;
    const dCtx = distCanvas.getContext('2d');
    if (dCtx) {
      dCtx.fillStyle = '#0f172a';
      dCtx.fillRect(0, 0, 640, 128);
      // Chevrons pointing forward (-Z)
      dCtx.fillStyle = '#06b6d4';
      dCtx.beginPath();
      for (let x = 48; x < 640; x += 88) {
        dCtx.moveTo(x, 100);
        dCtx.lineTo(x + 28, 28);
        dCtx.lineTo(x + 56, 100);
      }
      dCtx.fill();
    }
    const distTex = new THREE.CanvasTexture(distCanvas);
    distTex.wrapS = THREE.RepeatWrapping;
    distTex.wrapT = THREE.RepeatWrapping;
    distTex.repeat.set(2, 1);
    const distMat = new THREE.MeshBasicMaterial({ map: distTex, transparent: true, opacity: 0.45 });
    const distMesh = new THREE.Mesh(distGeo, distMat);
    distMesh.rotation.x = -Math.PI / 2;
    distMesh.position.set(1.5, 0.01, 12);
    worldGroup.add(distMesh);

    // Stadium Interior Concourse Corridor Ground (Z: -20 to 0)
    const concourseTileTex = createTileTexture('#0d1527', '#172554', 64);
    concourseTileTex.repeat.set(19, 10);
    const concourseGeo = new THREE.PlaneGeometry(38, 20);
    const concourseMat = new THREE.MeshStandardMaterial({
      map: concourseTileTex,
      roughness: 0.6,
      metalness: 0.25,
    });
    const concourseMesh = new THREE.Mesh(concourseGeo, concourseMat);
    concourseMesh.rotation.x = -Math.PI / 2;
    concourseMesh.position.set(1.5, 0, -10);
    concourseMesh.receiveShadow = true;
    worldGroup.add(concourseMesh);

    // Glowing Turnstile Threshold Line (Z: 0.0)
    const thresholdGeo = new THREE.PlaneGeometry(22, 0.6);
    const thresholdMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const thresholdMesh = new THREE.Mesh(thresholdGeo, thresholdMat);
    thresholdMesh.rotation.x = -Math.PI / 2;
    thresholdMesh.position.set(1.5, 0.02, 0);
    worldGroup.add(thresholdMesh);

    // --- Floor runner strips for Lanes 1, 2, 3 and Lane 4 (Overflow) ---
    LANE_X.forEach((lx, idx) => {
      const runnerGeo = new THREE.PlaneGeometry(2.3, 8.8);
      const runnerCanvas = document.createElement('canvas');
      runnerCanvas.width = 128;
      runnerCanvas.height = 512;
      const rCtx = runnerCanvas.getContext('2d');
      if (rCtx) {
        if (idx === 3) {
          // Overflow runner with caution hash pattern
          rCtx.fillStyle = '#1e1b4b';
          rCtx.fillRect(0, 0, 128, 512);
          rCtx.strokeStyle = '#eab308';
          rCtx.lineWidth = 6;
          for (let y = 32; y < 512; y += 48) {
            rCtx.beginPath();
            rCtx.moveTo(10, y);
            rCtx.lineTo(118, y + 24);
            rCtx.stroke();
          }
        } else {
          rCtx.fillStyle = idx % 2 === 0 ? '#1e293b' : '#1a2333';
          rCtx.fillRect(0, 0, 128, 512);
          rCtx.strokeStyle = '#06b6d4';
          rCtx.lineWidth = 4;
          for (let y = 32; y < 512; y += 64) {
            rCtx.beginPath();
            rCtx.moveTo(20, y);
            rCtx.lineTo(108, y);
            rCtx.stroke();
          }
        }
      }
      const runnerTex = new THREE.CanvasTexture(runnerCanvas);
      const runnerMat = new THREE.MeshStandardMaterial({
        map: runnerTex,
        roughness: 0.7,
      });
      const runnerMesh = new THREE.Mesh(runnerGeo, runnerMat);
      runnerMesh.rotation.x = -Math.PI / 2;
      runnerMesh.position.set(lx, 0.015, 5.6);
      runnerMesh.receiveShadow = true;
      worldGroup.add(runnerMesh);
    });

    // --- Stanchion Barriers with Velvet Ropes ---
    // Divider line X coordinates: separating Lane 1, 2, 3, 4 and outer bounds
    const stanchionXCoords = [-4.6, -1.6, 1.6, 4.8, 7.8];
    const stanchionZCoords = [1.8, 3.8, 5.8, 7.8, 9.8];

    const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.05, 12);
    const postBaseGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.06, 16);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Polished brass gold
      metalness: 0.9,
      roughness: 0.2,
    });
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // Deep royal velvet rope
      roughness: 0.9,
    });
    const overflowRopeMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // Deep crimson rope for overflow lane
      roughness: 0.9,
    });

    stanchionXCoords.forEach((sx, sIdx) => {
      for (let zi = 0; zi < stanchionZCoords.length; zi++) {
        const sz = stanchionZCoords[zi];

        // Stanchion Post
        const postMesh = new THREE.Mesh(postGeo, postMat);
        postMesh.position.set(sx, 0.52, sz);
        postMesh.castShadow = true;
        worldGroup.add(postMesh);

        // Stanchion Base
        const baseMesh = new THREE.Mesh(postBaseGeo, postMat);
        baseMesh.position.set(sx, 0.03, sz);
        baseMesh.receiveShadow = true;
        worldGroup.add(baseMesh);

        // Ball Finial
        const finialGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const finialMesh = new THREE.Mesh(finialGeo, postMat);
        finialMesh.position.set(sx, 1.08, sz);
        worldGroup.add(finialMesh);

        // Velvet Rope to next post along Z
        if (zi < stanchionZCoords.length - 1) {
          const nextZ = stanchionZCoords[zi + 1];
          const ropeLen = Math.abs(nextZ - sz);
          const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, ropeLen, 8);
          const activeRopeMat = sIdx >= 3 ? overflowRopeMat : ropeMat;
          const ropeMesh = new THREE.Mesh(ropeGeo, activeRopeMat);
          ropeMesh.rotation.x = Math.PI / 2;
          ropeMesh.position.set(sx, 0.85, (sz + nextZ) / 2);
          ropeMesh.castShadow = true;
          worldGroup.add(ropeMesh);
        }
      }
    });

    // --- Entrance Canopy & Architectural Portal ---
    const portalGroup = new THREE.Group();
    worldGroup.add(portalGroup);

    // Left and Right structural pillars (spanning around all 4 lanes)
    const pillarGeo = new THREE.BoxGeometry(0.9, 6.2, 1.2);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-6.5, 3.1, 1.0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    portalGroup.add(leftPillar);

    const midPillar = new THREE.Mesh(pillarGeo, pillarMat);
    midPillar.position.set(4.9, 3.1, 1.0);
    midPillar.castShadow = true;
    midPillar.receiveShadow = true;
    portalGroup.add(midPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(8.2, 3.1, 1.0);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    portalGroup.add(rightPillar);

    // Modern Cantilever Roof Canopy
    const canopyGeo = new THREE.BoxGeometry(16.5, 0.4, 7.5);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.6,
      roughness: 0.4,
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0.85, 5.4, 1.2);
    canopyMesh.castShadow = true;
    portalGroup.add(canopyMesh);

    // Canopy glowing underside rim
    const rimGeo = new THREE.BoxGeometry(16.6, 0.08, 0.2);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const rimFront = new THREE.Mesh(rimGeo, rimMat);
    rimFront.position.set(0.85, 5.18, 4.9);
    portalGroup.add(rimFront);

    // Main Overhead Signboard (above Lanes 1, 2, 3)
    const signGeo = new THREE.PlaneGeometry(11.2, 2.3);
    const signTex = createGateSignTexture(currentGate);
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.2,
    });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(-0.6, 4.2, 4.9);
    portalGroup.add(signMesh);
    signMeshRef.current = signMesh;

    // Overhead Lane Indicator Signs (above Lanes 1, 2, 3)
    laneSignsRef.current = [];
    [LANE_X[0], LANE_X[1], LANE_X[2]].forEach((lx, idx) => {
      const counter = currentGate.counters?.[idx];
      const status = counter?.status || 'OPERATIONAL';
      const cName = counter?.name || `Counter ${idx + 1}`;

      const lSignGeo = new THREE.PlaneGeometry(2.2, 0.9);
      const lSignTex = createLaneSignTexture(idx + 1, cName, status);
      const lSignMat = new THREE.MeshStandardMaterial({
        map: lSignTex,
        roughness: 0.3,
        emissive: status === 'OPERATIONAL' ? 0x10b981 : 0xef4444,
        emissiveIntensity: 0.25,
      });
      const lSignMesh = new THREE.Mesh(lSignGeo, lSignMat);
      lSignMesh.position.set(lx, 3.2, 2.4);
      portalGroup.add(lSignMesh);
      laneSignsRef.current.push(lSignMesh);
    });

    // --- Counter Desks, Optical Scanners & Vertical LED Beacons (Lanes 1, 2, 3) ---
    const deskGeo = new THREE.BoxGeometry(1.6, 1.0, 0.8);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3,
    });

    const scanPadGeo = new THREE.BoxGeometry(0.5, 0.04, 0.4);
    const scanPadMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.8,
    });

    const pillarIndicatorGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16);
    const beamGeo = new THREE.ConeGeometry(0.55, 1.4, 16, 1, true);

    beaconLightsRef.current = [];
    beaconPillarsRef.current = [];
    scannerBeamsRef.current = [];

    [LANE_X[0], LANE_X[1], LANE_X[2]].forEach((lx, idx) => {
      const counter = currentGate.counters?.[idx];
      const isOperational = counter?.status !== 'FAILED';

      // Counter Desk
      const deskMesh = new THREE.Mesh(deskGeo, deskMat);
      deskMesh.position.set(lx, 0.5, 1.2);
      deskMesh.castShadow = true;
      deskMesh.receiveShadow = true;
      worldGroup.add(deskMesh);

      // Optical Scanner Pad
      const scanPadMesh = new THREE.Mesh(scanPadGeo, scanPadMat);
      scanPadMesh.position.set(lx - 0.3, 1.02, 1.2);
      worldGroup.add(scanPadMesh);

      // Status Pillar
      const pillarColor = isOperational ? 0x10b981 : 0xef4444;
      const pillarIndicatorMat = new THREE.MeshStandardMaterial({
        color: pillarColor,
        emissive: pillarColor,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      const pMesh = new THREE.Mesh(pillarIndicatorGeo, pillarIndicatorMat);
      pMesh.position.set(lx + 0.65, 1.5, 1.2);
      worldGroup.add(pMesh);
      beaconPillarsRef.current.push(pMesh);

      // Point Light for counter glow
      const pLight = new THREE.PointLight(pillarColor, 2.5, 6);
      pLight.position.set(lx, 2.2, 1.2);
      worldGroup.add(pLight);
      beaconLightsRef.current.push(pLight);

      // Optical Scanner Cone
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.rotation.x = Math.PI;
      beamMesh.position.set(lx, 1.7, 1.4);
      beamMesh.visible = false;
      worldGroup.add(beamMesh);
      scannerBeamsRef.current.push(beamMesh);

      // Turnstile Barrier Flap
      const flapGeo = new THREE.BoxGeometry(0.04, 0.6, 0.7);
      const flapMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
      });
      const flapMesh = new THREE.Mesh(flapGeo, flapMat);
      flapMesh.position.set(lx + 0.6, 0.6, 0.4);
      worldGroup.add(flapMesh);
    });

    // =========================================================================
    // 7. BUILD THE PHYSICAL FOURTH OVERFLOW ENTRY DOOR BESIDE LANE 3 (X = 6.4m)
    // =========================================================================
    const overflowDoorGroup = new THREE.Group();
    worldGroup.add(overflowDoorGroup);

    // A. Overhead Signboard above Overflow Door
    const ofSignGeo = new THREE.PlaneGeometry(2.8, 1.1);
    const ofSignTex = createOverflowSignTexture(currentGate.overflowDoor);
    const ofSignMat = new THREE.MeshStandardMaterial({
      map: ofSignTex,
      roughness: 0.3,
      emissive: currentGate.overflowDoor?.status === 'OPEN' ? 0x10b981 : 0xef4444,
      emissiveIntensity: 0.35,
    });
    const ofSignMesh = new THREE.Mesh(ofSignGeo, ofSignMat);
    ofSignMesh.position.set(6.4, 3.4, 2.4);
    overflowDoorGroup.add(ofSignMesh);
    overflowSignRef.current = ofSignMesh;

    // B. Physical Motorized Barrier Doors (Left & Right Leaves)
    const doorLeafGeo = new THREE.BoxGeometry(1.2, 2.8, 0.08);
    const doorLeafTex = createHazardDoorTexture();
    const doorLeafMat = new THREE.MeshStandardMaterial({
      map: doorLeafTex,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Left Leaf (nominal closed at X = 5.8)
    const leftLeafMesh = new THREE.Mesh(doorLeafGeo, doorLeafMat);
    leftLeafMesh.position.set(5.8, 1.4, 1.2);
    leftLeafMesh.castShadow = true;
    overflowDoorGroup.add(leftLeafMesh);
    overflowLeftDoorRef.current = leftLeafMesh;

    // Right Leaf (nominal closed at X = 7.0)
    const rightLeafMesh = new THREE.Mesh(doorLeafGeo, doorLeafMat.clone());
    rightLeafMesh.position.set(7.0, 1.4, 1.2);
    rightLeafMesh.castShadow = true;
    overflowDoorGroup.add(rightLeafMesh);
    overflowRightDoorRef.current = rightLeafMesh;

    // C. Optical Scanner Desk & Status Pillar for Overflow Route
    const ofDeskGeo = new THREE.BoxGeometry(0.8, 1.0, 0.6);
    const ofDeskMesh = new THREE.Mesh(ofDeskGeo, deskMat);
    ofDeskMesh.position.set(7.5, 0.5, 1.2);
    overflowDoorGroup.add(ofDeskMesh);

    const ofScanPadMesh = new THREE.Mesh(scanPadGeo, scanPadMat);
    ofScanPadMesh.position.set(7.4, 1.02, 1.2);
    overflowDoorGroup.add(ofScanPadMesh);

    // Overflow Status Beacon Pillar
    const ofPillarColor = currentGate.overflowDoor?.status === 'OPEN' ? 0x10b981 : 0xef4444;
    const ofPillarMat = new THREE.MeshStandardMaterial({
      color: ofPillarColor,
      emissive: ofPillarColor,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const ofPillarMesh = new THREE.Mesh(pillarIndicatorGeo, ofPillarMat);
    ofPillarMesh.position.set(7.7, 1.5, 1.2);
    overflowDoorGroup.add(ofPillarMesh);
    overflowBeaconPillarRef.current = ofPillarMesh;

    const ofLight = new THREE.PointLight(ofPillarColor, 2.5, 7);
    ofLight.position.set(6.4, 2.5, 1.2);
    overflowDoorGroup.add(ofLight);
    overflowBeaconLightRef.current = ofLight;

    // Overflow Optical Beam Cone
    const ofBeamMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const ofBeamMesh = new THREE.Mesh(beamGeo, ofBeamMat);
    ofBeamMesh.rotation.x = Math.PI;
    ofBeamMesh.position.set(6.4, 1.7, 1.4);
    ofBeamMesh.visible = false;
    overflowDoorGroup.add(ofBeamMesh);
    overflowBeamRef.current = ofBeamMesh;

    // D. 3D Extreme Congestion Alert Banner (Pulsating mesh above canopy)
    const alertCanvas = document.createElement('canvas');
    alertCanvas.width = 1024;
    alertCanvas.height = 128;
    const aCtx = alertCanvas.getContext('2d');
    if (aCtx) {
      aCtx.fillStyle = '#7f1d1d';
      aCtx.fillRect(0, 0, 1024, 128);
      aCtx.strokeStyle = '#ef4444';
      aCtx.lineWidth = 6;
      aCtx.strokeRect(6, 6, 1012, 116);
      aCtx.fillStyle = '#fee2e2';
      aCtx.font = 'bold 36px monospace';
      aCtx.textAlign = 'center';
      aCtx.fillText('⚠️ EXTREME CONGESTION DETECTED — 4TH OVERFLOW DOOR ACTIVATED ⚠️', 512, 75);
    }
    const alertTex = new THREE.CanvasTexture(alertCanvas);
    const alertMat = new THREE.MeshStandardMaterial({
      map: alertTex,
      transparent: true,
      opacity: 0.95,
      emissive: 0xef4444,
      emissiveIntensity: 0.5,
    });
    const alertMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 1.7), alertMat);
    alertMesh.position.set(0.85, 6.3, 4.9);
    alertMesh.visible = false;
    worldGroup.add(alertMesh);
    extremeAlertBannerRef.current = alertMesh;

    // 8. Group for all 3D Pedestrians
    const pedestriansGroup = new THREE.Group();
    scene.add(pedestriansGroup);
    pedestriansGroupRef.current = pedestriansGroup;

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Animation & Render Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Camera preset smooth transition interpolation
      if (isTransitioningRef.current && targetCamRef.current && cameraRef.current && controlsRef.current) {
        const cam = cameraRef.current;
        const ctrl = controlsRef.current;
        const target = targetCamRef.current;

        const lerpFactor = Math.min(1.0, dt * 5.0);
        cam.position.lerp(target.pos, lerpFactor);
        ctrl.target.lerp(target.lookAt, lerpFactor);

        if (cam.position.distanceTo(target.pos) < 0.1 && ctrl.target.distanceTo(target.lookAt) < 0.1) {
          cam.position.copy(target.pos);
          ctrl.target.copy(target.lookAt);
          isTransitioningRef.current = false;
        }
      }

      controlsRef.current?.update();

      // Live gate reference from authoritative engine state
      const liveGate = engine.state.venue.gates.find((g) => g.id === gateId);

      // A. Update Regular Counter Beacons and Scanner Cones (Lanes 1, 2, 3)
      if (liveGate && liveGate.counters) {
        liveGate.counters.forEach((counter: ScannerCounter, idx: number) => {
          if (idx >= 3) return;
          const isOperational = counter.status === 'OPERATIONAL';
          const isProcessing = counter.isProcessing;

          const pLight = beaconLightsRef.current[idx];
          const pMesh = beaconPillarsRef.current[idx];
          const bMesh = scannerBeamsRef.current[idx];

          if (pLight && pMesh) {
            let col = 0x10b981;
            if (!isOperational) {
              col = 0xef4444;
            } else if (isProcessing) {
              col = 0x06b6d4;
            }

            pLight.color.setHex(col);
            (pMesh.material as THREE.MeshStandardMaterial).color.setHex(col);
            (pMesh.material as THREE.MeshStandardMaterial).emissive.setHex(col);

            if (!isOperational) {
              const pulse = 0.5 + 0.5 * Math.sin(currentTime * 0.008);
              pLight.intensity = 1.0 + 2.5 * pulse;
            } else {
              pLight.intensity = isProcessing ? 3.5 : 2.0;
            }
          }

          if (bMesh) {
            bMesh.visible = !!(isOperational && isProcessing);
            if (bMesh.visible) {
              bMesh.rotation.y += dt * 4;
            }
          }
        });
      }

      // B. Update Overflow Door Physical Opening Animation & Lights
      if (liveGate && liveGate.overflowDoor) {
        const door = liveGate.overflowDoor;
        const progress = Math.max(0, Math.min(1, door.doorProgress || 0));
        const isOpen = door.status === 'OPEN';
        const isOpening = door.status === 'OPENING';
        const isClosing = door.status === 'CLOSING';

        // Animate door physical leaves sliding open / closed
        if (overflowLeftDoorRef.current && overflowRightDoorRef.current) {
          // Left leaf slides leftwards from X = 5.8 to 4.7
          overflowLeftDoorRef.current.position.x = 5.8 - 1.1 * progress;
          // Right leaf slides rightwards from X = 7.0 to 8.1
          overflowRightDoorRef.current.position.x = 7.0 + 1.1 * progress;
        }

        // Animate Overflow Status Beacon Pillar & Light
        if (overflowBeaconLightRef.current && overflowBeaconPillarRef.current) {
          let ofCol = 0xef4444;
          if (isOpen) {
            ofCol = door.processingCount > 0 ? 0x06b6d4 : 0x10b981;
          } else if (isOpening || isClosing) {
            ofCol = 0xf59e0b; // Amber warning while opening/closing
          }

          overflowBeaconLightRef.current.color.setHex(ofCol);
          (overflowBeaconPillarRef.current.material as THREE.MeshStandardMaterial).color.setHex(ofCol);
          (overflowBeaconPillarRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(ofCol);

          if (isOpen) {
            overflowBeaconLightRef.current.intensity = door.processingCount > 0 ? 3.5 : 2.2;
          } else {
            const pulse = 0.5 + 0.5 * Math.sin(currentTime * 0.006);
            overflowBeaconLightRef.current.intensity = 1.0 + 2.0 * pulse;
          }
        }

        // Animate Overflow Scanner Beam
        if (overflowBeamRef.current) {
          overflowBeamRef.current.visible = !!(isOpen && door.processingCount > 0);
          if (overflowBeamRef.current.visible) {
            overflowBeamRef.current.rotation.y += dt * 4;
          }
        }

        // Animate Extreme Congestion Alert Banner
        if (extremeAlertBannerRef.current) {
          const showBanner = isOpen || isOpening;
          extremeAlertBannerRef.current.visible = showBanner;
          if (showBanner) {
            const pulse = 0.6 + 0.4 * Math.sin(currentTime * 0.007);
            (extremeAlertBannerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
          }
        }
      }

      // C. Update 3D Pedestrian Agents
      updatePedestrians(currentTime, dt);

      rendererRef.current?.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.clear();
      activeAgentMeshesRef.current.clear();
    };
  }, [gateId, createTileTexture, createGateSignTexture, createLaneSignTexture, createOverflowSignTexture, createHazardDoorTexture]);

  // Helper to create a single stylized 3D Pedestrian character mesh
  const createAgentMesh = (agent: CrowdAgent): THREE.Group => {
    const group = new THREE.Group();

    // Torso: Capsule / Cylinder
    const torsoGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.85, 10);
    const shirtMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(agent.shirtColor || '#38bdf8'),
      roughness: 0.7,
      metalness: 0.1,
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    torsoMesh.position.y = 0.85;
    torsoMesh.castShadow = true;
    group.add(torsoMesh);

    // Head: Sphere
    const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(agent.skinColor || '#f6d8b5'),
      roughness: 0.5,
    });
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.y = 1.45;
    headMesh.castShadow = true;
    group.add(headMesh);

    // Ticket / Badge in hand
    const ticketGeo = new THREE.BoxGeometry(0.12, 0.02, 0.08);
    const ticketMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ticketMesh = new THREE.Mesh(ticketGeo, ticketMat);
    ticketMesh.position.set(0.18, 0.95, -0.22);
    group.add(ticketMesh);

    // Base shadow disc
    const shadowGeo = new THREE.CircleGeometry(0.28, 10);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    group.add(shadowMesh);

    return group;
  };

  // Update Pedestrian Meshes based on live engine state
  const updatePedestrians = (currentTime: number, dt: number) => {
    const pedestriansGroup = pedestriansGroupRef.current;
    if (!pedestriansGroup) return;

    const liveAgents = engine.state.agents.filter((a) => a.targetGateId === gateId);
    const activeMap = activeAgentMeshesRef.current;
    const currentAgentIds = new Set<number>();

    // Group queuing agents by lane to compute their 3D depth along the lane (0, 1, 2, 3)
    const lane0Agents = liveAgents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && (a.assignedLane ?? 0) === 0);
    const lane1Agents = liveAgents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && (a.assignedLane ?? 0) === 1);
    const lane2Agents = liveAgents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && (a.assignedLane ?? 0) === 2);
    const lane3Agents = liveAgents.filter((a) => (a.state === 'QUEUING' || a.state === 'PROCESSING') && (a.assignedLane ?? 0) === 3);

    // Render up to 500 active 3D characters for optimal 60 FPS performance
    const renderCap = Math.min(liveAgents.length, 500);

    for (let i = 0; i < renderCap; i++) {
      const agent = liveAgents[i];
      if (
        agent.state !== 'APPROACHING' &&
        agent.state !== 'QUEUING' &&
        agent.state !== 'PROCESSING' &&
        agent.state !== 'HOLDING'
      ) {
        continue;
      }

      currentAgentIds.add(agent.id);

      let group = activeMap.get(agent.id);
      if (!group) {
        group = createAgentMesh(agent);
        pedestriansGroup.add(group);
        activeMap.set(agent.id, group);
      }

      // Calculate Target 3D coordinates (X, Y, Z)
      let targetX = 0;
      let targetZ = 30;
      let targetFacing = Math.PI;

      const laneIdx = agent.assignedLane ?? 0;
      const nominalLaneX = LANE_X[laneIdx] ?? (laneIdx === 3 ? 6.4 : 0);

      if (agent.state === 'PROCESSING') {
        targetX = nominalLaneX;
        targetZ = 1.4;
      } else if (agent.state === 'QUEUING') {
        const laneList =
          laneIdx === 0 ? lane0Agents : laneIdx === 1 ? lane1Agents : laneIdx === 2 ? lane2Agents : lane3Agents;
        const depth = Math.max(0, laneList.indexOf(agent));

        if (agent.isSwitchingLane && agent.switchSourceLane !== undefined) {
          // Agent is actively walking laterally across the distribution zone
          const srcX = LANE_X[agent.switchSourceLane] ?? 0;
          const dstX = nominalLaneX;
          targetX = (srcX + dstX) / 2;
          targetZ = 10.5 + depth * 0.4;
          targetFacing = dstX > srcX ? Math.PI / 2 : -Math.PI / 2;
        } else {
          // Two-abreast staggered queue formation so 80+ spectators per lane are visibly compact in front of canopy
          const row = Math.floor(depth / 2);
          const col = depth % 2;
          const lateralJitter = col === 0 ? -0.32 : 0.32;
          targetX = nominalLaneX + lateralJitter;
          targetZ = 2.4 + row * 0.65;
          targetFacing = Math.PI;
        }
      } else if (agent.state === 'HOLDING') {
        // Holding plaza area (Z: 20 to 32)
        const hash = (agent.id * 9301 + 49297) % 233280;
        const offsetX = ((hash % 100) / 100 - 0.5) * 12;
        const offsetZ = (((hash * 7) % 100) / 100) * 8;
        targetX = offsetX + 8;
        targetZ = 20 + offsetZ;
      } else if (agent.state === 'APPROACHING') {
        // Exterior Approach Walkway (Z: 24 to 48)
        const hash = (agent.id * 1337 + 7) % 1000;
        const lateralSpread = (hash / 1000 - 0.5) * 12;
        targetX = lateralSpread;
        const distToGate = Math.hypot(agent.targetX - agent.x, agent.targetY - agent.y);
        targetZ = Math.max(24, Math.min(48, distToGate * 1.2 + 20));
      }

      // Smooth Position Interpolation
      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.16);
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 0.16);

      // Walking bounce when moving
      const isMoving = Math.abs(group.position.x - targetX) > 0.05 || Math.abs(group.position.z - targetZ) > 0.05;
      if (isMoving) {
        group.position.y = Math.abs(Math.sin((currentTime * 0.008 + agent.id) * 3)) * 0.06;
      } else {
        group.position.y = 0;
      }

      // Rotation facing direction
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetFacing, 0.16);
    }

    // 2. Track newly admitted agents in admitted buffer so they walk through the concourse
    engine.state.agents.forEach((agent) => {
      if (agent.targetGateId === gateId && agent.state === 'ADMITTED') {
        if (!admittedVisualBufferRef.current.has(agent.id) && (agent.enteredTime || 0) > simTimeSecs - 4) {
          admittedVisualBufferRef.current.set(agent.id, {
            agent,
            admittedAt: simTimeSecs,
            initialZ: 0.8,
          });
        }
      }
    });

    // 3. Update & render admitted agents walking through concourse (Z: 0 to -14)
    admittedVisualBufferRef.current.forEach((item, agentId) => {
      const elapsed = simTimeSecs - item.admittedAt;
      if (elapsed > 3.5) {
        const mesh = activeMap.get(agentId);
        if (mesh) {
          pedestriansGroup.remove(mesh);
          activeMap.delete(agentId);
        }
        admittedVisualBufferRef.current.delete(agentId);
        return;
      }

      currentAgentIds.add(agentId);

      let group = activeMap.get(agentId);
      if (!group) {
        group = createAgentMesh(item.agent);
        pedestriansGroup.add(group);
        activeMap.set(agentId, group);
        const startX = LANE_X[item.agent.assignedLane ?? 0] ?? 0;
        group.position.set(startX, 0, item.initialZ);
      }

      const laneX = LANE_X[item.agent.assignedLane ?? 0] ?? 0;
      const targetZ = item.initialZ - elapsed * 3.5;
      group.position.x = laneX;
      group.position.z = targetZ;
      group.position.y = Math.abs(Math.sin(currentTime * 0.015)) * 0.05;
      group.rotation.y = Math.PI;
    });

    // 4. Remove stale agents that are no longer active
    activeMap.forEach((mesh, id) => {
      if (!currentAgentIds.has(id)) {
        pedestriansGroup.remove(mesh);
        activeMap.delete(id);
      }
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-950 select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
