import * as THREE from 'three';
import { type MarsRegion, MARS_REGIONS } from '../../types/globe';
import { latLonToVector3 } from '../../services/marsCoordinates';

export interface GlobeCallbacks {
  onHoverRegion: (region: MarsRegion | null, screenPos?: { x: number; y: number }) => void;
  onSelectRegion: (region: MarsRegion) => void;
}

export class ThreeMarsGlobe {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private globeGroup: THREE.Group;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  // Globe parameters
  private readonly GLOBE_RADIUS = 5.0;
  private regionObjects: Map<string, { group: THREE.Group; hitMesh: THREE.Mesh; region: MarsRegion }> = new Map();
  private callbacks: GlobeCallbacks;

  // Interaction state
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private rotationVelocity = { x: 0, y: 0.0012 }; // default slow idle spin
  private targetRotation: { x: number; y: number } | null = null;
  private animationFrameId: number | null = null;
  private hoveredRegionId: string | null = null;

  constructor(container: HTMLElement, callbacks: GlobeCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 2.5, 14.5);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    // 3. Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);

    // 4. Globe Root Group
    this.globeGroup = new THREE.Group();
    // Tilt Mars axis to its physical obliquity (25.19 degrees)
    this.globeGroup.rotation.z = THREE.MathUtils.degToRad(-25.19);
    this.scene.add(this.globeGroup);

    // 5. Construct Scene
    this.buildStarfield();
    this.buildLighting();
    this.buildMarsSphere();
    this.buildCoordinateGrid();
    this.buildAtmosphereGlow();
    this.buildRegionBeacons();

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
      // Distribute in a spherical shell (radius 70 to 180)
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

      // Color tints: slight cyan, amber, white
      const tint = Math.random();
      if (tint > 0.8) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1.0; // soft cyan
      } else if (tint > 0.6) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.7; // soft amber
      } else {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.92; colors[i * 3 + 2] = 0.95; // white
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
    // Sun key light illuminating from top-right
    const sunLight = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sunLight.position.set(20, 15, 20);
    this.scene.add(sunLight);

    // Deep space fill light (subtle blue-purple bounce)
    const fillLight = new THREE.DirectionalLight(0x283b5e, 0.6);
    fillLight.position.set(-20, -10, -20);
    this.scene.add(fillLight);

    // Ambient space light
    const ambient = new THREE.AmbientLight(0x121620, 0.8);
    this.scene.add(ambient);
  }

  private buildMarsSphere() {
    // 1. Translucent Base Mars Body
    const sphereGeometry = new THREE.SphereGeometry(this.GLOBE_RADIUS, 64, 64);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f0e08, // Dark rust tone
      roughness: 0.65,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const marsBody = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.globeGroup.add(marsBody);

    // 2. Geometric Wireframe Outer Crust
    const wireframeGeometry = new THREE.IcosahedronGeometry(this.GLOBE_RADIUS * 1.002, 4);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3d1c10, // subtle dark reddish wireframe
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const crustMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    this.globeGroup.add(crustMesh);
  }

  private buildCoordinateGrid() {
    // Latitude rings (parallels)
    const latInterval = 15;
    for (let lat = -75; lat <= 75; lat += latInterval) {
      const isEquator = lat === 0;
      const radiusAtLat = this.GLOBE_RADIUS * Math.cos(THREE.MathUtils.degToRad(lat)) * 1.003;
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
        color: isEquator ? 0xf27036 : 0x2a394d,
        transparent: true,
        opacity: isEquator ? 0.75 : 0.35,
        linewidth: isEquator ? 2 : 1,
      });

      const line = new THREE.Line(ringGeometry, ringMaterial);
      this.globeGroup.add(line);
    }

    // Longitude rings (meridians)
    const lonInterval = 30;
    for (let lon = 0; lon < 360; lon += lonInterval) {
      const isPrime = lon === 0;
      const ringGeometry = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segments = 96;

      for (let i = 0; i <= segments; i++) {
        const lat = -90 + (i / segments) * 180;
        const pt = latLonToVector3(lat, lon, this.GLOBE_RADIUS * 1.003);
        points.push(pt);
      }
      ringGeometry.setFromPoints(points);

      const ringMaterial = new THREE.LineBasicMaterial({
        color: isPrime ? 0x00e5ff : 0x2a394d,
        transparent: true,
        opacity: isPrime ? 0.75 : 0.3,
      });

      const line = new THREE.Line(ringGeometry, ringMaterial);
      this.globeGroup.add(line);
    }
  }

  private buildAtmosphereGlow() {
    // Outer atmospheric glow shell
    const glowGeometry = new THREE.SphereGeometry(this.GLOBE_RADIUS * 1.08, 48, 48);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xf2542d) },
      },
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
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(color, intensity * 0.45);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(glowMesh);
  }

  private buildRegionBeacons() {
    MARS_REGIONS.forEach((region) => {
      const group = new THREE.Group();
      const pos = latLonToVector3(region.center[0], region.center[1], this.GLOBE_RADIUS);
      const normal = pos.clone().normalize();

      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const colorHex = parseInt(region.color.replace('#', '0x'), 16);

      // 1. Target boundary ring on the surface
      const ringGeo = new THREE.RingGeometry(0.18, 0.24, 32);
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

      // 2. Vertical beacon pin
      const pinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
      pinGeo.translate(0, 0.3, 0);
      const pinMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      group.add(pinMesh);

      // 3. Glowing beacon head
      const headGeo = new THREE.SphereGeometry(0.08, 16, 16);
      headGeo.translate(0, 0.6, 0);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      group.add(headMesh);

      // 4. Invisible hit-sphere for reliable mouse raycasting
      const hitGeo = new THREE.SphereGeometry(0.65, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.3;
      hitMesh.userData = { regionId: region.id };
      group.add(hitMesh);

      this.globeGroup.add(group);
      this.regionObjects.set(region.id, { group, hitMesh, region });
    });
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

      // Update rotation
      this.globeGroup.rotation.y += deltaX * 0.005;
      this.globeGroup.rotation.x += deltaY * 0.005;

      // Clamp X tilt to prevent gimbal inversion
      this.globeGroup.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.globeGroup.rotation.x));

      this.rotationVelocity = { x: deltaY * 0.001, y: deltaX * 0.001 };
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else {
      // Raycast for hover
      this.checkIntersection(e.clientX, e.clientY);
    }
  }

  private onPointerUp(e: PointerEvent) {
    const movedDistance = Math.hypot(
      e.clientX - this.previousMousePosition.x,
      e.clientY - this.previousMousePosition.y
    );

    this.isDragging = false;

    // If mouse was clicked without significant drag, treat as selection click
    if (movedDistance < 4 && this.hoveredRegionId) {
      const entry = this.regionObjects.get(this.hoveredRegionId);
      if (entry) {
        this.selectRegion(entry.region);
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY * 0.012;
    this.camera.position.z = Math.min(Math.max(8.0, this.camera.position.z + zoomFactor), 22.0);
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
    const hitMeshes = Array.from(this.regionObjects.values()).map((v) => v.hitMesh);
    const intersects = this.raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object as THREE.Mesh;
      const regionId = hitObj.userData.regionId;
      if (regionId && this.regionObjects.has(regionId)) {
        if (this.hoveredRegionId !== regionId) {
          this.setRegionHover(regionId, true);
        }
        this.callbacks.onHoverRegion(this.regionObjects.get(regionId)!.region, { x: clientX, y: clientY });
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }

    if (this.hoveredRegionId) {
      this.setRegionHover(this.hoveredRegionId, false);
      this.hoveredRegionId = null;
      this.callbacks.onHoverRegion(null);
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  private setRegionHover(regionId: string, isHovered: boolean) {
    this.hoveredRegionId = isHovered ? regionId : null;
    const item = this.regionObjects.get(regionId);
    if (!item) return;

    // Scale beacon group up slightly on hover
    const targetScale = isHovered ? 1.35 : 1.0;
    item.group.scale.set(targetScale, targetScale, targetScale);
  }

  public selectRegion(region: MarsRegion) {
    this.callbacks.onSelectRegion(region);

    // Calculate target rotation to face the region directly toward camera
    const latRad = THREE.MathUtils.degToRad(region.center[0]);
    const lonRad = THREE.MathUtils.degToRad(region.center[1]);

    // Target rotation angles around Y and X to face +Z
    this.targetRotation = {
      y: -(lonRad + Math.PI / 2),
      x: latRad,
    };
  }

  public resetRotation() {
    this.targetRotation = null;
    this.rotationVelocity = { x: 0, y: 0.0012 };
  }

  public getScreenPositions(): { region: MarsRegion; x: number; y: number; visible: boolean }[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const result: { region: MarsRegion; x: number; y: number; visible: boolean }[] = [];

    this.regionObjects.forEach(({ group, region }) => {
      const worldPos = new THREE.Vector3();
      group.getWorldPosition(worldPos);

      // Check if on facing hemisphere
      const normal = worldPos.clone().normalize();
      const cameraDir = this.camera.position.clone().sub(worldPos).normalize();
      const dot = normal.dot(cameraDir);
      const isVisible = dot > 0.15;

      const projected = worldPos.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-(projected.y * 0.5) + 0.5) * rect.height;

      result.push({
        region,
        x,
        y,
        visible: isVisible,
      });
    });

    return result;
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Smooth interpolation to target region if clicked
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
      // Idle slow spin
      this.globeGroup.rotation.y += this.rotationVelocity.y;
      this.globeGroup.rotation.x += this.rotationVelocity.x;
      // Damping on X
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
