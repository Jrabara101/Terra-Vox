import React from 'react';
import { HudSnapshot } from '../voxel/types';

interface PauseModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRegenerate: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  onResume,
  onRegenerate,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(14, 18, 16, 0.74)' }}
    >
      <div
        role="dialog"
        aria-label="Game Paused"
        className="w-full max-w-sm rounded-xl border p-6 text-[#f2f5f2] shadow-2xl"
        style={{
          backgroundColor: '#1b221e',
          borderColor: 'rgba(200, 168, 108, 0.45)',
        }}
      >
        <h2 className="text-xl font-extrabold tracking-wide text-[#f7e7c0] text-center">
          World Paused
        </h2>
        <p className="text-xs text-[#aebbb0] text-center mt-1 mb-5">
          {hud.currentBiomeLabel}
        </p>

        <div
          className="grid grid-cols-3 gap-2 mb-6 text-center"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <div className="rounded-lg p-2.5 bg-black/25 border border-white/10">
            <div className="text-lg font-extrabold text-[#e8b954]">
              {hud.totalPlacedBlocks}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#aebbb0]">
              Built
            </div>
          </div>
          <div className="rounded-lg p-2.5 bg-black/25 border border-white/10">
            <div className="text-lg font-extrabold text-[#75e39e]">
              {hud.houseCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#aebbb0]">
              Houses
            </div>
          </div>
          <div className="rounded-lg p-2.5 bg-black/25 border border-white/10">
            <div className="text-lg font-extrabold text-[#9cd3f5]">
              {hud.npcCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#aebbb0]">
              Lifeforms
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#e8b954] text-[#182019] cursor-pointer"
          >
            Resume Exploration
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-[#2c3730] hover:bg-[#38463d] text-[#eef2ee] cursor-pointer"
          >
            New Random Seed
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-transparent border border-white/15 hover:bg-white/5 text-[#c5cfc7] cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};
