import React, { useState } from 'react';
import { Building2, Clock, CloudLightning, CloudRain, Moon, RefreshCw, ShieldCheck, Snowflake, Sun, Trees, X } from 'lucide-react';
import {
  BIOME_PRESETS,
  BiomeId,
  HouseStyle,
  WeatherType,
  WorldConfig,
} from '../voxel/types';

interface ArchitectDrawerProps {
  config: WorldConfig;
  stabilityOverlay: boolean;
  weather: WeatherType;
  weatherAutoCycle: boolean;
  isDuskOrNight: boolean;
  onRegenerateWorld: (next: WorldConfig) => void;
  onToggleStabilityPhysics: (enabled: boolean) => void;
  onToggleStabilityOverlay: (show: boolean) => void;
  onSetWeather: (weather: WeatherType, autoCycle?: boolean) => void;
  onToggleWeatherAutoCycle: (autoCycle: boolean) => void;
  onToggleDayNight: () => void;
  onBuildHouse: (style: HouseStyle) => void;
  onExpandVillage: () => void;
  onClose: () => void;
}

export const ArchitectDrawer: React.FC<ArchitectDrawerProps> = ({
  config,
  stabilityOverlay,
  weather,
  weatherAutoCycle,
  isDuskOrNight,
  onRegenerateWorld,
  onToggleStabilityPhysics,
  onToggleStabilityOverlay,
  onSetWeather,
  onToggleWeatherAutoCycle,
  onToggleDayNight,
  onBuildHouse,
  onExpandVillage,
  onClose,
}) => {
  const [draftBiome, setDraftBiome] = useState<BiomeId>(config.biome);
  const [draftSeed, setDraftSeed] = useState<number>(config.seed);
  const [draftAmp, setDraftAmp] = useState<number>(config.terrainAmplitude);
  const [draftTrees, setDraftTrees] = useState<number>(config.treeDensity);
  const [houseStyle, setHouseStyle] = useState<HouseStyle>('cottage');

  const biomes: BiomeId[] = [
    'mixed',
    'emerald_plains',
    'alpine_peaks',
    'redstone_oasis',
    'blossom_grove',
  ];

  const styles: Array<{ id: HouseStyle; label: string }> = [
    { id: 'cottage', label: 'Timber Cottage' },
    { id: 'watchtower', label: 'Stone Watchtower' },
    { id: 'barn', label: 'Meadow Barn' },
    { id: 'courtyard', label: 'Sunlit Villa' },
  ];

  return (
    <div
      className="fixed bottom-44 left-1/2 -translate-x-1/2 z-20 w-[min(680px,94vw)] rounded-xl border p-4 text-[#f2f5f2] shadow-2xl"
      style={{
        backgroundColor: 'rgba(22, 29, 25, 0.96)',
        borderColor: 'rgba(200, 168, 108, 0.48)',
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Trees className="w-4 h-4 text-[#e8b954]" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-[#f5e7c4]">
            Biome & Village Architect
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close Architect Panel"
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-[#c9d4cb] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Left: Procedural Custom Biome Generator */}
        <div className="space-y-2.5 bg-black/20 p-3 rounded-lg border border-white/10">
          <div className="font-bold text-[#d9e5dc] uppercase tracking-wider text-[11px]">
            Procedural Biome Terrain
          </div>

          <div className="flex flex-wrap gap-1.5">
            {biomes.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setDraftBiome(b)}
                className="px-2 py-1 rounded font-semibold cursor-pointer"
                style={{
                  backgroundColor: draftBiome === b ? '#569c46' : '#2d3730',
                  color: draftBiome === b ? '#ffffff' : '#c6d1c8',
                }}
              >
                {BIOME_PRESETS[b].name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#aebbb0]">World Seed</span>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={draftSeed}
                  onChange={(e) => setDraftSeed(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 rounded bg-[#151b17] border border-white/15 text-xs text-white"
                />
                <button
                  type="button"
                  aria-label="Randomize Seed"
                  onClick={() => setDraftSeed(Math.floor(100 + Math.random() * 9900))}
                  className="px-2 py-1 rounded bg-[#2d3730] hover:bg-[#3a473e] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#aebbb0]">
                Relief Amplitude ({draftAmp.toFixed(1)}×)
              </span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.1}
                value={draftAmp}
                onChange={(e) => setDraftAmp(Number(e.target.value))}
                className="accent-[#e8b954]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[#aebbb0]">
              Foliage Density ({Math.round(draftTrees * 100)}%)
            </span>
            <input
              type="range"
              min={0.2}
              max={1.5}
              step={0.1}
              value={draftTrees}
              onChange={(e) => setDraftTrees(Number(e.target.value))}
              className="accent-[#569c46]"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              onRegenerateWorld({
                ...config,
                biome: draftBiome,
                seed: draftSeed,
                terrainAmplitude: draftAmp,
                treeDensity: draftTrees,
              });
              onClose();
            }}
            className="w-full py-2 rounded font-bold bg-[#569c46] hover:bg-[#64b152] text-white cursor-pointer"
          >
            Generate Custom Biome World
          </button>
        </div>

        {/* Right: Modular House, Village Expansion & Structural Physics */}
        <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-white/10 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="font-bold text-[#d9e5dc] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#e8b954]" />
              <span>House & Village Expansion</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {styles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setHouseStyle(s.id)}
                  className="px-2 py-1.5 rounded text-left font-semibold cursor-pointer"
                  style={{
                    backgroundColor: houseStyle === s.id ? '#8c5e2b' : '#2d3730',
                    color: houseStyle === s.id ? '#fff6e0' : '#c6d1c8',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onBuildHouse(houseStyle);
                }}
                className="py-2 px-2 rounded font-bold bg-[#b57a36] hover:bg-[#c8893f] text-white cursor-pointer"
              >
                Build House Ahead
              </button>
              <button
                type="button"
                onClick={() => {
                  onExpandVillage();
                }}
                className="py-2 px-2 rounded font-bold bg-[#495866] hover:bg-[#576a7b] text-white cursor-pointer"
              >
                Expand Full Village
              </button>
            </div>
          </div>

          {/* Structural Physics Controls */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="font-bold text-[#d9e5dc] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#75e39e]" />
              <span>Modular Structural Physics</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#c6d1c8]">Auto-Collapse Unsupported</span>
              <button
                type="button"
                onClick={() => onToggleStabilityPhysics(!config.stabilityEnabled)}
                className="px-2.5 py-1 rounded font-bold cursor-pointer"
                style={{
                  backgroundColor: config.stabilityEnabled ? '#2c6e49' : '#3d4540',
                  color: '#ffffff',
                }}
              >
                {config.stabilityEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#c6d1c8]">Integrity Stress Heatmap [V]</span>
              <button
                type="button"
                onClick={() => onToggleStabilityOverlay(!stabilityOverlay)}
                className="px-2.5 py-1 rounded font-bold cursor-pointer"
                style={{
                  backgroundColor: stabilityOverlay ? '#b57a36' : '#3d4540',
                  color: '#ffffff',
                }}
              >
                {stabilityOverlay ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>

          {/* Procedural Weather Controls */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-[#d9e5dc] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-[#7ec8f2]" />
                <span>Procedural Weather [K]</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleWeatherAutoCycle(!weatherAutoCycle)}
                className="px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
                style={{
                  backgroundColor: weatherAutoCycle ? '#2c6e49' : '#3d4540',
                  color: '#ffffff',
                }}
              >
                {weatherAutoCycle ? 'Auto Cycle' : 'Manual'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'clear', label: 'Clear', Icon: Sun, activeBg: '#9a7127' },
                  { id: 'rainy', label: 'Rainy', Icon: CloudRain, activeBg: '#2e638c' },
                  { id: 'storm', label: 'Storm', Icon: CloudLightning, activeBg: '#3c3e6b' },
                  { id: 'snowy', label: 'Snowy', Icon: Snowflake, activeBg: '#4c6d8a' },
                ] as const
              ).map(({ id, label, Icon, activeBg }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetWeather(id)}
                  className="px-2 py-1.5 rounded font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  style={{
                    backgroundColor: weather === id ? activeBg : '#2d3730',
                    color: weather === id ? '#ffffff' : '#c6d1c8',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#d9e5dc]">
                <Clock className="w-3.5 h-3.5 text-[#f3c669]" />
                <span>Day / Night NPC Schedule [N]</span>
              </div>
              <button
                type="button"
                onClick={onToggleDayNight}
                className="px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isDuskOrNight ? '#4d3a73' : '#9a7127',
                  color: '#ffffff',
                }}
              >
                {isDuskOrNight ? (
                  <>
                    <Moon className="w-3 h-3" />
                    <span>Dusk · Lantern Shelter</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3 h-3" />
                    <span>Morning Daylight</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
