import React from 'react';
import {
  Building2,
  Camera,
  CloudLightning,
  CloudRain,
  Code2,
  Compass,
  Eye,
  EyeOff,
  Hammer,
  Home,
  Layers,
  Moon,
  Orbit,
  Package,
  Pause,
  Pickaxe,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Shuffle,
  Snowflake,
  Sparkles,
  Stamp,
  Sun,
  Trees,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getResourceCount, isCollectibleBlock } from '../voxel/inventory';
import {
  BLOCK_DEFS,
  BlockId,
  BlueprintSummary,
  EditBrush,
  HOTBAR_PAGES,
  HudSnapshot,
  NpcRole,
} from '../voxel/types';
import { BlueprintPopover } from './BlueprintPopover';
import { SummonPopover } from './SummonPopover';

interface GameHudProps {
  hud: HudSnapshot;
  selectedBlock: BlockId;
  hotbarPage: 0 | 1;
  activeBrush: EditBrush;
  stabilityEnabled: boolean;
  stabilityOverlay: boolean;
  architectOpen: boolean;
  inventoryOpen: boolean;
  summonOpen: boolean;
  blueprintOpen: boolean;
  blueprints: BlueprintSummary[];
  dockCollapsed: boolean;
  muted: boolean;
  toastMessage: string | null;
  onSelectBlock: (id: BlockId) => void;
  onSelectHotbarPage: (page: 0 | 1) => void;
  onSelectBrush: (brush: EditBrush) => void;
  onUndo: () => void;
  onMine: () => void;
  onPlace: () => void;
  onToggleStabilityOverlay: () => void;
  onToggleArchitect: () => void;
  onToggleInventory: () => void;
  onToggleSummon: () => void;
  onToggleBlueprint: () => void;
  onCaptureNearestHouse: (name?: string) => void;
  onMarkCornerA: () => void;
  onClearCornerA: () => void;
  onCaptureRegion: (name?: string) => void;
  onArmBlueprint: (id: string | null) => void;
  onRotateBlueprint: () => void;
  onStampBlueprint: () => void;
  onDeleteBlueprint: (id: string) => void;
  onSummonAsset: (role: NpcRole) => void;
  onSummonDefaultPack: () => void;
  onResetInventory: () => void;
  onTogglePhotoMode: () => void;
  onToggleDayNight: () => void;
  onToggleDock: () => void;
  onToggleMute: () => void;
  onOpenUnity: () => void;
  onPause: () => void;
  onQuickBuildHouse: () => void;
  onQuickExpandVillage: () => void;
  onCycleWeather: () => void;
  onFacePortal: () => void;
  onScramblePortal: () => void;
  onTeleportPortal: () => void;
  onReturnOverworld: () => void;
}

const COLLECTIBLE_BLOCKS = Object.values(BLOCK_DEFS).filter((def) =>
  isCollectibleBlock(def.id)
);

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  selectedBlock,
  hotbarPage,
  activeBrush,
  stabilityEnabled,
  stabilityOverlay,
  architectOpen,
  inventoryOpen,
  summonOpen,
  blueprintOpen,
  blueprints,
  dockCollapsed,
  muted,
  toastMessage,
  onSelectBlock,
  onSelectHotbarPage,
  onSelectBrush,
  onUndo,
  onMine,
  onPlace,
  onToggleStabilityOverlay,
  onToggleArchitect,
  onToggleInventory,
  onToggleSummon,
  onToggleBlueprint,
  onCaptureNearestHouse,
  onMarkCornerA,
  onClearCornerA,
  onCaptureRegion,
  onArmBlueprint,
  onRotateBlueprint,
  onStampBlueprint,
  onDeleteBlueprint,
  onSummonAsset,
  onSummonDefaultPack,
  onResetInventory,
  onTogglePhotoMode,
  onToggleDayNight,
  onToggleDock,
  onToggleMute,
  onOpenUnity,
  onPause,
  onQuickBuildHouse,
  onQuickExpandVillage,
  onCycleWeather,
  onFacePortal,
  onScramblePortal,
  onTeleportPortal,
  onReturnOverworld,
}) => {
  const targetDef = hud.targetBlock ? BLOCK_DEFS[hud.targetBlock.blockId] : null;
  const activeDef = BLOCK_DEFS[selectedBlock];
  const activeStock = getResourceCount(hud.inventory, selectedBlock);
  const currentHotbarBlocks = HOTBAR_PAGES[hotbarPage].blocks;
  const isSelectedInAnyHotbar =
    HOTBAR_PAGES[0].blocks.includes(selectedBlock) ||
    HOTBAR_PAGES[1].blocks.includes(selectedBlock);
  const isDay = !hud.isDuskOrNight;
  const weatherLabel =
    hud.weather === 'storm'
      ? 'Storm'
      : hud.weather === 'rainy'
      ? 'Rainy'
      : hud.weather === 'snowy'
      ? 'Snowy'
      : 'Clear';
  const WeatherIcon =
    hud.weather === 'storm'
      ? CloudLightning
      : hud.weather === 'rainy'
      ? CloudRain
      : hud.weather === 'snowy'
      ? Snowflake
      : Sun;
  const weatherColor =
    hud.weather === 'storm'
      ? '#f5c542'
      : hud.weather === 'rainy'
      ? '#7ec8f2'
      : hud.weather === 'snowy'
      ? '#e0f2fe'
      : '#f3c669';

  const brushes: Array<{ id: EditBrush; label: string }> = [
    { id: 'single', label: '1×1' },
    { id: 'platform3x3', label: '3×3' },
    { id: 'pillar4', label: '1×4' },
    { id: 'flatten', label: 'Flat' },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Top-Left Compact Biome & Settlement Cluster */}
      <div
        className="absolute top-3.5 left-3.5 rounded-lg px-3.5 py-2.5 border pointer-events-auto"
        style={{
          backgroundColor: 'rgba(22, 28, 24, 0.88)',
          borderColor: 'rgba(200, 168, 108, 0.35)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Compass className="w-4 h-4 text-[#e8b954] shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#f5f2e8] leading-tight">
                {hud.currentBiomeLabel}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border"
                style={{
                  backgroundColor:
                    hud.dimension === 'volcanic'
                      ? 'rgba(232, 81, 21, 0.25)'
                      : hud.dimension === 'hawaii_beach'
                      ? 'rgba(28, 168, 201, 0.25)'
                      : hud.dimension === 'dark_dungeon'
                      ? 'rgba(184, 51, 255, 0.25)'
                      : 'rgba(92, 225, 230, 0.16)',
                  borderColor:
                    hud.dimension === 'volcanic'
                      ? 'rgba(255, 136, 77, 0.5)'
                      : hud.dimension === 'hawaii_beach'
                      ? 'rgba(114, 224, 247, 0.5)'
                      : hud.dimension === 'dark_dungeon'
                      ? 'rgba(216, 128, 255, 0.5)'
                      : 'rgba(140, 210, 225, 0.35)',
                  color: '#f5f2e8',
                }}
              >
                {hud.dimension === 'overworld' ? 'Overworld' : hud.dimensionLabel}
              </span>
            </div>
            <div
              className="text-[11px] text-[#b9c6bc] font-medium mt-0.5 flex flex-wrap items-center gap-1.5"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <span>
                XYZ {hud.playerX}, {hud.playerY}, {hud.playerZ}
                {hud.flyMode ? ' · Flight' : ''}
              </span>
              <span>·</span>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Toggle Day or Dusk Schedule"
                title="Toggle Daylight / Dusk NPC Schedule [N]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleDayNight();
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#f5e7c4] font-semibold cursor-pointer whitespace-nowrap"
              >
                {isDay ? (
                  <Sun className="w-3 h-3 text-[#f3c669]" />
                ) : (
                  <Moon className="w-3 h-3 text-[#c8a9ff]" />
                )}
                <span>{isDay ? 'Daylight [N]' : 'Dusk [N]'}</span>
              </button>
              <span>·</span>
              <span className="inline-flex items-center gap-1" style={{ color: weatherColor }}>
                <WeatherIcon className="w-3 h-3" />
                <span>{weatherLabel}</span>
              </span>
            </div>
          </div>
        </div>
        <div
          className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px] text-[#d6dfd8]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span>
            {hud.villagerCount} Villagers
            {(hud.shelteringVillagers > 0 || hud.isDuskOrNight || hud.weather === 'rainy' || hud.weather === 'storm') && (
              <span className="text-[#f3c669]"> ({hud.shelteringVillagers} Lantern-Sheltered)</span>
            )}
          </span>
          <span>·</span>
          <span>{hud.animalCount} Wildlife</span>
          <span>·</span>
          <span className="text-[#f3a6ff] font-semibold">
            {hud.monsterCount} Monsters
            {hud.prowlingMonsters > 0 && (
              <span className="text-[#ff9ec7]"> ({hud.prowlingMonsters} Prowling)</span>
            )}
          </span>
          <span>·</span>
          <span>{hud.houseCount} Structures</span>
        </div>

        {/* Scrambled Dimensional Portal Readout & Controls */}
        <div
          className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <div className="flex items-center gap-1.5 text-[#d8b8ff] font-semibold">
            <Orbit className="w-3.5 h-3.5 text-[#c77dff] shrink-0" />
            <span data-testid="portal-coords">
              Portal XYZ {hud.portalPos.x}, {hud.portalPos.y}, {hud.portalPos.z}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              title="Look Toward Huge Portal"
              onClick={(e) => {
                e.currentTarget.blur();
                onFacePortal();
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-[#eef2ee] cursor-pointer"
            >
              Look
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Scramble Portal Position"
              title="Scramble Huge Portal XYZ Position"
              onClick={(e) => {
                e.currentTarget.blur();
                onScramblePortal();
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 bg-[#382b52] hover:bg-[#4a396d] text-[#eedcff] border border-[#a875ff]/40 cursor-pointer"
            >
              <Shuffle className="w-2.5 h-2.5" />
              <span>Scramble</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Enter Dimensional Portal"
              title="Teleport via Portal to Volcanic, Hawaii Beach, or Dark Dungeon [T]"
              onClick={(e) => {
                e.currentTarget.blur();
                onTeleportPortal();
              }}
              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-[#6d35b8] hover:bg-[#8044d1] text-white border border-[#c77dff]/60 cursor-pointer"
            >
              <span>Teleport [T]</span>
            </button>
            {hud.dimension !== 'overworld' && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="Return to Overworld"
                title="Return to Overworld Realm"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnOverworld();
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 bg-[#2c4f41] hover:bg-[#386553] text-[#e6fff4] cursor-pointer"
              >
                <Home className="w-2.5 h-2.5" />
                <span>Home</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top-Right Compact Utility Buttons */}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Enter Photo Mode"
          title="Photo Mode [O] — Hide HUD + Depth of Field"
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePhotoMode();
          }}
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border cursor-pointer"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          <Camera className="w-4 h-4 text-[#f3c669]" />
          <span className="hidden sm:inline">Photo</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Cycle Weather Condition"
          title="Cycle Weather [K]"
          onClick={(e) => {
            e.currentTarget.blur();
            onCycleWeather();
          }}
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border cursor-pointer"
          style={{
            backgroundColor:
              hud.weather === 'storm'
                ? 'rgba(42, 46, 72, 0.94)'
                : hud.weather === 'rainy'
                ? 'rgba(35, 68, 94, 0.9)'
                : hud.weather === 'snowy'
                ? 'rgba(54, 77, 99, 0.9)'
                : 'rgba(22, 28, 24, 0.88)',
            borderColor:
              hud.weather === 'clear' ? 'rgba(200, 168, 108, 0.35)' : weatherColor,
            color: '#f5f2e8',
          }}
        >
          <WeatherIcon className="w-4 h-4" style={{ color: weatherColor }} />
          <span className="hidden sm:inline">{weatherLabel}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle Structural Stability Heatmap"
          title={`Stability Heatmap [V] · Physics: ${stabilityEnabled ? 'On' : 'Free Build'}`}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleStabilityOverlay();
          }}
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border cursor-pointer"
          style={{
            backgroundColor: stabilityOverlay ? '#8c5e2b' : 'rgba(22, 28, 24, 0.88)',
            borderColor: stabilityOverlay ? '#f3c669' : 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          <ShieldAlert className="w-4 h-4 text-[#e8b954]" />
          <span className="hidden sm:inline">
            {stabilityOverlay ? 'Heatmap On' : 'Heatmap Off'}
          </span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle Architect & Biome Drawer"
          title="Architect & Biome Tools [G]"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleArchitect();
          }}
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border cursor-pointer"
          style={{
            backgroundColor: architectOpen ? '#8c5e2b' : 'rgba(22, 28, 24, 0.88)',
            borderColor: architectOpen ? '#f3c669' : 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          <Trees className="w-4 h-4 text-[#e8b954]" />
          <span className="hidden sm:inline">Architect</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Open Unity C# Export"
          title="Unity C# Scripts & Blueprint"
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenUnity();
          }}
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold border cursor-pointer"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          <Code2 className="w-4 h-4 text-[#9cd3f5]" />
          <span className="hidden md:inline">Unity C#</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          title="Mute [M]"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-9 h-9 rounded-lg flex items-center justify-center border cursor-pointer"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#e57373]" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Pause Game"
          title="Pause [Esc]"
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="w-9 h-9 rounded-lg flex items-center justify-center border cursor-pointer"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            color: '#f5f2e8',
          }}
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Exact Center Reticle + Live Target / NPC Inspector */}
      {!architectOpen && !inventoryOpen && !summonOpen && !blueprintOpen && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <line x1="12" y1="4" x2="12" y2="9" stroke="#ffffff" strokeWidth="2" />
            <line x1="12" y1="15" x2="12" y2="20" stroke="#ffffff" strokeWidth="2" />
            <line x1="4" y1="12" x2="9" y2="12" stroke="#ffffff" strokeWidth="2" />
            <line x1="15" y1="12" x2="20" y2="12" stroke="#ffffff" strokeWidth="2" />
          </svg>

          {hud.targetNpc ? (
            <div
              className="mt-3 px-2.5 py-1 rounded text-[11px] font-semibold text-[#f7f3e8] border whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(22, 28, 24, 0.9)',
                borderColor: 'rgba(232, 185, 84, 0.5)',
              }}
            >
              {hud.targetNpc.name} · {hud.targetNpc.role} ({hud.targetNpc.state}) · Press E
            </div>
          ) : hud.nearPortal ? (
            <div
              className="mt-3 px-2.5 py-1 rounded text-[11px] font-semibold text-[#f3e6ff] border whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(36, 22, 54, 0.92)',
                borderColor: 'rgba(199, 125, 255, 0.65)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Huge Dimensional Portal (XYZ {hud.portalPos.x}, {hud.portalPos.y}, {hud.portalPos.z}) · Walk In or Press E
            </div>
          ) : targetDef && hud.targetBlock ? (
            <div
              className="mt-3 px-2.5 py-1 rounded text-[11px] font-medium text-[#e9efe9] border whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(22, 28, 24, 0.86)',
                borderColor: 'rgba(255, 255, 255, 0.16)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {targetDef.name} ·{' '}
              <span
                style={{
                  color:
                    hud.targetBlock.integrity >= 70
                      ? '#75e39e'
                      : hud.targetBlock.integrity >= 35
                      ? '#f3c669'
                      : '#f27979',
                }}
              >
                {hud.targetBlock.anchored ? 'Bedrock/Ground 100%' : `Stability ${hud.targetBlock.integrity}%`}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Ephemeral World Event / NPC / Inventory Toast */}
      {toastMessage && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-semibold text-[#f9f6ee] border shadow-lg"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.94)',
            borderColor: 'rgba(232, 185, 84, 0.55)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Bottom Dock Collapse Toggle + Resource Bag Popover + Hotbar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[96vw]">
        {inventoryOpen && !dockCollapsed && (
          <div
            role="dialog"
            aria-label="Resource Inventory Bag"
            className="pointer-events-auto w-[min(560px,94vw)] rounded-xl p-3 border shadow-2xl"
            style={{
              backgroundColor: 'rgba(22, 28, 24, 0.96)',
              borderColor: 'rgba(200, 168, 108, 0.48)',
            }}
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
              <div>
                <div className="text-xs font-bold text-[#f7e7c0]">
                  Resource Pouch · {hud.totalInventoryCount} Blocks Stored
                </div>
                <div className="text-[11px] text-[#a9b7ac]">
                  Mine terrain to gather blocks. Select any gathered material to equip &amp; build.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onResetInventory();
                  }}
                  className="px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 bg-[#2c3730] hover:bg-[#38463d] text-[#e7ece8] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Pouch</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Close Resource Bag"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleInventory();
                  }}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-[#f5f2e8] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-0.5"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {COLLECTIBLE_BLOCKS.map((def) => {
                const count = getResourceCount(hud.inventory, def.id);
                const isSelected = selectedBlock === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectBlock(def.id);
                    }}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-left cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(232, 185, 84, 0.22)'
                        : 'rgba(34, 42, 37, 0.88)',
                      borderColor: isSelected ? '#e8b954' : 'rgba(255,255,255,0.09)',
                      opacity: count === 0 && !isSelected ? 0.62 : 1,
                    }}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-sm border border-black/40 shrink-0"
                        style={{ backgroundColor: def.topColor ?? def.color }}
                      />
                      <span className="text-[11px] font-medium text-[#eef2ee] truncate">
                        {def.shortName}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="text-[9px] font-bold uppercase text-[#e8b954]">
                          Equipped
                        </span>
                      )}
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: count > 0 ? '#75e39e' : '#f27979' }}
                      >
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {summonOpen && !dockCollapsed && (
          <SummonPopover
            summonedCount={hud.summonedCount}
            onSummonAsset={onSummonAsset}
            onSummonDefaultPack={onSummonDefaultPack}
            onClose={onToggleSummon}
          />
        )}

        {blueprintOpen && !dockCollapsed && (
          <BlueprintPopover
            blueprints={blueprints}
            activeBlueprint={hud.activeBlueprint}
            blueprintRotation={hud.blueprintRotation}
            blueprintCornerA={hud.blueprintCornerA}
            onCaptureNearestHouse={onCaptureNearestHouse}
            onMarkCornerA={onMarkCornerA}
            onClearCornerA={onClearCornerA}
            onCaptureRegion={onCaptureRegion}
            onArmBlueprint={onArmBlueprint}
            onRotateBlueprint={onRotateBlueprint}
            onStampBlueprint={onStampBlueprint}
            onDeleteBlueprint={onDeleteBlueprint}
            onClose={onToggleBlueprint}
          />
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleDock();
          }}
          className="pointer-events-auto px-3 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border cursor-pointer"
          style={{
            backgroundColor: 'rgba(22, 28, 24, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            color: '#d8e0d9',
          }}
        >
          {dockCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls [H]' : 'Hide Controls [H]'}</span>
        </button>

        {!dockCollapsed && (
          <div
            className="pointer-events-auto rounded-xl p-2 border shadow-xl flex flex-col gap-1.5"
            style={{
              backgroundColor: 'rgba(22, 28, 24, 0.92)',
              borderColor: 'rgba(200, 168, 108, 0.4)',
            }}
          >
            {/* Top sub-row: Active block clue + stock + Brush modes + Quick actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
              <div
                className="text-[#e8c982] font-semibold flex items-center gap-1.5"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                <span>{activeDef.name}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: activeStock > 0 ? 'rgba(86, 156, 70, 0.28)' : 'rgba(242, 121, 121, 0.2)',
                    color: activeStock > 0 ? '#8ef0af' : '#f59898',
                  }}
                >
                  Stock: {activeStock}
                </span>
                <span className="text-[#a9b7ac] font-normal hidden sm:inline">
                  · Span {activeDef.maxCantilever}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {brushes.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectBrush(b.id);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer"
                    style={{
                      backgroundColor: activeBrush === b.id ? '#569c46' : 'rgba(46, 56, 49, 0.9)',
                      color: activeBrush === b.id ? '#ffffff' : '#c6d1c8',
                    }}
                  >
                    {b.label}
                  </button>
                ))}

                <button
                  type="button"
                  tabIndex={-1}
                  title="Mine Targeted Block [LMB / X]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onMine();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-[#3a423d] text-[#f0f3f0] hover:bg-[#4c5750] cursor-pointer"
                >
                  <Pickaxe className="w-3 h-3" />
                  <span>Mine</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  title={hud.activeBlueprint ? 'Stamp Armed Blueprint [RMB / B]' : 'Place Block [RMB / B]'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onPlace();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 text-[#f0f3f0] cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: hud.activeBlueprint ? '#2b5e66' : '#3a423d',
                  }}
                >
                  {hud.activeBlueprint ? <Stamp className="w-3 h-3 text-[#7ee8f2]" /> : <Hammer className="w-3 h-3" />}
                  <span>{hud.activeBlueprint ? 'Stamp' : 'Place'}</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  title="Undo Last Edit [Ctrl+Z]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUndo();
                  }}
                  disabled={hud.undoCount === 0}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-[#3a423d] text-[#f0f3f0] disabled:opacity-40 cursor-pointer"
                >
                  <Undo2 className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Resource Bag"
                  title="Resource Bag [I]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleInventory();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: inventoryOpen ? '#8c5e2b' : '#3a423d',
                    color: '#f5f2e8',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Package className="w-3 h-3 text-[#e8b954]" />
                  <span>Bag ({hud.totalInventoryCount})</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Voxel Summoner"
                  title="Summon People, Animals & Monsters [U]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleSummon();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: summonOpen ? '#6a4c93' : '#4a3a66',
                    color: '#f6edff',
                  }}
                >
                  <Sparkles className="w-3 h-3 text-[#f3c669]" />
                  <span>Summon</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Open Blueprint Studio"
                  title="Copy, Rotate & Stamp House Blueprints [J]"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleBlueprint();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: blueprintOpen || hud.activeBlueprint ? '#2b5e66' : '#35484a',
                    color: '#e6fcff',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Layers className="w-3 h-3 text-[#5ce1e6]" />
                  <span>Blueprints{hud.blueprintCount > 0 ? ` (${hud.blueprintCount})` : ''}</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  title="Build Procedural Cottage Ahead"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onQuickBuildHouse();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-[#7c592f] text-[#fff4dd] cursor-pointer whitespace-nowrap"
                >
                  <Building2 className="w-3 h-3" />
                  <span>+House</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  title="Expand Full Procedural Village"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onQuickExpandVillage();
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 bg-[#495866] hover:bg-[#576a7b] text-[#f2f6fa] cursor-pointer whitespace-nowrap"
                >
                  <span>+Village</span>
                </button>
              </div>
            </div>

            {hud.activeBlueprint && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded-lg border text-[11px]"
                style={{
                  backgroundColor: 'rgba(34, 62, 68, 0.55)',
                  borderColor: 'rgba(92, 225, 230, 0.4)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div className="text-[#c9f4f8] font-semibold">
                  Blueprint: <span className="text-white">{hud.activeBlueprint.name}</span> ·{' '}
                  {hud.blueprintRotation * 90}° · {hud.activeBlueprint.blockCount} blocks
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onRotateBlueprint();
                    }}
                    className="px-2 py-0.5 rounded bg-[#2b4952] hover:bg-[#385e69] text-white font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Rotate [R]</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onStampBlueprint();
                    }}
                    className="px-2 py-0.5 rounded bg-[#569c46] hover:bg-[#65b553] text-white font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Stamp className="w-3 h-3" />
                    <span>Stamp [B]</span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onArmBlueprint(null);
                    }}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#e7ece8] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Exit
                  </button>
                </div>
              </div>
            )}

            {/* 9-Slot Voxel Material Hotbar (Core | Realms Page Switcher + Pouch Quick-Equip) */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <div
                role="tablist"
                aria-label="Hotbar Block Pages"
                className="flex flex-col gap-1 shrink-0 pr-1 border-r border-white/10"
              >
                {HOTBAR_PAGES.map((page) => {
                  const active = hotbarPage === page.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      tabIndex={-1}
                      title={`Switch Hotbar to ${page.label} Blocks [Tab]`}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectHotbarPage(page.id as 0 | 1);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: active
                          ? page.id === 1
                            ? '#6d35b8'
                            : '#569c46'
                          : 'rgba(40, 49, 43, 0.9)',
                        color: active ? '#ffffff' : '#b7c4b9',
                      }}
                    >
                      {page.label}
                    </button>
                  );
                })}
              </div>

              {currentHotbarBlocks.map((id, idx) => {
                const def = BLOCK_DEFS[id];
                const isSelected = selectedBlock === id;
                const count = getResourceCount(hud.inventory, id);
                const empty = count === 0;
                return (
                  <button
                    key={id}
                    type="button"
                    tabIndex={-1}
                    aria-label={`Select ${def.name} (Key ${idx + 1}, Stock ${count})`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectBlock(id);
                    }}
                    className="relative w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 transition-transform cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'rgba(232, 185, 84, 0.24)' : 'rgba(34, 42, 37, 0.9)',
                      border: isSelected ? '2px solid #e8b954' : '1px solid rgba(255,255,255,0.1)',
                      transform: isSelected ? 'translateY(-2px)' : 'none',
                      opacity: empty && !isSelected ? 0.56 : 1,
                    }}
                  >
                    <span className="absolute top-0.5 left-1 text-[9px] font-bold text-[#b8c4ba]">
                      {idx + 1}
                    </span>
                    <span
                      className="absolute top-0.5 right-1 text-[9px] font-extrabold leading-none"
                      style={{
                        color: empty ? '#f27979' : '#f7e7c0',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {count}
                    </span>
                    <span
                      className="w-5 h-5 rounded-sm border border-black/40 shadow-inner mt-1"
                      style={{
                        backgroundColor: def.topColor ?? def.color,
                      }}
                    />
                    <span className="text-[9px] font-semibold text-[#e6ece7] mt-0.5 leading-none">
                      {def.shortName}
                    </span>
                  </button>
                );
              })}

              {!isSelectedInAnyHotbar && (
                <div
                  className="relative w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 border-l"
                  style={{
                    backgroundColor: 'rgba(232, 185, 84, 0.24)',
                    border: '2px solid #e8b954',
                    transform: 'translateY(-2px)',
                  }}
                  title={`Pouch Quick-Equip: ${activeDef.name}`}
                >
                  <span className="absolute top-0.5 left-1 text-[8px] font-bold uppercase text-[#f3c669]">
                    Bag
                  </span>
                  <span
                    className="absolute top-0.5 right-1 text-[9px] font-extrabold leading-none"
                    style={{
                      color: activeStock === 0 ? '#f27979' : '#f7e7c0',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {activeStock}
                  </span>
                  <span
                    className="w-5 h-5 rounded-sm border border-black/40 shadow-inner mt-1"
                    style={{
                      backgroundColor: activeDef.topColor ?? activeDef.color,
                    }}
                  />
                  <span className="text-[9px] font-semibold text-[#e6ece7] mt-0.5 leading-none">
                    {activeDef.shortName}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

