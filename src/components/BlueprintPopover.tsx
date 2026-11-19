import React, { useState } from 'react';
import {
  Box,
  Check,
  Copy,
  Layers,
  RotateCw,
  Stamp,
  Trash2,
  X,
} from 'lucide-react';
import { BlueprintSummary } from '../voxel/types';

interface BlueprintPopoverProps {
  blueprints: BlueprintSummary[];
  activeBlueprint: BlueprintSummary | null;
  blueprintRotation: 0 | 1 | 2 | 3;
  blueprintCornerA: { x: number; y: number; z: number } | null;
  onCaptureNearestHouse: (name?: string) => void;
  onMarkCornerA: () => void;
  onClearCornerA: () => void;
  onCaptureRegion: (name?: string) => void;
  onArmBlueprint: (id: string | null) => void;
  onRotateBlueprint: () => void;
  onStampBlueprint: () => void;
  onDeleteBlueprint: (id: string) => void;
  onClose: () => void;
}

export const BlueprintPopover: React.FC<BlueprintPopoverProps> = ({
  blueprints,
  activeBlueprint,
  blueprintRotation,
  blueprintCornerA,
  onCaptureNearestHouse,
  onMarkCornerA,
  onClearCornerA,
  onCaptureRegion,
  onArmBlueprint,
  onRotateBlueprint,
  onStampBlueprint,
  onDeleteBlueprint,
  onClose,
}) => {
  const [regionName, setRegionName] = useState('');

  return (
    <div
      role="dialog"
      aria-label="Blueprint Copy & Stamp Studio"
      className="pointer-events-auto w-[min(600px,94vw)] rounded-xl p-3.5 border shadow-2xl text-[#f2f5f2]"
      style={{
        backgroundColor: 'rgba(22, 28, 24, 0.96)',
        borderColor: 'rgba(200, 168, 108, 0.48)',
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
        <div>
          <div className="text-xs font-bold text-[#f7e7c0] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#5ce1e6]" />
            <span>Architectural Blueprints · {blueprints.length} Saved</span>
          </div>
          <div className="text-[11px] text-[#a9b7ac]">
            Copy a built house or custom voxel region, rotate in 90° steps, and stamp cleanly.
          </div>
        </div>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close Blueprints"
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-[#f5f2e8] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Capture Actions Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="p-2.5 rounded-lg bg-black/25 border border-white/10 flex flex-col justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-[#eef2ee]">
              Copy Built House
            </div>
            <div className="text-[11px] text-[#a9b7ac]">
              Captures the closest cottage, watchtower, or structure around you.
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Copy Nearest House Blueprint"
            onClick={(e) => {
              e.currentTarget.blur();
              onCaptureNearestHouse();
            }}
            className="w-full py-1.5 px-3 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 bg-[#2d6255] hover:bg-[#387a6a] text-white cursor-pointer whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Nearest House</span>
          </button>
        </div>

        <div className="p-2.5 rounded-lg bg-black/25 border border-white/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#eef2ee]">
              Copy Voxel Region
            </span>
            {blueprintCornerA && (
              <span
                className="text-[10px] font-semibold text-[#7ee8f2]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                A: {blueprintCornerA.x}, {blueprintCornerA.y}, {blueprintCornerA.z}
              </span>
            )}
          </div>

          <input
            type="text"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder="Blueprint name (optional)"
            className="w-full px-2 py-1 rounded bg-[#151b17] border border-white/15 text-[11px] text-white placeholder:text-[#7f8e82]"
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Mark Region Corner A"
              onClick={(e) => {
                e.currentTarget.blur();
                onMarkCornerA();
              }}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 bg-[#36423a] hover:bg-[#445449] text-[#eef2ee] cursor-pointer whitespace-nowrap"
            >
              <Box className="w-3 h-3 text-[#7ee8f2]" />
              <span>{blueprintCornerA ? 'Reset A' : 'Mark Corner A'}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Save Custom Region Blueprint"
              disabled={!blueprintCornerA}
              onClick={(e) => {
                e.currentTarget.blur();
                onCaptureRegion(regionName.trim() || undefined);
                setRegionName('');
              }}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 bg-[#7c592f] hover:bg-[#936a39] disabled:opacity-45 text-white cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3 h-3" />
              <span>Save Corner B</span>
            </button>
            {blueprintCornerA && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="Clear Corner A"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onClearCornerA();
                }}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-[#d4ddd6] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Blueprint Rotation / Stamp Strip */}
      {activeBlueprint && (
        <div
          className="mb-2.5 px-3 py-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-[11px]"
          style={{
            backgroundColor: 'rgba(34, 62, 68, 0.55)',
            borderColor: 'rgba(92, 225, 230, 0.45)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div className="min-w-0">
            <span className="font-bold text-[#aaf4fa]">{activeBlueprint.name}</span>
            <span className="text-[#cde0dc] ml-2">
              Rotation {blueprintRotation * 90}° · {activeBlueprint.blockCount} blocks
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Rotate Armed Blueprint 90 Degrees"
              onClick={(e) => {
                e.currentTarget.blur();
                onRotateBlueprint();
              }}
              className="px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 bg-[#2b4952] hover:bg-[#365b66] text-white cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate 90° [R]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Stamp Armed Blueprint"
              onClick={(e) => {
                e.currentTarget.blur();
                onStampBlueprint();
              }}
              className="px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 bg-[#569c46] hover:bg-[#65b553] text-white cursor-pointer whitespace-nowrap"
            >
              <Stamp className="w-3 h-3" />
              <span>Stamp Here [B]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Disarm Blueprint"
              onClick={(e) => {
                e.currentTarget.blur();
                onArmBlueprint(null);
              }}
              className="px-2 py-1 rounded-md font-semibold bg-white/10 hover:bg-white/20 text-[#eef2ee] cursor-pointer whitespace-nowrap"
            >
              Exit Stamp
            </button>
          </div>
        </div>
      )}

      {/* Saved Blueprints Library */}
      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
        {blueprints.length === 0 ? (
          <div className="py-5 text-center text-[11px] text-[#9eb0a2] border border-dashed border-white/15 rounded-lg">
            No saved blueprints yet. Copy a nearby house or mark Corner A and B to capture any custom structure.
          </div>
        ) : (
          blueprints.map((bp) => {
            const isArmed = activeBlueprint?.id === bp.id;
            return (
              <div
                key={bp.id}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border"
                style={{
                  backgroundColor: isArmed
                    ? 'rgba(92, 225, 230, 0.14)'
                    : 'rgba(34, 42, 37, 0.85)',
                  borderColor: isArmed ? '#5ce1e6' : 'rgba(255,255,255,0.09)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#f4f7f4] truncate">
                    {bp.name}
                  </div>
                  <div className="text-[10px] text-[#a9b7ac]">
                    {bp.width}×{bp.height}×{bp.depth} · {bp.blockCount} blocks
                    {bp.sourceLabel ? ` · ${bp.sourceLabel}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onArmBlueprint(isArmed ? null : bp.id);
                    }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: isArmed ? '#2b4952' : '#4a6b53',
                      color: '#ffffff',
                    }}
                  >
                    {isArmed ? 'Armed' : 'Select'}
                  </button>
                  {isArmed && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Rotate ${bp.name} 90 degrees`}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onRotateBlueprint();
                      }}
                      className="p-1.5 rounded-md bg-[#2b4952] hover:bg-[#385e69] text-white cursor-pointer"
                      title="Rotate 90° [R]"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Delete ${bp.name}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onDeleteBlueprint(bp.id);
                    }}
                    className="p-1.5 rounded-md bg-white/10 hover:bg-[#8a3535] text-[#e7ece8] cursor-pointer"
                    title="Delete Blueprint"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
