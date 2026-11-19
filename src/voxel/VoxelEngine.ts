import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { voxelAudio } from './audio';
import {
  InventoryCounts,
  addResourceToInventory,
  consumeResourceFromInventory,
  getResourceCount,
  getTotalResourceCount,
  isCollectibleBlock,
  loadPersistentInventory,
  resetPersistentInventory,
  revertBatchInInventory,
  savePersistentInventory,
} from './inventory';
import { AnimatedNpcRig, animateNpcRig, buildNpcRig } from './models';
import {
  MAX_BLUEPRINT_BLOCKS,
  VoxelBlueprint,
  captureBlueprintRegion,
  captureNearestPlotBlueprint,
  loadBlueprints,
  normalizeRotationTurns,
  rotateBlueprintBlock,
  saveBlueprints,
  stampBlueprint,
  toBlueprintSummary,
} from './blueprints';
import { interactWithNpc, isDuskOrNightTime, stepNpcActor } from './npcAI';
import {
  DEFAULT_PHOTO_DOF,
  PhotoDofSettings,
  clampAperture,
  stepAutoFocusDistance,
} from './photoMode';
import {
  collapseUnstableBlocks,
  computeBlockInstanceTint,
  solveStructuralStability,
} from './stability';
import { buildProceduralHouse, expandVillage } from './structures';
import { createVoxelMaterialLibrary, BlockMaterialSet } from './textures';
import {
  DEFAULT_SUMMON_PACK,
  computeSummonPlacement,
  getSummonAssetDef,
} from './summon';
import {
  HugePortalVisual,
  PortalCoords,
  buildHugePortalStructure,
  clearHugePortalStructure,
  createHugePortalVisual,
  isPlayerInsidePortal,
  isPlayerNearPortal,
  pickRandomPortalDestination,
  scramblePortalPosition,
  updateHugePortalVisual,
} from './portal';
import {
  BIOME_PRESETS,
  BLOCK_DEFS,
  BlockId,
  BlueprintSummary,
  DIMENSION_PRESETS,
  DimensionId,
  EditBrush,
  HouseStyle,
  HudSnapshot,
  NpcActor,
  NpcRole,
  TargetBlockInfo,
  VillagePlot,
  WeatherType,
  WorldConfig,
} from './types';
import {
  ACTIVE_SECTOR_RADIUS,
  BlockChange,
  SECTOR_SIZE,
  VoxelGrid,
  VoxelSector,
  WATER_LEVEL,
  getSectorCoord,
} from './voxelGrid';
import {
  WeatherState,
  createInitialWeatherState,
  getWeatherAtmosphere,
  nextWeatherInCycle,
  setWeatherCondition,
  stepWeatherState,
} from './weather';
import { createNpcActor, generateProceduralWorld, generateSector } from './worldGen';

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _rainColor = new THREE.Color('#a8d8ff');
const _stormRainColor = new THREE.Color('#c2e0ff');
const _snowColor = new THREE.Color('#ffffff');
const _cloudTopColor = new THREE.Color('#ffffff');
const _cloudShadeColor = new THREE.Color('#d9e8f5');
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

const PRECIP_COUNT = 520;
const PRECIP_SPAN_XZ = 24;
const PRECIP_SPAN_Y = 16;

const CLOUD_CLUSTER_COUNT = 32;
const CLOUD_BLOCKS_PER_CLUSTER = 5;
const CLOUD_TOTAL_INSTANCES = CLOUD_CLUSTER_COUNT * CLOUD_BLOCKS_PER_CLUSTER;
const CLOUD_SPAN_XZ = 280;
const LIGHTNING_SEGMENTS = 10;

interface DebrisParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  scale: number;
  life: number;
  maxLife: number;
  colorHex: string;
}

export type GameMode = 'title' | 'playing' | 'paused';

export class VoxelEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private materialLib: BlockMaterialSet;
  private unitBoxGeo: THREE.BoxGeometry;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private distantSeaMesh: THREE.Mesh;

  // Post-processing Photo Mode DOF pipeline
  private composer: EffectComposer;
  private bokehPass: BokehPass;
  private outputPass: OutputPass;
  private photoDof: PhotoDofSettings = { ...DEFAULT_PHOTO_DOF };

  private sectorMeshes = new Map<string, Map<BlockId, THREE.InstancedMesh>>();
  private lastStreamSectorKey = '';
  private highlightMesh: THREE.LineSegments;
  private ghostMesh: THREE.Mesh;

  // Pooled zero-GC particle / falling debris ring buffer
  private particleMesh: THREE.InstancedMesh;
  private particlePool: DebrisParticle[] = [];
  private particleCursor = 0;

  // Pooled zero-GC procedural precipitation (rain streaks / snowflakes)
  private precipMesh: THREE.InstancedMesh;
  private precipX = new Float32Array(PRECIP_COUNT);
  private precipY = new Float32Array(PRECIP_COUNT);
  private precipZ = new Float32Array(PRECIP_COUNT);
  private precipSpeed = new Float32Array(PRECIP_COUNT);
  private precipPhase = new Float32Array(PRECIP_COUNT);

  // Pooled zero-GC weather-reactive 3D voxel clouds & thunderstorm lightning bolt
  private cloudMesh: THREE.InstancedMesh;
  private cloudClusterX = new Float32Array(CLOUD_CLUSTER_COUNT);
  private cloudClusterY = new Float32Array(CLOUD_CLUSTER_COUNT);
  private cloudClusterZ = new Float32Array(CLOUD_CLUSTER_COUNT);
  private cloudClusterThreshold = new Float32Array(CLOUD_CLUSTER_COUNT);
  private cloudClusterScale = new Float32Array(CLOUD_CLUSTER_COUNT);
  private cloudClusterSpeed = new Float32Array(CLOUD_CLUSTER_COUNT);
  private lightningGroup = new THREE.Group();
  private lightningSegments: THREE.Mesh[] = [];
  private lightningLight: THREE.PointLight;
  private weatherState: WeatherState;

  // World & Simulation state
  private config: WorldConfig;
  private grid!: VoxelGrid;
  private plots: VillagePlot[] = [];
  private npcs: NpcActor[] = [];
  private npcRigs: AnimatedNpcRig[] = [];
  private npcGroup = new THREE.Group();

  private inventory: InventoryCounts;
  private undoStack: BlockChange[][] = [];
  private totalPlacedBlocks = 0;
  private summonedCount = 0;
  private lastCollapsedCount = 0;
  private stabilityOverlay = false;

  // Huge Scrambled Dimensional Portal
  private portalPos: PortalCoords = { x: 26, y: 11, z: 12, yaw: 0 };
  private portalVisual: HugePortalVisual | null = null;
  private portalCooldown = 0;
  private nearPortal = false;

  // Reusable Blueprint Copy / Save / Rotate / Stamp system
  private blueprints: VoxelBlueprint[] = loadBlueprints();
  private armedBlueprintId: string | null = null;
  private blueprintRotation: 0 | 1 | 2 | 3 = 0;
  private blueprintCornerA: { x: number; y: number; z: number } | null = null;
  private blueprintPreviewMesh!: THREE.InstancedMesh;

  // Player state
  private gameMode: GameMode = 'title';
  private player = {
    x: 36.5,
    y: 12,
    z: 39.5,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: -0.15,
    grounded: false,
    coyoteTimer: 0,
    jumpBuffer: 0,
    flyMode: false,
  };

  private selectedBlock: BlockId = BlockId.OakPlanks;
  private activeBrush: EditBrush = 'single';
  private targetBlock: TargetBlockInfo | null = null;
  private targetNpc: NpcActor | null = null;

  // Input state
  private keysHeld = new Set<string>();
  private isDraggingLook = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastDragX = 0;
  private lastDragY = 0;
  private dragMoved = false;

  // Camera & Juice
  private trauma = 0;
  private timeOfDay = 0.28; // Morning sunlit angle
  private elapsed = 0;
  private simTick = 0;
  private hudTimer = 0;
  private frameId = 0;
  private disposed = false;

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onToast: (msg: string) => void;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialConfig: WorldConfig,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onToast: (msg: string) => void
  ) {
    this.container = container;
    this.config = { ...initialConfig };
    this.onHudUpdate = onHudUpdate;
    this.onToast = onToast;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 420);
    this.inventory = loadPersistentInventory();

    // Post-processing EffectComposer + Bokeh DOF for Photo Mode
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.composer.setSize(width, height);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: this.photoDof.focus,
      aperture: this.photoDof.aperture,
      maxblur: this.photoDof.maxblur,
    });
    this.composer.addPass(this.bokehPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Warm/cool 3-point outdoor daylight rig
    this.hemiLight = new THREE.HemisphereLight(0xa3d4ff, 0x5c4f3d, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.0);
    this.sunLight.position.set(42, 54, 48);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 180;
    this.sunLight.shadow.camera.left = -52;
    this.sunLight.shadow.camera.right = 52;
    this.sunLight.shadow.camera.top = 52;
    this.sunLight.shadow.camera.bottom = -52;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.target.position.set(16, 10, 16);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Extended horizon plane so world blends seamlessly into fog
    const seaGeo = new THREE.PlaneGeometry(1100, 1100);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x3b7d9c,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.distantSeaMesh = new THREE.Mesh(seaGeo, seaMat);
    this.distantSeaMesh.position.set(16, WATER_LEVEL - 0.55, 16);
    this.distantSeaMesh.receiveShadow = true;
    this.scene.add(this.distantSeaMesh);

    this.materialLib = createVoxelMaterialLibrary(this.renderer);
    this.unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

    // Block target wireframe & ghost preview
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015, 1.015, 1.015));
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.005, 1.005, 1.005),
      new THREE.MeshBasicMaterial({
        color: 0x84e1a7,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      })
    );
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);

    const bpPreviewGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const bpPreviewMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.blueprintPreviewMesh = new THREE.InstancedMesh(
      bpPreviewGeo,
      bpPreviewMat,
      MAX_BLUEPRINT_BLOCKS
    );
    this.blueprintPreviewMesh.frustumCulled = false;
    this.blueprintPreviewMesh.visible = false;
    this.blueprintPreviewMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_BLUEPRINT_BLOCKS * 3),
      3
    );
    this.scene.add(this.blueprintPreviewMesh);

    this.scene.add(this.npcGroup);

    // Initialize pooled debris/particle ring buffer (180 particles)
    const pGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const poolSize = 180;
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, poolSize);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(poolSize * 3),
      3
    );
    for (let i = 0; i < poolSize; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        scale: 0,
        life: 0,
        maxLife: 1,
        colorHex: '#ffffff',
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.set('#ffffff'));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Initialize pooled precipitation InstancedMesh (zero allocations per frame)
    this.weatherState = createInitialWeatherState(this.config.biome);
    const precipGeo = new THREE.BoxGeometry(1, 1, 1);
    const precipMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    });
    this.precipMesh = new THREE.InstancedMesh(precipGeo, precipMat, PRECIP_COUNT);
    this.precipMesh.frustumCulled = false;
    this.precipMesh.visible = false;
    this.precipMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PRECIP_COUNT * 3),
      3
    );
    for (let i = 0; i < PRECIP_COUNT; i++) {
      // Deterministic pseudo-random spread around player/camera
      const h1 = ((i * 2654435761) >>> 0) / 4294967295;
      const h2 = (((i + 97) * 2246822519) >>> 0) / 4294967295;
      const h3 = (((i + 313) * 3266489917) >>> 0) / 4294967295;
      this.precipX[i] = (h1 - 0.5) * PRECIP_SPAN_XZ;
      this.precipY[i] = h2 * PRECIP_SPAN_Y;
      this.precipZ[i] = (h3 - 0.5) * PRECIP_SPAN_XZ;
      this.precipSpeed[i] = 0.8 + h1 * 0.45;
      this.precipPhase[i] = h2 * Math.PI * 2;
      _mat4.makeScale(0, 0, 0);
      this.precipMesh.setMatrixAt(i, _mat4);
      this.precipMesh.setColorAt(i, _rainColor);
    }
    this.precipMesh.instanceMatrix.needsUpdate = true;
    if (this.precipMesh.instanceColor) this.precipMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.precipMesh);

    // Initialize pooled 3D voxel cloud canopy (fog-free so clouds reflect weather hue crisply)
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      fog: false,
    });
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_TOTAL_INSTANCES);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(CLOUD_TOTAL_INSTANCES * 3),
      3
    );
    for (let c = 0; c < CLOUD_CLUSTER_COUNT; c++) {
      const h1 = ((c * 2654435761) >>> 0) / 4294967295;
      const h2 = (((c + 43) * 2246822519) >>> 0) / 4294967295;
      const h3 = (((c + 137) * 3266489917) >>> 0) / 4294967295;
      this.cloudClusterX[c] = (h1 - 0.5) * CLOUD_SPAN_XZ;
      this.cloudClusterY[c] = (h2 - 0.5) * 6.5;
      this.cloudClusterZ[c] = (h3 - 0.5) * CLOUD_SPAN_XZ;
      this.cloudClusterThreshold[c] = c / CLOUD_CLUSTER_COUNT;
      this.cloudClusterScale[c] = 0.8 + h2 * 0.65;
      this.cloudClusterSpeed[c] = 0.75 + h1 * 0.5;
    }
    this.scene.add(this.cloudMesh);

    // Initialize pooled 3D thunderstorm lightning bolt & flash point light
    const boltGeo = new THREE.BoxGeometry(0.45, 1, 0.45);
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0xf4f9ff,
      transparent: true,
      opacity: 0.96,
      fog: false,
    });
    for (let s = 0; s < LIGHTNING_SEGMENTS; s++) {
      const seg = new THREE.Mesh(boltGeo, boltMat);
      this.lightningSegments.push(seg);
      this.lightningGroup.add(seg);
    }
    this.lightningGroup.visible = false;
    this.scene.add(this.lightningGroup);

    this.lightningLight = new THREE.PointLight(0xd9e8ff, 0, 180, 1.1);
    this.lightningLight.position.set(16, 32, 16);
    this.scene.add(this.lightningLight);

    this.buildWorld(this.config);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.lastTimestamp = performance.now();
    this.tick();
  }

  private lastTimestamp = 0;

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 120);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleResize() {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bokehPass.setSize(w, h);
    this.renderFrame();
  }

  private renderFrame() {
    if (this.photoDof.enabled) {
      const uniforms = this.bokehPass.uniforms as Record<string, THREE.IUniform>;
      uniforms['focus'].value = this.photoDof.focus;
      uniforms['aperture'].value = this.photoDof.aperture;
      uniforms['maxblur'].value = this.photoDof.maxblur;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setPhotoMode(enabled: boolean) {
    this.photoDof.enabled = enabled;
    if (enabled) {
      this.highlightMesh.visible = false;
      this.ghostMesh.visible = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      const hit = this.raycastVoxel(48);
      if (hit) {
        const dist = Math.hypot(
          hit.x + 0.5 - this.camera.position.x,
          hit.y + 0.5 - this.camera.position.y,
          hit.z + 0.5 - this.camera.position.z
        );
        this.photoDof.focus = Math.max(2.0, Math.min(48.0, dist));
      }
    }
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public isPhotoMode(): boolean {
    return this.photoDof.enabled;
  }

  public adjustPhotoAperture(delta: number) {
    this.photoDof.aperture = clampAperture(this.photoDof.aperture + delta);
    if (this.photoDof.enabled) {
      this.renderFrame();
    }
  }

  public capturePhotoPng() {
    this.renderFrame();
    try {
      const dataUrl = this.renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `terravox-photo-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Ignore download blocked in headless/sandbox environments
    }
  }

  public resetInventory() {
    this.inventory = resetPersistentInventory();
    this.onToast('Inventory reset to starter supplies');
    this.pushHudSnapshot();
  }

  public setGameMode(mode: GameMode) {
    const prev = this.gameMode;
    this.gameMode = mode;
    if (mode !== 'playing') {
      this.photoDof.enabled = false;
      this.keysHeld.clear();
      this.isDraggingLook = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } else if (prev === 'title') {
      // Face starter cottage & watchtower landmark cleanly on start
      this.player.pitch = -0.1;
      this.keysHeld.clear();
    }
    this.pushHudSnapshot();
  }

  public setSelectedBlock(id: BlockId) {
    this.selectedBlock = id;
  }

  public setActiveBrush(brush: EditBrush) {
    this.activeBrush = brush;
  }

  private getActiveRenderRadius(): number {
    return this.isSoftwareGl ? 2 : ACTIVE_SECTOR_RADIUS;
  }

  public setStabilityEnabled(enabled: boolean) {
    this.config.stabilityEnabled = enabled;
    if (enabled) {
      const collapsed = collapseUnstableBlocks(this.grid, this.player.x, this.player.z, 26);
      if (collapsed.length > 0) {
        this.spawnCollapseDebris(collapsed);
        this.rebuildDirtySectors(this.getActiveRenderRadius());
      }
    }
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public setStabilityOverlay(show: boolean) {
    this.stabilityOverlay = show;
    for (const sector of this.grid.getAllSectors()) {
      sector.dirty = true;
    }
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.renderFrame();
    this.pushHudSnapshot();
  }

  private ensureDefaultBlockColors() {
    if (!this.stabilityOverlay) return;
    this.stabilityOverlay = false;
    for (const sector of this.grid.getAllSectors()) {
      sector.dirty = true;
    }
  }

  public toggleFlyMode() {
    this.player.flyMode = !this.player.flyMode;
    this.player.vy = 0;
    this.onToast(this.player.flyMode ? 'Creative Flight Enabled' : 'Gravity Walking Enabled');
    this.pushHudSnapshot();
  }

  public setWeather(weather: WeatherType, autoCycle?: boolean) {
    const prev = this.weatherState.current;
    this.weatherState = setWeatherCondition(
      this.weatherState,
      weather,
      this.config.biome,
      autoCycle,
      true
    );
    if (weather === 'storm' && prev !== 'storm') {
      this.triggerLightningStrike(true);
    }
    this.applyWeatherAtmosphere(0.016);
    this.renderFrame();
    if (prev !== weather) {
      const label =
        weather === 'clear'
          ? 'Clear Skies'
          : weather === 'rainy'
          ? 'Rainstorm'
          : weather === 'storm'
          ? 'Thunderstorm'
          : 'Snowfall';
      this.onToast(`Weather: ${label}`);
    }
    this.pushHudSnapshot();
  }

  public setWeatherAutoCycle(autoCycle: boolean) {
    this.weatherState = { ...this.weatherState, autoCycle };
    this.onToast(autoCycle ? 'Weather Auto-Cycle Enabled' : 'Weather Locked Manually');
    this.pushHudSnapshot();
  }

  public cycleWeather() {
    const next = nextWeatherInCycle(this.weatherState.current);
    this.setWeather(next, this.weatherState.autoCycle);
  }

  public toggleDayNight() {
    const nextDusk = !isDuskOrNightTime(this.timeOfDay);
    this.timeOfDay = nextDusk ? 0.78 : 0.28;
    this.applyWeatherAtmosphere(0.016);
    this.renderFrame();
    this.onToast(
      nextDusk
        ? 'Dusk Nightfall — Villagers heading to lantern cottages, Monsters prowling!'
        : 'Morning Daylight — Villagers resuming patrols'
    );
    this.pushHudSnapshot();
  }

  public setTimeOfDay(val: number) {
    this.timeOfDay = ((val % 1) + 1) % 1;
    this.applyWeatherAtmosphere(0.016);
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public regenerateWorld(newConfig: WorldConfig) {
    this.config = { ...newConfig };
    this.undoStack = [];
    this.totalPlacedBlocks = 0;
    this.summonedCount = 0;
    this.lastCollapsedCount = 0;
    this.stabilityOverlay = false;
    this.weatherState = createInitialWeatherState(this.config.biome);
    this.buildWorld(this.config);
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public getWorldExportData() {
    return {
      config: this.config,
      plots: this.plots,
      placedCount: this.totalPlacedBlocks,
    };
  }

  private clearAllSectorMeshes() {
    this.sectorMeshes.forEach((meshMap) => {
      meshMap.forEach((mesh) => {
        this.scene.remove(mesh);
        mesh.dispose();
      });
    });
    this.sectorMeshes.clear();
  }

  private disposeSectorMesh(key: string) {
    const meshMap = this.sectorMeshes.get(key);
    if (!meshMap) return;
    meshMap.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
    this.sectorMeshes.delete(key);
  }

  private buildWorld(config: WorldConfig) {
    this.clearAllSectorMeshes();
    this.lastStreamSectorKey = '';
    if (this.portalVisual) {
      this.scene.remove(this.portalVisual.group);
      this.portalVisual.dispose();
      this.portalVisual = null;
    }

    const generated = generateProceduralWorld(config);
    this.grid = generated.grid;
    this.plots = generated.plots;
    this.npcs = generated.npcs;
    this.portalPos = generated.portal;

    this.player.x = generated.spawn.x;
    this.player.y = generated.spawn.y;
    this.player.z = generated.spawn.z;
    this.player.yaw = generated.spawn.yaw;
    this.player.pitch = -0.08;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.camera.position.set(this.player.x, this.player.y + 1.62, this.player.z);

    // Clear stale particles so none clip near camera lens across dimension warps
    for (let i = 0; i < this.particlePool.length; i++) {
      this.particlePool[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;

    this.distantSeaMesh.position.set(this.player.x, WATER_LEVEL - 0.55, this.player.z);

    const dim = config.dimension ?? 'overworld';
    this.portalVisual = createHugePortalVisual(dim);
    this.portalVisual.group.position.set(
      this.portalPos.x + 0.5,
      this.portalPos.y,
      this.portalPos.z + 0.5
    );
    this.scene.add(this.portalVisual.group);
    this.nearPortal = isPlayerNearPortal(this.player, this.portalPos);

    // Apply biome / dimension sky & fog continuity immediately
    const preset = BIOME_PRESETS[config.biome];
    this.scene.background = new THREE.Color(preset.skyHorizon);
    this.scene.fog = new THREE.FogExp2(preset.fogColor, 0.0115);

    this.rebuildNpcRigs();
    this.streamSectorsAroundPlayer(true);
    this.applyWeatherAtmosphere(0.016);
  }

  private rebuildNpcRigs() {
    while (this.npcGroup.children.length > 0) {
      this.npcGroup.remove(this.npcGroup.children[0]);
    }
    this.npcRigs = [];
    for (const actor of this.npcs) {
      const rig = buildNpcRig(actor);
      rig.group.position.set(actor.x, actor.y, actor.z);
      this.npcGroup.add(rig.group);
      this.npcRigs.push(rig);
    }
  }

  private ensureSectorsInArea(minX: number, maxX: number, minZ: number, maxZ: number) {
    const minSx = getSectorCoord(Math.floor(minX));
    const maxSx = getSectorCoord(Math.floor(maxX));
    const minSz = getSectorCoord(Math.floor(minZ));
    const maxSz = getSectorCoord(Math.floor(maxZ));

    for (let sx = minSx; sx <= maxSx; sx++) {
      for (let sz = minSz; sz <= maxSz; sz++) {
        if (!this.grid.hasGeneratedSector(sx, sz)) {
          const res = generateSector(this.grid, sx, sz, this.config, this.npcs.length);
          if (res.plots.length > 0) this.plots.push(...res.plots);
          for (const actor of res.npcs) {
            this.npcs.push(actor);
            const rig = buildNpcRig(actor);
            rig.group.position.set(actor.x, actor.y, actor.z);
            this.npcGroup.add(rig.group);
            this.npcRigs.push(rig);
          }
        }
      }
    }
  }

  private streamSectorsAroundPlayer(force = false) {
    const psx = getSectorCoord(Math.floor(this.player.x));
    const psz = getSectorCoord(Math.floor(this.player.z));
    const curKey = `${psx},${psz}`;
    const renderRadius = this.getActiveRenderRadius();

    if (force || curKey !== this.lastStreamSectorKey) {
      this.lastStreamSectorKey = curKey;

      for (let sx = psx - ACTIVE_SECTOR_RADIUS; sx <= psx + ACTIVE_SECTOR_RADIUS; sx++) {
        for (let sz = psz - ACTIVE_SECTOR_RADIUS; sz <= psz + ACTIVE_SECTOR_RADIUS; sz++) {
          if (!this.grid.hasGeneratedSector(sx, sz)) {
            const res = generateSector(this.grid, sx, sz, this.config, this.npcs.length);
            if (res.plots.length > 0) this.plots.push(...res.plots);
            for (const actor of res.npcs) {
              this.npcs.push(actor);
              const rig = buildNpcRig(actor);
              rig.group.position.set(actor.x, actor.y, actor.z);
              this.npcGroup.add(rig.group);
              this.npcRigs.push(rig);
            }
          }
        }
      }

      // Unload Three.js GPU meshes for distant sectors while preserving all block edits in grid
      const unloadRadius = renderRadius + 1;
      for (const key of Array.from(this.sectorMeshes.keys())) {
        const [sxStr, szStr] = key.split(',');
        const sx = Number(sxStr);
        const sz = Number(szStr);
        if (Math.abs(sx - psx) > unloadRadius || Math.abs(sz - psz) > unloadRadius) {
          this.disposeSectorMesh(key);
        }
      }
    }

    this.rebuildDirtySectors(renderRadius);
  }

  private rebuildDirtySectors(renderRadius = this.getActiveRenderRadius()) {
    const psx = getSectorCoord(Math.floor(this.player.x));
    const psz = getSectorCoord(Math.floor(this.player.z));

    // Purge any mounted meshes outside active radius whose sectors are dirty so no stale tint remains
    for (const key of Array.from(this.sectorMeshes.keys())) {
      const [sxStr, szStr] = key.split(',');
      const sx = Number(sxStr);
      const sz = Number(szStr);
      if (Math.abs(sx - psx) > renderRadius || Math.abs(sz - psz) > renderRadius) {
        const sector = this.grid.getSector(sx, sz);
        if (!sector || sector.dirty) {
          this.disposeSectorMesh(key);
        }
      }
    }

    for (let sx = psx - renderRadius; sx <= psx + renderRadius; sx++) {
      for (let sz = psz - renderRadius; sz <= psz + renderRadius; sz++) {
        const sector = this.grid.getSector(sx, sz);
        if (!sector) continue;
        if (sector.dirty || !this.sectorMeshes.has(sector.key)) {
          this.buildSectorMesh(sector);
        }
      }
    }
  }

  private buildSectorMesh(sector: VoxelSector) {
    this.disposeSectorMesh(sector.key);

    const startX = sector.sx * SECTOR_SIZE;
    const startZ = sector.sz * SECTOR_SIZE;
    const buckets = new Map<BlockId, Array<{ x: number; y: number; z: number }>>();

    for (let y = 0; y < this.grid.sizeY; y++) {
      for (let lz = 0; lz < SECTOR_SIZE; lz++) {
        const wz = startZ + lz;
        for (let lx = 0; lx < SECTOR_SIZE; lx++) {
          const wx = startX + lx;
          const id = sector.blocks[(y * SECTOR_SIZE + lz) * SECTOR_SIZE + lx] as BlockId;
          if (id === BlockId.Air) continue;
          if (!this.grid.isExposed(wx, y, wz)) continue;
          let arr = buckets.get(id);
          if (!arr) {
            arr = [];
            buckets.set(id, arr);
          }
          arr.push({ x: wx, y, z: wz });
        }
      }
    }

    const meshMap = new Map<BlockId, THREE.InstancedMesh>();
    buckets.forEach((positions, id) => {
      const mat = this.materialLib.materials.get(id);
      if (!mat) return;
      const mesh = new THREE.InstancedMesh(this.unitBoxGeo, mat, positions.length);
      const isTransparent = BLOCK_DEFS[id].transparent;
      mesh.castShadow = !this.isSoftwareGl && !isTransparent;
      mesh.receiveShadow = !this.isSoftwareGl && id !== BlockId.Lantern;

      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        _pos.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
        _quat.identity();
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);

        const blockTint = computeBlockInstanceTint(
          p.x,
          p.y,
          p.z,
          this.grid.isAnchored(p.x, p.y, p.z),
          this.grid.getIntegrity(p.x, p.y, p.z),
          this.stabilityOverlay
        );
        if (blockTint.mode === 'heatmap') {
          _color.set(blockTint.hex);
        } else {
          _color.setRGB(blockTint.tint, blockTint.tint, blockTint.tint);
        }
        mesh.setColorAt(i, _color);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
      meshMap.set(id, mesh);
    });

    this.sectorMeshes.set(sector.key, meshMap);
    sector.dirty = false;
  }

  private spawnParticles(x: number, y: number, z: number, colorHex: string, count: number, speed = 4.2) {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particlePool.length;
      p.active = true;
      p.x = x + 0.5 + (Math.random() - 0.5) * 0.5;
      p.y = y + 0.5 + (Math.random() - 0.5) * 0.5;
      p.z = z + 0.5 + (Math.random() - 0.5) * 0.5;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = 1.8 + Math.random() * speed * 0.9;
      p.vz = (Math.random() - 0.5) * speed;
      p.rx = Math.random() * Math.PI;
      p.ry = Math.random() * Math.PI;
      p.scale = 0.55 + Math.random() * 0.65;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.45;
      p.colorHex = colorHex;
    }
  }

  private spawnCollapseDebris(collapsed: Array<{ x: number; y: number; z: number; blockId: BlockId }>) {
    this.lastCollapsedCount = collapsed.length;
    voxelAudio.playCollapse(collapsed.length);
    this.trauma = Math.min(1, this.trauma + Math.min(0.65, 0.18 + collapsed.length * 0.03));
    const cap = Math.min(collapsed.length, 48);
    for (let i = 0; i < cap; i++) {
      const b = collapsed[i];
      const def = BLOCK_DEFS[b.blockId];
      this.spawnParticles(b.x, b.y, b.z, def.color, 3, 2.8);
    }
    this.onToast(`Structural Collapse! ${collapsed.length} unsupported block${collapsed.length > 1 ? 's' : ''} fell`);
  }

  /**
   * 3D Amanatides-Woo DDA voxel raycast — O(maxDist) exact block & face normal hit.
   */
  private raycastVoxel(maxDist = 8.5): TargetBlockInfo | null {
    _forward.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;
    const dx = _forward.x;
    const dy = _forward.y;
    const dz = _forward.z;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx >= 0 ? 1 : -1;
    const stepY = dy >= 0 ? 1 : -1;
    const stepZ = dz >= 0 ? 1 : -1;

    const tDeltaX = dx === 0 ? 1e6 : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? 1e6 : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? 1e6 : Math.abs(1 / dz);

    let tMaxX = dx === 0 ? 1e6 : ((dx > 0 ? x + 1 - ox : ox - x) * tDeltaX);
    let tMaxY = dy === 0 ? 1e6 : ((dy > 0 ? y + 1 - oy : oy - y) * tDeltaY);
    let tMaxZ = dz === 0 ? 1e6 : ((dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ);

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;

    while (dist <= maxDist) {
      if (this.grid.inBounds(x, y, z)) {
        const id = this.grid.getBlock(x, y, z);
        if (id !== BlockId.Air && id !== BlockId.Water) {
          return {
            x,
            y,
            z,
            nx,
            ny,
            nz,
            blockId: id,
            integrity: this.grid.getIntegrity(x, y, z),
            anchored: this.grid.isAnchored(x, y, z),
          };
        }
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          tMaxY += tDeltaY;
          y += stepY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }
    }

    return null;
  }

  private findTargetedNpc(): NpcActor | null {
    _forward.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    let best: NpcActor | null = null;
    let bestDist = 6.5;

    for (const actor of this.npcs) {
      const dx = actor.x - this.camera.position.x;
      const dy = actor.y + 0.9 - this.camera.position.y;
      const dz = actor.z - this.camera.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bestDist || d < 0.3) continue;
      const dot = (dx * _forward.x + dy * _forward.y + dz * _forward.z) / d;
      if (dot > 0.88) {
        bestDist = d;
        best = actor;
      }
    }
    return best;
  }

  public mineTargeted() {
    if (this.gameMode !== 'playing' || this.photoDof.enabled || !this.targetBlock) return;
    const { x, y, z, blockId } = this.targetBlock;
    if (blockId === BlockId.Bedrock) {
      this.onToast('Bedrock cannot be mined');
      return;
    }
    if (blockId === BlockId.PortalStone) {
      this.onToast('Dimensional Portal frame cannot be mined');
      return;
    }

    const batch: BlockChange[] = [];
    const tryRemove = (bx: number, by: number, bz: number) => {
      if (!this.grid.inBounds(bx, by, bz)) return;
      const cur = this.grid.getBlock(bx, by, bz);
      if (cur === BlockId.Air || cur === BlockId.Bedrock || cur === BlockId.PortalStone) return;
      batch.push({
        x: bx,
        y: by,
        z: bz,
        prevId: cur,
        nextId: BlockId.Air,
        prevAnchored: this.grid.isAnchored(bx, by, bz),
        nextAnchored: false,
      });
      this.grid.setBlock(bx, by, bz, BlockId.Air, false);
      if (isCollectibleBlock(cur)) {
        this.inventory = addResourceToInventory(this.inventory, cur, 1);
      }
      this.spawnParticles(bx, by, bz, BLOCK_DEFS[cur].color, 5);
    };

    if (this.activeBrush === 'platform3x3') {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          tryRemove(x + dx, y, z + dz);
        }
      }
    } else if (this.activeBrush === 'pillar4') {
      for (let dy = 0; dy < 4; dy++) {
        tryRemove(x, y - dy, z);
      }
    } else {
      tryRemove(x, y, z);
    }

    if (batch.length === 0) return;
    this.undoStack.push(batch);
    if (this.undoStack.length > 40) this.undoStack.shift();

    savePersistentInventory(this.inventory);
    voxelAudio.playMine();
    this.trauma = Math.min(1, this.trauma + 0.12);

    this.evaluateStabilityAndRefresh(x, z);
  }

  public placeTargeted() {
    if (this.gameMode !== 'playing' || this.photoDof.enabled) return;
    if (this.armedBlueprintId) {
      this.stampArmedBlueprint();
      return;
    }
    if (!this.targetBlock) return;

    const initialStock = getResourceCount(this.inventory, this.selectedBlock);
    if (initialStock <= 0) {
      this.onToast(`Out of ${BLOCK_DEFS[this.selectedBlock].name} — mine blocks to gather more!`);
      return;
    }

    const { x, y, z, nx, ny, nz } = this.targetBlock;
    const px = x + nx;
    const py = y + ny;
    const pz = z + nz;

    const batch: BlockChange[] = [];
    let placedCount = 0;
    let ranOut = false;

    const tryPlace = (bx: number, by: number, bz: number, id: BlockId) => {
      if (!this.grid.inBounds(bx, by, bz)) return;
      // Avoid trapping player inside placed solid block
      if (
        Math.floor(this.player.x) === bx &&
        Math.floor(this.player.z) === bz &&
        (Math.floor(this.player.y) === by || Math.floor(this.player.y + 1) === by)
      ) {
        return;
      }
      const prev = this.grid.getBlock(bx, by, bz);
      if (prev === id) return;

      const { next, consumed } = consumeResourceFromInventory(this.inventory, id, 1);
      if (consumed === 0) {
        ranOut = true;
        return;
      }
      this.inventory = next;
      if (isCollectibleBlock(prev)) {
        this.inventory = addResourceToInventory(this.inventory, prev, 1);
      }

      batch.push({
        x: bx,
        y: by,
        z: bz,
        prevId: prev,
        nextId: id,
        prevAnchored: this.grid.isAnchored(bx, by, bz),
        nextAnchored: false,
      });
      this.grid.setBlock(bx, by, bz, id, false);
      this.totalPlacedBlocks++;
      placedCount++;
    };

    if (this.activeBrush === 'platform3x3') {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          tryPlace(px + dx, py, pz + dz, this.selectedBlock);
        }
      }
    } else if (this.activeBrush === 'pillar4') {
      for (let dy = 0; dy < 4; dy++) {
        tryPlace(px, py + dy, pz, this.selectedBlock);
      }
    } else if (this.activeBrush === 'flatten') {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          tryPlace(x + dx, y, z + dz, this.selectedBlock);
          for (let dy = 1; dy <= 3; dy++) {
            const above = this.grid.getBlock(x + dx, y + dy, z + dz);
            if (above !== BlockId.Air && above !== BlockId.Bedrock) {
              batch.push({
                x: x + dx,
                y: y + dy,
                z: z + dz,
                prevId: above,
                nextId: BlockId.Air,
                prevAnchored: this.grid.isAnchored(x + dx, y + dy, z + dz),
                nextAnchored: false,
              });
              this.grid.setBlock(x + dx, y + dy, z + dz, BlockId.Air, false);
              if (isCollectibleBlock(above)) {
                this.inventory = addResourceToInventory(this.inventory, above, 1);
              }
            }
          }
        }
      }
    } else {
      tryPlace(px, py, pz, this.selectedBlock);
    }

    if (batch.length === 0) return;
    this.undoStack.push(batch);
    if (this.undoStack.length > 40) this.undoStack.shift();

    savePersistentInventory(this.inventory);
    if (ranOut && placedCount > 0) {
      this.onToast(
        `Placed ${placedCount} ${BLOCK_DEFS[this.selectedBlock].shortName} (${BLOCK_DEFS[this.selectedBlock].shortName} stock depleted)`
      );
    }

    voxelAudio.playPlace();
    this.evaluateStabilityAndRefresh(px, pz);
  }

  public undoLastEdit() {
    const batch = this.undoStack.pop();
    if (!batch) {
      this.onToast('Nothing to undo');
      return;
    }
    for (let i = batch.length - 1; i >= 0; i--) {
      const c = batch[i];
      this.grid.setBlock(c.x, c.y, c.z, c.prevId, c.prevAnchored);
    }
    this.inventory = revertBatchInInventory(this.inventory, batch);
    savePersistentInventory(this.inventory);
    const fx = batch[0]?.x ?? this.player.x;
    const fz = batch[0]?.z ?? this.player.z;
    solveStructuralStability(this.grid, fx, fz, 24);
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.renderFrame();
    voxelAudio.playPlace(0.85);
    this.pushHudSnapshot();
  }

  private evaluateStabilityAndRefresh(focusX = this.player.x, focusZ = this.player.z) {
    if (this.config.stabilityEnabled) {
      const collapsed = collapseUnstableBlocks(this.grid, focusX, focusZ, 24);
      if (collapsed.length > 0) {
        this.spawnCollapseDebris(collapsed);
      }
    } else {
      solveStructuralStability(this.grid, focusX, focusZ, 24);
    }
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public generateHouseAtPlayer(style: HouseStyle) {
    // Place house 9 blocks ahead of player gaze direction
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const hx = Math.round(this.player.x + forwardX * 9);
    const hz = Math.round(this.player.z + forwardZ * 9);

    this.ensureSectorsInArea(hx - 10, hx + 10, hz - 10, hz + 10);

    const res = buildProceduralHouse(
      this.grid,
      hx,
      hz,
      style,
      Math.floor(this.elapsed * 100) + this.plots.length + this.config.seed
    );
    this.plots.push(res.plot);
    this.totalPlacedBlocks += res.placedCount;

    // Spawn a resident villager at the doorway
    const roles: Array<'mason' | 'farmer' | 'ranger'> = ['mason', 'farmer', 'ranger'];
    const newNpc = createNpcActor(
      roles[this.plots.length % roles.length],
      res.doorX + 0.5,
      res.doorY,
      res.doorZ + 1.2,
      this.npcs.length,
      this.config.seed
    );
    this.npcs.push(newNpc);
    const rig = buildNpcRig(newNpc);
    this.npcGroup.add(rig.group);
    this.npcRigs.push(rig);

    this.ensureDefaultBlockColors();
    solveStructuralStability(this.grid, hx, hz, 24);
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.renderFrame();
    voxelAudio.playBuildChime();
    this.onToast(`Built ${res.plot.label} (${res.placedCount} modular blocks)`);
    this.pushHudSnapshot();
  }

  public triggerVillageExpansion() {
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const vx = Math.round(this.player.x + forwardX * 14);
    const vz = Math.round(this.player.z + forwardZ * 14);

    this.ensureSectorsInArea(vx - 24, vx + 24, vz - 24, vz + 24);

    const expansion = expandVillage(
      this.grid,
      vx,
      vz,
      this.plots,
      this.config.seed + this.plots.length * 17 + 13
    );

    if (expansion.plots.length === 0) {
      const altX = Math.round(this.player.x + forwardX * 36);
      const altZ = Math.round(this.player.z + forwardZ * 36);
      this.ensureSectorsInArea(altX - 24, altX + 24, altZ - 24, altZ + 24);
      const alt = expandVillage(this.grid, altX, altZ, this.plots, this.config.seed + 99);
      this.applyVillageExpansion(alt);
      return;
    }

    this.applyVillageExpansion(expansion);
  }

  private applyVillageExpansion(expansion: ReturnType<typeof expandVillage>) {
    this.plots.push(...expansion.plots);
    this.totalPlacedBlocks += expansion.placedBlocks;

    for (const sp of expansion.newNpcSpawns) {
      const actor = createNpcActor(
        sp.role,
        sp.x,
        sp.y,
        sp.z,
        this.npcs.length,
        this.config.seed
      );
      this.npcs.push(actor);
      const rig = buildNpcRig(actor);
      this.npcGroup.add(rig.group);
      this.npcRigs.push(rig);
    }

    this.ensureDefaultBlockColors();
    solveStructuralStability(this.grid, expansion.plazaX, expansion.plazaZ, 28);
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.renderFrame();
    voxelAudio.playBuildChime();
    this.onToast(
      `Village Expanded! +${expansion.plots.length} buildings & +${expansion.newNpcSpawns.length} residents`
    );
    this.pushHudSnapshot();
  }

  public summonVoxelAsset(role: NpcRole, emitToast = true, slotIndex = 0): NpcActor {
    const placement = computeSummonPlacement(
      this.grid,
      this.player,
      this.targetBlock,
      slotIndex
    );
    this.ensureSectorsInArea(
      placement.x - 4,
      placement.x + 4,
      placement.z - 4,
      placement.z + 4
    );
    const groundY = this.grid.getSurfaceY(
      Math.floor(placement.x),
      Math.floor(placement.z),
      false
    );
    const spawnY = Math.max(placement.y, groundY);

    const actor = createNpcActor(
      role,
      placement.x,
      spawnY,
      placement.z,
      this.npcs.length + this.summonedCount,
      this.config.seed + this.summonedCount * 17
    );
    actor.yaw = placement.yaw;

    this.npcs.push(actor);
    const rig = buildNpcRig(actor);
    rig.group.position.set(actor.x, actor.y, actor.z);
    rig.group.rotation.y = actor.yaw;
    this.npcGroup.add(rig.group);
    this.npcRigs.push(rig);
    this.summonedCount++;

    const def = getSummonAssetDef(role);
    this.spawnParticles(actor.x - 0.5, actor.y + 0.4, actor.z - 0.5, def.primaryColor, 10, 3.8);
    this.spawnParticles(actor.x - 0.5, actor.y + 0.7, actor.z - 0.5, def.accentColor, 6, 3.2);

    if (emitToast) {
      voxelAudio.playBuildChime();
      this.onToast(`Summoned ${def.label} (${actor.name})`);
      this.pushHudSnapshot();
    }
    return actor;
  }

  public summonDefaultAssets(): NpcActor[] {
    const spawned: NpcActor[] = [];
    DEFAULT_SUMMON_PACK.forEach((role, idx) => {
      spawned.push(this.summonVoxelAsset(role, false, idx));
    });
    voxelAudio.playBuildChime();
    this.onToast(
      `Summoned Default Pack (${spawned.length} voxel assets: Ranger, Fox, Moss Slime & Obsidian Golem)`
    );
    this.pushHudSnapshot();
    return spawned;
  }

  public scramblePortal(): PortalCoords {
    this.ensureSectorsInArea(
      this.player.x - 28,
      this.player.x + 28,
      this.player.z - 28,
      this.player.z + 28
    );

    const dim = this.config.dimension ?? 'overworld';
    const groundBlock =
      dim === 'volcanic'
        ? BlockId.Basalt
        : dim === 'hawaii_beach'
        ? BlockId.BeachSand
        : dim === 'dark_dungeon'
        ? BlockId.DungeonBrick
        : BlockId.Grass;
    const daisBlock =
      dim === 'volcanic'
        ? BlockId.Basalt
        : dim === 'hawaii_beach'
        ? BlockId.Sandstone
        : dim === 'dark_dungeon'
        ? BlockId.DungeonSlate
        : BlockId.Cobblestone;

    clearHugePortalStructure(
      this.grid,
      this.portalPos.x,
      this.portalPos.y,
      this.portalPos.z,
      groundBlock
    );

    const nextPortal = scramblePortalPosition(
      this.grid,
      this.player.x,
      this.player.z,
      this.plots,
      this.portalPos,
      Math.random,
      10,
      24
    );

    buildHugePortalStructure(
      this.grid,
      nextPortal.x,
      nextPortal.y,
      nextPortal.z,
      daisBlock
    );

    this.portalPos = nextPortal;
    if (this.portalVisual) {
      this.portalVisual.group.position.set(
        nextPortal.x + 0.5,
        nextPortal.y,
        nextPortal.z + 0.5
      );
    }

    this.rebuildDirtySectors(this.isSoftwareGl ? 2 : ACTIVE_SECTOR_RADIUS);
    this.spawnParticles(nextPortal.x, nextPortal.y + 4, nextPortal.z, '#c77dff', 18, 5.2);
    this.spawnParticles(nextPortal.x, nextPortal.y + 6, nextPortal.z, '#ffe066', 12, 4.4);
    voxelAudio.playPortalWarp();
    this.nearPortal = isPlayerNearPortal(this.player, this.portalPos);
    this.onToast(`Huge Portal scrambled to XYZ ${nextPortal.x}, ${nextPortal.y}, ${nextPortal.z}`);
    this.pushHudSnapshot();
    return nextPortal;
  }

  public teleportViaPortal(forcedDimension?: DimensionId): DimensionId {
    const curDim = this.config.dimension ?? 'overworld';
    const dest = forcedDimension ?? pickRandomPortalDestination(curDim);
    const nextSeed = Math.floor(100 + Math.random() * 9900);

    this.config = {
      ...this.config,
      seed: nextSeed,
      dimension: dest,
    };
    this.undoStack = [];
    this.portalCooldown = 3.5;
    this.weatherState = createInitialWeatherState(this.config.biome);
    this.buildWorld(this.config);
    this.facePortal();

    this.trauma = Math.min(1, this.trauma + 0.35);
    this.spawnParticles(this.portalPos.x, this.portalPos.y + 4, this.portalPos.z, '#c77dff', 18, 5.2);
    this.spawnParticles(this.portalPos.x, this.portalPos.y + 5.5, this.portalPos.z, '#ffe066', 10, 4.2);
    voxelAudio.playPortalWarp();

    const meta = DIMENSION_PRESETS[dest];
    this.onToast(
      `Teleported to ${meta.name}! Portal at XYZ ${this.portalPos.x}, ${this.portalPos.y}, ${this.portalPos.z}`
    );
    this.pushHudSnapshot();
    return dest;
  }

  public facePortal(): void {
    const dx = this.portalPos.x + 0.5 - this.player.x;
    const dz = this.portalPos.z + 0.5 - this.player.z;
    this.player.yaw = Math.atan2(-dx, -dz);
    this.player.pitch = 0.05;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.rotation.z = 0;
    this.renderFrame();
    this.pushHudSnapshot();
  }

  public getSavedBlueprints(): BlueprintSummary[] {
    return this.blueprints.map(toBlueprintSummary);
  }

  private getArmedBlueprint(): VoxelBlueprint | null {
    if (!this.armedBlueprintId) return null;
    return this.blueprints.find((b) => b.id === this.armedBlueprintId) ?? null;
  }

  private getBlueprintAnchor(): { x: number; y: number; z: number } {
    const bp = this.getArmedBlueprint();
    const minClearance = bp
      ? Math.max(8, Math.ceil(Math.max(bp.width, bp.depth) * 0.5) + 4)
      : 9;

    if (this.targetBlock) {
      const tx = this.targetBlock.x + this.targetBlock.nx;
      const ty = this.targetBlock.y + this.targetBlock.ny;
      const tz = this.targetBlock.z + this.targetBlock.nz;
      const horizDist = Math.hypot(tx - this.player.x, tz - this.player.z);
      if (horizDist >= minClearance) {
        return { x: tx, y: ty, z: tz };
      }
    }

    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const ax = Math.round(this.player.x + forwardX * minClearance);
    const az = Math.round(this.player.z + forwardZ * minClearance);
    const ay = this.grid.hasSectorAt(ax, az)
      ? this.grid.getSurfaceY(ax, az, false)
      : Math.round(this.player.y);
    return { x: ax, y: ay, z: az };
  }

  public captureNearestHouseBlueprint(customName?: string): BlueprintSummary | null {
    const bp = captureNearestPlotBlueprint(
      this.grid,
      this.plots,
      this.player.x,
      this.player.z,
      customName
    );
    if (!bp) {
      this.onToast('No nearby house structure found to copy');
      return null;
    }
    this.blueprints = [bp, ...this.blueprints].slice(0, 24);
    saveBlueprints(this.blueprints);
    this.armedBlueprintId = bp.id;
    this.blueprintRotation = 0;
    voxelAudio.playBuildChime();
    this.onToast(`Saved blueprint "${bp.name}" (${bp.width}×${bp.height}×${bp.depth}, ${bp.blocks.length} blocks)`);
    this.pushHudSnapshot();
    return toBlueprintSummary(bp);
  }

  public markBlueprintCornerA(): { x: number; y: number; z: number } {
    const pos = this.targetBlock
      ? { x: this.targetBlock.x, y: this.targetBlock.y, z: this.targetBlock.z }
      : {
          x: Math.floor(this.player.x),
          y: Math.floor(this.player.y),
          z: Math.floor(this.player.z),
        };
    this.blueprintCornerA = pos;
    voxelAudio.playPlace(1.1);
    this.onToast(`Blueprint Corner A marked at XYZ ${pos.x}, ${pos.y}, ${pos.z}`);
    this.pushHudSnapshot();
    return pos;
  }

  public clearBlueprintCornerA(): void {
    this.blueprintCornerA = null;
    this.pushHudSnapshot();
  }

  public captureCustomRegionBlueprint(customName?: string): BlueprintSummary | null {
    if (!this.blueprintCornerA) {
      this.markBlueprintCornerA();
      return null;
    }
    const cornerB = this.targetBlock
      ? { x: this.targetBlock.x, y: this.targetBlock.y, z: this.targetBlock.z }
      : {
          x: Math.floor(this.player.x),
          y: Math.floor(this.player.y),
          z: Math.floor(this.player.z),
        };

    const bp = captureBlueprintRegion(
      this.grid,
      this.blueprintCornerA,
      cornerB,
      customName || `Region Blueprint ${this.blueprints.length + 1}`,
      'Custom Region'
    );
    if (!bp) {
      this.onToast('Selected voxel region contains no capturable blocks');
      return null;
    }
    this.blueprintCornerA = null;
    this.blueprints = [bp, ...this.blueprints].slice(0, 24);
    saveBlueprints(this.blueprints);
    this.armedBlueprintId = bp.id;
    this.blueprintRotation = 0;
    voxelAudio.playBuildChime();
    this.onToast(`Saved "${bp.name}" (${bp.width}×${bp.height}×${bp.depth}, ${bp.blocks.length} blocks)`);
    this.pushHudSnapshot();
    return toBlueprintSummary(bp);
  }

  public armBlueprint(id: string | null): void {
    if (!id) {
      this.armedBlueprintId = null;
      this.blueprintPreviewMesh.visible = false;
      this.pushHudSnapshot();
      return;
    }
    const found = this.blueprints.find((b) => b.id === id);
    if (!found) return;
    this.armedBlueprintId = found.id;
    this.blueprintRotation = 0;
    this.onToast(`Blueprint armed: ${found.name} — Press R to rotate 90°, click or B to stamp`);
    this.pushHudSnapshot();
  }

  public rotateArmedBlueprint(): 0 | 1 | 2 | 3 {
    this.blueprintRotation = normalizeRotationTurns(this.blueprintRotation + 1);
    const bp = this.getArmedBlueprint();
    if (bp) {
      this.onToast(`Rotated "${bp.name}" to ${this.blueprintRotation * 90}°`);
    }
    this.pushHudSnapshot();
    return this.blueprintRotation;
  }

  public deleteSavedBlueprint(id: string): void {
    this.blueprints = this.blueprints.filter((b) => b.id !== id);
    saveBlueprints(this.blueprints);
    if (this.armedBlueprintId === id) {
      this.armedBlueprintId = null;
      this.blueprintPreviewMesh.visible = false;
    }
    this.onToast('Deleted blueprint');
    this.pushHudSnapshot();
  }

  public stampArmedBlueprint(): number {
    const bp = this.getArmedBlueprint();
    if (!bp) {
      this.onToast('Select or copy a blueprint first');
      return 0;
    }
    const anchor = this.getBlueprintAnchor();
    const padRadius = Math.max(bp.width, bp.depth) + 6;
    this.ensureSectorsInArea(
      anchor.x - padRadius,
      anchor.x + padRadius,
      anchor.z - padRadius,
      anchor.z + padRadius
    );

    const { placedCount, batch } = stampBlueprint(
      this.grid,
      bp,
      anchor.x,
      anchor.y,
      anchor.z,
      this.blueprintRotation
    );

    if (batch.length === 0) {
      this.onToast('No blocks changed at this blueprint placement');
      return 0;
    }

    this.undoStack.push(batch);
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.totalPlacedBlocks += placedCount;

    this.ensureDefaultBlockColors();
    solveStructuralStability(this.grid, anchor.x, anchor.z, 26);
    this.rebuildDirtySectors(this.getActiveRenderRadius());
    this.spawnParticles(anchor.x, anchor.y + 1.5, anchor.z, '#5ce1e6', 14, 4.4);
    this.renderFrame();
    voxelAudio.playBuildChime();
    this.onToast(
      `Stamped "${bp.name}" (${this.blueprintRotation * 90}°, ${placedCount} blocks)`
    );
    this.pushHudSnapshot();
    return placedCount;
  }

  private interactNearbyNpc() {
    const npc =
      this.targetNpc ??
      this.npcs.find(
        (n) => Math.hypot(n.x - this.player.x, n.z - this.player.z) < 4.5
      ) ??
      null;
    if (!npc) {
      if (this.nearPortal) {
        this.teleportViaPortal();
      }
      return;
    }
    const msg = interactWithNpc(npc, this.simTick, this.weatherState.current, this.timeOfDay);
    voxelAudio.playNpcGreet();
    this.onToast(msg);
    this.pushHudSnapshot();
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.gameMode !== 'playing') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      this.keysHeld.add(e.code);

      if (this.photoDof.enabled) {
        if (e.code === 'BracketLeft') {
          this.adjustPhotoAperture(-0.0004);
        } else if (e.code === 'BracketRight') {
          this.adjustPhotoAperture(0.0004);
        } else if (e.code === 'Enter') {
          e.preventDefault();
          this.capturePhotoPng();
        } else if (e.code === 'KeyF') {
          this.toggleFlyMode();
        }
        return;
      }

      if (e.code === 'KeyX') {
        this.mineTargeted();
      } else if (e.code === 'KeyB') {
        this.placeTargeted();
      } else if (e.code === 'KeyE') {
        this.interactNearbyNpc();
      } else if (e.code === 'KeyF') {
        this.toggleFlyMode();
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey || !this.keysHeld.has('ShiftLeft'))) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.undoLastEdit();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
      // Variable jump height cut
      if (e.code === 'Space' && !this.player.flyMode && this.player.vy > 2.0) {
        this.player.vy *= 0.5;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.gameMode !== 'playing') return;
      if (e.target !== canvas) return;
      if (e.button === 0) {
        this.isDraggingLook = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.dragMoved = false;
      } else if (e.button === 2) {
        e.preventDefault();
        if (!this.photoDof.enabled) {
          this.placeTargeted();
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.gameMode !== 'playing') return;
      if (document.pointerLockElement === canvas) {
        this.player.yaw -= e.movementX * 0.0024;
        this.player.pitch = Math.max(
          -1.45,
          Math.min(1.45, this.player.pitch - e.movementY * 0.0024)
        );
      } else if (this.isDraggingLook) {
        if (
          Math.abs(e.clientX - this.dragStartX) > 4 ||
          Math.abs(e.clientY - this.dragStartY) > 4
        ) {
          this.dragMoved = true;
        }
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.player.yaw -= dx * 0.0035;
        this.player.pitch = Math.max(
          -1.45,
          Math.min(1.45, this.player.pitch - dy * 0.0035)
        );
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        if (
          this.gameMode === 'playing' &&
          !this.photoDof.enabled &&
          !this.dragMoved &&
          e.target === canvas
        ) {
          // Click on canvas: mine if pointer locked or mine directly + optionally engage pointer lock
          if (document.pointerLockElement === canvas) {
            this.mineTargeted();
          } else {
            this.mineTargeted();
            canvas.requestPointerLock?.();
          }
        }
        this.isDraggingLook = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === canvas) e.preventDefault();
    };

    const onBlur = () => {
      this.keysHeld.clear();
      this.isDraggingLook = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);

    this.cleanupEvents = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }

  private cleanupEvents = () => {};

  private updatePlayerPhysics(dt: number) {
    const p = this.player;
    const forwardInput =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const strafeInput =
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);

    const sprinting = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const moveSpeed = p.flyMode ? (sprinting ? 28 : 14) : sprinting ? 7.8 : 5.2;

    const sinY = Math.sin(p.yaw);
    const cosY = Math.cos(p.yaw);
    // Forward is -Z when yaw = 0
    let wishX = -sinY * forwardInput + cosY * strafeInput;
    let wishZ = -cosY * forwardInput - sinY * strafeInput;
    const len = Math.hypot(wishX, wishZ);
    if (len > 0) {
      wishX /= len;
      wishZ /= len;
    }

    const accel = p.grounded || p.flyMode ? 14 : 6;
    p.vx += (wishX * moveSpeed - p.vx) * Math.min(1, dt * accel);
    p.vz += (wishZ * moveSpeed - p.vz) * Math.min(1, dt * accel);

    if (p.flyMode) {
      const vert =
        (this.keysHeld.has('Space') ? 1 : 0) -
        (this.keysHeld.has('KeyC') ? 1 : 0);
      p.vy += (vert * 11 - p.vy) * Math.min(1, dt * 10);
    } else {
      if (this.keysHeld.has('Space')) {
        p.jumpBuffer = 0.12;
      } else {
        p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
      }

      if (p.grounded) {
        p.coyoteTimer = 0.1;
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
      }

      if (p.jumpBuffer > 0 && p.coyoteTimer > 0) {
        p.vy = 8.4;
        p.grounded = false;
        p.coyoteTimer = 0;
        p.jumpBuffer = 0;
        voxelAudio.playJump();
      }

      p.vy -= 22 * dt; // Gravity
      p.vy = Math.max(-24, p.vy);
    }

    // Horizontal AABB collision + automatic 1-block step-up for smooth exploration
    const radius = 0.28;
    const collidesAt = (nx: number, ny: number, nz: number): boolean => {
      const minX = Math.floor(nx - radius);
      const maxX = Math.floor(nx + radius);
      const minZ = Math.floor(nz - radius);
      const maxZ = Math.floor(nz + radius);
      const minY = Math.floor(ny + 0.05);
      const maxY = Math.floor(ny + 1.68);
      for (let bx = minX; bx <= maxX; bx++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          for (let by = minY; by <= maxY; by++) {
            if (this.grid.isSolid(bx, by, bz)) return true;
          }
        }
      }
      return false;
    };

    const nextX = this.grid.isEndless
      ? p.x + p.vx * dt
      : Math.max(1.5, Math.min(this.grid.sizeX - 1.5, p.x + p.vx * dt));
    if (!collidesAt(nextX, p.y, p.z)) {
      p.x = nextX;
    } else if (!p.flyMode && p.grounded && !collidesAt(nextX, p.y + 1.05, p.z)) {
      p.x = nextX;
      p.y += 1.02;
    } else {
      p.vx = 0;
    }

    const nextZ = this.grid.isEndless
      ? p.z + p.vz * dt
      : Math.max(1.5, Math.min(this.grid.sizeZ - 1.5, p.z + p.vz * dt));
    if (!collidesAt(p.x, p.y, nextZ)) {
      p.z = nextZ;
    } else if (!p.flyMode && p.grounded && !collidesAt(p.x, p.y + 1.05, nextZ)) {
      p.z = nextZ;
      p.y += 1.02;
    } else {
      p.vz = 0;
    }

    const prevVy = p.vy;
    const nextY = Math.max(1, Math.min(this.grid.sizeY - 2, p.y + p.vy * dt));
    if (!collidesAt(p.x, nextY, p.z)) {
      p.y = nextY;
      p.grounded = false;
    } else {
      if (p.vy < 0) {
        if (!p.grounded && prevVy < -6.5) {
          voxelAudio.playLand();
        }
        p.y = Math.ceil(nextY);
        p.grounded = true;
      }
      p.vy = 0;
    }
  }

  private updateParticles(dt: number) {
    let anyChanged = false;
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }

      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += dt * 4;
      p.ry += dt * 5;

      const t = 1 - p.life / p.maxLife;
      const s = p.scale * t;
      _pos.set(p.x, p.y, p.z);
      _quat.setFromEuler(new THREE.Euler(p.rx, p.ry, 0));
      _scale.set(s, s, s);
      _mat4.compose(_pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.set(p.colorHex));
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private triggerLightningStrike(biasInFront = false) {
    let offX = this.weatherState.lightningOffsetX;
    let offZ = this.weatherState.lightningOffsetZ;
    if (biasInFront) {
      const dist = 42;
      offX = -Math.sin(this.player.yaw) * dist;
      offZ = -Math.cos(this.player.yaw) * dist;
    }

    const bx = this.player.x + offX;
    const bz = this.player.z + offZ;
    const atmo = getWeatherAtmosphere(
      this.weatherState,
      this.config.biome,
      this.timeOfDay,
      this.config.dimension ?? 'overworld'
    );
    const topY = atmo.cloudAltitude;
    const groundY = this.grid.hasSectorAt(Math.floor(bx), Math.floor(bz))
      ? this.grid.getSurfaceY(Math.floor(bx), Math.floor(bz), false)
      : WATER_LEVEL;

    const spanY = Math.max(12, topY - groundY);
    const stepY = spanY / LIGHTNING_SEGMENTS;
    let curX = bx;
    let curZ = bz;
    const seed = this.weatherState.thunderCount * 37 + 13;

    for (let s = 0; s < LIGHTNING_SEGMENTS; s++) {
      const seg = this.lightningSegments[s];
      const h1 = Math.sin(seed + s * 12.9898) * 43758.5453;
      const h2 = Math.sin(seed + s * 78.233) * 43758.5453;
      const rx = (h1 - Math.floor(h1) - 0.5) * 3.2;
      const rz = (h2 - Math.floor(h2) - 0.5) * 3.2;
      const nextX = s === LIGHTNING_SEGMENTS - 1 ? curX : curX + rx;
      const nextZ = s === LIGHTNING_SEGMENTS - 1 ? curZ : curZ + rz;

      const yTop = topY - s * stepY;
      const yBot = yTop - stepY;
      const midX = (curX + nextX) * 0.5;
      const midY = (yTop + yBot) * 0.5;
      const midZ = (curZ + nextZ) * 0.5;
      const segLen = Math.hypot(nextX - curX, stepY, nextZ - curZ);

      seg.position.set(midX, midY, midZ);
      seg.scale.set(1.1 - s * 0.06, segLen * 1.06, 1.1 - s * 0.06);
      seg.lookAt(nextX, yBot, nextZ);
      seg.rotateX(Math.PI * 0.5);

      curX = nextX;
      curZ = nextZ;
    }

    this.lightningLight.position.set(bx, topY - 4, bz);
    if (this.gameMode === 'playing') {
      voxelAudio.playThunder(1.0);
      this.trauma = Math.min(1, this.trauma + 0.28);
    }
  }

  private updateClouds(
    dt: number,
    cloudColorHex: string,
    cloudShadeHex: string,
    cloudCoverage: number,
    cloudScaleMult: number,
    cloudOpacity: number,
    cloudAltitude: number
  ) {
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const halfSpan = CLOUD_SPAN_XZ * 0.5;

    const mat = this.cloudMesh.material as THREE.MeshBasicMaterial;
    mat.opacity = cloudOpacity;

    _cloudTopColor.set(cloudColorHex);
    _cloudShadeColor.set(cloudShadeHex);
    _quat.identity();

    const windX = this.weatherState.windX;
    const windZ = this.weatherState.windZ;

    // 5 sub-voxel puff layout per cloud cluster: [dx, dy, dz, sx, sy, sz, isTop]
    const puffOffsets: Array<[number, number, number, number, number, number, boolean]> = [
      [0, 0.8, 0, 11.5, 2.8, 8.5, true],
      [-5.2, 0.1, 1.8, 7.5, 2.2, 6.2, false],
      [5.4, 0.2, -1.6, 7.8, 2.3, 6.4, false],
      [1.2, 1.9, -0.4, 6.4, 2.2, 5.2, true],
      [-1.5, -0.5, 0.6, 9.2, 1.7, 7.2, false],
    ];

    let idx = 0;
    for (let c = 0; c < CLOUD_CLUSTER_COUNT; c++) {
      const spd = this.cloudClusterSpeed[c];
      let cx = this.cloudClusterX[c] + (windX * 0.65 + 0.45) * spd * dt;
      let cz = this.cloudClusterZ[c] + (windZ * 0.65 + 0.12) * spd * dt;

      if (cx > halfSpan) cx -= CLOUD_SPAN_XZ;
      else if (cx < -halfSpan) cx += CLOUD_SPAN_XZ;
      if (cz > halfSpan) cz -= CLOUD_SPAN_XZ;
      else if (cz < -halfSpan) cz += CLOUD_SPAN_XZ;

      this.cloudClusterX[c] = cx;
      this.cloudClusterZ[c] = cz;

      const visible = this.cloudClusterThreshold[c] <= cloudCoverage;
      const baseScale = this.cloudClusterScale[c] * cloudScaleMult;
      const wx = camX + cx;
      const wy = cloudAltitude + this.cloudClusterY[c];
      const wz = camZ + cz;

      for (let b = 0; b < CLOUD_BLOCKS_PER_CLUSTER; b++) {
        const [ox, oy, oz, sx, sy, sz, isTop] = puffOffsets[b];
        if (!visible) {
          _mat4.makeScale(0, 0, 0);
        } else {
          _pos.set(wx + ox * baseScale, wy + oy * baseScale, wz + oz * baseScale);
          _scale.set(sx * baseScale, sy * baseScale, sz * baseScale);
          _mat4.compose(_pos, _quat, _scale);
        }
        this.cloudMesh.setMatrixAt(idx, _mat4);
        this.cloudMesh.setColorAt(idx, isTop ? _cloudTopColor : _cloudShadeColor);
        idx++;
      }
    }

    this.cloudMesh.instanceMatrix.needsUpdate = true;
    if (this.cloudMesh.instanceColor) this.cloudMesh.instanceColor.needsUpdate = true;
  }

  private applyWeatherAtmosphere(dt: number) {
    const sunAngle = this.timeOfDay * Math.PI * 2;
    const daylight = Math.max(0.25, Math.sin(sunAngle) * 0.75 + 0.5);
    const atmo = getWeatherAtmosphere(
      this.weatherState,
      this.config.biome,
      this.timeOfDay,
      this.config.dimension ?? 'overworld'
    );
    this.sunLight.intensity = (1.2 + daylight * 1.15) * atmo.sunIntensityMult;
    this.hemiLight.intensity = (0.45 + daylight * 0.35) * atmo.hemiIntensityMult;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.set(atmo.skyColorHex);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(atmo.fogColorHex);
      this.scene.fog.density = atmo.fogDensity;
    }
    (this.distantSeaMesh.material as THREE.MeshStandardMaterial).color.set(atmo.seaColorHex);

    // Update lightning bolt visibility & point flash
    const flash = atmo.lightningFlash;
    this.lightningGroup.visible = flash > 0.08 && atmo.stormAmount > 0.15;
    this.lightningLight.intensity = flash * 5.2;
    if (this.lightningSegments.length > 0) {
      const boltMat = this.lightningSegments[0].material as THREE.MeshBasicMaterial;
      boltMat.opacity = Math.min(1, flash * 1.15);
    }

    this.updateClouds(
      dt,
      atmo.cloudColorHex,
      atmo.cloudShadeHex,
      atmo.cloudCoverage,
      atmo.cloudScaleMult,
      atmo.cloudOpacity,
      atmo.cloudAltitude
    );

    this.updatePrecipitation(dt, atmo.rainAmount, atmo.snowAmount, atmo.stormAmount);
  }

  private updateDaylightCycle(dt: number, weatherDt: number) {
    this.timeOfDay = (this.timeOfDay + dt * 0.0045) % 1;
    const sunAngle = this.timeOfDay * Math.PI * 2;
    const sunY = Math.sin(sunAngle) * 58 + 18;
    const sunX = this.player.x + Math.cos(sunAngle) * 52;
    const sunZ = this.player.z + 24;
    this.sunLight.position.set(sunX, Math.max(14, sunY), sunZ);
    this.sunLight.target.position.set(this.player.x, 10, this.player.z);
    this.sunLight.target.updateMatrixWorld();
    this.distantSeaMesh.position.set(this.player.x, WATER_LEVEL - 0.55, this.player.z);

    const { state: nextWeather, changed, triggeredLightning } = stepWeatherState(
      this.weatherState,
      weatherDt,
      this.config.biome
    );
    this.weatherState = nextWeather;
    if (triggeredLightning) {
      this.triggerLightningStrike(false);
    }
    if (changed && this.gameMode === 'playing') {
      const label =
        nextWeather.current === 'clear'
          ? 'Clear Skies Returning'
          : nextWeather.current === 'rainy'
          ? 'Rain Clouds Gathering'
          : nextWeather.current === 'storm'
          ? 'Thunderstorm Approaching!'
          : 'Gentle Snowfall Beginning';
      this.onToast(`Weather Shift: ${label}`);
      this.pushHudSnapshot();
    }

    this.applyWeatherAtmosphere(dt);
  }

  private updatePrecipitation(
    dt: number,
    rainAmount: number,
    snowAmount: number,
    stormAmount = 0
  ) {
    const activeAmount = Math.max(rainAmount, snowAmount);
    if (activeAmount <= 0.02) {
      this.precipMesh.visible = false;
      return;
    }

    this.precipMesh.visible = true;
    const isSnow = snowAmount >= rainAmount;
    const centerX = this.camera.position.x;
    const centerY = this.camera.position.y - 3;
    const centerZ = this.camera.position.z;
    const halfXZ = PRECIP_SPAN_XZ * 0.5;

    const fallSpeed = isSnow ? 3.2 : 23.5 + stormAmount * 7.5;
    const wx = this.weatherState.windX;
    const wz = this.weatherState.windZ;

    const mat = this.precipMesh.material as THREE.MeshBasicMaterial;
    mat.opacity = isSnow ? 0.92 * snowAmount : Math.min(0.9, (0.78 + stormAmount * 0.14) * rainAmount);

    if (isSnow) {
      _euler.set(0, 0, 0);
      _quat.setFromEuler(_euler);
      _color.copy(_snowColor);
    } else {
      // Tilt rain streaks slightly along wind direction (steeper during thunderstorms)
      const tilt = 0.04 + stormAmount * 0.018;
      _euler.set(wz * tilt, 0, -wx * tilt);
      _quat.setFromEuler(_euler);
      _color.copy(stormAmount > 0.4 ? _stormRainColor : _rainColor);
    }

    for (let i = 0; i < PRECIP_COUNT; i++) {
      const spd = this.precipSpeed[i];
      const phase = this.precipPhase[i];
      let x = this.precipX[i] + wx * dt * (isSnow ? 0.55 : 0.95);
      let z = this.precipZ[i] + wz * dt * (isSnow ? 0.55 : 0.95);
      let y = this.precipY[i] - fallSpeed * spd * dt;

      if (isSnow) {
        x += Math.sin(this.elapsed * 1.9 + phase) * 0.85 * dt;
        z += Math.cos(this.elapsed * 1.6 + phase) * 0.85 * dt;
      }

      if (y < 0) y += PRECIP_SPAN_Y;
      if (x > halfXZ) x -= PRECIP_SPAN_XZ;
      else if (x < -halfXZ) x += PRECIP_SPAN_XZ;
      if (z > halfXZ) z -= PRECIP_SPAN_XZ;
      else if (z < -halfXZ) z += PRECIP_SPAN_XZ;

      this.precipX[i] = x;
      this.precipY[i] = y;
      this.precipZ[i] = z;

      _pos.set(centerX + x, centerY + y, centerZ + z);
      if (isSnow) {
        const s = (0.14 + (i % 3) * 0.032) * snowAmount;
        _scale.set(s, s, s);
      } else {
        const h = (0.78 + stormAmount * 0.35 + (i % 4) * 0.14) * rainAmount;
        _scale.set(0.052 + stormAmount * 0.015, h, 0.052 + stormAmount * 0.015);
      }

      _mat4.compose(_pos, _quat, _scale);
      this.precipMesh.setMatrixAt(i, _mat4);
      this.precipMesh.setColorAt(i, _color);
    }

    this.precipMesh.instanceMatrix.needsUpdate = true;
    if (this.precipMesh.instanceColor) this.precipMesh.instanceColor.needsUpdate = true;
  }

  private tick() {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    const weatherDt = Math.min(Math.max(rawDt, 0.001), 0.25);

    if (this.gameMode !== 'paused') {
      this.elapsed += dt;
      this.simTick++;
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      if (this.portalVisual) {
        updateHugePortalVisual(
          this.portalVisual,
          this.elapsed,
          this.config.dimension ?? 'overworld'
        );
      }
      this.updateDaylightCycle(dt, weatherDt);
      this.updateParticles(dt);

      const playerSprinting =
        this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');

      // Step AI NPCs & Animals within active simulation horizon
      for (let i = 0; i < this.npcs.length; i++) {
        const actor = this.npcs[i];
        const distSq =
          (actor.x - this.player.x) * (actor.x - this.player.x) +
          (actor.z - this.player.z) * (actor.z - this.player.z);
        const rig = this.npcRigs[i];
        if (distSq > 115 * 115) {
          if (rig) rig.group.visible = false;
          continue;
        }
        if (rig) rig.group.visible = true;
        stepNpcActor(
          actor,
          this.grid,
          this.npcs,
          this.player,
          playerSprinting,
          this.plots,
          dt,
          this.timeOfDay,
          this.simTick,
          this.weatherState.current
        );
        animateNpcRig(rig, dt, this.elapsed);
      }
    }

    if (this.gameMode === 'title') {
      // Atmospheric Live World Camera Tour orbiting starter hamlet from open meadow side
      const orbitAngle = this.elapsed * 0.15 - 0.32;
      const cx = 16;
      const cz = 10;
      const radius = 21;
      this.camera.position.set(
        cx + Math.sin(orbitAngle) * radius,
        20.5 + Math.sin(this.elapsed * 0.35) * 1.4,
        cz + Math.cos(orbitAngle) * radius
      );
      this.camera.lookAt(cx - 2.5, 12.2, cz - 2);
      this.highlightMesh.visible = false;
      this.ghostMesh.visible = false;
    } else if (this.gameMode === 'playing') {
      let rem = this.isSoftwareGl ? Math.min(Math.max(rawDt, 0.001), 0.25) : dt;
      while (rem > 0) {
        const step = Math.min(0.05, rem);
        this.updatePlayerPhysics(step);
        rem -= step;
      }
      this.streamSectorsAroundPlayer();

      this.nearPortal = isPlayerNearPortal(this.player, this.portalPos);
      if (
        !this.photoDof.enabled &&
        this.portalCooldown <= 0 &&
        isPlayerInsidePortal(this.player, this.portalPos)
      ) {
        this.teleportViaPortal();
      }

      // Exponentially smooth camera position & apply trauma shake
      const eyeY = this.player.y + 1.62;
      const camLerp = 1 - Math.exp(-26 * dt);
      this.camera.position.x += (this.player.x - this.camera.position.x) * camLerp;
      this.camera.position.y += (eyeY - this.camera.position.y) * camLerp;
      this.camera.position.z += (this.player.z - this.camera.position.z) * camLerp;

      this.trauma = Math.max(0, this.trauma - dt * 1.8);
      const shake = this.trauma * this.trauma * 0.045;
      const shakePitch = shake * Math.sin(this.elapsed * 47);
      const shakeYaw = shake * Math.cos(this.elapsed * 41);

      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.player.yaw + shakeYaw;
      this.camera.rotation.x = this.player.pitch + shakePitch;
      this.camera.rotation.z = 0;

      if (this.photoDof.enabled) {
        this.highlightMesh.visible = false;
        this.ghostMesh.visible = false;
        this.blueprintPreviewMesh.visible = false;
        this.targetBlock = null;
        this.targetNpc = null;
        if (this.photoDof.autoFocus) {
          const hit = this.raycastVoxel(48);
          const hitDist = hit
            ? Math.hypot(
                hit.x + 0.5 - this.camera.position.x,
                hit.y + 0.5 - this.camera.position.y,
                hit.z + 0.5 - this.camera.position.z
              )
            : null;
          this.photoDof.focus = stepAutoFocusDistance(this.photoDof.focus, hitDist, dt);
        }
      } else {
        // Update block target & ghost preview
        this.targetBlock = this.raycastVoxel(8.5);
        this.targetNpc = this.findTargetedNpc();

        if (this.targetBlock) {
          this.highlightMesh.visible = true;
          this.highlightMesh.position.set(
            this.targetBlock.x + 0.5,
            this.targetBlock.y + 0.5,
            this.targetBlock.z + 0.5
          );

          const gx = this.targetBlock.x + this.targetBlock.nx;
          const gy = this.targetBlock.y + this.targetBlock.ny;
          const gz = this.targetBlock.z + this.targetBlock.nz;
          if (!this.armedBlueprintId && this.grid.inBounds(gx, gy, gz)) {
            this.ghostMesh.visible = true;
            this.ghostMesh.position.set(gx + 0.5, gy + 0.5, gz + 0.5);
          } else {
            this.ghostMesh.visible = false;
          }
        } else {
          this.highlightMesh.visible = false;
          this.ghostMesh.visible = false;
        }

        this.updateBlueprintPreview();
      }

      this.hudTimer += dt;
      if (this.hudTimer >= 0.1) {
        this.hudTimer = 0;
        this.pushHudSnapshot();
      }
    }

    this.renderFrame();
    this.scheduleNextFrame();
  }

  private updateBlueprintPreview() {
    const bp = this.getArmedBlueprint();
    if (!bp || this.gameMode !== 'playing') {
      this.blueprintPreviewMesh.visible = false;
      return;
    }

    const anchor = this.getBlueprintAnchor();
    const count = Math.min(bp.blocks.length, MAX_BLUEPRINT_BLOCKS);
    this.blueprintPreviewMesh.count = count;
    this.blueprintPreviewMesh.visible = true;
    _quat.identity();
    _scale.set(1, 1, 1);

    for (let i = 0; i < count; i++) {
      const b = bp.blocks[i];
      const rot = rotateBlueprintBlock(b.dx, b.dz, this.blueprintRotation);
      _pos.set(anchor.x + rot.dx + 0.5, anchor.y + b.dy + 0.5, anchor.z + rot.dz + 0.5);
      _mat4.compose(_pos, _quat, _scale);
      this.blueprintPreviewMesh.setMatrixAt(i, _mat4);
      const def = BLOCK_DEFS[b.blockId];
      _color.set(def?.topColor ?? def?.color ?? '#5ce1e6');
      this.blueprintPreviewMesh.setColorAt(i, _color);
    }

    this.blueprintPreviewMesh.instanceMatrix.needsUpdate = true;
    if (this.blueprintPreviewMesh.instanceColor) {
      this.blueprintPreviewMesh.instanceColor.needsUpdate = true;
    }
  }

  private pushHudSnapshot() {
    const dim = this.config.dimension ?? 'overworld';
    const dimMeta = DIMENSION_PRESETS[dim];
    const biomeId = this.grid.getColumnBiome(this.player.x, this.player.z);
    const biomeLabel =
      dim === 'overworld'
        ? BIOME_PRESETS[biomeId]?.name ?? 'Archipelago Realms'
        : dimMeta.name;
    const monsterCount = this.npcs.filter((n) => n.isMonster).length;
    const animalCount = this.npcs.filter((n) => n.isAnimal).length;
    const villagerCount = this.npcs.length - animalCount - monsterCount;
    const shelteringVillagers = this.npcs.filter(
      (n) => !n.isAnimal && !n.isMonster && n.state === 'seek_shelter'
    ).length;
    const prowlingMonsters = this.npcs.filter(
      (n) => n.isMonster && (n.state === 'prowl' || n.state === 'hover')
    ).length;
    const armed = this.getArmedBlueprint();

    this.onHudUpdate({
      playerX: Math.round(this.player.x),
      playerY: Math.round(this.player.y),
      playerZ: Math.round(this.player.z),
      dimension: dim,
      dimensionLabel: dimMeta.name,
      portalPos: {
        x: this.portalPos.x,
        y: this.portalPos.y,
        z: this.portalPos.z,
      },
      nearPortal: this.nearPortal,
      currentBiomeLabel: biomeLabel,
      targetBlock: this.targetBlock,
      targetNpc: this.targetNpc
        ? {
            id: this.targetNpc.id,
            name: this.targetNpc.name,
            role: this.targetNpc.role,
            state: this.targetNpc.state,
            speech: this.targetNpc.speech,
          }
        : null,
      totalPlacedBlocks: this.totalPlacedBlocks,
      npcCount: this.npcs.length,
      villagerCount,
      animalCount,
      monsterCount,
      shelteringVillagers,
      prowlingMonsters,
      summonedCount: this.summonedCount,
      villageCount: Math.max(1, Math.floor(this.plots.length / 2)),
      houseCount: this.plots.length,
      flyMode: this.player.flyMode,
      lastCollapsedCount: this.lastCollapsedCount,
      undoCount: this.undoStack.length,
      timeOfDay: this.timeOfDay,
      isDuskOrNight: isDuskOrNightTime(this.timeOfDay),
      weather: this.weatherState.current,
      weatherIntensity: this.weatherState.intensity,
      weatherAutoCycle: this.weatherState.autoCycle,
      inventory: { ...this.inventory },
      totalInventoryCount: getTotalResourceCount(this.inventory),
      photoMode: this.photoDof.enabled,
      dofFocus: Number(this.photoDof.focus.toFixed(1)),
      activeBlueprint: armed ? toBlueprintSummary(armed) : null,
      blueprintRotation: this.blueprintRotation,
      blueprintCornerA: this.blueprintCornerA ? { ...this.blueprintCornerA } : null,
      blueprintCount: this.blueprints.length,
      stabilityOverlay: this.stabilityOverlay,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupEvents();
    this.resizeObserver.disconnect();
    this.clearAllSectorMeshes();
    if (this.portalVisual) {
      this.scene.remove(this.portalVisual.group);
      this.portalVisual.dispose();
      this.portalVisual = null;
    }
    this.unitBoxGeo.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.precipMesh.geometry.dispose();
    (this.precipMesh.material as THREE.Material).dispose();
    this.cloudMesh.geometry.dispose();
    (this.cloudMesh.material as THREE.Material).dispose();
    if (this.lightningSegments.length > 0) {
      this.lightningSegments[0].geometry.dispose();
      (this.lightningSegments[0].material as THREE.Material).dispose();
    }
    this.distantSeaMesh.geometry.dispose();
    (this.distantSeaMesh.material as THREE.Material).dispose();
    this.highlightMesh.geometry.dispose();
    (this.highlightMesh.material as THREE.Material).dispose();
    this.ghostMesh.geometry.dispose();
    (this.ghostMesh.material as THREE.Material).dispose();
    this.blueprintPreviewMesh.geometry.dispose();
    (this.blueprintPreviewMesh.material as THREE.Material).dispose();
    this.bokehPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
    this.materialLib.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
