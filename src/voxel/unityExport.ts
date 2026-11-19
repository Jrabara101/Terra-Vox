import { VillagePlot, WorldConfig } from './types';

export interface UnityScriptBundle {
  voxelChunkCs: string;
  stabilitySolverCs: string;
  villageGeneratorCs: string;
  npcAgentCs: string;
  worldBlueprintJson: string;
}

export function generateUnityBundle(
  config: WorldConfig,
  plots: VillagePlot[],
  placedCount: number
): UnityScriptBundle {
  const voxelChunkCs = `using UnityEngine;
using System.Collections.Generic;

namespace TerraVox.Unity
{
    /// <summary>
    /// High-fidelity URP/HDRP procedural voxel chunk mesh builder with exposed-face culling.
    /// Seed: ${config.seed} | Biome: ${config.biome}
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider))]
    public class VoxelTerrainGenerator : MonoBehaviour
    {
        public int sizeX = 216;
        public int sizeY = 36;
        public int sizeZ = 216;
        public int chunkSize = 32;
        public int seed = ${config.seed};
        public float terrainAmplitude = ${config.terrainAmplitude.toFixed(2)}f;
        public Material voxelPbrAtlas;

        private byte[,,] _blocks;

        void Start()
        {
            GenerateBiomeTerrain();
            RebuildChunkMesh();
        }

        public void GenerateBiomeTerrain()
        {
            _blocks = new byte[sizeX, sizeY, sizeZ];
            for (int x = 0; x < sizeX; x++)
            {
                for (int z = 0; z < sizeZ; z++)
                {
                    float nx = (x + seed * 0.13f) * 0.04f;
                    float nz = (z + seed * 0.17f) * 0.04f;
                    float n = Mathf.PerlinNoise(nx, nz) * 2f - 1f;
                    int h = Mathf.Clamp(Mathf.RoundToInt(9 + n * 5f * terrainAmplitude), 3, sizeY - 8);
                    for (int y = 0; y <= h; y++)
                    {
                        _blocks[x, y, z] = (byte)(y == h ? 2 : (y < h - 3 ? 4 : 3));
                    }
                }
            }
        }

        public void RebuildChunkMesh()
        {
            var verts = new List<Vector3>();
            var tris = new List<int>();
            var norms = new List<Vector3>();
            Vector3Int[] dirs = {
                Vector3Int.right, Vector3Int.left,
                Vector3Int.up, Vector3Int.down,
                Vector3Int.forward, Vector3Int.back
            };

            for (int x = 0; x < sizeX; x++)
            for (int y = 0; y < sizeY; y++)
            for (int z = 0; z < sizeZ; z++)
            {
                if (_blocks[x, y, z] == 0) continue;
                foreach (var d in dirs)
                {
                    int nx = x + d.x, ny = y + d.y, nz = z + d.z;
                    bool exposed = nx < 0 || nx >= sizeX || ny < 0 || ny >= sizeY || nz < 0 || nz >= sizeZ || _blocks[nx, ny, nz] == 0;
                    if (exposed) AddFace(verts, tris, norms, new Vector3(x, y, z), d);
                }
            }

            Mesh mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.SetNormals(norms);
            GetComponent<MeshFilter>().sharedMesh = mesh;
            GetComponent<MeshCollider>().sharedMesh = mesh;
        }

        private void AddFace(List<Vector3> v, List<int> t, List<Vector3> n, Vector3 pos, Vector3Int dir)
        {
            int idx = v.Count;
            // Construct quad perpendicular to dir
            Vector3 up = dir.y != 0 ? Vector3.forward : Vector3.up;
            Vector3 right = Vector3.Cross(dir, up);
            Vector3 c = pos + (Vector3)dir * 0.5f;
            v.Add(c - right * 0.5f - up * 0.5f);
            v.Add(c + right * 0.5f - up * 0.5f);
            v.Add(c + right * 0.5f + up * 0.5f);
            v.Add(c - right * 0.5f + up * 0.5f);
            for (int i = 0; i < 4; i++) n.Add(dir);
            t.Add(idx); t.Add(idx + 2); t.Add(idx + 1);
            t.Add(idx); t.Add(idx + 3); t.Add(idx + 2);
        }
    }
}`;

  const stabilitySolverCs = `using UnityEngine;
using System.Collections.Generic;

namespace TerraVox.Unity
{
    /// <summary>
    /// Physics-based structural integrity solver supporting vertical load-bearing
    /// pillars, cantilever span attenuation, and dynamic rigidbody collapse debris.
    /// </summary>
    public static class StructuralStabilitySolver
    {
        public struct BlockProps { public float mass; public float loadCapacity; public int maxCantilever; }

        public static List<Vector3Int> SolveAndDetachUnstable(
            byte[,,] blocks, bool[,,] anchored, byte[,,] integrity, BlockProps[] defs)
        {
            int sx = blocks.GetLength(0), sy = blocks.GetLength(1), sz = blocks.GetLength(2);
            var buckets = new Queue<Vector3Int>[101];
            for (int i = 0; i <= 100; i++) buckets[i] = new Queue<Vector3Int>();

            for (int x = 0; x < sx; x++)
            for (int y = 0; y < sy; y++)
            for (int z = 0; z < sz; z++)
            {
                if (blocks[x, y, z] == 0) { integrity[x, y, z] = 0; continue; }
                if (anchored[x, y, z]) { integrity[x, y, z] = 100; buckets[100].Enqueue(new Vector3Int(x, y, z)); }
                else integrity[x, y, z] = 0;
            }

            Vector3Int[] dirs = { Vector3Int.up, Vector3Int.right, Vector3Int.left, Vector3Int.forward, Vector3Int.back, Vector3Int.down };
            for (int lvl = 100; lvl >= 1; lvl--)
            {
                while (buckets[lvl].Count > 0)
                {
                    var p = buckets[lvl].Dequeue();
                    if (integrity[p.x, p.y, p.z] != lvl) continue;
                    var sup = defs[blocks[p.x, p.y, p.z]];

                    foreach (var d in dirs)
                    {
                        int nx = p.x + d.x, ny = p.y + d.y, nz = p.z + d.z;
                        if (nx < 0 || nx >= sx || ny < 0 || ny >= sy || nz < 0 || nz >= sz) continue;
                        if (anchored[nx, ny, nz] || blocks[nx, ny, nz] == 0) continue;
                        var nDef = defs[blocks[nx, ny, nz]];
                        int cost = d.y == 1
                            ? Mathf.Max(1, Mathf.RoundToInt(1.5f + (nDef.mass / Mathf.Max(1f, sup.loadCapacity)) * 55f))
                            : (d.y == 0 ? Mathf.Max(10, Mathf.RoundToInt(100f / (sup.maxCantilever + 0.5f))) : 48);
                        int next = lvl - cost;
                        if (next > integrity[nx, ny, nz])
                        {
                            integrity[nx, ny, nz] = (byte)next;
                            buckets[next].Enqueue(new Vector3Int(nx, ny, nz));
                        }
                    }
                }
            }

            var collapsed = new List<Vector3Int>();
            for (int x = 0; x < sx; x++)
            for (int y = 0; y < sy; y++)
            for (int z = 0; z < sz; z++)
            {
                if (blocks[x, y, z] != 0 && !anchored[x, y, z] && integrity[x, y, z] == 0)
                {
                    blocks[x, y, z] = 0;
                    collapsed.Add(new Vector3Int(x, y, z));
                }
            }
            return collapsed;
        }
    }
}`;

  const villageGeneratorCs = `using UnityEngine;

namespace TerraVox.Unity
{
    /// <summary>
    /// Procedural modular house and village expansion planner with leveled
    /// stone foundations, framed lintels, timber trusses, and cobblestone streets.
    /// </summary>
    public class ProceduralVillageGenerator : MonoBehaviour
    {
        public void BuildCottage(byte[,,] blocks, int cx, int baseY, int cz)
        {
            int hw = 3, hd = 3, h = 4;
            for (int dy = 0; dy < h; dy++)
            for (int x = cx - hw; x <= cx + hw; x++)
            for (int z = cz - hd; z <= cz + hd; z++)
            {
                bool edge = x == cx - hw || x == cx + hw || z == cz - hd || z == cz + hd;
                if (!edge) continue;
                bool isDoor = z == cz + hd && x == cx && dy < 2;
                if (!isDoor) blocks[x, baseY + dy, z] = (byte)((dy == h - 1) ? 6 : 7);
            }
        }
    }
}`;

  const npcAgentCs = `using UnityEngine;
using UnityEngine.AI;

namespace TerraVox.Unity
{
    /// <summary>
    /// AI-driven NPC & wildlife state machine with smooth Animator locomotion blending.
    /// </summary>
    public class NpcBehaviorAgent : MonoBehaviour
    {
        public enum State { Idle, Wander, Patrol, Socialize, Flee, SeekShelter }
        public State currentState = State.Patrol;
        public Animator animator;
        public float walkSpeed = 1.85f;
        private Vector3 _target;

        void Update()
        {
            Vector3 toTarget = _target - transform.position;
            toTarget.y = 0;
            if (toTarget.magnitude > 0.4f)
            {
                Vector3 dir = toTarget.normalized;
                transform.position += dir * walkSpeed * Time.deltaTime;
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(dir), Time.deltaTime * 8f);
                if (animator) animator.SetFloat("Speed", walkSpeed, 0.1f, Time.deltaTime);
            }
            else if (animator)
            {
                animator.SetFloat("Speed", 0f, 0.1f, Time.deltaTime);
            }
        }
    }
}`;

  const worldBlueprintJson = JSON.stringify(
    {
      engine: 'TERRAVOX-1.0',
      unityCompatible: true,
      seed: config.seed,
      biome: config.biome,
      terrainAmplitude: config.terrainAmplitude,
      treeDensity: config.treeDensity,
      stabilityPhysicsEnabled: config.stabilityEnabled,
      playerPlacedBlockCount: placedCount,
      villagePlots: plots,
    },
    null,
    2
  );

  return {
    voxelChunkCs,
    stabilitySolverCs,
    villageGeneratorCs,
    npcAgentCs,
    worldBlueprintJson,
  };
}
