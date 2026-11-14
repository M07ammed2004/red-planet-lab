import * as THREE from 'three';
import {
  type MarsRegion,
  MARS_REGIONS,
  type UsgsMartianLandmark,
  USGS_MARTIAN_NOMENCLATURE,
  type MartianFeatureCategory,
} from '../../types/globe';
import type { Sector } from '../../types/api';
import { latLonToVector3 } from '../../services/marsCoordinates';

export interface GlobeCallbacks {
  onHoverItem: (
    item: { type: 'landmark'; data: UsgsMartianLandmark } | { type: 'region'; data: MarsRegion; sector?: Sector } | null,
    screenPos?: { x: number; y: number }
  ) => void;
  onSelectItem: (
    item: { type: 'landmark'; data: UsgsMartianLandmark } | { type: 'region'; data: MarsRegion; sector?: Sector }
  ) => void;
}

export class ThreeMarsGlobe {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private globeGroup: THREE.Group;
  private sectorPatchesGroup: THREE.Group;
  private landmarksGroup: THREE.Group;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  // Globe parameters
  private readonly GLOBE_RADIUS = 5.0;
  private callbacks: GlobeCallbacks;

  // Tracked objects for raycasting
  private hitObjects: Map<
    THREE.Object3D,
    { type: 'landmark'; data: UsgsMartianLandmark } | { type: 'region'; data: MarsRegion }
  > = new Map();

  private landmarkBeacons: Map<string, { group: THREE.Group; landmark: UsgsMartianLandmark }> = new Map();
  private sectorObjects: Map<string, { patch?: THREE.Mesh; border: THREE.Line; region: MarsRegion }> = new Map();

  // Interaction state
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private rotationVelocity = { x: 0, y: 0.0012 }; // slow idle spin
  private targetRotation: { x: number; y: number } | null = null;
  private animationFrameId: number | null = null;
  private hoveredHitMesh: THREE.Object3D | null = null;

  // Filtering
  private activeCategory: MartianFeatureCategory | 'ALL' | 'SECTORS' = 'ALL';
  private currentSectors: Sector[] = [];

  constructor(container: HTMLElement, callbacks: GlobeCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 13.5);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 3. Raycaster & Mouse
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);

    // 4. Globe Groups
    this.globeGroup = new THREE.Group();
    // Tilt Mars axis to its physical obliquity (25.19 degrees)
    this.globeGroup.rotation.z = THREE.MathUtils.degToRad(-25.19);
    this.scene.add(this.globeGroup);

    this.sectorPatchesGroup = new THREE.Group();
    this.globeGroup.add(this.sectorPatchesGroup);

    this.landmarksGroup = new THREE.Group();
    this.globeGroup.add(this.landmarksGroup);

    // 5. Construct Visuals
    this.buildStarfield();
    this.buildLighting();
    this.buildMarsSphere();
    this.buildCoordinateGrid();
    this.buildAtmosphereGlow();
    this.buildLandmarkBeacons();
    this.buildSectorFootprints();

    // 6. Bind Event Listeners
    this.bindEvents();

    // 7. Start Render Loop
    this.animate();
  }

  private buildStarfield() {
    const starCount = 1800;
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 70 + Math.random() * 110;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const tint = Math.random();
      if (tint > 0.8) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1.0;
      } else if (tint > 0.6) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.7;
      } else {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.92; colors[i * 3 + 2] = 0.95;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(starField);
  }

  private buildLighting() {
    // Warm Sun direct light - natural solar radiance in Mars orbit
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.8);
    sunLight.position.set(24, 12, 18);
    this.scene.add(sunLight);

    // Subtle soft fill light for realism on limb
    const fillLight = new THREE.DirectionalLight(0x7598b2, 0.55);
    fillLight.position.set(-20, -8, -18);
    this.scene.add(fillLight);

    // Warm ambient light so topographical features and landmarks across Mars remain clearly visible
    const ambient = new THREE.AmbientLight(0xffeedd, 0.75);
    this.scene.add(ambient);
  }

  private buildMarsSphere() {
    // 1. Authentic realistic Martian surface texture map (SolarSystemScope / NASA MOLA-Viking 2K)
    const textureLoader = new THREE.TextureLoader();
    const marsTexture = textureLoader.load('/textures/mars_realistic_2k.jpg');
    marsTexture.colorSpace = THREE.SRGBColorSpace;
    marsTexture.wrapS = THREE.RepeatWrapping;
    marsTexture.wrapT = THREE.ClampToEdgeWrapping;

    const sphereGeometry = new THREE.SphereGeometry(this.GLOBE_RADIUS, 96, 96);
    // Align texture Prime Meridian (0 deg East) with latLonToVector3 mathematical coordinates
    sphereGeometry.rotateY(-Math.PI);

    const sphereMaterial = new THREE.MeshStandardMaterial({
      map: marsTexture,
      roughness: 0.82,
      metalness: 0.04,
    });
    const marsBody = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.globeGroup.add(marsBody);

    // 2. Delicate atmospheric Rayleigh scattering haze layer
    const hazeGeometry = new THREE.SphereGeometry(this.GLOBE_RADIUS * 1.003, 64, 64);
    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd97555,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
    });
    this.globeGroup.add(new THREE.Mesh(hazeGeometry, hazeMaterial));
  }

  private buildCoordinateGrid() {
    // Parallels (Latitude lines)
    for (let lat = -75; lat <= 75; lat += 15) {
      const isEquator = lat === 0;
      const radiusAtLat = this.GLOBE_RADIUS * Math.cos(THREE.MathUtils.degToRad(lat)) * 1.002;
      const yPos = this.GLOBE_RADIUS * Math.sin(THREE.MathUtils.degToRad(lat));

      const ringGeometry = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segments = 96;

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radiusAtLat, yPos, Math.sin(theta) * radiusAtLat));
      }
      ringGeometry.setFromPoints(points);

      const ringMaterial = new THREE.LineBasicMaterial({
        color: isEquator ? 0xefbd61 : 0xead8c6,
        transparent: true,
        opacity: isEquator ? 0.75 : 0.22,
        linewidth: isEquator ? 2 : 1,
      });

      this.globeGroup.add(new THREE.Line(ringGeometry, ringMaterial));
    }

    // Meridians (Longitude lines)
    for (let lon = 0; lon < 360; lon += 30) {
      const isPrime = lon === 0;
      const ringGeometry = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segments = 96;

      for (let i = 0; i <= segments; i++) {
        const lat = -90 + (i / segments) * 180;
        points.push(latLonToVector3(lat, lon, this.GLOBE_RADIUS * 1.002));
      }
      ringGeometry.setFromPoints(points);

      const ringMaterial = new THREE.LineBasicMaterial({
        color: isPrime ? 0x438c91 : 0xead8c6,
        transparent: true,
        opacity: isPrime ? 0.75 : 0.2,
      });

      this.globeGroup.add(new THREE.Line(ringGeometry, ringMaterial));
    }
  }

  private buildAtmosphereGlow() {
    const glowGeometry = new THREE.SphereGeometry(this.GLOBE_RADIUS * 1.07, 48, 48);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xd96b50) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(color, intensity * 0.42);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    this.scene.add(new THREE.Mesh(glowGeometry, glowMaterial));
  }

  // --- USGS Nomenclature Landmark Beacons ---
  private buildLandmarkBeacons() {
    this.landmarksGroup.clear();
    this.landmarkBeacons.clear();

    USGS_MARTIAN_NOMENCLATURE.forEach((landmark) => {
      const group = new THREE.Group();
      const pos = latLonToVector3(landmark.center[0], landmark.center[1], this.GLOBE_RADIUS);
      const normal = pos.clone().normalize();

      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const colorHex = parseInt(landmark.color.replace('#', '0x'), 16);

      // 1. Surface footprint ring
      const ringGeo = new THREE.RingGeometry(0.14, 0.18, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.02;
      group.add(ringMesh);

      // 2. Vertical tactical beacon
      const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8);
      pinGeo.translate(0, 0.225, 0);
      const pinMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
      group.add(new THREE.Mesh(pinGeo, pinMat));

      // 3. Glowing landmark beacon head
      const headGeo = new THREE.SphereGeometry(0.065, 12, 12);
      headGeo.translate(0, 0.45, 0);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      group.add(new THREE.Mesh(headGeo, headMat));

      // 4. Raycast hit target
      const hitGeo = new THREE.SphereGeometry(0.45, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.22;
      group.add(hitMesh);

      this.landmarksGroup.add(group);
      this.landmarkBeacons.set(landmark.id, { group, landmark });
      this.hitObjects.set(hitMesh, { type: 'landmark', data: landmark });
    });
  }

  // --- Exploration Sector Curved Patches & Bounding Footprints ---
  private buildSectorFootprints() {
    this.sectorPatchesGroup.clear();
    this.sectorObjects.clear();

    MARS_REGIONS.forEach((region) => {
      const b = region.bounds;
      const matchingSector = this.currentSectors.find((s) => s.sector_id === region.id);
      const isScouted = matchingSector?.state === 'DISCOVERED';

      const colorHex = isScouted ? 0x00e5ff : 0x475569;

      // 1. Curved perimeter boundary line
      const border = this.createCurvedSectorBorder(b.min_lat, b.max_lat, b.min_lon, b.max_lon, this.GLOBE_RADIUS * 1.005, colorHex, isScouted);
      this.sectorPatchesGroup.add(border);

      let patchMesh: THREE.Mesh | undefined;

      // 2. If scouted, drape real processed elevation/mosaic texture patch on the sphere surface
      if (isScouted) {
        const patchGeo = this.createCurvedSectorGeometry(b.min_lat, b.max_lat, b.min_lon, b.max_lon, this.GLOBE_RADIUS * 1.006, 16);
        const textureUrl = `/api/sectors/${region.id}/layers/elevation/preview`;
        const tex = new THREE.TextureLoader().load(textureUrl);
        tex.colorSpace = THREE.SRGBColorSpace;

        const patchMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.65,
          metalness: 0.1,
          side: THREE.FrontSide,
        });

        patchMesh = new THREE.Mesh(patchGeo, patchMat);
        this.sectorPatchesGroup.add(patchMesh);
      }

      // 3. Invisible hit mesh for clicking sector on globe
      const centerPos = latLonToVector3(region.center[0], region.center[1], this.GLOBE_RADIUS * 1.01);
      const hitGeo = new THREE.SphereGeometry(0.7, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(centerPos);
      this.sectorPatchesGroup.add(hitMesh);

      this.sectorObjects.set(region.id, { patch: patchMesh, border, region });
      this.hitObjects.set(hitMesh, { type: 'region', data: region });
    });
  }

  private createCurvedSectorGeometry(
    min_lat: number,
    max_lat: number,
    min_lon: number,
    max_lon: number,
    radius: number,
    segments: number = 16
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= segments; j++) {
      const v = j / segments;
      const lat = min_lat + v * (max_lat - min_lat);
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const lon = min_lon + u * (max_lon - min_lon);
        const pt = latLonToVector3(lat, lon, radius);
        positions.push(pt.x, pt.y, pt.z);
        uvs.push(u, v);
      }
    }

    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * (segments + 1) + i;
        const b = j * (segments + 1) + i + 1;
        const c = (j + 1) * (segments + 1) + i;
        const d = (j + 1) * (segments + 1) + i + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private createCurvedSectorBorder(
    min_lat: number,
    max_lat: number,
    min_lon: number,
    max_lon: number,
    radius: number,
    color: number,
    isScouted: boolean
  ): THREE.Line {
    const pts: THREE.Vector3[] = [];
    const segs = 12;

    // South edge (West to East)
    for (let i = 0; i <= segs; i++) pts.push(latLonToVector3(min_lat, min_lon + (i / segs) * (max_lon - min_lon), radius));
    // East edge (South to North)
    for (let i = 0; i <= segs; i++) pts.push(latLonToVector3(min_lat + (i / segs) * (max_lat - min_lat), max_lon, radius));
    // North edge (East to West)
    for (let i = 0; i <= segs; i++) pts.push(latLonToVector3(max_lat, max_lon - (i / segs) * (max_lon - min_lon), radius));
    // West edge (North to South)
    for (let i = 0; i <= segs; i++) pts.push(latLonToVector3(max_lat - (i / segs) * (max_lat - min_lat), min_lon, radius));

    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color,
      linewidth: isScouted ? 2.5 : 1,
      transparent: true,
      opacity: isScouted ? 0.95 : 0.45,
    });
    return new THREE.Line(lineGeo, lineMat);
  }

  // --- External State Updates ---
  public updateSectors(sectors: Sector[]) {
    this.currentSectors = sectors;
    this.buildSectorFootprints();
  }

  public setCategoryFilter(category: MartianFeatureCategory | 'ALL' | 'SECTORS') {
    this.activeCategory = category;

    // Filter landmark beacons
    this.landmarkBeacons.forEach(({ group, landmark }) => {
      if (category === 'SECTORS') {
        group.visible = false;
      } else if (category === 'ALL') {
        group.visible = true;
      } else {
        group.visible = landmark.category === category;
      }
    });

    // Filter sectors
    this.sectorPatchesGroup.visible = category === 'ALL' || category === 'SECTORS';
  }

  public flyTo(lat: number, lon: number) {
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);

    this.targetRotation = {
      y: -(lonRad + Math.PI / 2),
      x: latRad,
    };
  }

  public selectRegion(region: MarsRegion) {
    this.flyTo(region.center[0], region.center[1]);
  }

  public selectLandmark(landmark: UsgsMartianLandmark) {
    this.flyTo(landmark.center[0], landmark.center[1]);
  }

  public resetRotation() {
    this.targetRotation = null;
    this.rotationVelocity = { x: 0, y: 0.0012 };
  }

  // --- Interaction & Event Handling ---
  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    el.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onPointerDown(e: PointerEvent) {
    this.isDragging = true;
    this.targetRotation = null;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.isDragging) {
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.globeGroup.rotation.y += deltaX * 0.005;
      this.globeGroup.rotation.x += deltaY * 0.005;
      this.globeGroup.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.globeGroup.rotation.x));

      this.rotationVelocity = { x: deltaY * 0.001, y: deltaX * 0.001 };
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else {
      this.checkIntersection(e.clientX, e.clientY);
    }
  }

  private onPointerUp(e: PointerEvent) {
    const dist = Math.hypot(e.clientX - this.previousMousePosition.x, e.clientY - this.previousMousePosition.y);
    this.isDragging = false;

    if (dist < 4 && this.hoveredHitMesh) {
      const entry = this.hitObjects.get(this.hoveredHitMesh);
      if (entry) {
        if (entry.type === 'landmark') {
          this.callbacks.onSelectItem({ type: 'landmark', data: entry.data });
          this.flyTo(entry.data.center[0], entry.data.center[1]);
        } else {
          const sec = this.currentSectors.find((s) => s.sector_id === entry.data.id);
          this.callbacks.onSelectItem({ type: 'region', data: entry.data, sector: sec });
          this.flyTo(entry.data.center[0], entry.data.center[1]);
        }
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY * 0.012;
    this.camera.position.z = Math.min(Math.max(7.5, this.camera.position.z + zoomFactor), 22.0);
  }

  private onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private checkIntersection(clientX: number, clientY: number) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitMeshes = Array.from(this.hitObjects.keys());
    const intersects = this.raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const entry = this.hitObjects.get(hitMesh);
      if (entry) {
        this.hoveredHitMesh = hitMesh;
        this.renderer.domElement.style.cursor = 'pointer';

        if (entry.type === 'landmark') {
          this.callbacks.onHoverItem({ type: 'landmark', data: entry.data }, { x: clientX, y: clientY });
        } else {
          const sec = this.currentSectors.find((s) => s.sector_id === entry.data.id);
          this.callbacks.onHoverItem({ type: 'region', data: entry.data, sector: sec }, { x: clientX, y: clientY });
        }
        return;
      }
    }

    if (this.hoveredHitMesh) {
      this.hoveredHitMesh = null;
      this.callbacks.onHoverItem(null);
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  // --- Projected Screen Labels ---
  public getScreenPositions(): {
    id: string;
    name: string;
    color: string;
    category?: string;
    x: number;
    y: number;
    visible: boolean;
    isLandmark: boolean;
  }[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const results: {
      id: string;
      name: string;
      color: string;
      category?: string;
      x: number;
      y: number;
      visible: boolean;
      isLandmark: boolean;
    }[] = [];

    // 1. Sector Labels
    MARS_REGIONS.forEach((region) => {
      const worldPos = new THREE.Vector3();
      const pos = latLonToVector3(region.center[0], region.center[1], this.GLOBE_RADIUS);
      worldPos.copy(pos).applyMatrix4(this.globeGroup.matrixWorld);

      const normal = worldPos.clone().normalize();
      const cameraDir = this.camera.position.clone().sub(worldPos).normalize();
      const isVisible = normal.dot(cameraDir) > 0.25;

      const projected = worldPos.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-(projected.y * 0.5) + 0.5) * rect.height;

      results.push({
        id: region.id,
        name: region.name,
        color: region.color,
        category: 'SECTOR',
        x,
        y,
        visible: isVisible && (this.activeCategory === 'ALL' || this.activeCategory === 'SECTORS'),
        isLandmark: false,
      });
    });

    // 2. Landmark Labels (sampled for prominent features when category matches)
    if (this.activeCategory !== 'SECTORS') {
      USGS_MARTIAN_NOMENCLATURE.forEach((lm) => {
        if (this.activeCategory !== 'ALL' && lm.category !== this.activeCategory) return;

        const worldPos = new THREE.Vector3();
        const pos = latLonToVector3(lm.center[0], lm.center[1], this.GLOBE_RADIUS);
        worldPos.copy(pos).applyMatrix4(this.globeGroup.matrixWorld);

        const normal = worldPos.clone().normalize();
        const cameraDir = this.camera.position.clone().sub(worldPos).normalize();
        const isVisible = normal.dot(cameraDir) > 0.35;

        const projected = worldPos.clone().project(this.camera);
        const x = (projected.x * 0.5 + 0.5) * rect.width;
        const y = (-(projected.y * 0.5) + 0.5) * rect.height;

        results.push({
          id: lm.id,
          name: lm.name,
          color: lm.color,
          category: lm.category,
          x,
          y,
          visible: isVisible,
          isLandmark: true,
        });
      });
    }

    return results;
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.targetRotation) {
      this.globeGroup.rotation.y += (this.targetRotation.y - this.globeGroup.rotation.y) * 0.05;
      this.globeGroup.rotation.x += (this.targetRotation.x - this.globeGroup.rotation.x) * 0.05;
      if (
        Math.abs(this.targetRotation.y - this.globeGroup.rotation.y) < 0.005 &&
        Math.abs(this.targetRotation.x - this.globeGroup.rotation.x) < 0.005
      ) {
        this.targetRotation = null;
      }
    } else if (!this.isDragging) {
      this.globeGroup.rotation.y += this.rotationVelocity.y;
      this.globeGroup.rotation.x += this.rotationVelocity.x;
      this.rotationVelocity.x *= 0.95;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('pointermove', this.onPointerMove.bind(this));
    window.removeEventListener('pointerup', this.onPointerUp.bind(this));
    window.removeEventListener('resize', this.onResize.bind(this));

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
