import * as THREE from 'three';
import { BLOCK_DEFS, BlockId } from './types';

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shadeHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, factor);
  return `#${c.getHexString()}`;
}

export interface BlockMaterialSet {
  materials: Map<BlockId, THREE.Material | THREE.Material[]>;
  dispose: () => void;
}

function createPixelCanvasTexture(
  baseHex: string,
  pattern: 'noise' | 'grass_side' | 'plank' | 'brick' | 'cobble' | 'log_side' | 'log_top' | 'shingle' | 'glass' | 'lantern' | 'water' | 'ore' | 'magma' | 'portal' | 'coral',
  maxAnisotropy: number,
  seed: number,
  topHex?: string
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 64;
  const px = 4; // 16x16 crisp voxel texels scaled 4x
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const rand = seededRand(seed);

  for (let gx = 0; gx < 16; gx++) {
    for (let gy = 0; gy < 16; gy++) {
      let col = baseHex;
      let bump = 128;

      if (pattern === 'noise') {
        const d = (rand() - 0.5) * 0.09;
        col = shadeHex(baseHex, d);
        bump = 115 + Math.floor(rand() * 40);
      } else if (pattern === 'grass_side') {
        if (gy < 3 || (gy === 3 && rand() > 0.45)) {
          col = shadeHex(topHex ?? '#569c46', (rand() - 0.5) * 0.08);
          bump = 145;
        } else {
          col = shadeHex(baseHex, (rand() - 0.5) * 0.1);
          bump = 115 + Math.floor(rand() * 35);
        }
      } else if (pattern === 'plank') {
        const isSeam = gy % 4 === 0 || (gx === ((gy >> 2) * 7) % 16);
        col = isSeam ? shadeHex(baseHex, -0.14) : shadeHex(baseHex, (rand() - 0.5) * 0.06);
        bump = isSeam ? 70 : 145 + Math.floor(rand() * 20);
      } else if (pattern === 'brick') {
        const row = Math.floor(gy / 4);
        const offset = (row % 2) * 4;
        const isMortar = gy % 4 === 0 || (gx + offset) % 8 === 0;
        col = isMortar ? '#cfc7bc' : shadeHex(baseHex, (rand() - 0.5) * 0.08);
        bump = isMortar ? 65 : 165 + Math.floor(rand() * 25);
      } else if (pattern === 'cobble') {
        const row = Math.floor(gy / 4);
        const off = (row % 2) * 3;
        const isMortar =
          gy % 4 === 0 ||
          (gx + off) % 5 === 0 ||
          (gx === 0 && gy % 4 === 2);
        const tileTint = (((gx + off) >> 2) * 13 + row * 7) % 3;
        col = isMortar
          ? shadeHex(baseHex, -0.09)
          : shadeHex(baseHex, (tileTint - 1) * 0.035 + (rand() - 0.5) * 0.025);
        bump = isMortar ? 95 : 148 + tileTint * 8;
      } else if (pattern === 'log_side') {
        const bark = gx % 3 === 0 ? -0.09 : (rand() - 0.5) * 0.06;
        col = shadeHex(baseHex, bark);
        bump = gx % 3 === 0 ? 90 : 160;
      } else if (pattern === 'log_top') {
        const ring = Math.max(Math.abs(gx - 7.5), Math.abs(gy - 7.5));
        col = ring > 5.8 ? '#6d4c30' : ring % 2 < 1 ? shadeHex('#b89262', -0.05) : '#a68255';
        bump = ring % 2 < 1 ? 150 : 120;
      } else if (pattern === 'shingle') {
        const isOverlap = gy % 4 === 3;
        col = isOverlap ? shadeHex(baseHex, -0.12) : shadeHex(baseHex, (rand() - 0.5) * 0.06);
        bump = isOverlap ? 85 : 155;
      } else if (pattern === 'glass') {
        const isFrame = gx === 0 || gx === 15 || gy === 0 || gy === 15;
        const isGlint = (gx + gy === 6 || gx + gy === 7) && gx > 2 && gx < 6;
        col = isFrame ? '#d8edf5' : isGlint ? '#ffffff' : '#9bd2e8';
        bump = isFrame ? 170 : 128;
      } else if (pattern === 'lantern') {
        const isCage = gx === 0 || gx === 15 || gy === 0 || gy === 15 || gy === 3 || gy === 12;
        col = isCage ? '#3a3532' : (gx >= 5 && gx <= 10 && gy >= 5 && gy <= 10 ? '#fff2b2' : '#ffba42');
        bump = isCage ? 180 : 110;
      } else if (pattern === 'water') {
        const wave = Math.sin(gx * 0.6 + gy * 0.4) * 0.06;
        col = shadeHex(baseHex, wave);
        bump = 128 + Math.floor(Math.sin(gx * 0.8 + gy * 0.6) * 20);
      } else if (pattern === 'ore') {
        const isVein = (gx >= 4 && gx <= 6 && gy >= 4 && gy <= 6) || (gx >= 10 && gx <= 12 && gy >= 9 && gy <= 11);
        col = isVein ? '#f0c44d' : shadeHex('#7d838a', (rand() - 0.5) * 0.08);
        bump = isVein ? 190 : 130;
      } else if (pattern === 'magma') {
        const crack = (gx + gy * 2) % 7 === 0 || (gx * 3 - gy + 16) % 9 === 0;
        col = crack ? '#ff9d2e' : shadeHex(baseHex, (rand() - 0.5) * 0.14);
        bump = crack ? 95 : 165;
      } else if (pattern === 'portal') {
        const rune =
          gx === 2 || gx === 13 || gy === 2 || gy === 13 || ((gx === 7 || gx === 8) && (gy === 7 || gy === 8));
        col = rune ? '#9e6bff' : shadeHex(baseHex, (rand() - 0.5) * 0.08);
        bump = rune ? 185 : 125;
      } else if (pattern === 'coral') {
        const polyp = (gx * 5 + gy * 3) % 4 === 0;
        col = polyp ? '#ffd166' : shadeHex(baseHex, (rand() - 0.5) * 0.15);
        bump = polyp ? 175 : 120;
      }

      ctx.fillStyle = col;
      ctx.fillRect(gx * px, gy * px, px, px);

      bCtx.fillStyle = `rgb(${bump},${bump},${bump})`;
      bCtx.fillRect(gx * px, gy * px, px, px);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = maxAnisotropy;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.magFilter = THREE.NearestFilter;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

export function createVoxelMaterialLibrary(
  renderer: THREE.WebGLRenderer
): BlockMaterialSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const materials = new Map<BlockId, THREE.Material | THREE.Material[]>();
  const texturesToDispose: THREE.Texture[] = [];

  const makeStd = (
    id: BlockId,
    pattern: Parameters<typeof createPixelCanvasTexture>[1],
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
    overrideColor?: string
  ) => {
    const def = BLOCK_DEFS[id];
    const { map, bumpMap } = createPixelCanvasTexture(
      overrideColor ?? def.color,
      pattern,
      maxAniso,
      id * 101 + 7,
      def.topColor
    );
    texturesToDispose.push(map, bumpMap);
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.035,
      roughness: def.roughness,
      metalness: def.metalness,
      ...extra,
    });
  };

  for (const rawId of Object.keys(BLOCK_DEFS)) {
    const id = Number(rawId) as BlockId;
    if (id === BlockId.Air) continue;

    if (id === BlockId.Grass) {
      const sideMat = makeStd(id, 'grass_side');
      const topMat = makeStd(id, 'noise', {}, BLOCK_DEFS[id].topColor);
      const bottomMat = makeStd(BlockId.Dirt, 'noise');
      // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
      materials.set(id, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]);
    } else if (id === BlockId.OakLog || id === BlockId.PalmWood) {
      const barkMat = makeStd(id, 'log_side');
      const endMat = makeStd(id, 'log_top');
      materials.set(id, [barkMat, barkMat, endMat, endMat, barkMat, barkMat]);
    } else if (id === BlockId.OakPlanks || id === BlockId.TimberBeam) {
      materials.set(id, makeStd(id, 'plank'));
    } else if (id === BlockId.Brick || id === BlockId.DungeonBrick) {
      materials.set(id, makeStd(id, 'brick'));
    } else if (id === BlockId.Cobblestone || id === BlockId.DungeonSlate) {
      materials.set(id, makeStd(id, 'cobble'));
    } else if (id === BlockId.RoofShingle) {
      materials.set(id, makeStd(id, 'shingle'));
    } else if (id === BlockId.Glass) {
      materials.set(
        id,
        makeStd(id, 'glass', {
          transparent: true,
          opacity: 0.52,
          roughness: 0.1,
          depthWrite: false,
        })
      );
    } else if (id === BlockId.Water) {
      materials.set(
        id,
        makeStd(id, 'water', {
          transparent: true,
          opacity: 0.72,
          roughness: 0.14,
          depthWrite: false,
        })
      );
    } else if (id === BlockId.Lava) {
      materials.set(
        id,
        makeStd(id, 'magma', {
          emissive: new THREE.Color('#ff5514'),
          emissiveIntensity: 1.25,
          roughness: 0.25,
        })
      );
    } else if (id === BlockId.Magma) {
      materials.set(
        id,
        makeStd(id, 'magma', {
          emissive: new THREE.Color('#cc3d0a'),
          emissiveIntensity: 0.72,
        })
      );
    } else if (id === BlockId.PortalStone) {
      materials.set(
        id,
        makeStd(id, 'portal', {
          emissive: new THREE.Color('#5a2ca8'),
          emissiveIntensity: 0.55,
          metalness: 0.45,
          roughness: 0.28,
        })
      );
    } else if (id === BlockId.Coral) {
      materials.set(id, makeStd(id, 'coral'));
    } else if (id === BlockId.Lantern) {
      materials.set(
        id,
        makeStd(id, 'lantern', {
          emissive: new THREE.Color('#ffaa33'),
          emissiveIntensity: 1.15,
        })
      );
    } else if (id === BlockId.GoldOre) {
      materials.set(id, makeStd(id, 'ore'));
    } else {
      materials.set(id, makeStd(id, 'noise'));
    }
  }

  return {
    materials,
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      materials.forEach((mat) => {
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      });
    },
  };
}
