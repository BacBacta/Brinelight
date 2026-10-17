import * as THREE from "three";

/** Where the Mist's veil stands around the city, and how high it rises from the water. */
export const VEIL = { radius: 45, height: 16, color: "#8A6CFF", top: "#B9B3D6", opacity: 0.55 } as const;

/**
 * The Mist's veil on the horizon (docs/art-direction.md: "The Mist is a wall advancing from the horizon"; here it stands
 * still): a ring around the city, violet at the water and fading upward, seen when the camera tilts toward the horizon
 * (the fog veils the far sea in every view). One draw call while it shows; hidden in calm weather.
 */
export function createVeil() {
  const g = new THREE.CylinderGeometry(VEIL.radius, VEIL.radius, VEIL.height, 48, 1, true);
  g.translate(0, VEIL.height / 2 - 0.5, 0);
  const pos = g.getAttribute("position");
  const low = new THREE.Color(VEIL.color);
  const high = new THREE.Color(VEIL.top);
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const bottom = pos.getY(i) < VEIL.height / 2;
    const c = bottom ? low : high;
    colors.push(c.r, c.g, c.b, bottom ? VEIL.opacity : 0);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
  const mesh = new THREE.Mesh(g, material);
  mesh.name = "mist-veil";
  mesh.visible = false;
  return {
    mesh,
    /** 0: gone (not drawn), 1: fully there. */
    set(amount: number) {
      material.opacity = amount;
      mesh.visible = amount > 0.001;
    },
  };
}
