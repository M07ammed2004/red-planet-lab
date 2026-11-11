import * as THREE from 'three';

/**
 * Convert Mars geographic coordinates (lat, lon) in degrees to 3D Cartesian (x, y, z).
 * Mars standard: +Y is North Pole, Equator is Y=0, Airy-0 Prime Meridian is +Z.
 */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180); // map 0-360 around the sphere

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Convert 3D Cartesian vector on a sphere back to Mars geographic coordinates (lat, lon).
 */
export function vector3ToLatLon(vec: THREE.Vector3): { lat: number; lon: number } {
  const norm = vec.clone().normalize();
  const phi = Math.acos(Math.min(Math.max(norm.y, -1), 1));
  const lat = 90 - phi * (180 / Math.PI);

  const theta = Math.atan2(norm.z, -norm.x);
  let lon = theta * (180 / Math.PI) - 180;
  if (lon < 0) lon += 360;

  return { lat, lon };
}

/**
 * Check if a 3D point on the sphere is visible to the camera (not occluded by Mars body).
 */
export function isPointVisibleToCamera(point: THREE.Vector3, camera: THREE.Camera): boolean {
  const normal = point.clone().normalize();
  const viewDir = camera.position.clone().sub(point).normalize();
  return normal.dot(viewDir) > 0.15; // dot > 0 is front hemisphere; > 0.15 adds rim margin
}

/**
 * Project a 3D point to 2D screen coordinates (normalized 0 to 1 and pixel coordinates).
 */
export function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const visible = isPointVisibleToCamera(point, camera);
  const projected = point.clone().project(camera);

  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (-(projected.y * 0.5) + 0.5) * height;

  return { x, y, visible };
}
