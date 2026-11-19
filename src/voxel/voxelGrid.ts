import { BLOCK_DEFS, BiomeId, BlockId } from './types';

/** 3x expanded base world span (originally 72x36x72 -> now 216x36x216 base + endless chunk streaming) */
export const WORLD_SIZE_X = 216;
export const WORLD_SIZE_Y = 36;
export const WORLD_SIZE_Z = 216;
export const WATER_LEVEL = 7;

export const SECTOR_SIZE = 32;
export const INITIAL_SECTOR_RADIUS = 3; // 7x7 sectors = 224x224 blocks (>3x original 72x72 span)
export const ACTIVE_SECTOR_RADIUS = 3; // Streamed 7x7 sector horizon around player

export interface BlockChange {
  x: number;
  y: number;
  z: number;
  prevId: BlockId;
  nextId: BlockId;
  prevAnchored: boolean;
  nextAnchored: boolean;
}

export interface VoxelSector {
  sx: number;
  sz: number;
  key: string;
  blocks: Uint8Array;
  anchored: Uint8Array;
  integrity: Uint8Array;
  columnBiomes: BiomeId[];
  dirty: boolean;
  generated: boolean;
}

export function getSectorCoord(worldCoord: number): number {
  return Math.floor(worldCoord / SECTOR_SIZE);
}

export function getLocalCoord(worldCoord: number): number {
  const m = worldCoord % SECTOR_SIZE;
  return m < 0 ? m + SECTOR_SIZE : m;
}

export function makeSectorKey(sx: number, sz: number): string {
  return `${sx},${sz}`;
}

export class VoxelGrid {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly isEndless: boolean;

  // Finite-mode dense arrays (used when constructed with explicit finite dimensions for unit tests)
  readonly blocks: Uint8Array;
  /** 1 = natural bedrock/terrain anchor, 0 = modular/placed block */
  readonly anchored: Uint8Array;
  /** Structural integrity 0..100 computed by stability solver */
  readonly integrity: Uint8Array;
  /** Biome per (x, z) column */
  readonly columnBiomes: BiomeId[];
  /** Optional ceiling cutoff Y so underground dimensions (Dark Dungeon) resolve walkable floor instead of roof */
  ceilingCutoffY: number;

  // Endless chunked sector map (used for 3x + endless world streaming)
  private sectors = new Map<string, VoxelSector>();

  constructor(
    sizeX = WORLD_SIZE_X,
    sizeY = WORLD_SIZE_Y,
    sizeZ = WORLD_SIZE_Z,
    isEndless = false
  ) {
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.isEndless = isEndless;
    this.ceilingCutoffY = sizeY - 1;

    if (isEndless) {
      this.blocks = new Uint8Array(0);
      this.anchored = new Uint8Array(0);
      this.integrity = new Uint8Array(0);
      this.columnBiomes = [];
    } else {
      const total = sizeX * sizeY * sizeZ;
      this.blocks = new Uint8Array(total);
      this.anchored = new Uint8Array(total);
      this.integrity = new Uint8Array(total);
      this.columnBiomes = new Array<BiomeId>(sizeX * sizeZ).fill('emerald_plains');
    }
  }

  static createEndless(sizeY = WORLD_SIZE_Y): VoxelGrid {
    return new VoxelGrid(WORLD_SIZE_X, sizeY, WORLD_SIZE_Z, true);
  }

  private createSector(sx: number, sz: number): VoxelSector {
    const key = makeSectorKey(sx, sz);
    const total = SECTOR_SIZE * this.sizeY * SECTOR_SIZE;
    const sector: VoxelSector = {
      sx,
      sz,
      key,
      blocks: new Uint8Array(total),
      anchored: new Uint8Array(total),
      integrity: new Uint8Array(total),
      columnBiomes: new Array<BiomeId>(SECTOR_SIZE * SECTOR_SIZE).fill('emerald_plains'),
      dirty: true,
      generated: false,
    };
    this.sectors.set(key, sector);
    return sector;
  }

  getSector(sx: number, sz: number): VoxelSector | undefined {
    return this.sectors.get(makeSectorKey(sx, sz));
  }

  getOrCreateSector(sx: number, sz: number): VoxelSector {
    return this.sectors.get(makeSectorKey(sx, sz)) ?? this.createSector(sx, sz);
  }

  hasGeneratedSector(sx: number, sz: number): boolean {
    const s = this.sectors.get(makeSectorKey(sx, sz));
    return Boolean(s && s.generated);
  }

  hasSectorAt(x: number, z: number): boolean {
    if (!this.isEndless) return this.inBounds(x, 0, z);
    return this.hasGeneratedSector(getSectorCoord(Math.floor(x)), getSectorCoord(Math.floor(z)));
  }

  getAllSectors(): IterableIterator<VoxelSector> {
    return this.sectors.values();
  }

  getLoadedSectorCount(): number {
    return this.sectors.size;
  }

  markSectorDirty(sx: number, sz: number): void {
    const s = this.sectors.get(makeSectorKey(sx, sz));
    if (s) s.dirty = true;
  }

  private sectorIndex(lx: number, y: number, lz: number): number {
    return (y * SECTOR_SIZE + lz) * SECTOR_SIZE + lx;
  }

  inBounds(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= this.sizeY) return false;
    if (this.isEndless) return true;
    return x >= 0 && x < this.sizeX && z >= 0 && z < this.sizeZ;
  }

  index(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return BlockId.Air;
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const sector = this.getSector(getSectorCoord(ix), getSectorCoord(iz));
      if (!sector) return BlockId.Air;
      const lx = getLocalCoord(ix);
      const lz = getLocalCoord(iz);
      return sector.blocks[this.sectorIndex(lx, iy, lz)] as BlockId;
    }
    return this.blocks[this.index(x, y, z)] as BlockId;
  }

  setBlock(
    x: number,
    y: number,
    z: number,
    id: BlockId,
    isAnchored = false
  ): boolean {
    if (!this.inBounds(x, y, z)) return false;

    if (this.isEndless) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const sx = getSectorCoord(ix);
      const sz = getSectorCoord(iz);
      const sector = this.getOrCreateSector(sx, sz);
      const lx = getLocalCoord(ix);
      const lz = getLocalCoord(iz);
      const idx = this.sectorIndex(lx, iy, lz);

      sector.blocks[idx] = id;
      sector.anchored[idx] = id === BlockId.Air ? 0 : isAnchored ? 1 : 0;
      if (id === BlockId.Air) {
        sector.integrity[idx] = 0;
      } else if (isAnchored) {
        sector.integrity[idx] = 100;
      }
      sector.dirty = true;

      // Mark adjacent sectors dirty if edit lies on sector boundary so exposed faces stay seamless
      if (lx === 0) this.markSectorDirty(sx - 1, sz);
      else if (lx === SECTOR_SIZE - 1) this.markSectorDirty(sx + 1, sz);
      if (lz === 0) this.markSectorDirty(sx, sz - 1);
      else if (lz === SECTOR_SIZE - 1) this.markSectorDirty(sx, sz + 1);
      return true;
    }

    const idx = this.index(x, y, z);
    this.blocks[idx] = id;
    this.anchored[idx] = id === BlockId.Air ? 0 : isAnchored ? 1 : 0;
    if (id === BlockId.Air) {
      this.integrity[idx] = 0;
    } else if (isAnchored) {
      this.integrity[idx] = 100;
    }
    return true;
  }

  isAnchored(x: number, y: number, z: number): boolean {
    if (!this.inBounds(x, y, z)) return false;
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const sector = this.getSector(getSectorCoord(ix), getSectorCoord(iz));
      if (!sector) return false;
      return sector.anchored[this.sectorIndex(getLocalCoord(ix), iy, getLocalCoord(iz))] === 1;
    }
    return this.anchored[this.index(x, y, z)] === 1;
  }

  getIntegrity(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const sector = this.getSector(getSectorCoord(ix), getSectorCoord(iz));
      if (!sector) return 0;
      return sector.integrity[this.sectorIndex(getLocalCoord(ix), iy, getLocalCoord(iz))];
    }
    return this.integrity[this.index(x, y, z)];
  }

  setIntegrity(x: number, y: number, z: number, val: number): void {
    if (!this.inBounds(x, y, z)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const sector = this.getSector(getSectorCoord(ix), getSectorCoord(iz));
      if (!sector) return;
      sector.integrity[this.sectorIndex(getLocalCoord(ix), iy, getLocalCoord(iz))] = clamped;
      return;
    }
    this.integrity[this.index(x, y, z)] = clamped;
  }

  isSolid(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    return BLOCK_DEFS[id]?.solid ?? false;
  }

  isTransparent(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    return BLOCK_DEFS[id]?.transparent ?? true;
  }

  setColumnBiome(x: number, z: number, biome: BiomeId): void {
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const sector = this.getOrCreateSector(getSectorCoord(ix), getSectorCoord(iz));
      sector.columnBiomes[getLocalCoord(iz) * SECTOR_SIZE + getLocalCoord(ix)] = biome;
      return;
    }
    if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return;
    this.columnBiomes[z * this.sizeX + x] = biome;
  }

  getColumnBiome(x: number, z: number): BiomeId {
    if (this.isEndless) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const sector = this.getSector(getSectorCoord(ix), getSectorCoord(iz));
      if (!sector) return 'emerald_plains';
      return sector.columnBiomes[getLocalCoord(iz) * SECTOR_SIZE + getLocalCoord(ix)] ?? 'emerald_plains';
    }
    const cx = Math.max(0, Math.min(this.sizeX - 1, Math.floor(x)));
    const cz = Math.max(0, Math.min(this.sizeZ - 1, Math.floor(z)));
    return this.columnBiomes[cz * this.sizeX + cx] ?? 'emerald_plains';
  }

  /** Highest solid ground Y at (x, z) ignoring canopy leaves so actors stand on terrain/roofs cleanly */
  getSurfaceY(x: number, z: number, includeLeaves = false): number {
    const cx = this.isEndless ? Math.floor(x) : Math.max(0, Math.min(this.sizeX - 1, Math.floor(x)));
    const cz = this.isEndless ? Math.floor(z) : Math.max(0, Math.min(this.sizeZ - 1, Math.floor(z)));
    const startY = Math.min(this.sizeY - 1, this.ceilingCutoffY);
    for (let y = startY; y >= 0; y--) {
      const id = this.getBlock(cx, y, cz);
      if (id === BlockId.Air || id === BlockId.Water || id === BlockId.Lava) continue;
      if (
        !includeLeaves &&
        (id === BlockId.OakLeaves ||
          id === BlockId.BlossomLeaves ||
          id === BlockId.PalmLeaves ||
          id === BlockId.PortalStone)
      ) {
        continue;
      }
      if (BLOCK_DEFS[id].solid) {
        return y + 1;
      }
    }
    return 1;
  }

  /** Check if block has at least one exposed face adjacent to a transparent block or boundary */
  isExposed(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    if (id === BlockId.Air) return false;
    const isSelfTransparent = BLOCK_DEFS[id].transparent;

    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (let i = 0; i < 6; i++) {
      const nx = x + dirs[i][0];
      const ny = y + dirs[i][1];
      const nz = z + dirs[i][2];
      if (ny < 0) continue;
      if (ny >= this.sizeY) return true;

      if (!this.isEndless) {
        if (!this.inBounds(nx, ny, nz)) {
          return true;
        }
      } else if (!this.hasSectorAt(nx, nz)) {
        // Avoid rendering hollow vertical edge skirts into unloaded fog horizon
        continue;
      }

      const neighbor = this.getBlock(nx, ny, nz);
      if (neighbor === BlockId.Air) return true;
      if (!isSelfTransparent && BLOCK_DEFS[neighbor].transparent) return true;
      if (isSelfTransparent && neighbor !== id && BLOCK_DEFS[neighbor].transparent) return true;
    }
    return false;
  }

  countBlocks(filter?: (id: BlockId, anchored: boolean) => boolean): number {
    let count = 0;
    if (this.isEndless) {
      for (const sector of this.sectors.values()) {
        const blocks = sector.blocks;
        const anchored = sector.anchored;
        for (let i = 0; i < blocks.length; i++) {
          const id = blocks[i] as BlockId;
          if (id === BlockId.Air) continue;
          if (!filter || filter(id, anchored[i] === 1)) {
            count++;
          }
        }
      }
      return count;
    }

    for (let i = 0; i < this.blocks.length; i++) {
      const id = this.blocks[i] as BlockId;
      if (id === BlockId.Air) continue;
      if (!filter || filter(id, this.anchored[i] === 1)) {
        count++;
      }
    }
    return count;
  }
}
