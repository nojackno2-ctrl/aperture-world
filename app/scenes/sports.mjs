import { LAYER } from "../world.mjs";
import { bench, block, build3DHedgehog, build3DHuman, build3DLyingDog, build3DPerchedBird, build3DRaccoon, build3DSittingDog, contactShadow, cylinder, peak, put, rand, slab, surface } from "../scene-kit.mjs";

/** Static world for the `sports` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  const stand = rand(17);
  slab(THREE, scene, 900, 900, "#4d8049", [0, -0.02, -60], LAYER.far);

  // A real athletics oval. Every band is a ring stretched twice as wide as it
  // is deep, which is also exactly the ellipse the runners' lane routes trace,
  // so an athlete always has concrete under both feet on the bends.
  // The tripod is up in the near grandstand, so the track sits far enough back
  // that looking down at it stays a comfortable angle.
  const TRACK_CENTRE = -32.5, LANE_WIDTH = 1.6, INNER_RADIUS = 11.2;
  const TRACK_EDGE = TRACK_CENTRE + INNER_RADIUS + LANE_WIDTH * 8 + 1.4;
  const ovalBand = (inner, outer, color, y, material = {}) => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), surface(THREE, color, { side: THREE.DoubleSide, ...material }));
    mesh.scale.set(2, 1, 1);
    return put(scene, mesh, LAYER.far, [0, y, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);
  };
  const ovalDisc = (radius, color, y, material = {}) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), surface(THREE, color, { side: THREE.DoubleSide, ...material }));
    mesh.scale.set(2, 1, 1);
    return put(scene, mesh, LAYER.far, [0, y, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);
  };
  ovalBand(INNER_RADIUS - 1.0, INNER_RADIUS + LANE_WIDTH * 8 + 1.4, "#c76a4b", 0.01);
  ovalDisc(INNER_RADIUS - 0.6, "#5b9350", 0.012);
  for (let line = 0; line <= 8; line += 1) {
    const r = INNER_RADIUS + line * LANE_WIDTH;
    ovalBand(r - 0.06, r + 0.06, "#f4f1e8", 0.03);
  }
  ovalBand(INNER_RADIUS - 1.0, INNER_RADIUS - 0.85, "#f8fafc", 0.03);
  // Football pitch inside the oval, with its own markings.
  ovalDisc(INNER_RADIUS - 2.6, "#4d8f45", 0.014);
  slab(THREE, scene, 0.24, 18, "#eef2e6", [0, 0.02, TRACK_CENTRE], LAYER.far);
  const centreCircle = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.05, 48), surface(THREE, "#eef2e6", { side: THREE.DoubleSide }));
  put(scene, centreCircle, LAYER.far, [0, 0.02, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);

  // The near apex is where the field sweeps closest to the tripod, so nothing
  // tall is allowed to stand there: only paint. Staggered start marks per lane.
  for (let lane = 0; lane < 8; lane += 1) {
    const mz = TRACK_CENTRE + INNER_RADIUS + LANE_WIDTH * (lane + 0.5);
    slab(THREE, scene, 0.26, LANE_WIDTH * 0.9, "#f4f1e8", [1.0 + lane * 1.4, 0.04, mz], LAYER.far);
    slab(THREE, scene, 0.5, 0.5, "#f8fafc", [2.2 + lane * 1.4, 0.04, mz], LAYER.far);
  }

  // Finish line, gantry, sponsor banner and timing beams sit on the western
  // straight, off to the side, so nothing tall ever stands on the sight line
  // down the middle of the track.
  const finishX = -(INNER_RADIUS + LANE_WIDTH * 4) * 2;
  slab(THREE, scene, LANE_WIDTH * 16, 0.42, "#f8fafc", [finishX, 0.04, TRACK_CENTRE], LAYER.far);
  for (const gx of [finishX + 14.4, finishX - 14.4]) {
    cylinder(THREE, scene, 0.24, 0.3, 7.2, "#cbd5e1", [gx, 3.6, TRACK_CENTRE], LAYER.far, {}, 8);
    block(THREE, scene, [0.9, 0.16, 0.9], "#94a3b8", [gx, 0.08, TRACK_CENTRE], LAYER.far);
    block(THREE, scene, [0.3, 0.24, 0.24], "#0f172a", [gx > finishX ? gx - 0.5 : gx + 0.5, 1.15, TRACK_CENTRE], LAYER.far);
  }
  block(THREE, scene, [30.0, 0.5, 0.6], "#cbd5e1", [finishX, 7.1, TRACK_CENTRE], LAYER.far);
  block(THREE, scene, [27.6, 1.9, 0.22], "#dc2626", [finishX, 6.0, TRACK_CENTRE + 0.1], LAYER.far);
  block(THREE, scene, [22.8, 0.9, 0.06], "#f8fafc", [finishX, 6.0, TRACK_CENTRE + 0.25], LAYER.far);
  block(THREE, scene, [27.6, 0.34, 0.3], "#facc15", [finishX, 4.95, TRACK_CENTRE + 0.1], LAYER.far);
  const finishZ = TRACK_CENTRE;
  // Spare starting blocks stacked in the infield, out of everyone's way.
  for (let spare = 0; spare < 4; spare += 1) {
    block(THREE, scene, [1.1, 0.09, 0.42], "#e2e8f0", [-6 + spare * 1.4, 0.06 + spare * 0.02, TRACK_CENTRE - 7], LAYER.far);
    block(THREE, scene, [0.16, 0.3, 0.52], "#1d4ed8", [-6.3 + spare * 1.4, 0.2, TRACK_CENTRE - 7], LAYER.far, { rotation: [0, 0, 0.5] });
  }

  // Far grandstand across the track: rake, seat bands, tunnels, cantilever roof.
  {
    const standZ = TRACK_CENTRE - 34;
    for (let tier = 0; tier < 12; tier += 1) {
      const z = standZ - tier * 1.6;
      block(THREE, scene, [176, 1.0 + tier * 0.9, 1.6], "#5b6577", [0, (1.0 + tier * 0.9) / 2, z], LAYER.far);
      for (let bay = 0; bay < 22; bay += 1) {
        const roll = (bay + tier + Math.floor(stand() * 3)) % 5;
        const seatColor = roll < 2 ? "#dc2626" : roll < 4 ? "#1d4ed8" : "#f1f5f9";
        block(THREE, scene, [7.2, 0.34, 1.44], seatColor, [-84 + bay * 8, 1.05 + tier * 0.9, z], LAYER.far);
      }
    }
    for (const tunnelX of [-58, 0, 58]) block(THREE, scene, [4.4, 2.4, 3.2], "#334155", [tunnelX, 1.2, standZ - 1.1], LAYER.far);
    for (let column = 0; column < 9; column += 1) {
      cylinder(THREE, scene, 0.3, 0.36, 18, "#94a3b8", [-80 + column * 20, 9, standZ - 19.4], LAYER.far, {}, 6);
    }
    block(THREE, scene, [176, 0.7, 21], "#e2e8f0", [0, 18.0, standZ - 10], LAYER.far);
    block(THREE, scene, [176, 1.5, 1.4], "#cbd5e1", [0, 17.2, standZ + 0.6], LAYER.far);
  }

  // The near grandstand is the one the tripod stands in. Its rows RISE behind
  // the camera and FALL away in front of it, so the photographer looks over
  // the heads below instead of into the back of a seat: nothing this stand is
  // made of ever crosses the lens. There is deliberately no front railing.
  // A 35 degree rake, not a gentle one: at this angle the rows in front of the
  // tripod drop away faster than the lens can look down, so the seating below
  // never climbs into the frame.
  const STAND_FRONT = TRACK_EDGE, ROW_RISE = 0.9, ROW_DEPTH = 1.3, FRONT_ROW_Y = 1.0;
  for (let row = 0; row < 20; row += 1) {
    const rz = STAND_FRONT + row * ROW_DEPTH, ry = FRONT_ROW_Y + row * ROW_RISE;
    block(THREE, scene, [176, ry, ROW_DEPTH], "#5b6577", [0, ry / 2, rz + ROW_DEPTH / 2], LAYER.far);
    for (let bay = 0; bay < 22; bay += 1) {
      // The rows the camera itself occupies stay empty; seats there would be
      // level with the lens.
      if (row >= 4 && row <= 6 && Math.abs(-84 + bay * 8) < 12) continue;
      const roll = (bay + row + Math.floor(stand() * 3)) % 5;
      const seatColor = roll < 2 ? "#dc2626" : roll < 4 ? "#1d4ed8" : "#f1f5f9";
      block(THREE, scene, [7.2, 0.34, 1.16], seatColor, [-84 + bay * 8, ry + 0.17, rz + 0.7], LAYER.far);
    }
  }
  // Retaining wall from the front row down to the track apron, so the stand
  // meets the ground instead of ending in a floating lip.
  block(THREE, scene, [176, FRONT_ROW_Y, 0.6], "#4a5364", [0, FRONT_ROW_Y / 2, STAND_FRONT - 0.3], LAYER.far);
  // Spectators, but only out towards the wings where they cannot mask the track.
  for (let fan = 0; fan < 14; fan += 1) {
    const side = fan % 2 ? 1 : -1;
    const row = 1 + (fan % 5);
    const seated = build3DHuman(THREE, {
      pose: "sit", height: 1.44,
      top: ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc", "#c084fc", "#0ea5e9"][fan % 7],
      bottom: "#1f2937", hair: ["#1c1917", "#4a2e1b", "#7c2d12", "#111827", "#a16207"][fan % 5],
      skin: ["#f0c9a4", "#c68642", "#8d5524", "#e8b98a", "#f5d0a9", "#e0ac69"][fan % 6],
      layer: LAYER.far,
    });
    put(scene, seated, LAYER.far, [side * (16 + (fan % 6) * 7), FRONT_ROW_Y + row * ROW_RISE, STAND_FRONT + row * ROW_DEPTH + 0.5], [0, Math.PI, 0]);
  }
  // End stands closing the oval at both ends.
  for (const endX of [-62, 62]) {
    for (let tier = 0; tier < 8; tier += 1) {
      block(THREE, scene, [1.6, 1.0 + tier * 0.9, 62], endX < 0 ? "#586274" : "#5b6577", [endX + Math.sign(endX) * tier * 1.6, (1.0 + tier * 0.9) / 2, TRACK_CENTRE], LAYER.far);
      for (let bay = 0; bay < 8; bay += 1) {
        const seatColor = ((bay + tier) % 4) < 2 ? "#1d4ed8" : "#f1f5f9";
        block(THREE, scene, [1.44, 0.34, 6.6], seatColor, [endX + Math.sign(endX) * tier * 1.6, 1.05 + tier * 0.9, TRACK_CENTRE - 26 + bay * 7.4], LAYER.far);
      }
    }
  }

  // Floodlight towers at the four corners.
  for (const [fx, fz] of [[-72, -92], [72, -92], [-72, 30], [72, 30]]) {
    cylinder(THREE, scene, 0.6, 1.1, 38, "#64748b", [fx, 19, fz], LAYER.far, {}, 8);
    block(THREE, scene, [11, 5.5, 1.2], "#475569", [fx, 39.5, fz], LAYER.far);
    for (let lampRow = 0; lampRow < 3; lampRow += 1) {
      for (let lampColumn = 0; lampColumn < 7; lampColumn += 1) {
        block(THREE, scene, [1.2, 1.2, 0.24], "#fefce8", [fx - 4.5 + lampColumn * 1.5, 38.0 + lampRow * 1.6, fz + (fz > 0 ? -0.7 : 0.7)], LAYER.far, { emissive: new THREE.Color("#fff7cc"), emissiveIntensity: 1.4 });
      }
    }
  }

  // Jumbotron and scoreboard beyond the back straight.
  for (const sx of [-11, 11]) cylinder(THREE, scene, 0.7, 0.7, 26, "#374151", [sx, 13, -100], LAYER.far);
  block(THREE, scene, [26, 11, 1.4], "#1f2937", [0, 27, -100], LAYER.far);
  block(THREE, scene, [23.4, 8.6, 0.2], "#0f172a", [0, 27.6, -99.2], LAYER.far, { emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.9 });
  block(THREE, scene, [23.4, 1.1, 0.2], "#0f172a", [0, 22.6, -99.2], LAYER.far, { emissive: new THREE.Color("#facc15"), emissiveIntensity: 1.3 });

  // Flag line along the back of the arena.
  for (let flag = 0; flag < 18; flag += 1) {
    const fx = -68 + flag * 8;
    cylinder(THREE, scene, 0.07, 0.09, 9, "#e2e8f0", [fx, 4.5, -112], LAYER.far, {}, 5);
    block(THREE, scene, [1.7, 1.1, 0.06], ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc"][flag % 5], [fx + 0.9, 8.3, -112], LAYER.far);
  }

  // Trackside kit: team benches, a water station, hurdles and marker cones,
  // all inside the infield where they cannot trip anybody up.
  for (let seat = 0; seat < 5; seat += 1) bench(THREE, scene, [-22 + seat * 2.6, TRACK_CENTRE + 8.6], LAYER.far, { seat: "#1d4ed8", leg: "#334155" });
  block(THREE, scene, [1.5, 0.9, 0.7], "#0ea5e9", [22, 0.45, TRACK_CENTRE + 7.5], LAYER.far);
  block(THREE, scene, [1.3, 0.14, 0.5], "#e0f2fe", [22, 0.97, TRACK_CENTRE + 7.5], LAYER.far);
  for (let bottle = 0; bottle < 6; bottle += 1) cylinder(THREE, scene, 0.05, 0.05, 0.24, "#f8fafc", [21.5 + bottle * 0.2, 1.12, TRACK_CENTRE + 7.5], LAYER.far, {}, 6);
  for (let hurdle = 0; hurdle < 6; hurdle += 1) {
    const hx = -24 + hurdle * 2.4, hz = TRACK_CENTRE - 8.5;
    block(THREE, scene, [0.1, 0.06, 1.1], "#f8fafc", [hx, 0.85, hz], LAYER.far);
    block(THREE, scene, [0.06, 0.85, 0.06], "#334155", [hx, 0.42, hz - 0.5], LAYER.far);
    block(THREE, scene, [0.06, 0.85, 0.06], "#334155", [hx, 0.42, hz + 0.5], LAYER.far);
  }
  cylinder(THREE, scene, 3.2, 3.2, 0.08, "#94a3b8", [-34, 0.05, TRACK_CENTRE + 4], LAYER.far, {}, 16);
  for (let cone = 0; cone < 16; cone += 1) {
    // Offset so no cone parks itself exactly on the camera's sight line.
    const coneAngle = cone * Math.PI / 8 + 0.19;
    peak(THREE, scene, 0.16, 0.42, "#f97316", [Math.cos(coneAngle) * 19.6, 0.21, TRACK_CENTRE + Math.sin(coneAngle) * 9.8], LAYER.far, 5);
  }

  // Officials and a coach, standing where officials actually stand.
  const starter = build3DHuman(THREE, { pose: "stand", top: "#f8fafc", bottom: "#1f2937", hair: "#1c1917", hat: "#dc2626", layer: LAYER.far });
  put(scene, starter, LAYER.far, [-2.0, 0.02, TRACK_CENTRE - INNER_RADIUS + 2.4], [0, 3.0, 0]);
  contactShadow(THREE, scene, 0.32).position.set(-2.0, 0.03, TRACK_CENTRE - INNER_RADIUS + 2.4);
  const judge = build3DHuman(THREE, { pose: "stand", top: "#facc15", bottom: "#334155", hair: "#4a2e1b", glasses: true, layer: LAYER.far });
  put(scene, judge, LAYER.far, [finishX + 1.4, 0.02, TRACK_CENTRE + 3.0], [0, -1.5, 0]);
  contactShadow(THREE, scene, 0.32).position.set(finishX + 1.4, 0.03, TRACK_CENTRE + 3.0);
  const coach = build3DHuman(THREE, { pose: "stand", top: "#0f766e", bottom: "#1f2937", hair: "#111827", hat: "#0f172a", layer: LAYER.far });
  put(scene, coach, LAYER.far, [-9.0, 0.02, TRACK_CENTRE + 8.0], [0, 0.2, 0]);
  contactShadow(THREE, scene, 0.32).position.set(-9.0, 0.03, TRACK_CENTRE + 8.0);
  const photographer = build3DHuman(THREE, { pose: "stand", top: "#0f172a", bottom: "#1f2937", hair: "#111827", layer: LAYER.near, prop: "camera" });
  put(scene, photographer, LAYER.near, [-5.6, 0.02, -9.6], [0, 3.0, 0]);
  contactShadow(THREE, scene, 0.32, 0.24, LAYER.near).position.set(-5.6, 0.03, -9.6);

  // Static animals
  const mascotDog = build3DSittingDog(THREE, "#d97706");
  put(scene, mascotDog, LAYER.near, [5.4, 0.02, -9.4], [0, -0.5, 0]);
  contactShadow(THREE, scene, 0.35, 0.24, LAYER.near).position.set(5.4, 0.03, -9.4);

  const restingDog = build3DLyingDog(THREE, "#f59e0b");
  put(scene, restingDog, LAYER.far, [-14, 0.02, TRACK_CENTRE + 5], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.4).position.set(-14, 0.03, TRACK_CENTRE + 5);

  const pigeon1 = build3DPerchedBird(THREE, "#64748b");
  put(scene, pigeon1, LAYER.far, [finishX - 6, 7.35, finishZ], [0, 1.5, 0]);
  const pigeon2 = build3DPerchedBird(THREE, "#475569");
  put(scene, pigeon2, LAYER.far, [finishX + 7, 7.35, finishZ], [0, -1.5, 0]);

  const standRaccoon = build3DRaccoon(THREE, "#64748b");
  put(scene, standRaccoon, LAYER.far, [-50, 0.03, TRACK_CENTRE - 27], [0, 0.7, 0]);
  contactShadow(THREE, scene, 0.22).position.set(-50, 0.04, TRACK_CENTRE - 27);

  const infieldHedgehog = build3DHedgehog(THREE, "#44403c");
  put(scene, infieldHedgehog, LAYER.far, [31, 0.03, TRACK_CENTRE + 7.5], [0, -0.5, 0]);
  contactShadow(THREE, scene, 0.16).position.set(31, 0.04, TRACK_CENTRE + 7.5);
  for (let spectator = 0; spectator < 6; spectator += 1) {
    const fan = build3DHuman(THREE, {
      pose: "stand", height: 1.44,
      top: ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc", "#c084fc"][spectator],
      bottom: "#1f2937", hair: ["#1c1917", "#4a2e1b", "#7c2d12", "#111827", "#a16207", "#0f172a"][spectator],
      skin: ["#f0c9a4", "#c68642", "#8d5524", "#e8b98a", "#f5d0a9", "#e0ac69"][spectator],
      layer: LAYER.far,
    });
    put(scene, fan, LAYER.far, [-30 + spectator * 12, 1.92, TRACK_CENTRE - 35.6], [0, 0, 0]);
  }

  return {};
}

/** The photographable subjects of `sports`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  // Five sprinters, one per lane, each in a different club vest.
  const kit = [
    { top: "#f8fafc", bottom: "#1d4ed8", skin: "#f0c9a4", hair: "#2a1d14" },
    { top: "#ef4444", bottom: "#111827", skin: "#8d5524", hair: "#0f172a" },
    { top: "#3b82f6", bottom: "#1e293b", skin: "#e8b98a", hair: "#7c2d12" },
    { top: "#10b981", bottom: "#0f172a", skin: "#c68642", hair: "#1c1917" },
    { top: "#f59e0b", bottom: "#334155", skin: "#f5d0a9", hair: "#a16207" },
  ];
  for (let index = 0; index < 5; index += 1) {
    const runner = build3DHuman(THREE, { ...kit[index], pose: "run", height: 1.52, sleeves: false, bare: true, shoes: "#f8fafc" });
    scene.add(runner);
    subjects.push(runner);
    shadows.push(contactShadow(THREE, scene, 0.5));
  }
}
