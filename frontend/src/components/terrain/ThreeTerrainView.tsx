import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TerrainMesh } from '../../types/api';

export type TerrainLayerMode = 'visible' | 'elevation' | 'slope' | 'roughness';

interface ThreeTerrainViewProps {
  mesh: TerrainMesh;
  layerMode: TerrainLayerMode;
  verticalExaggeration: number;
  wireframe: boolean;
  onProbeUpdate?: (probe: {
    lat: number;
    lon: number;
    elevation: number;
    slope: number;
    roughness: number;
  } | null) => void;
}

export const ThreeTerrainView: React.FC<ThreeTerrainViewProps> = ({
  mesh,
  layerMode,
  verticalExaggeration,
  wireframe,
  onProbeUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const probeMarkerRef = useRef<THREE.Mesh | null>(null);
  const texturesRef = useRef<Record<string, THREE.Texture>>({});
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const [activeProbe, setActiveProbe] = useState<{
    lat: number;
    lon: number;
    elevation: number;
    slope: number;
    roughness: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070913); // Deep space Martian night
    sceneRef.current = scene;

    // Subtle atmospheric fog
    scene.fog = new THREE.FogExp2(0x0a0c18, 0.003);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 110, 140);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 450;
    controls.minDistance = 15;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent dipping beneath terrain
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffecd2, 0.45);
    scene.add(ambientLight);

    // Primary Solar Directional Light
    const sunLight = new THREE.DirectionalLight(0xfff7ea, 1.3);
    sunLight.position.set(120, 180, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 100;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Secondary Martian Rayleigh ambient fill
    const fillLight = new THREE.DirectionalLight(0x4a6b8c, 0.35);
    fillLight.position.set(-100, 60, -100);
    scene.add(fillLight);

    // 6. Coordinate Reference Grid & Compass Base
    const gridHelper = new THREE.GridHelper(140, 14, 0x1a233a, 0x101626);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // 7. Interactive 3D Probe Marker
    const markerGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true });
    const probeMarker = new THREE.Mesh(markerGeo, markerMat);
    probeMarker.visible = false;
    scene.add(probeMarker);
    probeMarkerRef.current = probeMarker;

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Window Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, []);

  // Pre-load layer textures
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const urls: Record<string, string> = {
      visible: mesh.texture_url,
      elevation: mesh.elevation_colormap_url,
      slope: mesh.slope_colormap_url,
      roughness: mesh.roughness_colormap_url,
    };

    Object.entries(urls).forEach(([mode, url]) => {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        texturesRef.current[mode] = tex;
        updateTerrainMaterial();
      });
    });
  }, [mesh.sector_id]);

  // Construct or update 3D Terrain PlaneGeometry displaced by real elevation
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing terrain mesh if present
    if (terrainMeshRef.current) {
      scene.remove(terrainMeshRef.current);
      terrainMeshRef.current.geometry.dispose();
      terrainMeshRef.current = null;
    }

    const [rows, cols] = mesh.dimensions;
    const planeSize = 100; // Base spatial footprint in Three.js world units
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize, cols - 1, rows - 1);

    // Rotate plane so X is East, Z is South, Y is Up
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const elev = mesh.elevation_grid;
    const minElev = mesh.elevation_stats.min;
    const maxElev = mesh.elevation_stats.max;
    const elevRange = Math.max(1.0, maxElev - minElev);

    // Base height displacement scale
    const baseElevationHeight = 18.0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const vertexIndex = r * cols + c;
        const normalizedH = (elev[r][c] - minElev) / elevRange;
        // Y displacement scaled by vertical exaggeration
        pos.setY(vertexIndex, normalizedH * baseElevationHeight * verticalExaggeration);
      }
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const initialTexture = texturesRef.current[layerMode] || null;
    const material = new THREE.MeshStandardMaterial({
      map: initialTexture,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: wireframe,
      flatShading: false,
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;
  }, [mesh, verticalExaggeration]);

  // Update material texture or wireframe mode on prop change
  const updateTerrainMaterial = () => {
    if (!terrainMeshRef.current) return;
    const mat = terrainMeshRef.current.material as THREE.MeshStandardMaterial;
    const tex = texturesRef.current[layerMode];
    if (tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    mat.wireframe = wireframe;
    mat.needsUpdate = true;
  };

  useEffect(() => {
    updateTerrainMaterial();
  }, [layerMode, wireframe]);

  // Handle Raycasting Pointer Probe on Terrain Surface
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !terrainMeshRef.current || !cameraRef.current) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseRef.current.x = (x / rect.width) * 2 - 1;
    mouseRef.current.y = -(y / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(terrainMeshRef.current);

    if (intersects.length > 0 && intersects[0].uv) {
      const hit = intersects[0];
      const uv = hit.uv!;

      // Position 3D marker at intersection point
      if (probeMarkerRef.current) {
        probeMarkerRef.current.position.copy(hit.point);
        probeMarkerRef.current.position.y += 0.8;
        probeMarkerRef.current.visible = true;
      }

      // Map UV back to scientific coordinate values:
      // U is 0..1 (West to East)
      // V is 0..1 (South to North in PlaneGeometry)
      const [rows, cols] = mesh.dimensions;
      const r = Math.min(rows - 1, Math.max(0, Math.floor((1 - uv.y) * (rows - 1))));
      const c = Math.min(cols - 1, Math.max(0, Math.floor(uv.x * (cols - 1))));

      const lat = mesh.bounds.max_lat - (1 - uv.y) * (mesh.bounds.max_lat - mesh.bounds.min_lat);
      const lon = mesh.bounds.min_lon + uv.x * (mesh.bounds.max_lon - mesh.bounds.min_lon);

      const elevation = mesh.elevation_grid[r] ? mesh.elevation_grid[r][c] : 0;
      const slope = mesh.slope_grid[r] ? mesh.slope_grid[r][c] : 0;
      const roughness = mesh.roughness_grid[r] ? mesh.roughness_grid[r][c] : 0;

      const probeInfo = {
        lat,
        lon,
        elevation,
        slope,
        roughness,
        screenX: x,
        screenY: y,
      };

      setActiveProbe(probeInfo);
      if (onProbeUpdate) onProbeUpdate(probeInfo);
    } else {
      if (probeMarkerRef.current) probeMarkerRef.current.visible = false;
      setActiveProbe(null);
      if (onProbeUpdate) onProbeUpdate(null);
    }
  };

  const handlePointerLeave = () => {
    if (probeMarkerRef.current) probeMarkerRef.current.visible = false;
    setActiveProbe(null);
    if (onProbeUpdate) onProbeUpdate(null);
  };

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 110, 140);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div
      className="three-terrain-container"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div ref={mountRef} className="three-terrain-canvas" />

      {/* Floating 3D Probe HUD Badge */}
      {activeProbe && (
        <div
          className="terrain-probe-hud"
          style={{
            left: Math.min(activeProbe.screenX + 18, (mountRef.current?.clientWidth || 800) - 230),
            top: Math.max(20, activeProbe.screenY - 70),
          }}
        >
          <div className="probe-header">
            <span className="probe-dot"></span>
            <span>SURFACE TELEMETRY PROBE</span>
          </div>
          <div className="probe-row">
            <span>COORDINATES:</span>
            <strong>
              {activeProbe.lat.toFixed(4)}°N, {activeProbe.lon.toFixed(4)}°E
            </strong>
          </div>
          <div className="probe-row highlight">
            <span>ELEVATION:</span>
            <strong>{activeProbe.elevation.toFixed(1)} m</strong>
          </div>
          <div className="probe-row">
            <span>SLOPE:</span>
            <strong style={{ color: activeProbe.slope > 15 ? '#ff5252' : '#69f0ae' }}>
              {activeProbe.slope.toFixed(2)}°
            </strong>
          </div>
          <div className="probe-row">
            <span>ROUGHNESS:</span>
            <strong>{activeProbe.roughness.toFixed(2)} m</strong>
          </div>
        </div>
      )}

      {/* Viewport Overlay: North Cardinal Indicator & Reset View Button */}
      <div className="terrain-overlay-controls">
        <button
          className="terrain-cam-btn"
          onClick={handleResetCamera}
          title="Reset Camera Orientation"
        >
          🎯 RESET CAM
        </button>
        <div className="compass-pill">
          <span className="compass-arrow">▲</span> N (0°)
        </div>
      </div>
    </div>
  );
};
