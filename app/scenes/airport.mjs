import { LAYER } from "../world.mjs";
import { block, build3DAirplane, build3DBunny, build3DCar, build3DFox, build3DHedgehog, build3DHuman, build3DPerchedBird, contactShadow, cylinder, facadeBlock, facadeTexture, fence, peak, put, rand, slab, sphere, surface } from "../scene-kit.mjs";

/** Static world for the `airport` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  const field = rand(59);
  // Airfield: mown grass everywhere, concrete only where aircraft actually roll.
  slab(THREE, scene, 2600, 2600, "#5c7a4e", [0, 0, -400], LAYER.far);
  // Main Concrete Runway (1800m x 55m)
  slab(THREE, scene, 1800, 55, "#1e293b", [0, 0.02, -260], LAYER.far);
  slab(THREE, scene, 1800, 75, "#556070", [0, 0.015, -260], LAYER.far);
  // Grass infield between the spotters' fence and the runway strip.
  for (let tuft = 0; tuft < 90; tuft += 1) {
    block(THREE, scene, [1.6 + field() * 2.4, 0.22, 1.4 + field() * 2.0], field() > 0.5 ? "#4f6f43" : "#688a55", [-260 + field() * 520, 0.11, -25 - field() * 190], LAYER.far);
  }
  // Parallel taxiway, its apron, and the yellow taxi guidance lines.
  slab(THREE, scene, 1500, 26, "#39424f", [0, 0.02, -330], LAYER.far);
  slab(THREE, scene, 1500, 0.9, "#facc15", [0, 0.035, -330], LAYER.far);
  slab(THREE, scene, 620, 90, "#39424f", [285, 0.02, -450], LAYER.far);
  for (const linkX of [-500, -180, 180, 500]) {
    slab(THREE, scene, 26, 70, "#39424f", [linkX, 0.02, -295], LAYER.far);
    slab(THREE, scene, 0.9, 70, "#facc15", [linkX, 0.035, -295], LAYER.far);
    slab(THREE, scene, 26, 52, "#39424f", [linkX + 40, 0.02, -356], LAYER.far, { spin: 0.3 });
  }
  for (const gateX of [175, 235, 295, 355, 415]) {
    slab(THREE, scene, 0.9, 60, "#facc15", [gateX, 0.035, -428], LAYER.far);
    slab(THREE, scene, 24, 0.5, "#f8fafc", [gateX, 0.035, -440], LAYER.far);
  }
  // Service road for ground vehicles, kept clear of the movement area.
  slab(THREE, scene, 900, 8, "#3f4652", [0, 0.02, -120], LAYER.far);
  for (let dash = -430; dash <= 430; dash += 24) slab(THREE, scene, 8, 0.4, "#e2e8f0", [dash, 0.035, -120], LAYER.far);
  // Runway Centerline Dashes
  for (let dash = -800; dash <= 800; dash += 45) {
    slab(THREE, scene, 25, 2.2, "#ffffff", [dash, 0.03, -260], LAYER.far, { spin: Math.PI / 2 });
  }
  // Runway Threshold Piano Keys at both ends
  for (const endX of [-780, 780]) {
    for (let k = -20; k <= 20; k += 4.5) {
      slab(THREE, scene, 28, 2.0, "#ffffff", [endX, 0.03, -260 + k], LAYER.far);
    }
  }
  // Runway Edge Lights
  for (let lightX = -800; lightX <= 800; lightX += 60) {
    sphere(THREE, scene, 0.35, "#ffffff", [lightX, 0.25, -288], LAYER.far, { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.8 });
    sphere(THREE, scene, 0.35, "#ffffff", [lightX, 0.25, -232], LAYER.far, { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.8 });
  }

  // Airport Passenger Terminal Building (Z = -450m)
  // The terminal sits off to one side. Squarely behind the runway it becomes a
  // wall of glass that fills every telephoto frame; from here the aircraft get
  // open sky behind them and the building still reads as the airport.
  facadeBlock(THREE, scene, [300, 21, 55], [285, 10.5, -520], LAYER.far, facadeTexture(THREE, { base: "#e2e8f0", frame: "#64748b", glass: "#0ea5e9", lit: 0.55, columns: 8, rows: 4, seed: 19 }), "#f1f5f9", null, [20, 2]);
  for (const jx of [175, 235, 295, 355, 415]) {
    block(THREE, scene, [6, 4, 30], "#cbd5e1", [jx, 8, -468], LAYER.far);
    cylinder(THREE, scene, 0.4, 0.4, 8, "#64748b", [jx, 4, -455], LAYER.far);
  }
  // Air Traffic Control (ATC) Tower
  cylinder(THREE, scene, 4.5, 6.0, 52, "#e2e8f0", [-240, 26, -420], LAYER.far, {}, 12);
  cylinder(THREE, scene, 8.5, 7.0, 8, "#0284c7", [-240, 52, -420], LAYER.far, { emissive: new THREE.Color("#0284c7"), emissiveIntensity: 0.8 }, 12);
  sphere(THREE, scene, 4.2, "#f8fafc", [-240, 58, -420], LAYER.far);

  // Perimeter Security Chain-Link Fence & Spotter Area (Z = -10m to -25m)
  fence(THREE, scene, [-35, -12], [35, -12], 2.2, "#64748b", LAYER.far, 3.0);
  // Warning placard, kept off the centre line so a 600 mm lens sees the runway.
  block(THREE, scene, [1.6, 0.8, 0.05], "#f59e0b", [-14, 1.6, -11.95], LAYER.far);

  // Raised spotter deck. The whole point of it is that the tripod ends up
  // above the perimeter fence, so the chain-link never crosses the frame at
  // any pitch. The runway side is open: railings run down the flanks and
  // across the back only, and the front edge carries no rail at all.
  block(THREE, scene, [13, 0.35, 13], "#94a3b8", [0, 4.22, 0], LAYER.far);
  block(THREE, scene, [13, 0.5, 0.5], "#78849a", [0, 4.15, -6.3], LAYER.far);
  for (const [lx, lz] of [[-5.8, -5.8], [5.8, -5.8], [-5.8, 5.8], [5.8, 5.8], [0, -5.8], [0, 5.8]]) {
    cylinder(THREE, scene, 0.22, 0.28, 4.05, "#64748b", [lx, 2.02, lz], LAYER.far, {}, 8);
  }
  for (const braceZ of [-5.8, 5.8]) block(THREE, scene, [11.6, 0.16, 0.16], "#64748b", [0, 2.2, braceZ], LAYER.far);
  for (const sideX of [-6.4, 6.4]) {
    // Flank railings stop level with the tripod and only run backwards, so no
    // part of them is ever in front of the lens however far it is yawed.
    for (let post = 0; post < 4; post += 1) cylinder(THREE, scene, 0.05, 0.05, 1.1, "#cbd5e1", [sideX, 4.95, 0.6 + post * 1.9], LAYER.far, {}, 6);
    block(THREE, scene, [0.07, 0.07, 6.1], "#cbd5e1", [sideX, 5.45, 3.4], LAYER.far);
    block(THREE, scene, [0.07, 0.07, 6.1], "#cbd5e1", [sideX, 4.9, 3.4], LAYER.far);
  }
  for (let post = 0; post < 7; post += 1) cylinder(THREE, scene, 0.05, 0.05, 1.1, "#cbd5e1", [-6.4 + post * 2.13, 4.95, 6.3], LAYER.far, {}, 6);
  block(THREE, scene, [13, 0.07, 0.07], "#cbd5e1", [0, 5.45, 6.3], LAYER.far);
  // Stair flight down off the back of the deck.
  for (let step = 0; step < 11; step += 1) {
    block(THREE, scene, [2.4, 0.14, 0.34], "#94a3b8", [0, 4.0 - step * 0.38, 6.9 + step * 0.36], LAYER.far);
  }
  // An information board and a seat at the back of the deck, behind the lens.
  block(THREE, scene, [2.4, 1.0, 0.09], "#e2e8f0", [3.6, 5.1, 5.9], LAYER.far, { rotation: [-0.45, 0, 0] });
  block(THREE, scene, [1.8, 0.09, 0.5], "#64748b", [-3.8, 4.85, 5.4], LAYER.far);
  for (const legX of [-4.6, -3.0]) block(THREE, scene, [0.1, 0.45, 0.45], "#475569", [legX, 4.62, 5.4], LAYER.far);

  // Airport Windsock on its mast, out by the runway where windsocks live.
  cylinder(THREE, scene, 0.06, 0.06, 4.5, "#e2e8f0", [-78, 2.25, -150], LAYER.far);
  cylinder(THREE, scene, 0.28, 0.14, 1.4, "#ea580c", [-77.4, 4.4, -150], LAYER.far, { rotation: [0, 0, Math.PI / 2] });

  // Approach light array leading up to the arrival threshold.
  for (let bar = 1; bar <= 14; bar += 1) {
    const bx = -800 - bar * 30;
    const barWidth = bar % 5 === 0 ? 22 : 9;
    cylinder(THREE, scene, 0.4, 0.6, 2.2 + bar * 0.55, "#475569", [bx, (2.2 + bar * 0.55) / 2, -260], LAYER.far, {}, 5);
    slab(THREE, scene, 1.6, barWidth, "#fefce8", [bx, 2.4 + bar * 0.55, -260], LAYER.far, { emissive: new THREE.Color("#fff7cc"), emissiveIntensity: 2.2 });
  }
  // Precision approach path indicator beside the touchdown zone.
  for (let papi = 0; papi < 4; papi += 1) {
    block(THREE, scene, [1.6, 1.1, 1.1], "#e2e8f0", [-700, 0.6, -300 - papi * 4], LAYER.far);
    block(THREE, scene, [0.2, 0.7, 0.7], papi < 2 ? "#ef4444" : "#f8fafc", [-700.9, 0.7, -300 - papi * 4], LAYER.far, { emissive: new THREE.Color(papi < 2 ? "#ef4444" : "#f8fafc"), emissiveIntensity: 2 });
  }
  // Glideslope antenna mast on the far side of the runway.
  cylinder(THREE, scene, 0.35, 0.5, 14, "#e2e8f0", [-690, 7, -212], LAYER.far, {}, 6);
  for (let dish = 0; dish < 3; dish += 1) block(THREE, scene, [0.4, 1.6, 2.6], "#f8fafc", [-690, 4 + dish * 4, -210], LAYER.far);
  block(THREE, scene, [8, 0.4, 8], "#94a3b8", [-690, 0.2, -212], LAYER.far);
  // Localiser array off the departure end.
  for (let element = 0; element < 12; element += 1) {
    cylinder(THREE, scene, 0.2, 0.24, 5, "#e2e8f0", [860, 2.5, -290 + element * 7], LAYER.far, {}, 5);
  }

  // Maintenance hangars along the western apron.
  for (const [hx, hz, hw] of [[-420, -430, 150], [-250, -430, 130]]) {
    block(THREE, scene, [hw, 34, 96], "#cbd5e1", [hx, 17, hz], LAYER.far);
    const roof = put(scene, new THREE.Mesh(new THREE.CylinderGeometry(52, 52, hw, 14, 1, false, 0, Math.PI), surface(THREE, "#94a3b8")), LAYER.far, [hx, 34, hz], [0, 0, Math.PI / 2]);
    roof.updateMatrix();
    block(THREE, scene, [hw * 0.8, 26, 1.2], "#64748b", [hx, 13, hz + 48.5], LAYER.far);
    for (let panel = 0; panel < 6; panel += 1) block(THREE, scene, [hw * 0.12, 24, 0.4], "#475569", [hx - hw * 0.35 + panel * hw * 0.14, 13, hz + 49.2], LAYER.far);
  }
  slab(THREE, scene, 420, 120, "#39424f", [-340, 0.02, -360], LAYER.far);

  // Rotating beacon tower beside the control tower.
  cylinder(THREE, scene, 0.6, 1.0, 26, "#e2e8f0", [-210, 13, -404], LAYER.far, {}, 8);
  block(THREE, scene, [3.4, 2.0, 1.6], "#334155", [-210, 27, -404], LAYER.far);
  block(THREE, scene, [1.2, 1.2, 0.3], "#4ade80", [-210, 27, -403.1], LAYER.far, { emissive: new THREE.Color("#4ade80"), emissiveIntensity: 3 });
  block(THREE, scene, [1.2, 1.2, 0.3], "#f8fafc", [-210, 27, -404.9], LAYER.far, { emissive: new THREE.Color("#f8fafc"), emissiveIntensity: 3 });

  // Radar and perimeter service kit.
  for (let post = 0; post < 22; post += 1) {
    cylinder(THREE, scene, 0.14, 0.18, 3.4, "#94a3b8", [-320 + post * 30, 1.7, -228], LAYER.far, {}, 5);
    sphere(THREE, scene, 0.22, "#f8fafc", [-320 + post * 30, 3.4, -228], LAYER.far, { emissive: new THREE.Color("#fef3c7"), emissiveIntensity: 1.4 }, 6, 5);
  }

  // Parked Commercial Jetliner at terminal gate (Z = -360m)
  const parkedPlane = build3DAirplane(THREE, "#ffffff", "#0284c7");
  put(scene, parkedPlane, LAYER.far, [235, 1.63, -430], [0, Math.PI / 2, 0]);

  // Ground handling around the parked jet: stairs, fuel bowser, belt loader, cones.
  block(THREE, scene, [4.4, 0.4, 2.4], "#e2e8f0", [225.0, 0.5, -423.0], LAYER.far);
  for (let stair = 0; stair < 9; stair += 1) block(THREE, scene, [0.6, 0.16, 2.2], "#cbd5e1", [227.4 + stair * 0.62, 0.9 + stair * 0.42, -423], LAYER.far);
  block(THREE, scene, [5.6, 0.9, 0.12], "#94a3b8", [228.5, 3.2, -421.9], LAYER.far, { rotation: [0, 0, 0.6] });
  for (const wheelX of [224.2, 231.6]) cylinder(THREE, scene, 0.35, 0.35, 0.3, "#1e293b", [wheelX, 0.32, -423], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 10);
  block(THREE, scene, [7.5, 1.8, 2.6], "#f8fafc", [245.0, 1.3, -422.0], LAYER.far);
  cylinder(THREE, scene, 1.3, 1.3, 6.2, "#e2e8f0", [246.5, 2.2, -422.0], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 12);
  block(THREE, scene, [2.4, 1.9, 2.4], "#0284c7", [240.4, 1.3, -422.0], LAYER.far);
  for (const [wx, wz] of [[241, -420.9], [241, -423.1], [247.5, -420.9], [247.5, -423.1]]) cylinder(THREE, scene, 0.45, 0.45, 0.4, "#1e293b", [wx, 0.45, wz], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 10);
  for (let cone = 0; cone < 10; cone += 1) {
    peak(THREE, scene, 0.24, 0.7, "#f97316", [223 + cone * 3.2, 0.35, -437], LAYER.far, 5);
  }
  for (let dolly = 0; dolly < 4; dolly += 1) {
    block(THREE, scene, [2.6, 0.5, 1.5], "#475569", [219 - dolly * 3.2, 0.55, -438], LAYER.far);
    block(THREE, scene, [2.2, 0.9, 1.3], "#cbd5e1", [219 - dolly * 3.2, 1.2, -438], LAYER.far);
  }

  // Ground crew, marshalling where ground crew actually stand.
  const marshaller = build3DHuman(THREE, { pose: "stand", top: "#facc15", bottom: "#1f2937", hair: "#1c1917", hat: "#f97316", layer: LAYER.far });
  put(scene, marshaller, LAYER.far, [221, 0.03, -442], [0, -1.5, 0]);
  const spotter = build3DHuman(THREE, { pose: "stand", top: "#0ea5e9", bottom: "#334155", hair: "#4a2e1b", hat: "#1d4ed8", layer: LAYER.near, prop: "camera" });
  put(scene, spotter, LAYER.near, [-4.4, 4.42, 4.6], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.3, 0.24, LAYER.near).position.set(-4.4, 4.43, 4.6);

  // Static wildlife
  const securityHawk = build3DPerchedBird(THREE, "#475569", "#f59e0b");
  put(scene, securityHawk, LAYER.far, [16.5, 2.25, -12], [0, -0.4, 0]);
  const runwayBunny = build3DBunny(THREE, "#d1d5db");
  put(scene, runwayBunny, LAYER.far, [-6.5, 0.02, -18], [0, 0.5, 0]);
  contactShadow(THREE, scene, 0.25).position.set(-6.5, 0.03, -18);

  const perimeterFox = build3DFox(THREE, "#c2410c");
  put(scene, perimeterFox, LAYER.far, [24, 0.03, -36], [0, -0.8, 0]);
  contactShadow(THREE, scene, 0.3).position.set(24, 0.04, -36);

  const grassHedgehog = build3DHedgehog(THREE, "#57534e");
  put(scene, grassHedgehog, LAYER.far, [-21, 0.03, -27], [0, 0.5, 0]);
  contactShadow(THREE, scene, 0.16).position.set(-21, 0.04, -27);

  return {};
}

/** The photographable subjects of `airport`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const plane1 = build3DAirplane(THREE, "#f8fafc", "#2563eb"); scene.add(plane1);
  const plane2 = build3DAirplane(THREE, "#ffffff", "#dc2626"); scene.add(plane2);
  const tug = build3DCar(THREE, "#f59e0b"); scene.add(tug);

  subjects.push(plane1, plane2, tug);
  shadows.push(contactShadow(THREE, scene, 1.2), contactShadow(THREE, scene, 1.2), contactShadow(THREE, scene, 0.5));
}
