import { useCallback, useEffect, useRef, useState } from 'react';
import { ArchitectDrawer } from './components/ArchitectDrawer';
import { GameHud } from './components/GameHud';
import { PauseModal } from './components/PauseModal';
import { TitleOverlay } from './components/TitleOverlay';
import { UnityModal } from './components/UnityModal';
import { voxelAudio } from './voxel/audio';
import { createStarterInventory, getTotalResourceCount } from './voxel/inventory';
import {
  BiomeId,
  BlockId,
  BlueprintSummary,
  EditBrush,
  HOTBAR_PAGES,
  HouseStyle,
  HudSnapshot,
  WorldConfig,
} from './voxel/types';
import { GameMode, VoxelEngine } from './voxel/VoxelEngine';

const STARTER_COUNTS = createStarterInventory();

const INITIAL_HUD: HudSnapshot = {
  playerX: 17,
  playerY: 11,
  playerZ: 20,
  dimension: 'overworld',
  dimensionLabel: 'Overworld Realm',
  portalPos: { x: 26, y: 11, z: 12 },
  nearPortal: false,
  currentBiomeLabel: 'Archipelago Realms',
  targetBlock: null,
  targetNpc: null,
  totalPlacedBlocks: 0,
  npcCount: 11,
  villagerCount: 3,
  animalCount: 5,
  monsterCount: 3,
  shelteringVillagers: 0,
  prowlingMonsters: 0,
  summonedCount: 0,
  villageCount: 1,
  houseCount: 2,
  flyMode: false,
  lastCollapsedCount: 0,
  undoCount: 0,
  timeOfDay: 0.28,
  isDuskOrNight: false,
  weather: 'clear',
  weatherIntensity: 0,
  weatherAutoCycle: true,
  inventory: STARTER_COUNTS,
  totalInventoryCount: getTotalResourceCount(STARTER_COUNTS),
  photoMode: false,
  dofFocus: 9.0,
  activeBlueprint: null,
  blueprintRotation: 0,
  blueprintCornerA: null,
  blueprintCount: 0,
  stabilityOverlay: false,
};

export default function App() {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);

  const [gameMode, setGameMode] = useState<GameMode>(autostart ? 'playing' : 'title');
  const [worldConfig, setWorldConfig] = useState<WorldConfig>({
    seed: 2048,
    biome: 'mixed',
    terrainAmplitude: 1.0,
    treeDensity: 1.0,
    stabilityEnabled: true,
  });

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedBlock, setSelectedBlock] = useState<BlockId>(BlockId.OakPlanks);
  const [hotbarPage, setHotbarPage] = useState<0 | 1>(0);
  const [activeBrush, setActiveBrush] = useState<EditBrush>('single');
  const [architectOpen, setArchitectOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [summonOpen, setSummonOpen] = useState(false);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [blueprintList, setBlueprintList] = useState<BlueprintSummary[]>([]);
  const [unityOpen, setUnityOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const refreshBlueprints = useCallback(() => {
    if (!engineRef.current) return;
    setBlueprintList(engineRef.current.getSavedBlueprints());
  }, []);

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameMode;
    engineRef.current?.setGameMode(gameMode);
  }, [gameMode]);

  // Initialize Three.js VoxelEngine once inside isolated mount div
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new VoxelEngine(
      mount,
      worldConfig,
      (snapshot) => setHud(snapshot),
      (msg) => showToastRef.current(msg)
    );
    engine.setGameMode(autostart ? 'playing' : 'title');
    engine.setSelectedBlock(BlockId.OakPlanks);
    engineRef.current = engine;
    setBlueprintList(engine.getSavedBlueprints());

    return () => {
      window.clearTimeout(toastTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep saved blueprint list fresh whenever blueprintCount changes or drawer opens
  useEffect(() => {
    if (engineRef.current) {
      setBlueprintList(engineRef.current.getSavedBlueprints());
    }
  }, [hud.blueprintCount, blueprintOpen]);

  const handleStart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameMode('playing');
  }, []);

  const handleSelectBiomeOnTitle = useCallback((biome: BiomeId) => {
    setWorldConfig((prev) => {
      const next = { ...prev, biome };
      engineRef.current?.regenerateWorld(next);
      return next;
    });
  }, []);

  const handleRegenerateWorld = useCallback(
    (nextConfig: WorldConfig) => {
      setWorldConfig(nextConfig);
      engineRef.current?.regenerateWorld(nextConfig);
      showToast('Generated custom biome realm');
    },
    [showToast]
  );

  const handleSelectBlock = useCallback((id: BlockId) => {
    setSelectedBlock(id);
    engineRef.current?.setSelectedBlock(id);
    if (HOTBAR_PAGES[0].blocks.includes(id)) {
      setHotbarPage(0);
    } else if (HOTBAR_PAGES[1].blocks.includes(id)) {
      setHotbarPage(1);
    }
  }, []);

  const handleSelectHotbarPage = useCallback((page: 0 | 1) => {
    setHotbarPage(page);
    const firstBlock = HOTBAR_PAGES[page].blocks[0];
    if (firstBlock !== undefined) {
      setSelectedBlock(firstBlock);
      engineRef.current?.setSelectedBlock(firstBlock);
    }
  }, []);

  const handleSelectBrush = useCallback((brush: EditBrush) => {
    setActiveBrush(brush);
    engineRef.current?.setActiveBrush(brush);
  }, []);

  const handleToggleStabilityOverlay = useCallback(() => {
    const next = !hud.stabilityOverlay;
    engineRef.current?.setStabilityOverlay(next);
    showToast(next ? 'Structural Integrity Heatmap ON' : 'Structural Integrity Heatmap OFF');
  }, [hud.stabilityOverlay, showToast]);

  const handleToggleStabilityPhysics = useCallback(
    (enabled: boolean) => {
      setWorldConfig((prev) => ({ ...prev, stabilityEnabled: enabled }));
      engineRef.current?.setStabilityEnabled(enabled);
      showToast(enabled ? 'Structural Collapse Physics Enabled' : 'Free-Build Mode (No Collapse)');
    },
    [showToast]
  );

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      voxelAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleTogglePhotoMode = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !engine.isPhotoMode();
    if (next) {
      setArchitectOpen(false);
      setInventoryOpen(false);
      setSummonOpen(false);
      setBlueprintOpen(false);
      setToastMessage(null);
    }
    engine.setPhotoMode(next);
    if (!next) {
      showToast('Photo Mode exited');
    }
  }, [showToast]);

  // Global keyboard shortcuts across Title / Playing / Paused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (gameMode === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !unityOpen) {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (hud.photoMode) {
          engineRef.current?.setPhotoMode(false);
          showToast('Photo Mode exited');
          return;
        }
        if (unityOpen) {
          setUnityOpen(false);
          return;
        }
        if (inventoryOpen) {
          setInventoryOpen(false);
          return;
        }
        if (summonOpen) {
          setSummonOpen(false);
          return;
        }
        if (blueprintOpen) {
          setBlueprintOpen(false);
          return;
        }
        if (architectOpen) {
          setArchitectOpen(false);
          return;
        }
        if (hud.activeBlueprint) {
          engineRef.current?.armBlueprint(null);
          return;
        }
        setGameMode((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (gameMode !== 'playing') return;

      if (e.code === 'KeyO') {
        e.preventDefault();
        handleTogglePhotoMode();
        return;
      }

      if (hud.photoMode) return;

      if (e.code === 'Tab') {
        e.preventDefault();
        handleSelectHotbarPage(hotbarPage === 0 ? 1 : 0);
        return;
      }

      // 1-9 hotbar keys mapped to active hotbar page (Core or Realms)
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        const pageBlocks = HOTBAR_PAGES[hotbarPage].blocks;
        if (num >= 1 && num <= pageBlocks.length) {
          handleSelectBlock(pageBlocks[num - 1]);
        }
      } else if (e.code === 'KeyI') {
        setSummonOpen(false);
        setBlueprintOpen(false);
        setInventoryOpen((v) => !v);
      } else if (e.code === 'KeyU') {
        setInventoryOpen(false);
        setBlueprintOpen(false);
        setSummonOpen((v) => !v);
      } else if (e.code === 'KeyJ') {
        setInventoryOpen(false);
        setSummonOpen(false);
        setBlueprintOpen((v) => !v);
      } else if (e.code === 'KeyR') {
        engineRef.current?.rotateArmedBlueprint();
      } else if (e.code === 'KeyN') {
        engineRef.current?.toggleDayNight();
      } else if (e.code === 'KeyG') {
        setArchitectOpen((v) => !v);
      } else if (e.code === 'KeyH') {
        setDockCollapsed((v) => !v);
      } else if (e.code === 'KeyV') {
        handleToggleStabilityOverlay();
      } else if (e.code === 'KeyK') {
        engineRef.current?.cycleWeather();
      } else if (e.code === 'KeyT') {
        engineRef.current?.teleportViaPortal();
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameMode,
    unityOpen,
    architectOpen,
    inventoryOpen,
    summonOpen,
    blueprintOpen,
    hotbarPage,
    hud.photoMode,
    hud.activeBlueprint,
    handleStart,
    handleSelectBlock,
    handleSelectHotbarPage,
    handleToggleStabilityOverlay,
    handleToggleMute,
    handleTogglePhotoMode,
    showToast,
  ]);

  const exportData = engineRef.current?.getWorldExportData();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#161d19]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="voxel-viewport"
        className="fixed inset-0 w-screen h-screen"
      />

      {gameMode === 'title' && (
        <TitleOverlay
          selectedBiome={worldConfig.biome}
          onSelectBiome={handleSelectBiomeOnTitle}
          onStart={handleStart}
          onOpenUnity={() => setUnityOpen(true)}
        />
      )}

      {gameMode === 'playing' && !hud.photoMode && (
        <GameHud
          hud={hud}
          selectedBlock={selectedBlock}
          hotbarPage={hotbarPage}
          activeBrush={activeBrush}
          stabilityEnabled={worldConfig.stabilityEnabled}
          stabilityOverlay={hud.stabilityOverlay}
          architectOpen={architectOpen}
          inventoryOpen={inventoryOpen}
          summonOpen={summonOpen}
          blueprintOpen={blueprintOpen}
          blueprints={blueprintList}
          dockCollapsed={dockCollapsed}
          muted={muted}
          toastMessage={toastMessage}
          onSelectBlock={handleSelectBlock}
          onSelectHotbarPage={handleSelectHotbarPage}
          onSelectBrush={handleSelectBrush}
          onUndo={() => engineRef.current?.undoLastEdit()}
          onMine={() => engineRef.current?.mineTargeted()}
          onPlace={() => engineRef.current?.placeTargeted()}
          onToggleStabilityOverlay={handleToggleStabilityOverlay}
          onToggleArchitect={() => setArchitectOpen((v) => !v)}
          onToggleInventory={() => {
            setSummonOpen(false);
            setBlueprintOpen(false);
            setInventoryOpen((v) => !v);
          }}
          onToggleSummon={() => {
            setInventoryOpen(false);
            setBlueprintOpen(false);
            setSummonOpen((v) => !v);
          }}
          onToggleBlueprint={() => {
            setInventoryOpen(false);
            setSummonOpen(false);
            setBlueprintOpen((v) => !v);
          }}
          onCaptureNearestHouse={(name) => {
            engineRef.current?.captureNearestHouseBlueprint(name);
            refreshBlueprints();
          }}
          onMarkCornerA={() => engineRef.current?.markBlueprintCornerA()}
          onClearCornerA={() => engineRef.current?.clearBlueprintCornerA()}
          onCaptureRegion={(name) => {
            engineRef.current?.captureCustomRegionBlueprint(name);
            refreshBlueprints();
          }}
          onArmBlueprint={(id) => engineRef.current?.armBlueprint(id)}
          onRotateBlueprint={() => engineRef.current?.rotateArmedBlueprint()}
          onStampBlueprint={() => engineRef.current?.stampArmedBlueprint()}
          onDeleteBlueprint={(id) => {
            engineRef.current?.deleteSavedBlueprint(id);
            refreshBlueprints();
          }}
          onSummonAsset={(role) => engineRef.current?.summonVoxelAsset(role)}
          onSummonDefaultPack={() => engineRef.current?.summonDefaultAssets()}
          onResetInventory={() => engineRef.current?.resetInventory()}
          onTogglePhotoMode={handleTogglePhotoMode}
          onToggleDayNight={() => engineRef.current?.toggleDayNight()}
          onToggleDock={() => setDockCollapsed((v) => !v)}
          onToggleMute={handleToggleMute}
          onOpenUnity={() => setUnityOpen(true)}
          onPause={() => setGameMode('paused')}
          onQuickBuildHouse={() => engineRef.current?.generateHouseAtPlayer('cottage')}
          onQuickExpandVillage={() => engineRef.current?.triggerVillageExpansion()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onFacePortal={() => engineRef.current?.facePortal()}
          onScramblePortal={() => engineRef.current?.scramblePortal()}
          onTeleportPortal={() => engineRef.current?.teleportViaPortal()}
          onReturnOverworld={() => engineRef.current?.teleportViaPortal('overworld')}
        />
      )}

      {gameMode === 'playing' && !hud.photoMode && architectOpen && (
        <ArchitectDrawer
          config={worldConfig}
          stabilityOverlay={hud.stabilityOverlay}
          weather={hud.weather}
          weatherAutoCycle={hud.weatherAutoCycle}
          isDuskOrNight={hud.isDuskOrNight}
          onRegenerateWorld={handleRegenerateWorld}
          onToggleStabilityPhysics={handleToggleStabilityPhysics}
          onToggleStabilityOverlay={(show) => {
            engineRef.current?.setStabilityOverlay(show);
          }}
          onSetWeather={(w, auto) => engineRef.current?.setWeather(w, auto)}
          onToggleWeatherAutoCycle={(auto) => engineRef.current?.setWeatherAutoCycle(auto)}
          onToggleDayNight={() => engineRef.current?.toggleDayNight()}
          onBuildHouse={(style: HouseStyle) => engineRef.current?.generateHouseAtPlayer(style)}
          onExpandVillage={() => engineRef.current?.triggerVillageExpansion()}
          onClose={() => setArchitectOpen(false)}
        />
      )}

      {gameMode === 'paused' && (
        <PauseModal
          hud={hud}
          onResume={() => setGameMode('playing')}
          onRegenerate={() => {
            const nextSeed = Math.floor(100 + Math.random() * 9900);
            handleRegenerateWorld({ ...worldConfig, seed: nextSeed });
            setGameMode('playing');
          }}
          onReturnTitle={() => {
            setArchitectOpen(false);
            setInventoryOpen(false);
            setSummonOpen(false);
            setBlueprintOpen(false);
            setGameMode('title');
          }}
        />
      )}

      {unityOpen && (
        <UnityModal
          config={exportData?.config ?? worldConfig}
          plots={exportData?.plots ?? []}
          placedCount={exportData?.placedCount ?? hud.totalPlacedBlocks}
          onClose={() => setUnityOpen(false)}
        />
      )}
    </main>
  );
}
