export function projectForestPoint3d(point, camera = { x: 0, y: 0 }) {
  return {
    x: point.x - camera.x,
    y: point.y - camera.y - point.z,
    depth: point.y + point.z
  };
}
