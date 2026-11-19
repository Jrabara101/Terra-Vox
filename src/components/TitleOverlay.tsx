import React from 'react';
import { BIOME_PRESETS, BiomeId } from '../voxel/types';

interface TitleOverlayProps {
  selectedBiome: BiomeId;
  onSelectBiome: (biome: BiomeId) => void;
  onStart: () => void;
  onOpenUnity: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedBiome,
  onSelectBiome,
  onStart,
  onOpenUnity,
}) => {
  const biomeOrder: BiomeId[] = [
    'mixed',
    'emerald_plains',
    'alpine_peaks',
    'redstone_oasis',
    'blossom_grove',
  ];

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(18, 24, 21, 0.72) 0%, rgba(18, 24, 21, 0.25) 45%, rgba(18, 24, 21, 0.05) 100%)',
      }}
    >
      {/* Top-Left Title Emblem & World Biome Picker over calm negative space */}
      <div className="max-w-sm pointer-events-auto select-none">
        <svg
          viewBox="0 0 420 118"
          className="w-full max-w-[390px] h-auto mb-3 drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]"
          aria-label="TERRAVOX Living Voxel World"
        >
          {/* Isometric Voxel Crest Icon */}
          <g transform="translate(8, 12)">
            <polygon
              points="36,4 68,21 36,38 4,21"
              fill="#68b653"
              stroke="#19211b"
              strokeWidth="2.5"
            />
            <polygon
              points="4,21 36,38 36,74 4,57"
              fill="#8b623f"
              stroke="#19211b"
              strokeWidth="2.5"
            />
            <polygon
              points="68,21 36,38 36,74 68,57"
              fill="#6f7a85"
              stroke="#19211b"
              strokeWidth="2.5"
            />
            <polygon
              points="36,12 52,21 36,30 20,21"
              fill="#f3c669"
              opacity="0.9"
            />
          </g>

          {/* Engraved Display Typography */}
          <text
            x="92"
            y="54"
            fill="#f7f3e8"
            stroke="#161b17"
            strokeWidth="6"
            paintOrder="stroke fill"
            fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="44"
            letterSpacing="3"
          >
            TERRAVOX
          </text>
          <text
            x="95"
            y="84"
            fill="#e8c982"
            stroke="#161b17"
            strokeWidth="3.5"
            paintOrder="stroke fill"
            fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="14"
            letterSpacing="3.5"
          >
            LIVING VOXEL ARCHITECT
          </text>
        </svg>

        {/* Biome Quick Selection */}
        <div
          className="rounded-lg p-3.5 mb-5 border"
          style={{
            backgroundColor: 'rgba(22, 29, 25, 0.88)',
            borderColor: 'rgba(200, 168, 108, 0.35)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
          }}
        >
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#d6ba83] font-semibold mb-2">
            Starting Biome
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {biomeOrder.map((id) => {
              const active = selectedBiome === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectBiome(id);
                  }}
                  className="px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? '#569c46' : 'rgba(42, 52, 46, 0.9)',
                    color: active ? '#ffffff' : '#d5ddd7',
                    border: active ? '1px solid #88d175' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {BIOME_PRESETS[id].name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#c5cfc7] leading-snug">
            {BIOME_PRESETS[selectedBiome].tagline}
          </p>
        </div>

        {/* Primary Menu Actions (<= 3 actions) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="px-7 py-3.5 rounded-lg font-extrabold text-base tracking-wide text-[#182019] shadow-lg transition-transform active:scale-95 cursor-pointer"
            style={{
              backgroundColor: '#e8b954',
              border: '2px solid #f7dc94',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
            }}
          >
            Enter World
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenUnity();
            }}
            className="px-4 py-3.5 rounded-lg font-semibold text-sm text-[#e6ece7] transition-colors cursor-pointer"
            style={{
              backgroundColor: 'rgba(28, 36, 31, 0.88)',
              border: '1px solid rgba(200, 168, 108, 0.35)',
            }}
          >
            Unity C# Package
          </button>
        </div>
      </div>

      {/* Single flat borderless control-hint line */}
      <div className="text-center md:text-left select-none">
        <span
          className="text-xs tracking-[0.12em] uppercase font-medium text-[#e9efe9]"
          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
        >
          WASD Move · LMB Mine · RMB Place · I Bag · G Architect · O Photo · Esc Pause
        </span>
      </div>
    </div>
  );
};
