import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { VillagePlot, WorldConfig } from '../voxel/types';
import { generateUnityBundle } from '../voxel/unityExport';

interface UnityModalProps {
  config: WorldConfig;
  plots: VillagePlot[];
  placedCount: number;
  onClose: () => void;
}

type ScriptTab = 'terrain' | 'stability' | 'village' | 'npc' | 'blueprint';

export const UnityModal: React.FC<UnityModalProps> = ({
  config,
  plots,
  placedCount,
  onClose,
}) => {
  const [tab, setTab] = useState<ScriptTab>('terrain');
  const [copied, setCopied] = useState(false);

  const bundle = useMemo(
    () => generateUnityBundle(config, plots, placedCount),
    [config, plots, placedCount]
  );

  const tabs: Array<{ id: ScriptTab; label: string; filename: string; content: string }> = [
    { id: 'terrain', label: 'VoxelTerrain.cs', filename: 'VoxelTerrainGenerator.cs', content: bundle.voxelChunkCs },
    { id: 'stability', label: 'StabilitySolver.cs', filename: 'StructuralStabilitySolver.cs', content: bundle.stabilitySolverCs },
    { id: 'village', label: 'VillageGen.cs', filename: 'ProceduralVillageGenerator.cs', content: bundle.villageGeneratorCs },
    { id: 'npc', label: 'NpcAgent.cs', filename: 'NpcBehaviorAgent.cs', content: bundle.npcAgentCs },
    { id: 'blueprint', label: 'World.json', filename: 'terravox-blueprint.json', content: bundle.worldBlueprintJson },
  ];

  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  const handleCopy = () => {
    navigator.clipboard?.writeText(active.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleDownload = () => {
    const blob = new Blob([active.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(12, 16, 14, 0.78)' }}
    >
      <div
        role="dialog"
        aria-label="Unity C# Architecture & Blueprint Export"
        className="w-full max-w-3xl rounded-xl border p-5 text-[#eef2ee] shadow-2xl flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: '#1a211d',
          borderColor: 'rgba(200, 168, 108, 0.45)',
        }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-[#f7e7c0]">
              Unity C# Cross-Platform Scripts & Blueprint
            </h2>
            <p className="text-xs text-[#aab8ad] mt-0.5">
              Drop-in C# scripts mirroring TERRAVOX terrain, structural physics, village expansion & AI agents for Unity URP/HDRP.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Unity Export Modal"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 my-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: tab === t.id ? '#569c46' : '#28332c',
                color: tab === t.id ? '#ffffff' : '#c6d1c8',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <pre className="flex-1 overflow-auto rounded-lg p-3.5 bg-[#111613] border border-white/10 text-[11px] leading-relaxed text-[#d7e6da] font-mono">
          {active.content}
        </pre>

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#2d3831] hover:bg-[#3a483f] text-white cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#75e39e]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#e8b954] text-[#182019] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {active.filename}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
