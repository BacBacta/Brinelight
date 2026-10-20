/**
 * The city's finish at full quality (style pass, with ?blender): what glows is only what shines brighter than the
 * sunlit walls, the grade warms the lights and cools the shadows a little, and it is done in three.js's own output pass.
 */
import { describe, expect, it } from "vitest";
import { BLOOM, GRADE, gradedOutput } from "../src/scene/post.js";

describe("the city's finish", () => {
  it("glows only around what shines brighter than a sunlit wall, softly", () => {
    expect(BLOOM.threshold).toBeGreaterThan(1.2);
    expect(BLOOM.strength).toBeLessThanOrEqual(0.5);
  });

  it("golden lights, slightly blue shadows, a little more contrast and color: never neon", () => {
    const [lr, , lb] = GRADE.lights;
    const [sr, , sb] = GRADE.shadows;
    expect(lr).toBeGreaterThan(lb);
    expect(sb).toBeGreaterThan(sr);
    for (const v of [...GRADE.lights, ...GRADE.shadows]) expect(Math.abs(v)).toBeLessThanOrEqual(0.04);
    expect(GRADE.contrast).toBeGreaterThan(1);
    expect(GRADE.contrast).toBeLessThanOrEqual(1.1);
    expect(GRADE.saturation).toBeLessThanOrEqual(1.1);
  });

  it("grades in the output pass, after the tone mapping and the screen's colors", () => {
    const shader = gradedOutput().material.fragmentShader;
    expect(shader).toContain("uniform float uContrast, uSaturation, uAmount;");
    const srgb = shader.indexOf("sRGBTransferOETF( gl_FragColor )");
    const grade = shader.indexOf("uContrast + .5");
    expect(srgb).toBeGreaterThan(0);
    expect(grade).toBeGreaterThan(srgb);
  });

  it("fades in: at 0, the screen's colors untouched by the grade", () => {
    const shader = gradedOutput().material.fragmentShader;
    expect(shader).toContain("mix(gl_FragColor.rgb, clamp(c, 0., 1.), uAmount)");
  });
});
