import React, { useState } from 'react';
import { Sparkles, Users, PawPrint, Skull, X } from 'lucide-react';
import {
  DEFAULT_SUMMON_PACK,
  DEFAULT_SUMMON_ROLE,
  SUMMON_ASSETS,
  SummonAssetDef,
  getSummonAssetDef,
} from '../voxel/summon';
import { NpcRole, SummonCategory } from '../voxel/types';

interface SummonPopoverProps {
  summonedCount: number;
  onSummonAsset: (role: NpcRole) => void;
  onSummonDefaultPack: () => void;
  onClose: () => void;
}

const VoxelPortrait: React.FC<{ asset: SummonAssetDef }> = ({ asset }) => {
  const { role, primaryColor, accentColor, eyeColor } = asset;

  if (role === 'slime') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="3" y="4" width="10" height="10" fill={primaryColor} />
        <rect x="2" y="9" width="1" height="4" fill={primaryColor} />
        <rect x="13" y="9" width="1" height="4" fill={primaryColor} />
        <rect x="5" y="6" width="6" height="6" fill={accentColor} />
        <rect x="5" y="7" width="2" height="2" fill={eyeColor} />
        <rect x="9" y="7" width="2" height="2" fill={eyeColor} />
        <rect x="7" y="10" width="2" height="1" fill="#133d1f" />
      </svg>
    );
  }

  if (role === 'golem') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="4" y="2" width="8" height="5" fill={primaryColor} />
        <rect x="4" y="2" width="8" height="2" fill="#2a2d36" />
        <rect x="5" y="4" width="2" height="1" fill={eyeColor} />
        <rect x="9" y="4" width="2" height="1" fill={eyeColor} />
        <rect x="2" y="7" width="12" height="6" fill={primaryColor} />
        <rect x="2" y="7" width="3" height="2" fill="#4f7d47" />
        <rect x="11" y="7" width="3" height="2" fill="#4f7d47" />
        <rect x="6" y="9" width="4" height="3" fill={accentColor} />
        <rect x="5" y="13" width="2" height="2" fill="#2a2d36" />
        <rect x="9" y="13" width="2" height="2" fill="#2a2d36" />
      </svg>
    );
  }

  if (role === 'wraith') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="3" y="1" width="2" height="3" fill={accentColor} />
        <rect x="11" y="1" width="2" height="3" fill={accentColor} />
        <rect x="4" y="3" width="8" height="5" fill={primaryColor} />
        <rect x="5" y="5" width="2" height="1" fill={eyeColor} />
        <rect x="9" y="5" width="2" height="1" fill={eyeColor} />
        <rect x="3" y="8" width="10" height="5" fill={primaryColor} />
        <rect x="7" y="9" width="2" height="3" fill={eyeColor} />
        <rect x="5" y="13" width="2" height="2" fill={accentColor} />
        <rect x="9" y="13" width="2" height="2" fill={accentColor} />
      </svg>
    );
  }

  if (role === 'sheep') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="2" y="5" width="11" height="7" fill={primaryColor} />
        <rect x="4" y="4" width="7" height="1" fill={primaryColor} />
        <rect x="9" y="6" width="5" height="5" fill={accentColor} />
        <rect x="10" y="7" width="1" height="1" fill="#ffffff" />
        <rect x="12" y="7" width="1" height="1" fill="#ffffff" />
        <rect x="4" y="12" width="2" height="3" fill="#262322" />
        <rect x="9" y="12" width="2" height="3" fill="#262322" />
      </svg>
    );
  }

  if (role === 'fox') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="3" y="3" width="2" height="2" fill="#2a2422" />
        <rect x="11" y="3" width="2" height="2" fill="#2a2422" />
        <rect x="3" y="5" width="10" height="6" fill={primaryColor} />
        <rect x="5" y="7" width="1" height="1" fill={eyeColor} />
        <rect x="10" y="7" width="1" height="1" fill={eyeColor} />
        <rect x="6" y="9" width="4" height="3" fill={accentColor} />
        <rect x="7" y="9" width="2" height="1" fill="#2a2422" />
        <rect x="4" y="12" width="2" height="2" fill="#2a2422" />
        <rect x="10" y="12" width="2" height="2" fill="#2a2422" />
      </svg>
    );
  }

  if (role === 'songbird') {
    return (
      <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
        <rect x="5" y="4" width="6" height="5" fill={primaryColor} />
        <rect x="11" y="6" width="2" height="2" fill="#332b24" />
        <rect x="8" y="5" width="1" height="1" fill={eyeColor} />
        <rect x="3" y="8" width="9" height="4" fill={primaryColor} />
        <rect x="6" y="9" width="5" height="3" fill={accentColor} />
        <rect x="2" y="7" width="3" height="2" fill="#296e9c" />
      </svg>
    );
  }

  // Humanoid Villagers (Mason, Farmer, Ranger)
  return (
    <svg viewBox="0 0 16 16" className="w-10 h-10 shrink-0" shapeRendering="crispEdges">
      <rect x="4" y="2" width="8" height="2" fill={role === 'ranger' ? primaryColor : accentColor} />
      {role === 'farmer' && <rect x="2" y="4" width="12" height="1" fill={accentColor} />}
      <rect x="5" y="4" width="6" height="4" fill="#e6b89c" />
      <rect x="6" y="5" width="1" height="1" fill={eyeColor} />
      <rect x="9" y="5" width="1" height="1" fill={eyeColor} />
      <rect x="4" y="8" width="8" height="5" fill={primaryColor} />
      <rect x="4" y="11" width="8" height="1" fill={accentColor} />
      <rect x="5" y="13" width="2" height="2" fill="#3a3f4b" />
      <rect x="9" y="13" width="2" height="2" fill="#3a3f4b" />
    </svg>
  );
};

export const SummonPopover: React.FC<SummonPopoverProps> = ({
  summonedCount,
  onSummonAsset,
  onSummonDefaultPack,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | SummonCategory>('all');
  const defaultDef = getSummonAssetDef(DEFAULT_SUMMON_ROLE);

  const visibleAssets =
    filter === 'all'
      ? SUMMON_ASSETS
      : SUMMON_ASSETS.filter((asset) => asset.category === filter);

  const tabs: Array<{ id: 'all' | SummonCategory; label: string }> = [
    { id: 'all', label: 'All (9)' },
    { id: 'people', label: 'People (3)' },
    { id: 'animal', label: 'Animals (3)' },
    { id: 'monster', label: 'Monsters (3)' },
  ];

  const categoryIcon = (cat: SummonCategory) => {
    if (cat === 'people') return <Users className="w-3 h-3 text-[#9cd3f5]" />;
    if (cat === 'animal') return <PawPrint className="w-3 h-3 text-[#75e39e]" />;
    return <Skull className="w-3 h-3 text-[#f3a6ff]" />;
  };

  const categoryLabel = (cat: SummonCategory) =>
    cat === 'people' ? 'Person' : cat === 'animal' ? 'Animal' : 'Monster';

  return (
    <div
      role="dialog"
      aria-label="Voxel Art Asset Summoner"
      className="pointer-events-auto w-[min(620px,95vw)] rounded-xl p-3 border shadow-2xl"
      style={{
        backgroundColor: 'rgba(22, 28, 24, 0.96)',
        borderColor: 'rgba(200, 168, 108, 0.48)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-white/10">
        <div>
          <div className="text-xs font-bold text-[#f7e7c0] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#e8b954]" />
            <span>
              Voxel Asset Summoner · {summonedCount} Summoned
            </span>
          </div>
          <div className="text-[11px] text-[#a9b7ac]">
            Summon People, Animals, or Monsters ahead of your view using 3D voxel art rigs.
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSummonAsset(DEFAULT_SUMMON_ROLE);
            }}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#2f4b37] hover:bg-[#3b6146] border border-[#6be09a]/40 text-[#e8fff0] cursor-pointer"
          >
            Default ({defaultDef.label})
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSummonDefaultPack();
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#e8b954] hover:bg-[#f0c869] text-[#182019] cursor-pointer"
          >
            Summon Default Assets ({DEFAULT_SUMMON_PACK.length})
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Close Voxel Summoner"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-[#f5f2e8] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Filter Row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setFilter(tab.id);
            }}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
            style={{
              backgroundColor:
                filter === tab.id ? '#569c46' : 'rgba(42, 52, 46, 0.9)',
              color: filter === tab.id ? '#ffffff' : '#c6d1c8',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Voxel Art Asset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-0.5">
        {visibleAssets.map((asset) => {
          const isDefaultRole = asset.role === DEFAULT_SUMMON_ROLE;
          return (
            <button
              key={asset.role}
              type="button"
              tabIndex={-1}
              aria-label={`Summon ${asset.label}`}
              onClick={(e) => {
                e.currentTarget.blur();
                onSummonAsset(asset.role);
              }}
              className="flex items-center gap-2.5 p-2 rounded-lg border text-left transition-colors hover:bg-white/5 cursor-pointer"
              style={{
                backgroundColor: isDefaultRole
                  ? 'rgba(82, 196, 101, 0.14)'
                  : 'rgba(34, 42, 37, 0.9)',
                borderColor: isDefaultRole
                  ? 'rgba(117, 227, 158, 0.55)'
                  : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                className="w-11 h-11 rounded-md border border-black/40 flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(18, 23, 20, 0.85)' }}
              >
                <VoxelPortrait asset={asset} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-[#f7f3e8] truncate">
                    {asset.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-[#c5d1c8]">
                  {categoryIcon(asset.category)}
                  <span>{categoryLabel(asset.category)}</span>
                  {isDefaultRole && (
                    <span className="ml-auto text-[9px] font-bold text-[#75e39e]">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#9aa89d] truncate mt-0.5">
                  {asset.tagline}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
