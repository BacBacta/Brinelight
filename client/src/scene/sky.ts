import * as THREE from "three";

/** Vertical gradient drawn on a small canvas, used as the scene background. */
export function skyTexture(top: string, mid: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, mid);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function addCitySky(scene: THREE.Scene): void {
  scene.background = skyTexture("#5DB4EC", "#A8DDF7", "#E8F6FF");
  scene.fog = new THREE.Fog("#CFEBFB", 30, 70);
}
