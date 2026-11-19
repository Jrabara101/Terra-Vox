import * as THREE from 'three';
import {
  BlockId,
  DIMENSION_PRESETS,
  DimensionId,
  PORTAL_DESTINATIONS,
  PortalDestinationId,
  VillagePlot,
} from './types';
import { VoxelGrid, WATER_LEVEL } from './voxelGrid';

export interface PortalCoords {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface HugePortalVisual {
  group: THREE.Group;
  vortexMat: THREE.ShaderMaterial;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  crownCrystal: THREE.Mesh;
  beaconMesh: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  pointLight: THREE.PointLight;
  dispose: () => void;
}

export function pickRandomPortalDestination(
  currentDimension: DimensionId,
  rng: () => number = Math.random
): PortalDestinationId {
  const pool = PORTAL_DESTINATIONS.filter((d) => d !== currentDimension);
  const candidates = pool.length > 0 ? pool : PORTAL_DESTINATIONS;
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx];
}

function overlapsPlot(x: number, z: number, plots: VillagePlot[], margin = 6): boolean {
  for (const p of plots) {
    const halfW = p.width * 0.5 + margin;
    const halfD = p.depth * 0.5 + margin;
    if (Math.abs(x - p.centerX) <= halfW && Math.abs(z - p.centerZ) <= halfD) {
      return true;
    }
  }
  return false;
}

/**
 * Scrambles the huge portal's XYZ position around an anchor coordinate while keeping
 * it on dry, solid terrain clear of spawn and village buildings.
 */
export function scramblePortalPosition(
  grid: VoxelGrid,
  anchorX: number,
  anchorZ: number,
  plots: VillagePlot[] = [],
  prevPos?: { x: number; y: number; z: number } | null,
  rng: () => number = Math.random,
  minRadius = 11,
  maxRadius = 24
): PortalCoords {
  const attempts = 64;
  for (let i = 0; i < attempts; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = minRadius + rng() * Math.max(2, maxRadius - minRadius);
    const rawX = Math.round(anchorX + Math.cos(angle) * radius);
    const rawZ = Math.round(anchorZ + Math.sin(angle) * radius);

    const cx = grid.isEndless ? rawX : Math.max(7, Math.min(grid.sizeX - 8, rawX));
    const cz = grid.isEndless ? rawZ : Math.max(7, Math.min(grid.sizeZ - 8, rawZ));

    if (Math.hypot(cx - anchorX, cz - anchorZ) < 8.5) continue;
    if (prevPos && Math.hypot(cx - prevPos.x, cz - prevPos.z) < 6.5) continue;
    if (overlapsPlot(cx, cz, plots, 6)) continue;

    if (grid.isEndless && !grid.hasSectorAt(cx, cz)) continue;

    const sy = grid.getSurfaceY(cx, cz, false);
    const below = grid.getBlock(cx, sy - 1, cz);
    if (below === BlockId.Water || below === BlockId.Lava || sy - 1 <= WATER_LEVEL) {
      continue;
    }
    if (sy > grid.sizeY - 14) continue;

    // Avoid deep pits where surrounding terrain blocks the portal vista
    const n1 = grid.getSurfaceY(cx + 4, cz, false);
    const n2 = grid.getSurfaceY(cx - 4, cz, false);
    const n3 = grid.getSurfaceY(cx, cz + 4, false);
    const n4 = grid.getSurfaceY(cx, cz - 4, false);
    if (Math.max(n1, n2, n3, n4) > sy + 3) continue;

    const yaw = Math.atan2(anchorX - cx, anchorZ - cz);
    return { x: cx, y: sy, z: cz, yaw };
  }

  // Fallback guaranteed safe offset
  const fallbackX = Math.round(anchorX + 12);
  const fallbackZ = Math.round(anchorZ - 12);
  const sy = Math.min(grid.sizeY - 14, grid.getSurfaceY(fallbackX, fallbackZ, false));
  return {
    x: fallbackX,
    y: sy,
    z: fallbackZ,
    yaw: Math.atan2(anchorX - fallbackX, anchorZ - fallbackZ),
  };
}

/**
 * Clears a previously placed huge portal structure cleanly back to walkable ground.
 */
export function clearHugePortalStructure(
  grid: VoxelGrid,
  cx: number,
  baseY: number,
  cz: number,
  groundBlock: BlockId = BlockId.Grass
): void {
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 11; dy++) {
        const cur = grid.getBlock(cx + dx, baseY + dy, cz + dz);
        if (
          cur === BlockId.PortalStone ||
          cur === BlockId.GoldOre ||
          cur === BlockId.Lantern ||
          cur === BlockId.Cobblestone ||
          cur === BlockId.DungeonSlate ||
          cur === BlockId.Basalt
        ) {
          grid.setBlock(cx + dx, baseY + dy, cz + dz, BlockId.Air, false);
        }
      }
      if (grid.getBlock(cx + dx, baseY - 1, cz + dz) === BlockId.PortalStone) {
        grid.setBlock(cx + dx, baseY - 1, cz + dz, groundBlock, true);
      }
    }
  }
}

/**
 * Builds a monumental 9x11x5 carved obsidian & gilded rune voxel gateway
 * anchored solidly to the terrain with a walkable 5x7 interior portal mouth.
 */
export function buildHugePortalStructure(
  grid: VoxelGrid,
  cx: number,
  baseY: number,
  cz: number,
  daisBlock: BlockId = BlockId.Cobblestone
): void {
  // 0. Clear surrounding tree canopies / overhangs around the portal plaza
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let dy = 0; dy <= 12; dy++) {
        const cur = grid.getBlock(cx + dx, baseY + dy, cz + dz);
        if (
          cur !== BlockId.Air &&
          cur !== BlockId.Bedrock &&
          (Math.abs(dx) <= 4 && Math.abs(dz) <= 3 ||
            cur === BlockId.OakLog ||
            cur === BlockId.OakLeaves ||
            cur === BlockId.BlossomLeaves ||
            cur === BlockId.PalmWood ||
            cur === BlockId.PalmLeaves)
        ) {
          grid.setBlock(cx + dx, baseY + dy, cz + dz, BlockId.Air, false);
        }
      }
    }
  }

  // 1. Solid foundation + stepped 9x5 walkable dais
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      // Fill beneath dais so slopes never leave floating overhang
      for (let down = 1; down <= 4; down++) {
        const y = baseY - down;
        if (y >= 1 && !grid.isSolid(cx + dx, y, cz + dz)) {
          grid.setBlock(cx + dx, y, cz + dz, daisBlock, true);
        }
      }

      const isRim = Math.abs(dx) === 4 || Math.abs(dz) === 2;
      const topPad = isRim ? daisBlock : BlockId.PortalStone;
      grid.setBlock(cx + dx, baseY - 1, cz + dz, topPad, true);

      // Clear interior airspace up to portal crown so doorway is unobstructed
      for (let dy = 0; dy <= 10; dy++) {
        grid.setBlock(cx + dx, baseY + dy, cz + dz, BlockId.Air, false);
      }
    }
  }

  // Walk-up steps on +Z and -Z faces
  for (let dx = -2; dx <= 2; dx++) {
    grid.setBlock(cx + dx, baseY, cz + 2, BlockId.Air, false);
    grid.setBlock(cx + dx, baseY, cz - 2, BlockId.Air, false);
  }

  // 2. Twin massive 2-block-thick pillars (dy = 0..8)
  for (let dy = 0; dy <= 8; dy++) {
    for (const px of [-4, -3, 3, 4]) {
      for (const pz of [-1, 0, 1]) {
        const isCoreVein =
          (px === -3 || px === 3) && pz === 0 && (dy === 2 || dy === 5 || dy === 8);
        const block = isCoreVein ? BlockId.GoldOre : BlockId.PortalStone;
        grid.setBlock(cx + px, baseY + dy, cz + pz, block, true);
      }
    }
  }

  // 3. Stepped monumental arch lintel (dy = 8..10)
  for (let dx = -4; dx <= 4; dx++) {
    for (const pz of [-1, 0, 1]) {
      if (Math.abs(dx) <= 3) {
        const isKeystone = dx === 0 && pz === 0;
        grid.setBlock(
          cx + dx,
          baseY + 8,
          cz + pz,
          isKeystone ? BlockId.GoldOre : BlockId.PortalStone,
          true
        );
      }
      if (Math.abs(dx) <= 3) {
        const isCrown = Math.abs(dx) <= 1 && pz === 0;
        grid.setBlock(
          cx + dx,
          baseY + 9,
          cz + pz,
          isCrown ? BlockId.GoldOre : BlockId.PortalStone,
          true
        );
      }
      if (Math.abs(dx) <= 1 && pz === 0) {
        grid.setBlock(
          cx + dx,
          baseY + 10,
          cz + pz,
          dx === 0 ? BlockId.Lantern : BlockId.PortalStone,
          true
        );
      }
    }
  }

  // 4. Corner brazier Lanterns flanking the portal steps
  for (const bx of [-4, 4]) {
    for (const bz of [-2, 2]) {
      grid.setBlock(cx + bx, baseY, cz + bz, BlockId.PortalStone, true);
      grid.setBlock(cx + bx, baseY + 1, cz + bz, BlockId.Lantern, true);
    }
  }
}

export function isPlayerInsidePortal(
  playerPos: { x: number; y: number; z: number },
  portalPos: { x: number; y: number; z: number }
): boolean {
  const dx = Math.abs(playerPos.x - (portalPos.x + 0.5));
  const dz = Math.abs(playerPos.z - (portalPos.z + 0.5));
  const dy = playerPos.y - portalPos.y;
  return dx <= 2.35 && dz <= 1.25 && dy >= -0.6 && dy <= 7.2;
}

export function isPlayerNearPortal(
  playerPos: { x: number; y: number; z: number },
  portalPos: { x: number; y: number; z: number }
): boolean {
  const distXZ = Math.hypot(
    playerPos.x - (portalPos.x + 0.5),
    playerPos.z - (portalPos.z + 0.5)
  );
  return distXZ <= 8.2;
}

/**
 * Builds the composite Three.js hero group seated inside the huge voxel gateway:
 * animated GLSL vortex curtain, dual counter-rotating runic rings, sky beacon shaft,
 * floating keystone crystal, and colored dimensional PointLight.
 */
export function createHugePortalVisual(dimension: DimensionId): HugePortalVisual {
  const meta = DIMENSION_PRESETS[dimension];
  const group = new THREE.Group();

  const coreCol = new THREE.Color(meta.portalCoreHex);
  const rimCol = new THREE.Color(meta.portalRimHex);

  // 1. Swirling Dimensional Energy Curtain (custom GLSL ShaderMaterial)
  const vortexGeo = new THREE.PlaneGeometry(5.2, 7.6, 14, 18);
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoreColor: { value: coreCol.clone() },
      uRimColor: { value: rimCol.clone() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float dist = length(uv - vec2(0.5));
        pos.z += sin(dist * 14.0 - uTime * 3.8) * 0.14 * (1.0 - dist);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * vec2(1.0, 1.35);
        float r = length(p);
        float angle = atan(p.y, p.x);

        float swirl = sin(angle * 4.0 + r * 12.0 - uTime * 3.4);
        float ripple = sin(r * 18.0 - uTime * 4.8) * 0.5 + 0.5;
        float coreGlow = smoothstep(0.68, 0.04, r);
        float edgeMask = smoothstep(0.74, 0.42, r);

        vec3 col = mix(uCoreColor, uRimColor, clamp(swirl * 0.35 + ripple * 0.55, 0.0, 1.0));
        col += vec3(0.45) * pow(coreGlow, 2.4);

        float alpha = clamp(edgeMask * (0.68 + 0.28 * ripple), 0.0, 0.94);
        if (alpha < 0.04) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
  vortexMesh.position.set(0, 4.0, 0);
  group.add(vortexMesh);

  // 2. Dual Counter-Rotating Gilded Runic Rings
  const ringMatOuter = new THREE.MeshStandardMaterial({
    color: meta.portalRimHex,
    emissive: meta.portalCoreHex,
    emissiveIntensity: 0.45,
    metalness: 0.85,
    roughness: 0.22,
  });
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.12, 8, 28), ringMatOuter);
  outerRing.position.set(0, 4.0, 0);
  group.add(outerRing);

  const ringMatInner = new THREE.MeshStandardMaterial({
    color: meta.portalCoreHex,
    emissive: meta.portalRimHex,
    emissiveIntensity: 0.75,
    metalness: 0.65,
    roughness: 0.25,
  });
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 8, 22), ringMatInner);
  innerRing.position.set(0, 4.0, 0);
  group.add(innerRing);

  // 3. Rotating Keystone Crystal atop the Archway
  const crystalMat = new THREE.MeshStandardMaterial({
    color: meta.portalRimHex,
    emissive: meta.portalCoreHex,
    emissiveIntensity: 1.0,
    metalness: 0.3,
    roughness: 0.18,
  });
  const crownCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), crystalMat);
  crownCrystal.position.set(0, 12.1, 0);
  group.add(crownCrystal);

  // 4. Vertical Dimensional Sky Beacon Beam so portal is visible across the map
  const beaconGeo = new THREE.CylinderGeometry(0.45, 0.95, 34, 12, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: meta.portalRimHex,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.set(0, 27, 0);
  group.add(beaconMesh);

  // 5. Colored Dimensional PointLight
  const pointLight = new THREE.PointLight(meta.portalCoreHex, 4.5, 22, 1.4);
  pointLight.position.set(0, 4.2, 1.4);
  group.add(pointLight);

  return {
    group,
    vortexMat,
    outerRing,
    innerRing,
    crownCrystal,
    beaconMesh,
    beaconMat,
    pointLight,
    dispose: () => {
      vortexGeo.dispose();
      vortexMat.dispose();
      outerRing.geometry.dispose();
      ringMatOuter.dispose();
      innerRing.geometry.dispose();
      ringMatInner.dispose();
      crownCrystal.geometry.dispose();
      crystalMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
    },
  };
}

export function updateHugePortalVisual(
  visual: HugePortalVisual,
  elapsed: number,
  dimension: DimensionId
): void {
  const meta = DIMENSION_PRESETS[dimension];
  visual.vortexMat.uniforms.uTime.value = elapsed;
  visual.vortexMat.uniforms.uCoreColor.value.set(meta.portalCoreHex);
  visual.vortexMat.uniforms.uRimColor.value.set(meta.portalRimHex);
  visual.beaconMat.color.set(meta.portalRimHex);
  visual.pointLight.color.set(meta.portalCoreHex);
  visual.pointLight.intensity = 4.2 + Math.sin(elapsed * 3.5) * 0.9;

  visual.outerRing.rotation.z = elapsed * 0.65;
  visual.outerRing.rotation.y = Math.sin(elapsed * 0.7) * 0.18;

  visual.innerRing.rotation.z = -elapsed * 1.15;
  visual.innerRing.rotation.x = Math.cos(elapsed * 0.85) * 0.22;

  visual.crownCrystal.rotation.y = elapsed * 1.25;
  visual.crownCrystal.position.y = 12.1 + Math.sin(elapsed * 2.4) * 0.28;
  visual.beaconMesh.rotation.y = elapsed * 0.4;
}
