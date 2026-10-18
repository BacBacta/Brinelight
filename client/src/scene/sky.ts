import * as THREE from "three";

export type Sky = {
  texture: THREE.CanvasTexture;
  /** Draws the gradient again (top, middle, horizon). */
  paint(colors: readonly [string, string, string]): void;
};

/** A vertical gradient drawn on a small canvas, used as the scene background. */
export function createSky(colors: readonly [string, string, string]): Sky {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const paint = (colors: readonly [string, string, string]) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, colors[0]);
    gr.addColorStop(0.55, colors[1]);
    gr.addColorStop(1, colors[2]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    texture.needsUpdate = true;
  };
  paint(colors);
  return { texture, paint };
}
