import * as THREE from 'three';
import { NpcActor, NpcRole } from './types';

export interface AnimatedNpcRig {
  group: THREE.Group;
  actor: NpcActor;
  leftLimb: THREE.Object3D;
  rightLimb: THREE.Object3D;
  leftBackLimb?: THREE.Object3D;
  rightBackLimb?: THREE.Object3D;
  head: THREE.Object3D;
  shadowDisc: THREE.Mesh;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTex) return sharedShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 20, 28, 0.55)');
  grad.addColorStop(0.65, 'rgba(15, 20, 28, 0.22)');
  grad.addColorStop(1, 'rgba(15, 20, 28, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  sharedShadowTex = new THREE.CanvasTexture(canvas);
  return sharedShadowTex;
}

function makeContactShadow(radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 18);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.02;
  return mesh;
}

/**
 * Builds composite 3-12 part procedural 3D character and animal rigs
 * pivoted at bottom-center with varied PBR roughness/metalness and articulated limbs.
 */
export function buildNpcRig(actor: NpcActor): AnimatedNpcRig {
  const group = new THREE.Group();
  group.userData.npcId = actor.id;

  const shadowRadius =
    actor.role === 'songbird'
      ? 0.22
      : actor.role === 'golem'
      ? 0.62
      : actor.role === 'slime'
      ? 0.48
      : actor.isAnimal
      ? 0.45
      : 0.42;
  const shadowDisc = makeContactShadow(shadowRadius);
  group.add(shadowDisc);

  if (actor.role === 'sheep') {
    const woolMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.92, metalness: 0 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x3b3532, roughness: 0.62, metalness: 0.04 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x262322, roughness: 0.4, metalness: 0.1 });

    // Primary wool body + fluffy saddle cluster
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.92), woolMat);
    body.position.set(0, 0.56, 0);
    body.castShadow = true;
    group.add(body);

    const fleeceTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.72), woolMat);
    fleeceTop.position.set(0, 0.86, -0.04);
    group.add(fleeceTop);

    // Head group with snout & floppy ears
    const head = new THREE.Group();
    head.position.set(0, 0.68, 0.52);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.42), faceMat);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.34), woolMat);
    crown.position.y = 0.18;
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.12), faceMat);
    earL.position.set(0.22, 0.04, -0.02);
    const earR = earL.clone();
    earR.position.x = -0.22;
    head.add(skull, crown, earL, earR);
    group.add(head);

    // 4 Articulated legs
    const legGeo = new THREE.BoxGeometry(0.15, 0.34, 0.15);
    legGeo.translate(0, -0.17, 0);
    const fl = new THREE.Mesh(legGeo, hoofMat);
    fl.position.set(0.2, 0.34, 0.3);
    const fr = new THREE.Mesh(legGeo, hoofMat);
    fr.position.set(-0.2, 0.34, 0.3);
    const bl = new THREE.Mesh(legGeo, hoofMat);
    bl.position.set(0.2, 0.34, -0.3);
    const br = new THREE.Mesh(legGeo, hoofMat);
    br.position.set(-0.2, 0.34, -0.3);
    group.add(fl, fr, bl, br);

    return { group, actor, leftLimb: fl, rightLimb: fr, leftBackLimb: bl, rightBackLimb: br, head, shadowDisc };
  }

  if (actor.role === 'fox') {
    const furMat = new THREE.MeshStandardMaterial({ color: 0xd96b27, roughness: 0.78, metalness: 0 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf6ede0, roughness: 0.85, metalness: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2422, roughness: 0.45, metalness: 0.05 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.78), furMat);
    body.position.set(0, 0.38, 0);
    body.castShadow = true;
    group.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.22), creamMat);
    chest.position.set(0, 0.34, 0.32);
    group.add(chest);

    const head = new THREE.Group();
    head.position.set(0, 0.52, 0.45);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), furMat);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.2), creamMat);
    snout.position.set(0, -0.05, 0.22);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.06), darkMat);
    nose.position.set(0, -0.02, 0.32);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), darkMat);
    earL.position.set(0.11, 0.2, -0.02);
    const earR = earL.clone();
    earR.position.x = -0.11;
    head.add(skull, snout, nose, earL, earR);
    group.add(head);

    // Bushy white-tipped tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.4, -0.4);
    tail.rotation.x = -0.35;
    const tailBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.42), furMat);
    tailBase.position.z = -0.2;
    const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), creamMat);
    tailTip.position.z = -0.44;
    tail.add(tailBase, tailTip);
    group.add(tail);

    const legGeo = new THREE.BoxGeometry(0.1, 0.24, 0.1);
    legGeo.translate(0, -0.12, 0);
    const fl = new THREE.Mesh(legGeo, darkMat);
    fl.position.set(0.14, 0.24, 0.26);
    const fr = new THREE.Mesh(legGeo, darkMat);
    fr.position.set(-0.14, 0.24, 0.26);
    const bl = new THREE.Mesh(legGeo, darkMat);
    bl.position.set(0.14, 0.24, -0.26);
    const br = new THREE.Mesh(legGeo, darkMat);
    br.position.set(-0.14, 0.24, -0.26);
    group.add(fl, fr, bl, br);

    return { group, actor, leftLimb: fl, rightLimb: fr, leftBackLimb: bl, rightBackLimb: br, head, shadowDisc };
  }

  if (actor.role === 'songbird') {
    const plumageMat = new THREE.MeshStandardMaterial({ color: 0x3b8ec2, roughness: 0.55, metalness: 0.08 });
    const breastMat = new THREE.MeshStandardMaterial({ color: 0xf4c552, roughness: 0.68, metalness: 0 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0x332b24, roughness: 0.3, metalness: 0.2 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.34), plumageMat);
    body.position.y = 0.12;
    const breast = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), breastMat);
    breast.position.set(0, 0.08, 0.04);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.2), plumageMat);
    tail.position.set(0, 0.14, -0.24);
    tail.rotation.x = 0.2;

    const head = new THREE.Group();
    head.position.set(0, 0.2, 0.18);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), plumageMat);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.12;
    head.add(skull, beak);

    const wingGeo = new THREE.BoxGeometry(0.32, 0.035, 0.18);
    const wingL = new THREE.Mesh(wingGeo, plumageMat);
    wingL.geometry = wingGeo.clone().translate(0.16, 0, 0);
    wingL.position.set(0.1, 0.16, 0);
    const wingR = new THREE.Mesh(wingGeo.clone().translate(-0.16, 0, 0), plumageMat);
    wingR.position.set(-0.1, 0.16, 0);

    group.add(body, breast, tail, head, wingL, wingR);
    return { group, actor, leftLimb: wingL, rightLimb: wingR, head, shadowDisc };
  }

  if (actor.role === 'slime') {
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x52c465,
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      opacity: 0.74,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1e6630,
      roughness: 0.6,
      metalness: 0.05,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xd9ff70,
      emissive: 0x99f244,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });

    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.76, 0.84), outerMat);
    outer.position.set(0, 0.39, 0);
    outer.castShadow = true;

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.46), coreMat);
    core.position.set(0, 0.38, 0);

    const head = new THREE.Group();
    head.position.set(0, 0.44, 0.4);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), eyeMat);
    eyeL.position.set(0.18, 0.06, 0);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.18;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), coreMat);
    mouth.position.set(0, -0.14, 0);
    head.add(eyeL, eyeR, mouth);

    const blobL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.22), outerMat);
    blobL.position.set(0.46, 0.22, 0);
    const blobR = blobL.clone();
    blobR.position.x = -0.46;

    group.add(core, outer, head, blobL, blobR);
    group.userData.slimeOuter = outer;
    return { group, actor, leftLimb: blobL, rightLimb: blobR, head, shadowDisc };
  }

  if (actor.role === 'golem') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x424754, roughness: 0.88, metalness: 0.14 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.82, metalness: 0.2 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4f7d47, roughness: 0.86, metalness: 0 });
    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xffa630,
      emissive: 0xff7b1a,
      emissiveIntensity: 1.0,
      roughness: 0.25,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.78, 0.52), stoneMat);
    torso.position.set(0, 1.04, 0);
    torso.castShadow = true;

    const runeCore = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.56), runeMat);
    runeCore.position.set(0, 1.06, 0);

    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.42), darkStoneMat);
    waist.position.set(0, 0.58, 0);

    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.48), mossMat);
    pauldronL.position.set(0.52, 1.38, 0);
    const pauldronR = pauldronL.clone();
    pauldronR.position.x = -0.52;

    const head = new THREE.Group();
    head.position.set(0, 1.62, 0.06);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.44), stoneMat);
    skull.castShadow = true;
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.48), darkStoneMat);
    brow.position.y = 0.16;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), runeMat);
    eyeL.position.set(0.11, 0.04, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.11;
    head.add(skull, brow, eyeL, eyeR);

    const armGeo = new THREE.BoxGeometry(0.24, 0.88, 0.26);
    armGeo.translate(0, -0.36, 0);
    const armL = new THREE.Mesh(armGeo, darkStoneMat);
    armL.position.set(0.58, 1.28, 0);
    const armR = new THREE.Mesh(armGeo, darkStoneMat);
    armR.position.set(-0.58, 1.28, 0);

    const legGeo = new THREE.BoxGeometry(0.28, 0.56, 0.3);
    legGeo.translate(0, -0.28, 0);
    const legL = new THREE.Mesh(legGeo, stoneMat);
    legL.position.set(0.22, 0.56, 0);
    const legR = new THREE.Mesh(legGeo, stoneMat);
    legR.position.set(-0.22, 0.56, 0);

    group.add(torso, runeCore, waist, pauldronL, pauldronR, head, armL, armR, legL, legR);
    return {
      group,
      actor,
      leftLimb: legL,
      rightLimb: legR,
      leftBackLimb: armL,
      rightBackLimb: armR,
      head,
      shadowDisc,
    };
  }

  if (actor.role === 'wraith') {
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x312b4d, roughness: 0.72, metalness: 0.15 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x56468c, roughness: 0.55, metalness: 0.25 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x5ce1e6,
      emissive: 0x45c4ff,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.76, 0.32), cloakMat);
    torso.position.set(0, 0.92, 0);
    torso.castShadow = true;

    const amulet = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.36), glowMat);
    amulet.position.set(0, 1.0, 0);

    const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.22), trimMat);
    tail1.position.set(0, 0.44, -0.04);
    tail1.rotation.x = 0.25;

    const head = new THREE.Group();
    head.position.set(0, 1.48, 0);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), cloakMat);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), glowMat);
    eyeL.position.set(0.1, 0.02, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.1;
    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), trimMat);
    hornL.position.set(0.2, 0.26, -0.02);
    hornL.rotation.z = -0.25;
    const hornR = hornL.clone();
    hornR.position.x = -0.2;
    hornR.rotation.z = 0.25;
    head.add(hood, eyeL, eyeR, hornL, hornR);

    const wingGeo = new THREE.BoxGeometry(0.18, 0.62, 0.2);
    wingGeo.translate(0, -0.24, 0);
    const clawL = new THREE.Mesh(wingGeo, trimMat);
    clawL.position.set(0.38, 1.2, 0.04);
    const clawR = new THREE.Mesh(wingGeo, trimMat);
    clawR.position.set(-0.38, 1.2, 0.04);

    group.add(torso, amulet, tail1, head, clawL, clawR);
    return { group, actor, leftLimb: clawL, rightLimb: clawR, head, shadowDisc };
  }

  // Villager Humanoids (Mason, Farmer, Ranger) — 7+ distinct parts with varied PBR materials
  const palette: Record<'mason' | 'farmer' | 'ranger', { tunic: number; accent: number; skin: number; pants: number }> = {
    mason: { tunic: 0x3b6e8c, accent: 0xd98c2b, skin: 0xe6b89c, pants: 0x3a3f4b },
    farmer: { tunic: 0x5c8c42, accent: 0xe5c158, skin: 0xd9a17c, pants: 0x594233 },
    ranger: { tunic: 0x456348, accent: 0x9c3d32, skin: 0xf0c7ae, pants: 0x2e3138 },
  };
  const pal = palette[actor.role as 'mason' | 'farmer' | 'ranger'] ?? palette.mason;

  const tunicMat = new THREE.MeshStandardMaterial({ color: pal.tunic, roughness: 0.78, metalness: 0.02 });
  const accentMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.38, metalness: 0.35 });
  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.64, metalness: 0 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.85, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.2, metalness: 0.1 });

  // Torso + Belt + Backpack/Satchel
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), tunicMat);
  torso.position.set(0, 0.98, 0);
  torso.castShadow = true;
  group.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.28), accentMat);
  belt.position.set(0, 0.74, 0);
  group.add(belt);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.14), accentMat);
  pack.position.set(0, 1.0, -0.18);
  group.add(pack);

  // Head + Eyes + Role Hat/Hood
  const head = new THREE.Group();
  head.position.set(0, 1.48, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  skull.castShadow = true;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), eyeMat);
  eyeL.position.set(0.09, 0.02, 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.09;
  head.add(skull, eyeL, eyeR);

  if (actor.role === 'mason') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), accentMat);
    cap.position.y = 0.21;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.14), accentMat);
    brim.position.set(0, 0.15, 0.22);
    head.add(cap, brim);
  } else if (actor.role === 'farmer') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.05, 8), accentMat);
    brim.position.y = 0.18;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.14, 8), accentMat);
    crown.position.y = 0.26;
    head.add(brim, crown);
  } else {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), tunicMat);
    hood.position.set(0, 0.04, -0.03);
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.16), accentMat);
    plume.position.set(0.18, 0.24, -0.08);
    head.add(hood, plume);
  }
  group.add(head);

  // Articulated Arms
  const armGeo = new THREE.BoxGeometry(0.16, 0.56, 0.16);
  armGeo.translate(0, -0.24, 0);
  const armL = new THREE.Mesh(armGeo, tunicMat);
  armL.position.set(0.32, 1.24, 0);
  const armR = new THREE.Mesh(armGeo, tunicMat);
  armR.position.set(-0.32, 1.24, 0);

  if (actor.role === 'ranger') {
    // Lantern staff held in right hand
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), pantsMat);
    staff.position.set(0, -0.25, 0.12);
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa62b, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    tip.position.set(0, 0.22, 0.12);
    armR.add(staff, tip);
  }

  // Articulated Legs
  const legGeo = new THREE.BoxGeometry(0.18, 0.64, 0.2);
  legGeo.translate(0, -0.32, 0);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(0.12, 0.64, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(-0.12, 0.64, 0);

  group.add(armL, armR, legL, legR);
  group.userData.armL = armL;
  group.userData.armR = armR;

  return {
    group,
    actor,
    leftLimb: legL,
    rightLimb: legR,
    leftBackLimb: armL,
    rightBackLimb: armR,
    head,
    shadowDisc,
  };
}

export function animateNpcRig(rig: AnimatedNpcRig, dt: number, elapsed: number) {
  const { actor, group, leftLimb, rightLimb, leftBackLimb, rightBackLimb, head } = rig;
  group.position.set(actor.x, actor.y, actor.z);
  group.rotation.y = actor.yaw;

  if (actor.role === 'songbird') {
    const flap = Math.sin(actor.walkPhase * 1.9) * 0.65;
    leftLimb.rotation.z = flap;
    rightLimb.rotation.z = -flap;
    rig.shadowDisc.visible = false;
    return;
  }

  const speed = Math.hypot(actor.vx, actor.vz);
  const moving = speed > 0.15;

  if (actor.role === 'slime') {
    const hop = moving ? Math.abs(Math.sin(actor.walkPhase * 1.45)) : Math.abs(Math.sin(elapsed * 2.4 + actor.x)) * 0.35;
    group.position.y = actor.y + hop * 0.55;
    const squash = 1 - hop * 0.18;
    const stretch = 1 + hop * 0.22;
    group.scale.set(1 / Math.sqrt(stretch), stretch * squash + (1 - squash), 1 / Math.sqrt(stretch));
    leftLimb.position.y = 0.22 + hop * 0.14;
    rightLimb.position.y = 0.22 + hop * 0.14;
    return;
  }

  if (actor.role === 'wraith') {
    const floatOffset = Math.sin(elapsed * 2.8 + actor.x) * 0.22;
    group.position.y = actor.y + floatOffset;
    const wingSweep = Math.sin(elapsed * 3.4 + actor.z) * 0.28;
    leftLimb.rotation.z = 0.25 + wingSweep;
    rightLimb.rotation.z = -0.25 - wingSweep;
    leftLimb.rotation.x = moving ? -0.35 : -0.15;
    rightLimb.rotation.x = moving ? -0.35 : -0.15;
    head.rotation.y = Math.sin(elapsed * 1.6) * 0.12;
    return;
  }

  if (actor.role === 'golem') {
    const swing = moving ? Math.sin(actor.walkPhase * 0.85) * 0.5 : 0;
    leftLimb.rotation.x = swing;
    rightLimb.rotation.x = -swing;
    if (leftBackLimb) leftBackLimb.rotation.x = -swing * 0.75;
    if (rightBackLimb) rightBackLimb.rotation.x = swing * 0.75;
    head.rotation.y = Math.sin(elapsed * 1.1 + actor.x) * 0.14;
    return;
  }

  if (actor.isAnimal) {
    const swing = moving ? Math.sin(actor.walkPhase) * 0.55 : 0;
    leftLimb.rotation.x = swing;
    rightLimb.rotation.x = -swing;
    if (leftBackLimb) leftBackLimb.rotation.x = -swing;
    if (rightBackLimb) rightBackLimb.rotation.x = swing;

    // Grazing head dip when idle/grazing
    const grazePitch = actor.state === 'graze' ? 0.38 + Math.sin(elapsed * 3.5 + actor.x) * 0.12 : 0;
    head.rotation.x += (grazePitch - head.rotation.x) * Math.min(1, dt * 8);
  } else {
    const swing = moving ? Math.sin(actor.walkPhase) * 0.65 : 0;
    leftLimb.rotation.x = swing;
    rightLimb.rotation.x = -swing;
    if (leftBackLimb) leftBackLimb.rotation.x = -swing * 0.8;
    if (rightBackLimb) rightBackLimb.rotation.x = swing * 0.8;

    // Gentle idle breathing / socializing nod
    head.rotation.x =
      actor.state === 'socialize'
        ? Math.sin(elapsed * 5 + actor.x) * 0.12
        : Math.sin(elapsed * 1.8 + actor.z) * 0.03;
  }
}
