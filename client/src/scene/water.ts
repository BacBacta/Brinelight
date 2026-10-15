import * as THREE from "three";

export type Water = { mesh: THREE.Mesh; setTime(seconds: number): void };

/** A wide plane whose vertices move as small waves over time (shader copied from the prototype). */
export function createWater(size: number, color: THREE.ColorRepresentation): Water {
  const uT = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.08 });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader =
      "uniform float uT;\n" +
      sh.vertexShader
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nfloat w=sin(position.x*.5+uT*1.2)*.07+cos(position.y*.4+uT*.9)*.07+sin((position.x+position.y)*.9+uT*2.)*.03;transformed.z+=w;",
        )
        .replace(
          "#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\nobjectNormal=normalize(vec3(-cos(position.x*.5+uT*1.2)*.035,sin(position.y*.4+uT*.9)*.03,1.));",
        );
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 140, 140), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.42;
  return { mesh, setTime: (s) => (uT.value = s) };
}
