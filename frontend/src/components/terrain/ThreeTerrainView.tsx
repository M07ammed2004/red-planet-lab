import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RoverWaypoint, StormCell, SurfacePhoto, TerrainMesh } from '../../types/api';

export type TerrainLayerMode = 'visible' | 'elevation' | 'slope' | 'roughness' | 'geology';

interface ThreeTerrainViewProps {
  mesh: TerrainMesh;
  layerMode: TerrainLayerMode;
  verticalExaggeration: number;
  wireframe: boolean;
  photos?: SurfacePhoto[];
  onSelectPhoto?: (photo: SurfacePhoto) => void;
  roverPath?: [number, number][];
  roverWaypoints?: RoverWaypoint[];
  showRoverTraverse?: boolean;
  plannedRoutes?: {
    fastest?: [number, number][];
    safest?: [number, number][];
    scientific?: [number, number][];
  };
  startPoint?: [number, number] | null;
  destPoint?: [number, number] | null;
  stormCells?: StormCell[];
  showStormLayer?: boolean;
  onPickPoint?: (coords: [number, number]) => void;
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
  photos = [],
  onSelectPhoto,
  roverPath = [],
  roverWaypoints = [],
  showRoverTraverse = true,
  plannedRoutes,
  startPoint,
  destPoint,
  stormCells = [],
  showStormLayer = true,
  onPickPoint,
  onProbeUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const probeMarkerRef = useRef<THREE.Mesh | null>(null);
  const photoBeaconsGroupRef = useRef<THREE.Group | null>(null);
  const routesGroupRef = useRef<THREE.Group | null>(null);
  const stormsGroupRef = useRef<THREE.Group | null>(null);
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

  const [hoveredPhoto, setHoveredPhoto] = useState<SurfacePhoto | null>(null);

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

      // Dynamic rotation for Martian storm vortexes
      if (stormsGroupRef.current) {
        stormsGroupRef.current.children.forEach((child) => {
          if (child.userData?.isStormVortex) {
            child.rotation.y += 0.015;
          }
        });
      }

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
      geology: mesh.geology_colormap_url || mesh.elevation_colormap_url,
    };

    Object.entries(urls).forEach(([mode, url]) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          texturesRef.current[mode] = tex;
          updateTerrainMaterial();
        },
        undefined,
        (err) => {
          console.warn(`Could not load texture for layer ${mode} (${url}):`, err);
        }
      );
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
    // Calculate physical aspect ratio (E-W / N-S) accounting for latitude-dependent meridian convergence
    const centerLatRad = ((mesh.bounds.min_lat + mesh.bounds.max_lat) / 2.0) * (Math.PI / 180.0);
    const aspect =
      mesh.aspect_ratio ??
      (Math.cos(centerLatRad) * ((mesh.bounds.max_lon - mesh.bounds.min_lon) / (mesh.bounds.max_lat - mesh.bounds.min_lat)));

    const planeHeight = 100; // Base North-South footprint in Three.js world units
    const planeWidth = 100 * aspect; // Geographically scaled East-West footprint
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, cols - 1, rows - 1);

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

    // Helper to map geographic (lat, lon) to Three.js world coordinates on the displaced terrain
    const coordToWorld = (lat: number, lon: number, yOffset: number = 0.5): THREE.Vector3 | null => {
      const u = (lon - mesh.bounds.min_lon) / (mesh.bounds.max_lon - mesh.bounds.min_lon);
      const v = (lat - mesh.bounds.min_lat) / (mesh.bounds.max_lat - mesh.bounds.min_lat);
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      const x = (u - 0.5) * planeWidth;
      const z = (0.5 - v) * planeHeight;
      const r = Math.min(rows - 1, Math.max(0, Math.floor((1 - v) * (rows - 1))));
      const c = Math.min(cols - 1, Math.max(0, Math.floor(u * (cols - 1))));
      const normH = (elev[r][c] - minElev) / elevRange;
      const y = normH * baseElevationHeight * verticalExaggeration + yOffset;
      return new THREE.Vector3(x, y, z);
    };

    // 1. Group for all mission routes, markers & waypoints
    if (routesGroupRef.current) {
      scene.remove(routesGroupRef.current);
      routesGroupRef.current = null;
    }
    const routesGroup = new THREE.Group();

    // Render NASA Rover Ground Truth Traverse Path (Golden Line)
    if (showRoverTraverse && roverPath && roverPath.length > 1) {
      const pathPoints: THREE.Vector3[] = roverPath
        .map(([pLat, pLon]) => coordToWorld(pLat, pLon, 0.7))
        .filter(Boolean) as THREE.Vector3[];

      if (pathPoints.length > 1) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffd700, linewidth: 4 });
        routesGroup.add(new THREE.Line(lineGeo, lineMat));
      }
    }

    // Render NASA Rover Waypoint Pins (Gold Dodecahedrons)
    if (showRoverTraverse && roverWaypoints && roverWaypoints.length > 0) {
      roverWaypoints.forEach((wp) => {
        const pos = coordToWorld(wp.lat, wp.lon, 1.4);
        if (pos) {
          const wpGeo = new THREE.DodecahedronGeometry(1.2);
          const wpMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffb300,
            emissiveIntensity: 0.8,
            metalness: 0.5,
          });
          const wpMesh = new THREE.Mesh(wpGeo, wpMat);
          wpMesh.position.copy(pos);
          wpMesh.userData = { waypoint: wp };
          routesGroup.add(wpMesh);
        }
      });
    }

    // Render A* Fastest Route (Cyan Line)
    if (plannedRoutes?.fastest && plannedRoutes.fastest.length > 1) {
      const pts = plannedRoutes.fastest
        .map(([pLat, pLon]) => coordToWorld(pLat, pLon, 0.8))
        .filter(Boolean) as THREE.Vector3[];
      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 3 });
        routesGroup.add(new THREE.Line(geo, mat));
      }
    }

    // Render A* Safest Route (Emerald Green Line)
    if (plannedRoutes?.safest && plannedRoutes.safest.length > 1) {
      const pts = plannedRoutes.safest
        .map(([pLat, pLon]) => coordToWorld(pLat, pLon, 0.9))
        .filter(Boolean) as THREE.Vector3[];
      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x00e676, linewidth: 4 });
        routesGroup.add(new THREE.Line(geo, mat));
      }
    }

    // Render A* Scientific Exploration Route (Amber / Orange with Science Waypoint Beacons)
    if (plannedRoutes?.scientific && plannedRoutes.scientific.length > 1) {
      const pts = plannedRoutes.scientific
        .map(([pLat, pLon]) => coordToWorld(pLat, pLon, 1.05))
        .filter(Boolean) as THREE.Vector3[];
      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0xffa000, linewidth: 4 });
        routesGroup.add(new THREE.Line(geo, mat));

        // Place science waypoint markers along the scientific route
        pts.forEach((pt, i) => {
          if (i > 0 && i < pts.length - 1 && i % 3 === 0) {
            const sciGeo = new THREE.IcosahedronGeometry(0.9, 0);
            const sciMat = new THREE.MeshStandardMaterial({
              color: 0xffb300,
              emissive: 0xff6f00,
              emissiveIntensity: 0.9,
              metalness: 0.7,
              roughness: 0.2,
            });
            const sciMesh = new THREE.Mesh(sciGeo, sciMat);
            sciMesh.position.copy(pt);
            routesGroup.add(sciMesh);
          }
        });
      }
    }

    // Start Position Pin (Green Sphere)
    if (startPoint) {
      const pos = coordToWorld(startPoint[0], startPoint[1], 1.6);
      if (pos) {
        const sGeo = new THREE.SphereGeometry(1.6, 16, 16);
        const sMat = new THREE.MeshStandardMaterial({
          color: 0x00e676,
          emissive: 0x00c853,
          emissiveIntensity: 0.9,
        });
        const sMesh = new THREE.Mesh(sGeo, sMat);
        sMesh.position.copy(pos);
        routesGroup.add(sMesh);
      }
    }

    // Destination Position Pin (Red Cone / Flag)
    if (destPoint) {
      const pos = coordToWorld(destPoint[0], destPoint[1], 1.8);
      if (pos) {
        const dGeo = new THREE.ConeGeometry(1.6, 3.2, 16);
        const dMat = new THREE.MeshStandardMaterial({
          color: 0xff1744,
          emissive: 0xd50000,
          emissiveIntensity: 0.9,
        });
        const dMesh = new THREE.Mesh(dGeo, dMat);
        dMesh.position.copy(pos);
        routesGroup.add(dMesh);
      }
    }

    scene.add(routesGroup);
    routesGroupRef.current = routesGroup;

    // 2. Render In-Situ Surface Camera Beacons (Golden Octahedrons with Glow Rings)
    if (photoBeaconsGroupRef.current) {
      scene.remove(photoBeaconsGroupRef.current);
      photoBeaconsGroupRef.current = null;
    }
    const beaconGroup = new THREE.Group();
    photos.forEach((photo) => {
      const pos = coordToWorld(photo.lat, photo.lon, 1.8);
      if (pos) {
        const bGeo = new THREE.OctahedronGeometry(1.8, 0);
        const bMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xff9100,
          emissiveIntensity: 0.9,
          metalness: 0.8,
          roughness: 0.2,
        });
        const bMesh = new THREE.Mesh(bGeo, bMat);
        bMesh.position.copy(pos);
        bMesh.userData = { photo };

        // Outer pulsing target ring
        const ringGeo = new THREE.RingGeometry(2.2, 2.7, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffd700,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos);
        ringMesh.position.y -= 0.5;

        beaconGroup.add(bMesh);
        beaconGroup.add(ringMesh);
      }
    });
    scene.add(beaconGroup);
    photoBeaconsGroupRef.current = beaconGroup;

    // 3. Render Active Martian Dust Storms & Vortexes
    if (stormsGroupRef.current) {
      scene.remove(stormsGroupRef.current);
      stormsGroupRef.current = null;
    }
    if (showStormLayer && stormCells && stormCells.length > 0) {
      const stormsGroup = new THREE.Group();
      const totalKmNs = (mesh.bounds.max_lat - mesh.bounds.min_lat) * 59.27;
      const sceneUnitsPerKm = totalKmNs > 0 ? planeHeight / totalKmNs : 1.0;

      stormCells.forEach((storm) => {
        if (!storm.is_active) return;
        const pos = coordToWorld(storm.center_lat, storm.center_lon, 0.5);
        if (!pos) return;

        const stormRadiusScene = Math.max(storm.radius_km * sceneUnitsPerKm, 4.0);

        // A. Outer Swirling Dust Vortex Cylinder
        const vortexGeo = new THREE.CylinderGeometry(
          stormRadiusScene * 1.15,
          stormRadiusScene * 0.95,
          18.0 * verticalExaggeration,
          32,
          1,
          true
        );
        const vortexMat = new THREE.MeshBasicMaterial({
          color: 0xd96b50,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
        vortexMesh.position.set(pos.x, pos.y + 9.0 * verticalExaggeration, pos.z);
        vortexMesh.userData = { isStormVortex: true };
        stormsGroup.add(vortexMesh);

        // B. Inner Core Cone (Dense Dust Eye - Obstacle Zone)
        const eyeRadius = stormRadiusScene * 0.55;
        const eyeGeo = new THREE.ConeGeometry(eyeRadius, 14.0 * verticalExaggeration, 24, 1, true);
        const eyeMat = new THREE.MeshBasicMaterial({
          color: 0xff3d00,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
        eyeMesh.rotation.x = Math.PI; // upside-down funnel vortex
        eyeMesh.position.set(pos.x, pos.y + 7.0 * verticalExaggeration, pos.z);
        eyeMesh.userData = { isStormVortex: true };
        stormsGroup.add(eyeMesh);

        // C. Ground Hazard Exclusion Perimeter Ring (Red warning boundary)
        const ringGeo = new THREE.RingGeometry(stormRadiusScene * 0.52, stormRadiusScene * 0.58, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff1744,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(pos.x, pos.y + 0.2, pos.z);
        stormsGroup.add(ringMesh);

        // D. Outer Wind Shear Ring
        const windRingGeo = new THREE.RingGeometry(stormRadiusScene * 0.98, stormRadiusScene * 1.02, 48);
        windRingGeo.rotateX(-Math.PI / 2);
        const windRingMat = new THREE.MeshBasicMaterial({
          color: 0xff9800,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const windRingMesh = new THREE.Mesh(windRingGeo, windRingMat);
        windRingMesh.position.set(pos.x, pos.y + 0.15, pos.z);
        stormsGroup.add(windRingMesh);

        // E. Floating Storm Center Marker (Pulsing Diamond)
        const markerGeo = new THREE.OctahedronGeometry(1.6, 0);
        const markerMat = new THREE.MeshStandardMaterial({
          color: 0xff3d00,
          emissive: 0xd50000,
          emissiveIntensity: 0.9,
          wireframe: true,
        });
        const markerMesh = new THREE.Mesh(markerGeo, markerMat);
        markerMesh.position.set(pos.x, pos.y + 19.0 * verticalExaggeration, pos.z);
        markerMesh.userData = { isStormVortex: true };
        stormsGroup.add(markerMesh);
      });

      scene.add(stormsGroup);
      stormsGroupRef.current = stormsGroup;
    }
  }, [
    mesh,
    verticalExaggeration,
    roverPath,
    roverWaypoints,
    showRoverTraverse,
    plannedRoutes,
    startPoint,
    destPoint,
    photos,
    stormCells,
    showStormLayer,
  ]);

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

    // Check hover over in-situ camera beacons
    if (photoBeaconsGroupRef.current) {
      const beaconHits = raycasterRef.current.intersectObjects(photoBeaconsGroupRef.current.children);
      if (beaconHits.length > 0 && beaconHits[0].object.userData?.photo) {
        setHoveredPhoto(beaconHits[0].object.userData.photo);
      } else {
        setHoveredPhoto(null);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraRef.current) return;
    const container = mountRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    // 1. Check in-situ camera beacon hit
    if (photoBeaconsGroupRef.current && onSelectPhoto) {
      const hits = raycasterRef.current.intersectObjects(photoBeaconsGroupRef.current.children);
      if (hits.length > 0 && hits[0].object.userData?.photo) {
        onSelectPhoto(hits[0].object.userData.photo);
        return;
      }
    }

    // 2. Check terrain hit for coordinate picking
    if (onPickPoint && terrainMeshRef.current) {
      const terrainHits = raycasterRef.current.intersectObject(terrainMeshRef.current);
      if (terrainHits.length > 0 && terrainHits[0].uv) {
        const uv = terrainHits[0].uv!;
        const lat = Number((mesh.bounds.max_lat - (1 - uv.y) * (mesh.bounds.max_lat - mesh.bounds.min_lat)).toFixed(4));
        const lon = Number((mesh.bounds.min_lon + uv.x * (mesh.bounds.max_lon - mesh.bounds.min_lon)).toFixed(4));
        onPickPoint([lat, lon]);
      }
    }
  };

  const handlePointerLeave = () => {
    if (probeMarkerRef.current) probeMarkerRef.current.visible = false;
    setActiveProbe(null);
    setHoveredPhoto(null);
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
      onClick={handleClick}
    >
      <div ref={mountRef} className="three-terrain-canvas" />

      {/* In-situ photo hover pill */}
      {hoveredPhoto && (
        <div className="photo-beacon-tooltip">
          <span>📷 {hoveredPhoto.target_name}</span>
          <small>Sol {hoveredPhoto.sol} • {hoveredPhoto.instrument} (Click to view)</small>
        </div>
      )}

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
