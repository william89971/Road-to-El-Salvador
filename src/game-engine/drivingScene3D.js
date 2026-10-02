import * as THREE from 'three';
import { gameState } from './gameStateAndRules.js';
import { CONFIG } from './gameConfig.js';
import { BIOMES, ROUTE } from '../map-data/citiesAndRoute.js';
import { createSUV } from './truckModel3D.js';

// A true 3D driving scene: a perspective camera chases a fixed SUV while the
// road, rolling terrain, props and mountains scroll toward it on a seamless
// two-tile treadmill. A gradient sky dome, sun/stars, real shadows,
// hemisphere + time-of-day lighting and procedural canvas textures give it a
// realistic look. Same exported class/interface as before, so
// GameController.jsx needs zero changes.

const TILE = 600;          // length of one scrolling tile on the Z axis
const ROAD_W = 14;         // road width
const TERRAIN_W = 120;     // each terrain tile width
const TERRAIN_X = 67;      // terrain tile center offset (road half 7 + terrain half 60)
const SCROLL = 5;          // world units scrolled per mile (driving-feel speed)
// z hill frequencies snapped to N·π/300 so every cos(z·f) is periodic over
// TILE=600 → the treadmill wrap stays seamless (no slope crease at the seam).
const HZ1 = 4 * Math.PI / 300;   // ≈0.0419 (large rolling hills)
const HZ2 = 14 * Math.PI / 300;  // ≈0.1466 (medium variation)
const HZ3 = 33 * Math.PI / 300;  // ≈0.3456 (fine surface roughness)
const DEG = Math.PI / 180;

// Layered-octave hill height at a world (x,z): big rolling hills + medium
// variation + fine roughness, so it reads as landscape rather than a sine wave.
// Ramped to 0 near the road so the shoulders sit flat and props rest on it.
function terrainHeight(x, z) {
  const ramp = Math.min(1, Math.max(0, (Math.abs(x) - ROAD_W / 2) / 25));
  const h = Math.sin(x * 0.06) * Math.cos(z * HZ1) * 5
          + Math.sin(x * 0.18) * Math.cos(z * HZ2) * 2
          + Math.sin(x * 0.40) * Math.cos(z * HZ3) * 0.8;
  return h * ramp;
}

// deterministic pseudo-random so both treadmill tiles share an identical
// layout (props/mountains line up across the seam → invisible loop)
function rand(seed) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

// ---- procedural canvas textures -----------------------------------------

// Asphalt: mid-grey base + high-contrast speckle + directional grain so it
// reads as a textured surface in daylight rather than a black void.
function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#484849';
  g.fillRect(0, 0, 512, 512);
  // high-contrast speckle: dark grit + bright glints
  for (let i = 0; i < 11000; i++) {
    const dark = Math.random() > 0.45;
    g.fillStyle = dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)';
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  // directional grain (lengthwise streaks of varied tone)
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (Math.random() * 2 - 1)); g.stroke();
  }
  // worn pale center, darker shoulders. Canvas X runs across the road.
  const wear = g.createLinearGradient(0, 0, 512, 0);
  wear.addColorStop(0, 'rgba(0,0,0,0.5)');
  wear.addColorStop(0.16, 'rgba(0,0,0,0.12)');
  wear.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  wear.addColorStop(0.84, 'rgba(0,0,0,0.12)');
  wear.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = wear;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 40);
  return t;
}

// Neutral grayscale terrain detail: near-white base + soft blobs + speckles.
// Multiplied by the (smoothly lerped) biome color so transitions stay smooth.
function makeTerrainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f0f0f0';
  g.fillRect(0, 0, 256, 256);
  // darker patches (stronger so detail is clearly visible on lit terrain)
  for (let i = 0; i < 44; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 52;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = i % 2 === 0;
    grd.addColorStop(0, dark ? 'rgba(110,110,110,0.40)' : 'rgba(255,255,255,0.30)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // fine speckles
  for (let i = 0; i < 5000; i++) {
    const dark = Math.random() > 0.5;
    g.fillStyle = dark ? 'rgba(120,120,120,0.30)' : 'rgba(255,255,255,0.30)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 20); // integer Y → tiles seamlessly across the treadmill seam
  return t;
}

// Soft radial alpha (white core → transparent edge). Used additively for the
// sun halo and, tinted black, for the SUV contact shadow.
function makeRadialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStars() {
  const N = 1000;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // upper hemisphere shell, just inside the dome
    const u = Math.random(), v = Math.random() * 0.5; // v<0.5 → upper half
    const theta = u * Math.PI * 2, phi = Math.acos(1 - 2 * v);
    const r = 380;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

// ---- day/night keyframe model -------------------------------------------
// Each frame's color fields are stored as THREE.Color (or a token); scalars as
// numbers. The table is treated as circular so 0.85 → 0.00 wraps smoothly.
const KF = [
  { t: 0.00, dir: '#a0b4d0', int: 0.30, elev: -10, zen: '#050814', hor: '#0a0814', hemi: 0.15, sun: 0, stars: 1.0 },
  { t: 0.10, dir: '#ffd9a0', int: 0.55, elev: 4,   zen: '#244a6e', hor: 'sky:#ff9e5e:0.5', hemi: 0.30, sun: 1, stars: 0.4 },
  { t: 0.18, dir: '#ffe8c8', int: 1.10, elev: 18,  zen: '#1a3a5c', hor: 'sky', hemi: 0.45, sun: 1, stars: 0.0 },
  { t: 0.30, dir: '#fff5e0', int: 1.60, elev: 38,  zen: '#1a3a5c', hor: 'sky', hemi: 0.50, sun: 1, stars: 0.0 },
  { t: 0.55, dir: '#fff0d0', int: 1.25, elev: 28,  zen: '#1c3c5e', hor: 'sky', hemi: 0.48, sun: 1, stars: 0.0 },
  { t: 0.66, dir: '#ff8c42', int: 0.90, elev: 10,  zen: '#2a3a6c', hor: 'sky:#ff8c42:0.6', hemi: 0.40, sun: 1, stars: 0.0 },
  { t: 0.75, dir: '#ff6a3a', int: 0.55, elev: 2,   zen: '#122244', hor: 'sky:#ff6a3a:0.5', hemi: 0.30, sun: 1, stars: 0.25 },
  { t: 0.85, dir: '#b0c0d8', int: 0.32, elev: -8,  zen: '#070a18', hor: '#0a0814', hemi: 0.18, sun: 0, stars: 0.85 },
];
// pre-parse color tokens
for (const k of KF) {
  k.dirC = new THREE.Color(k.dir);
  k.zenC = new THREE.Color(k.zen);
  if (k.hor.startsWith('sky')) {
    const parts = k.hor.split(':'); // 'sky' | 'sky:#hex:amt'
    k.horMode = parts.length === 1 ? 'sky' : 'skyMix';
    if (k.horMode === 'skyMix') { k.horMixC = new THREE.Color(parts[1]); k.horMixAmt = parseFloat(parts[2]); }
  } else { k.horMode = 'fixed'; k.horC = new THREE.Color(k.hor); }
}

export class ParallaxScene {
  constructor(canvas) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    const biome = BIOMES[gameState.biome] || BIOMES.california;
    this.currentProp = gameState.biome; // props are keyed by biome name so all 8 are distinct
    this.curMid = new THREE.Color(biome.earth || biome.mid);
    this.curSky = new THREE.Color(biome.sky);
    this.curPlant = new THREE.Color(biome.plant || biome.mid);
    this.curAccent = new THREE.Color(biome.accent || '#f4f1ea');
    this._t1 = new THREE.Color();
    this._t2 = new THREE.Color();
    this._t3 = new THREE.Color();
    this._t4 = new THREE.Color();
    this._roadTarget = new THREE.Color('#ffffff');

    // reusable day/night output
    this._dn = { dirC: new THREE.Color(), int: 1, elev: 30, zenC: new THREE.Color(), horC: new THREE.Color(), hemi: 0.5, sun: 1, stars: 0, night: false };

    // ---- camera: behind & above the SUV, looking slightly down toward it ----
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 600);
    this.camera.position.set(0, 6.2, -11);
    this.camera.lookAt(0, 1.5, 16);

    // ---- lights ----
    this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
    this._azimuth = new THREE.Vector3(-15, 0, 25).normalize(); // horizontal bearing of the sun
    this.dirLight.castShadow = true;
    const sc = this.dirLight.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80;
    sc.near = 1; sc.far = 300;
    sc.updateProjectionMatrix();
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target); // keep target at origin

    this.hemi = new THREE.HemisphereLight(biome.sky, biome.mid, 0.5);
    this.scene.add(this.hemi);

    // ---- fog: matches the dome horizon, gives depth ----
    this.scene.fog = new THREE.Fog(biome.sky, 80, 200);
    this.renderer.setClearColor(biome.sky);

    // ---- sky dome (gradient, immune to fog) ----
    this.skyUniforms = {
      uZenith: { value: new THREE.Color('#1a3a5c') },
      uHorizon: { value: new THREE.Color(biome.sky) },
      uExponent: { value: 0.6 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform float uExponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos - cameraPosition).y;
          float f = pow(clamp(h, 0.0, 1.0), uExponent);
          gl_FragColor = vec4(mix(uHorizon, uZenith, f), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.dome.renderOrder = -2;
    this.dome.position.copy(this.camera.position);
    this.scene.add(this.dome);

    // ---- sun ----
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false, depthWrite: false }),
    );
    this.sun.renderOrder = -1;
    this.scene.add(this.sun);

    // ---- sun halo (soft additive glow that tracks the sun) ----
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeRadialTexture(), color: 0xfff2c0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
    }));
    this.sunHalo.scale.setScalar(40);
    this.sunHalo.renderOrder = -1;
    this.scene.add(this.sunHalo);

    // ---- stars ----
    this.stars = makeStars();
    this.stars.renderOrder = -1;
    this.stars.position.copy(this.camera.position);
    this.scene.add(this.stars);

    // ---- shared materials (updated on biome change) ----
    this.roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05, map: makeRoadTexture() });
    this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.7, metalness: 0.1 });
    this.dashMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.6, metalness: 0.1, emissive: 0x3a2c00 });
    this.terrainMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(biome.mid), roughness: 0.73, metalness: 0, map: makeTerrainTexture() });
    this.mountainMat = new THREE.MeshStandardMaterial({ color: this.curMid.clone().multiplyScalar(0.6), roughness: 0.87, metalness: 0 });
    this.propMat = new THREE.MeshStandardMaterial({ color: this.curMid.clone().multiplyScalar(0.8), roughness: 0.85, metalness: 0 });
    // fixed-color prop materials (natural colors, biome-independent)
    this.matFoliage = new THREE.MeshStandardMaterial({ color: 0x3a5a32, roughness: 1 });
    this.matFoliageDark = new THREE.MeshStandardMaterial({ color: 0x244a22, roughness: 1 });
    this.matCactus = new THREE.MeshStandardMaterial({ color: 0x4a7a4a, roughness: 1 });
    this.matTrunk = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
    this.matRock = new THREE.MeshStandardMaterial({ color: 0x6e6a60, roughness: 1 });
    this.matDark = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 1 });
    this.matSign = new THREE.MeshStandardMaterial({ color: 0xcfc7b0, roughness: 0.7 });
    this.matScrub = new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 1 });
    this.matBanana = new THREE.MeshStandardMaterial({ color: 0x4e8a3a, roughness: 0.9, side: THREE.DoubleSide });
    this.matAccent = new THREE.MeshStandardMaterial({ color: biome.accent || 0xf4f1ea, roughness: 0.8 });

    // ---- shared geometries ----
    this.roadGeo = new THREE.PlaneGeometry(ROAD_W, TILE);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.edgeGeo = new THREE.BoxGeometry(0.3, 0.04, TILE);
    this.dashGeo = new THREE.BoxGeometry(0.18, 0.06, 7);
    this.laneGeo = new THREE.BoxGeometry(0.08, 0.05, TILE); // solid yellow lane lines
    this.terrainGeoL = makeTerrainGeo(-TERRAIN_X);
    this.terrainGeoR = makeTerrainGeo(TERRAIN_X);
    this.coneGeo = new THREE.ConeGeometry(1, 1, 6);
    this.ridgeGeo = new THREE.BoxGeometry(1, 1, 1);
    this.butteGeo = new THREE.CylinderGeometry(0.62, 0.78, 1, 6);
    this.propGeo = {
      cyl: new THREE.CylinderGeometry(0.35, 0.45, 4, 8),
      arm: new THREE.BoxGeometry(0.3, 1.1, 0.3),
      trunk: new THREE.CylinderGeometry(0.22, 0.3, 2.6, 7),
      bush: new THREE.ConeGeometry(1.4, 2.6, 8),
      palmTrunk: new THREE.CylinderGeometry(0.18, 0.26, 4.2, 7),
      leaf: new THREE.BoxGeometry(1.8, 0.12, 0.5),
      box: new THREE.BoxGeometry(3, 6, 3),
      post: new THREE.CylinderGeometry(0.1, 0.1, 3, 6),
      board: new THREE.BoxGeometry(2.4, 1.3, 0.2),
      cone: new THREE.ConeGeometry(1.6, 4, 6),
      // region-specific extras
      palmCrown: new THREE.SphereGeometry(0.95, 8, 6),
      saguaro: new THREE.CylinderGeometry(0.32, 0.42, 5.2, 8),
      saguaroArm: new THREE.CylinderGeometry(0.18, 0.22, 1.7, 6),
      rock: new THREE.BoxGeometry(1, 1, 1),
      scrub: new THREE.SphereGeometry(0.6, 6, 5),
      deadTrunk: new THREE.CylinderGeometry(0.12, 0.2, 3.6, 6),
      branch: new THREE.BoxGeometry(0.1, 0.1, 1.3),
      pole: new THREE.CylinderGeometry(0.1, 0.13, 6.5, 6),
      crossbar: new THREE.BoxGeometry(2.4, 0.09, 0.09),
      canopy: new THREE.ConeGeometry(1.9, 2.3, 7),
      vine: new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5),
      banana: new THREE.PlaneGeometry(0.5, 1.6),
      billboardLeg: new THREE.BoxGeometry(0.12, 4, 0.12),
      billboardPanel: new THREE.BoxGeometry(3.2, 1.8, 0.15),
    };

    // ---- deterministic layouts shared by both tiles ----
    this.mountainLayout = [];
    for (let i = 0; i < 12; i++) {
      const left = i % 2 === 0;
      const x = (left ? -1 : 1) * (60 + rand(i * 3.1) * 90);
      const z = 150 + rand(i * 7.3) * 150;      // far back (Z +150..+300)
      const s = 14 + rand(i * 5.7) * 26;
      this.mountainLayout.push({ x, y: 0, z, sx: s * 0.8, sy: s, sz: s * 0.8 });
    }
    this.propLayout = [];
    for (let i = 0; i < 30; i++) {
      const left = i % 2 === 0;
      const x = (left ? -1 : 1) * (16 + rand(i * 2.3) * 100);
      const z = -TILE / 2 + rand(i * 9.1) * TILE;
      const s = 0.7 + rand(i * 4.7) * 0.8;
      this.propLayout.push({ x, z, s });
    }
    this.propLayoutB = [];
    for (let i = 0; i < 30; i++) {
      const left = i % 2 !== 0;
      const x = (left ? -1 : 1) * (18 + rand(i * 2.3 + 40) * 90);
      const z = -TILE / 2 + rand(i * 9.1 + 17) * TILE;
      const s = 0.7 + rand(i * 4.7 + 3) * 0.8;
      this.propLayoutB.push({ x, z, s });
    }

    // ---- two identical treadmill tiles ----
    this.tiles = [this._makeTile(), this._makeTile()];
    this.tiles.forEach((t) => this.scene.add(t));

    // ---- the SUV (fixed in world space; the model already faces down the road = +Z) ----
    this.suv = createSUV();
    this.suv.group.rotation.y = 0;
    this.suv.group.position.set(0, 0, 0);
    this.suv.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material && o.material.transparent) { o.castShadow = false; o.receiveShadow = false; }
      else { o.castShadow = true; o.receiveShadow = true; }
    });
    this.scene.add(this.suv.group);
    this._suvColor = gameState.suvColor;
    this.suv.setColor(this._suvColor);

    // ---- contact shadow: a soft dark disc under the SUV so it reads planted ----
    this.contact = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 32),
      new THREE.MeshBasicMaterial({ map: makeRadialTexture(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.set(0, 0.02, 0);
    this.contact.renderOrder = 1;
    this.scene.add(this.contact);

    this._lastScroll = gameState.miles * SCROLL;
    this._fogNear = 80; this._fogFar = 200;
    this._golden = gameState.biome === 'el_salvador' ? 1 : 0; // golden-hour blend for the coast

    this._initEnvironment(); // ocean / urban silhouette / dust devil
    this._initLandmarks();   // approaching city landmarks
    this._initRoadDressing();
    this._rebuildProps();    // initial props and mountain silhouettes
    this.update(0);          // prime lighting/sky for the starting time of day
  }

  // ---- biome environment extras (toggled per biome in update) ----
  _initEnvironment() {
    // ocean far to the right (el_salvador)
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 700),
      new THREE.MeshStandardMaterial({ color: 0x1f6f93, roughness: 0.35, metalness: 0.2 }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(95, -2, 140); // far right, visible on the coastal approach
    this.ocean.visible = false;
    this.scene.add(this.ocean);

    // distant urban silhouette (central_mx)
    this.urban = new THREE.Group();
    const ub = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const h = 6 + rand(i * 5.5) * 26;
      const b = new THREE.Mesh(new THREE.BoxGeometry(4 + rand(i) * 4, h, 4), ub);
      b.position.set(-90 + i * 7, h / 2, 230 + (i % 3) * 8);
      this.urban.add(b);
    }
    this.urban.visible = false;
    this.scene.add(this.urban);

    // dust devil (sonora) — a swirling tan particle column off the roadside
    this.dust = makeParticleField(140, 0xcdb98a, 0.7, false, 0.5);
    this.dust.position.set(-26, 0, 70);
    this.dust.visible = false;
    this._dustData = this.dust.userData.data;
    this.scene.add(this.dust);

    this.rain = makeRain(420);
    this.rain.visible = false;
    this.scene.add(this.rain);
    this._heatColor = new THREE.Color('#e8b56a');
    this._rainColor = new THREE.Color('#6d7c88');
    this._rainZenith = new THREE.Color('#243038');
  }

  _updateEnvironment(dt, s) {
    const jungle = s.biome === 's_mexico';
    const coast = s.biome === 'el_salvador';
    // fog density: jungle mist, desert heat haze, otherwise a long view
    const heat = s.biome === 'sonora';
    const rain = s.biome === 'guatemala';
    const tn = jungle ? 35 : heat ? 22 : rain ? 18 : 80;
    const tf = jungle ? 110 : heat ? 95 : rain ? 90 : 200;
    this._fogNear += (tn - this._fogNear) * Math.min(1, dt * 1.5);
    this._fogFar += (tf - this._fogFar) * Math.min(1, dt * 1.5);
    this.scene.fog.near = this._fogNear; this.scene.fog.far = this._fogFar;

    this.ocean.visible = coast;
    if (coast) this.ocean.material.color.set(0x1f6f93);
    this.urban.visible = s.biome === 'central_mx';

    // dust devil swirl
    this.dust.visible = s.biome === 'sonora';
    if (this.dust.visible) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < this._dustData.length; i++) {
        const d = this._dustData[i];
        d.a += dt * (2.4 - d.r * 0.15);
        d.y += dt * (2 + d.r * 0.3);
        if (d.y > 9) { d.y = 0; d.r = 0.3 + Math.random() * 1.6; }
        const rr = d.r * (0.4 + d.y / 9);
        pos.setXYZ(i, Math.cos(d.a) * rr, d.y, Math.sin(d.a) * rr);
      }
      pos.needsUpdate = true;
    }

    this.rain.visible = s.biome === 'guatemala';
    if (this.rain.visible) updateRain(this.rain, dt);
  }

  // ---- approaching city landmarks ----
  _mileTexture(mile) {
    if (!this._mileTex) this._mileTex = {};
    if (this._mileTex[mile]) return this._mileTex[mile];
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#1a1411';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 122, 58);
    g.fillStyle = '#1a1411';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(mile), 64, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._mileTex[mile] = t;
    return t;
  }

  _initRoadDressing() {
    this.mileMarkers = [0, 1].map(() => {
      const group = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), this.matDark);
      post.position.y = 0.75;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.75),
        new THREE.MeshBasicMaterial({ map: this._mileTexture(0), side: THREE.DoubleSide }),
      );
      board.position.set(0, 1.65, 0);
      board.rotation.y = Math.PI;
      group.add(post);
      group.add(board);
      group.userData.board = board;
      group.userData.mile = -1;
      this.scene.add(group);
      return group;
    });
    this.oncoming = [];
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe7a0 });
    for (let i = 0; i < 3; i++) {
      const pair = new THREE.Group();
      for (const dx of [-0.5, 0.5]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat);
        lamp.position.set(dx, 0.65, 0);
        pair.add(lamp);
      }
      pair.position.set(-2.6, 0, 36 + i * 95);
      pair.visible = false;
      this.scene.add(pair);
      this.oncoming.push(pair);
    }
  }

  _updateMileMarkers(s) {
    const base = Math.floor(s.miles / 10) * 10;
    this.mileMarkers.forEach((marker, i) => {
      const mile = Math.min(CONFIG.TOTAL_MILES, base + i * 10);
      const z = (mile - s.miles) * SCROLL;
      marker.position.set(11, 0, z);
      marker.visible = mile > 0 && z > 10 && z < 180;
      if (marker.userData.mile !== mile) {
        marker.userData.mile = mile;
        marker.userData.board.material.map = this._mileTexture(mile);
        marker.userData.board.material.needsUpdate = true;
      }
    });
  }

  _initLandmarks() {
    this.landmarks = ROUTE.map((_, i) => {
      const lm = buildLandmark(i);
      lm.group.visible = false;
      this.scene.add(lm.group);
      return lm; // { group, side, baseY, lava? }
    });
  }

  _landmarkZ(i, s) {
    const lm = this.landmarks[i];
    let z = (ROUTE[i].mile - s.miles) * 1.25 + (lm.lead || 0);
    // A city stop used to park the monument inside the camera. Hold it up the road.
    if (s.paused && s.cityStopIndex === i) z = Math.max(z, 42);
    return z;
  }

  _updateLandmarks(dt, s) {
    // Visibility follows the mesh, not the city mile. Hollywood is placed
    // ahead of Los Angeles, so a mile window hid it while it was still in frame.
    // Prefer the nearest monument still ahead. A sign you have already passed
    // must not hide the next city.
    let active = -1;
    let activeZ = Infinity;
    let passing = -1;
    let passingZ = -Infinity;
    for (let i = 0; i < this.landmarks.length; i++) {
      const z = this._landmarkZ(i, s);
      if (z >= 6 && z <= 260 && z < activeZ) { activeZ = z; active = i; }
      if (z >= -20 && z < 6 && z > passingZ) { passingZ = z; passing = i; }
    }
    if (active < 0) { active = passing; activeZ = passingZ; }
    for (let i = 0; i < this.landmarks.length; i++) {
      const lm = this.landmarks[i];
      const on = i === active;
      lm.group.visible = on;
      if (!on) continue;
      lm.group.position.set(lm.side, lm.baseY, activeZ);
      if (lm.lava) updateParticleField(lm.lava, dt, true);
      if (lm.smoke) updateParticleField(lm.smoke, dt, true);
    }
  }

  _makeTile() {
    const tile = new THREE.Group();

    // road
    const road = new THREE.Mesh(this.roadGeo, this.roadMat);
    road.receiveShadow = true;
    tile.add(road);

    // white edge lines
    for (const sx of [-1, 1]) {
      const edge = new THREE.Mesh(this.edgeGeo, this.edgeMat);
      edge.position.set(sx * (ROAD_W / 2 - 0.25), 0.02, 0);
      tile.add(edge);
    }

    // centerline: a single crisp dashed line down the middle
    for (let i = 0; i < 20; i++) {
      const z = -TILE / 2 + i * (TILE / 20) + TILE / 40;
      const dash = new THREE.Mesh(this.dashGeo, this.dashMat);
      dash.position.set(0, 0.03, z);
      tile.add(dash);
    }
    // solid yellow lane lines flanking the center
    for (const sx of [-1.8, 1.8]) {
      const lane = new THREE.Mesh(this.laneGeo, this.dashMat);
      lane.position.set(sx, 0.03, 0);
      tile.add(lane);
    }

    // terrain tiles (left + right of the road)
    const tl = new THREE.Mesh(this.terrainGeoL, this.terrainMat); tl.position.x = -TERRAIN_X; tl.receiveShadow = true; tile.add(tl);
    const tr = new THREE.Mesh(this.terrainGeoR, this.terrainMat); tr.position.x = TERRAIN_X; tr.receiveShadow = true; tile.add(tr);

    const mountains = new THREE.Group();
    tile.add(mountains);
    tile.userData.mountains = mountains;

    // props container (filled/refilled per biome)
    const props = new THREE.Group();
    tile.add(props);
    tile.userData.props = props;

    return tile;
  }

  _boardMat(biome) {
    const text = sloganFor(biome);
    if (!this._boardMats) this._boardMats = {};
    if (!this._boardMats[text]) {
      this._boardMats[text] = new THREE.MeshBasicMaterial({
        map: makeWordTexture(text), toneMapped: false, side: THREE.DoubleSide,
      });
    }
    return this._boardMats[text];
  }

  _billboardMesh(biome) {
    const g = this.propGeo;
    const grp = new THREE.Group();
    const leg = (x) => {
      const mesh = new THREE.Mesh(g.billboardLeg, this.matDark);
      mesh.position.set(x, 3.4, 0);
      mesh.castShadow = true;
      grp.add(mesh);
    };
    leg(-3.1); leg(3.1);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 3.6), this._boardMat(biome));
    panel.position.set(0, 6.2, 0);
    panel.rotation.y = Math.PI;
    grp.add(panel);
    return grp;
  }

  // build one region-specific prop for `biome`. `variant` (0..2, deterministic
  // per layout slot) gives variety within a biome.
  _propMesh(biome, variant) {
    const g = this.propGeo;
    const grp = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      grp.add(mesh);
    };
    const palm = () => { add(g.palmTrunk, this.matTrunk, 0, 2.1, 0); for (let a = 0; a < 5; a++) add(g.leaf, this.matFoliage, 0, 4.1, 0, 0.2, (a / 5) * Math.PI * 2, 0.5); };
    const tree = (mat = this.matFoliage) => { add(g.trunk, this.matTrunk, 0, 1.3, 0); add(g.bush, mat, 0, 3.3, 0); };
    const rockCluster = () => { add(g.rock, this.matRock, 0, 0.5, 0, 0.2, 0.5, 0.1, 1.6, 1, 1.3); add(g.rock, this.matRock, 0.8, 0.35, 0.4, 0, 0.8, 0, 0.9, 0.7, 0.9); };
    const scrub = () => { for (let i = 0; i < 3; i++) add(g.scrub, this.matScrub, (i - 1) * 0.5, 0.4, (i % 2) * 0.4, 0, 0, 0, 1, 0.7, 1); };
    const pine = () => {
      add(g.trunk, this.matTrunk, 0, 1.6, 0, 0, 0, 0, 1, 1.5, 1);
      add(g.canopy, this.matFoliageDark, 0, 3.4, 0);
      add(g.canopy, this.matFoliage, 0, 4.6, 0, 0, 0, 0, 0.72, 0.8, 0.72);
    };
    const maguey = () => { for (let a = 0; a < 7; a++) add(g.leaf, this.matFoliage, 0, 0.35, 0, 1.05, (a / 7) * Math.PI * 2, 0.35, 0.55, 0.25, 1.3); };
    const cardon = () => { add(g.saguaro, this.matCactus, 0, 3.6, 0, 0, 0, 0, 0.62, 1.55, 0.62); add(g.saguaroArm, this.matCactus, 0.35, 4.4, 0, 0, 0, -0.4); };

    switch (biome) {
      case 'california':
        if (variant === 0) { add(g.palmTrunk, this.matTrunk, 0, 2.6, 0, 0, 0, 0, 1, 1.3, 1); add(g.palmCrown, this.matFoliage, 0, 5.4, 0, 0, 0, 0, 1.3, 1, 1.3); }
        else if (variant === 1) scrub();
        else palm();
        break;
      case 'baja':
        if (variant === 0) cardon();
        else if (variant === 1) rockCluster();
        else scrub();
        break;
      case 'sonora':
        if (variant === 0) { add(g.saguaro, this.matCactus, 0, 2.6, 0); add(g.saguaroArm, this.matCactus, -0.45, 3, 0, 0, 0, 0.5); add(g.saguaroArm, this.matCactus, 0.45, 2.6, 0, 0, 0, -0.5); add(g.saguaroArm, this.matCactus, -0.45, 3.6, 0, Math.PI / 2, 0, 0); }
        else if (variant === 1) { add(g.trunk, this.matTrunk, 0, 1.5, 0, 0, 0, 0, 0.7, 1.4, 0.7); add(g.bush, this.matFoliage, 0, 3.4, 0, 0, 0, 0, 1.15, 0.9, 1.15); }
        else scrub();
        break;
      case 'central_mx':
        if (variant === 0) { add(g.trunk, this.matTrunk, 0, 1.2, 0); add(g.bush, this.matAccent, 0, 3.1, 0, 0, 0, 0, 1.25, 1, 1.25); }
        else maguey();
        break;
      case 's_mexico':
        add(g.trunk, this.matTrunk, 0, 1.6, 0, 0, 0, 0, 1, 1.4, 1);
        add(g.canopy, this.matFoliageDark, 0, 3.6, 0, 0, 0, 0, 1.2, 1, 1.2);
        add(g.canopy, this.matFoliage, 0, 4.7, 0, 0, 0.5, 0, 0.85, 0.9, 0.85);
        if (variant === 1) { add(g.vine, this.matFoliageDark, 0.7, 2.6, 0.2); add(g.vine, this.matFoliageDark, -0.6, 2.4, -0.2); }
        break;
      case 'guatemala':
        if (variant === 1) rockCluster();
        else tree(this.matFoliageDark);
        break;
      case 'honduras':
        pine();
        break;
      case 'el_salvador':
        if (variant === 1) { for (let i = 0; i < 5; i++) add(g.pole, this.matFoliage, (i - 2) * 0.28, 1.3, 0, 0, 0, 0.08, 0.35, 1.1, 0.35); }
        else palm();
        break;
      default:
        tree();
        break;
    }
    return grp;
  }

  // per-biome relative density (fraction of the 30 layout slots that render)
  _density(biome) {
    if (biome === 's_mexico' || biome === 'honduras' || biome === 'guatemala' || biome === 'central_mx') return 1;
    if (biome === 'sonora') return 0.45;
    if (biome === 'baja' || biome === 'california') return 0.7;
    return 0.8;
  }

  _rebuildMountains() {
    const biome = this.currentProp;
    const kind = (biome === 'sonora' || biome === 'baja') ? 'butte'
      : biome === 'california' ? 'ridge' : 'low';
    for (const tile of this.tiles) {
      const group = tile.userData.mountains;
      if (!group) continue;
      group.clear();
      for (const m of this.mountainLayout) {
        let geo = this.coneGeo;
        let sx = m.sx, sy = m.sy, sz = m.sz;
        if (kind === 'ridge') { geo = this.ridgeGeo; sx = m.sx * 2.4; sy = m.sy * 0.32; sz = m.sz * 0.45; }
        else if (kind === 'butte') { geo = this.butteGeo; sx = m.sx * 1.15; sy = m.sy * 0.5; sz = m.sz * 1.15; }
        else { sx *= 0.75; sy *= 0.42; sz *= 0.75; }
        const mesh = new THREE.Mesh(geo, this.mountainMat);
        mesh.position.set(m.x, sy / 2, m.z);
        mesh.scale.set(sx, sy, sz);
        group.add(mesh);
      }
    }
  }

  // refill props in both tiles. The second tile uses a different shoulder list.
  _rebuildProps() {
    const biome = this.currentProp;
    const layouts = [this.propLayout, this.propLayoutB];
    this.tiles.forEach((tile, ti) => {
      const layout = layouts[ti] || this.propLayout;
      const keep = Math.round(layout.length * this._density(biome));
      const props = tile.userData.props;
      props.clear();
      layout.forEach((p, idx) => {
        if (idx >= keep) return;
        const prop = this._propMesh(biome, idx % 3);
        prop.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        prop.rotation.y = (idx * 1.7) % (Math.PI * 2);
        prop.scale.setScalar(p.s);
        props.add(prop);
      });
      [-TILE * 0.22, TILE * 0.18].forEach((z, i) => {
        const x = (i === 0 ? -1 : 1) * 20;
        const board = this._billboardMesh(biome);
        board.position.set(x, terrainHeight(x, z), z);
        props.add(board);
      });
    });
    this._rebuildMountains();
  }

  // interpolate the day/night keyframes for time t (0..1, circular) into this._dn
  _dayNight(t) {
    let a = KF[KF.length - 1], b = KF[0];
    for (let i = 0; i < KF.length; i++) {
      if (t < KF[i].t) { b = KF[i]; a = KF[(i - 1 + KF.length) % KF.length]; break; }
      if (i === KF.length - 1) { a = KF[i]; b = KF[0]; }
    }
    let span = (b.t - a.t + 1) % 1; if (span === 0) span = 1;
    const local = ((t - a.t + 1) % 1) / span;
    const out = this._dn;
    out.dirC.lerpColors(a.dirC, b.dirC, local);
    out.zenC.lerpColors(a.zenC, b.zenC, local);
    out.int = a.int + (b.int - a.int) * local;
    out.elev = a.elev + (b.elev - a.elev) * local;
    out.hemi = a.hemi + (b.hemi - a.hemi) * local;
    out.stars = a.stars + (b.stars - a.stars) * local;
    out.sun = a.sun + (b.sun - a.sun) * local;
    this._horizonFor(a, this._t1); this._horizonFor(b, this._t2);
    out.horC.lerpColors(this._t1, this._t2, local);
    out.night = t >= 0.75 || t <= 0.10;
    return out;
  }

  // resolve a keyframe's horizon color (may reference the lerped biome sky)
  _horizonFor(k, target) {
    if (k.horMode === 'fixed') target.copy(k.horC);
    else if (k.horMode === 'sky') target.copy(this.curSky);
    else target.copy(this.curSky).lerp(k.horMixC, k.horMixAmt);
    return target;
  }

  resize(w, h) {
    this.width = w; this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(dt) {
    const s = gameState;
    const b = BIOMES[s.biome] || BIOMES.california;

    // apply a newly-chosen SUV color (picked on the start screen)
    if (s.suvColor !== this._suvColor) { this._suvColor = s.suvColor; this.suv.setColor(this._suvColor); }

    // smoothly lerp biome colors (terrain / mountains / props / sky / fog)
    const k = 1 - Math.exp(-dt / 0.8);
    this.curMid.lerp(this._t1.set(b.earth || b.mid), k);
    this.curSky.lerp(this._t2.set(b.sky), k);
    this.curPlant.lerp(this._t3.set(b.plant || b.mid), k);
    this.curAccent.lerp(this._t4.set(b.accent || '#f4f1ea'), k);
    if (s.biome !== this.currentProp) { this.currentProp = s.biome; this._rebuildProps(); }
    this.terrainMat.color.copy(this.curMid);
    this.mountainMat.color.copy(this.curMid).multiplyScalar(0.6);
    this.propMat.color.copy(this.curMid).multiplyScalar(0.8);
    this.matFoliage.color.copy(this.curPlant);
    this.matFoliageDark.color.copy(this.curPlant).multiplyScalar(0.62);
    this.matScrub.color.copy(this.curPlant).multiplyScalar(0.85);
    this.matAccent.color.copy(this.curAccent);
    this.hemi.color.copy(this.curSky);
    this.hemi.groundColor.copy(this.curMid);
    this._roadTarget.set(s.biome === 'guatemala' ? '#6e6e70' : '#ffffff');
    this.roadMat.color.lerp(this._roadTarget, Math.min(1, dt * 1.5));

    // seamless infinite scroll: two tiles leapfrog along Z as the world moves
    const scroll = s.miles * SCROLL;
    const offset = ((scroll % TILE) + TILE) % TILE;
    this.tiles[0].position.z = -offset;
    this.tiles[1].position.z = TILE - offset;

    // spin wheels to match the road motion (axle is along X) — stops when stopped
    const dScroll = scroll - this._lastScroll;
    this._lastScroll = scroll;
    for (const w of this.suv.wheels) w.rotation.x -= dScroll / 0.6;

    // A little suspension so the chase camera feels like a vehicle, and rests when you stop.
    this._bobT = (this._bobT || 0) + Math.abs(dScroll) * 0.28;
    const cruise = Math.min(1, Math.abs(dScroll) / (Math.max(dt, 1e-3) * SCROLL * 8));
    const hill = terrainHeight(32, 36);
    const targetY = 6.2 + hill * 0.28 + Math.sin(this._bobT) * 0.14 * cruise;
    const targetX = Math.sin(this._bobT * 0.37) * 0.06 * cruise;
    const blend = Math.min(1, dt * 4);
    this.camera.position.y += (targetY - this.camera.position.y) * blend;
    this.camera.position.x += (targetX - this.camera.position.x) * blend;
    this.camera.lookAt(0, 1.5 + hill * 0.15, 16);
    this._updateMileMarkers(s);

    // biome environment extras + approaching landmarks
    this._updateEnvironment(dt, s);
    this._updateLandmarks(dt, s);

    // ---- time of day (el_salvador eases to a locked golden hour) ----
    this._golden += ((s.biome === 'el_salvador' ? 1 : 0) - this._golden) * Math.min(1, dt * 1.2);
    const tod = s.timeOfDay + (0.66 - s.timeOfDay) * this._golden;
    const dn = this._dayNight(tod);

    // directional sun: aim from elevation along the fixed azimuth bearing
    const elev = dn.elev * DEG;
    const ce = Math.cos(elev), se = Math.sin(elev);
    this.dirLight.position.set(this._azimuth.x * ce, se, this._azimuth.z * ce).multiplyScalar(60);
    // clamp the *shadow* direction to a min elevation so low-sun shadows don't stretch/acne
    const shadowSe = Math.max(se, Math.sin(8 * DEG));
    this.dirLight.position.y = shadowSe * 60; // raise only for shadow stability; visual sun uses its own mesh
    this.dirLight.color.copy(dn.dirC);
    this.dirLight.intensity = dn.int;
    this.hemi.intensity = dn.hemi;

    // sky dome + fog/clear horizon blend
    this.skyUniforms.uZenith.value.copy(dn.zenC);
    this.skyUniforms.uHorizon.value.copy(dn.horC);
    this.scene.fog.color.copy(dn.horC);
    if (s.biome === 'guatemala') {
      this.scene.fog.color.lerp(this._rainColor, 0.62);
      this.skyUniforms.uHorizon.value.lerp(this._rainColor, 0.5);
      this.skyUniforms.uZenith.value.lerp(this._rainZenith, 0.55);
      this.dirLight.intensity *= 0.45;
    }
    if (s.biome === 'sonora') {
      this.scene.fog.color.lerp(this._heatColor, 0.55);
      // Shimmer in place. A running offset makes the desert slide sideways.
      this._heatT = (this._heatT || 0) + dt;
      if (this.terrainMat.map) this.terrainMat.map.offset.x = Math.sin(this._heatT * 0.8) * 0.015;
    } else if (this.terrainMat.map) {
      this.terrainMat.map.offset.x = 0;
    }
    this.renderer.setClearColor(this.scene.fog.color);
    this.dome.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);

    // sun mesh + soft halo: along the (unclamped) sun direction so it can sit near the horizon
    this.sun.visible = dn.sun > 0.01;
    this.sun.position.set(this._azimuth.x * ce, se, this._azimuth.z * ce).multiplyScalar(350).add(this.camera.position);
    this.sunHalo.visible = this.sun.visible;
    this.sunHalo.position.copy(this.sun.position);

    // stars
    this.stars.material.opacity = dn.stars;
    this.stars.visible = dn.stars > 0.01;

    for (const pair of this.oncoming) {
      pair.visible = dn.night;
      if (!dn.night) continue;
      pair.position.z -= dt * 55;
      if (pair.position.z < -24) pair.position.z += 280;
    }

    // headlights / lamps (lamps are inert glass by day, glow at night)
    for (const hl of this.suv.headlights) hl.intensity = dn.night ? 2.4 : 0;
    for (const lamp of this.suv.lamps) lamp.material.emissiveIntensity = dn.night ? 1.4 : 0;

    // contact shadow fades with the sun (faint at night, strongest at midday)
    this.contact.material.opacity = 0.12 + 0.28 * Math.min(1, dn.int / 1.4);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const disposedTex = new Set();
    const disposedMat = new Set();
    const disposedGeo = new Set();

    const disposeTexture = (tex) => {
      if (!tex || disposedTex.has(tex)) return;
      disposedTex.add(tex);
      tex.dispose();
    };

    this.scene.traverse((obj) => {
      if (obj.geometry && !disposedGeo.has(obj.geometry)) {
        disposedGeo.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mm of mats) {
          if (disposedMat.has(mm)) continue;
          disposedMat.add(mm);
          // dispose all texture slots, not just .map
          for (const key of ['map', 'lightMap', 'aoMap', 'emissiveMap', 'bumpMap', 'normalMap', 'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap']) {
            disposeTexture(mm[key]);
          }
          mm.dispose();
        }
      }
    });
    disposeTexture(this.dirLight.shadow.map);
    this.renderer.dispose();
  }
}

// PlaneGeometry laid flat with sin/cos vertex displacement for rolling hills.
function makeTerrainGeo(offsetX) {
  const g = new THREE.PlaneGeometry(TERRAIN_W, TILE, 40, 140);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x + offsetX, z));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ---- particles --------------------------------------------------------------
function makeParticleField(count, color, size, additive, opacity = 0.7) {
  const pos = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 1.6, y = Math.random() * 9;
    data.push({ a, r, y, vy: 1.2 + Math.random() * 2.4 });
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.data = data;
  return pts;
}

function sloganFor(biome) {
  if (biome === 'el_salvador') return 'LEGAL TENDER';
  if (biome === 'guatemala' || biome === 'honduras') return 'NOT YOUR KEYS';
  if (biome === 'central_mx' || biome === 's_mexico') return 'THERE IS NO SECOND BEST';
  return 'INFLATION IS POLICY';
}

function makeWordTexture(text, opts = {}) {
  const width = opts.width || 512;
  const height = opts.height || 256;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#1a120c';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = opts.fg || '#f7931a';
  g.lineWidth = Math.max(8, Math.round(height * 0.04));
  g.strokeRect(14, 14, width - 28, height - 28);
  g.fillStyle = opts.fg || '#f7931a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.floor(height * 0.42);
  g.font = `bold ${size}px Georgia, serif`;
  while (g.measureText(text).width > width * 0.86 && size > 16) {
    size -= 2;
    g.font = `bold ${size}px Georgia, serif`;
  }
  g.fillText(text, width / 2, height / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rain sits in front of the fixed SUV. The world scrolls; the streaks do not.
function makeRain(count) {
  const geo = new THREE.PlaneGeometry(0.045, 2.8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe7eef3, transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const data = [];
  for (let i = 0; i < count; i++) {
    const drop = {
      x: (Math.random() - 0.5) * 26,
      y: Math.random() * 20,
      z: -2 + Math.random() * 48,
      vy: 26 + Math.random() * 14,
    };
    data.push(drop);
    dummy.position.set(drop.x, drop.y, drop.z);
    dummy.rotation.x = 0.25;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.userData.data = data;
  mesh.userData.dummy = dummy;
  return mesh;
}

function updateRain(field, dt) {
  const data = field.userData.data;
  const dummy = field.userData.dummy;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    d.y -= d.vy * dt;
    if (d.y < 0.2) {
      d.y = 14 + Math.random() * 8;
      d.x = (Math.random() - 0.5) * 26;
      d.z = -2 + Math.random() * 48;
    }
    dummy.position.set(d.x, d.y, d.z);
    dummy.rotation.set(0.25, 0, 0);
    dummy.updateMatrix();
    field.setMatrixAt(i, dummy.matrix);
  }
  field.instanceMatrix.needsUpdate = true;
}

function updateParticleField(field, dt, rise) {
  const data = field.userData.data;
  const pos = field.geometry.attributes.position;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    d.y += d.vy * dt * (rise ? 1 : 0.3);
    if (d.y > 9) { d.y = 0; d.r = 0.3 + Math.random() * 1.4; d.a = Math.random() * Math.PI * 2; }
    const rr = d.r * (1 - d.y / 16);
    pos.setXYZ(i, Math.cos(d.a) * rr, d.y, Math.sin(d.a) * rr);
  }
  pos.needsUpdate = true;
}

// ---- city landmarks (Three.js primitives) -----------------------------------
function makeBtcTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1411'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#f7931a';
  g.font = 'bold 180px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('₿', 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// returns { group, side, baseY, lava? }
function buildLandmark(idx) {
  const group = new THREE.Group();
  const M = (hex, opts = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: opts.r ?? 0.9, metalness: opts.m ?? 0, emissive: opts.e ?? 0x000000, emissiveIntensity: opts.ei ?? 0 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); group.add(m); return m;
  };
  let side = 0, baseY = 0, lead = 0, lava = null, smoke = null;

  switch (idx) {
    case 0: { // Los Angeles — white letters on a wide straw hill
      side = -48; baseY = 0;
      const hill = M(0xc4a56a, { r: 1 });
      add(new THREE.BoxGeometry(78, 5, 28), hill, 0, 2, 0, 0.04, 0, 0);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(36, 8),
        new THREE.MeshBasicMaterial({
          map: makeWordTexture('HOLLYWOOD', { bg: '#161311', fg: '#f4f1ea', width: 1024, height: 256 }),
          toneMapped: false, side: THREE.DoubleSide,
        }),
      );
      sign.position.set(0, 7.2, 10);
      sign.rotation.set(-0.06, Math.PI, 0);
      group.add(sign);
      lead = 95;
      break;
    }
    case 1: { // Tijuana — the yellow arch, not a flag-colored gate
      side = 0; baseY = 0;
      const gold = M(0xe2b13c, { m: 0.35, r: 0.45 });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(11, 1.15, 10, 28, Math.PI), gold);
      arch.position.set(0, 1.2, 0);
      group.add(arch);
      add(new THREE.BoxGeometry(2.2, 2.4, 2.2), gold, -11, 1.2, 0);
      add(new THREE.BoxGeometry(2.2, 2.4, 2.2), gold, 11, 1.2, 0);
      break;
    }
    case 2: { // Hermosillo — two-tower cathedral, Cerro de la Campana behind
      side = 36; baseY = 0;
      const cream = M(0xf0e2b0);
      const cerro = M(0xa24a32, { r: 1 });
      add(new THREE.ConeGeometry(16, 22, 7), cerro, 2, 11, 16);
      add(new THREE.BoxGeometry(18, 11, 12), cream, 0, 5.5, 0);
      add(new THREE.BoxGeometry(3.2, 16, 3.2), cream, -6.2, 12, 2);
      add(new THREE.BoxGeometry(3.2, 16, 3.2), cream, 6.2, 12, 2);
      add(new THREE.ConeGeometry(1.3, 3.2, 6), M(0xc9a23a, { m: 0.4 }), -6.2, 21.5, 2);
      add(new THREE.ConeGeometry(1.3, 3.2, 6), M(0xc9a23a, { m: 0.4 }), 6.2, 21.5, 2);
      break;
    }
    case 3: { // Mexico City — Angel, with a snow-dusted cone far behind
      side = 28; baseY = 0;
      const stone = M(0xe6e0cf);
      add(new THREE.ConeGeometry(11, 20, 8), M(0xd5dbe2), 16, 12, 48);
      add(new THREE.BoxGeometry(10, 5, 10), stone, 0, 2.5, 0);
      add(new THREE.CylinderGeometry(2.1, 2.8, 52, 12), stone, 0, 30, 0);
      const gold = M(0xd4af37, { m: 0.6, e: 0x4a3a00, ei: 0.45 });
      add(new THREE.BoxGeometry(2.4, 4, 1.6), gold, 0, 58, 0);
      add(new THREE.BoxGeometry(0.35, 5, 3.2), gold, -1.6, 60, 0, 0, 0, 0.5);
      add(new THREE.BoxGeometry(0.35, 5, 3.2), gold, 1.6, 60, 0, 0, 0, -0.5);
      group.scale.setScalar(1.15);
      break;
    }
    case 4: { // Oaxaca — Monte Albán: wide low platforms on red earth
      side = -40; baseY = 0;
      const earth = M(0x8a3a28, { r: 1 });
      const stone = M(0x8d9a86);
      add(new THREE.BoxGeometry(52, 4, 28), earth, 0, 1.6, -2);
      for (let i = 0; i < 4; i++) {
        const w = 40 - i * 7;
        add(new THREE.BoxGeometry(w, 2.1, w * 0.62), stone, 0, 4.2 + i * 2.1, 0);
      }
      break;
    }
    case 5: { // Guatemala City — Agua's green cone, Fuego glowing beside it
      side = -36; baseY = 0;
      const green = M(0x2f6a3e);
      add(new THREE.ConeGeometry(26, 46, 20), green, -6, 23, 0);
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), M(0xe7eef2, { r: 1 }));
      cloud.scale.set(1.5, 0.45, 1.1);
      cloud.position.set(-6, 46, 0);
      group.add(cloud);
      add(new THREE.ConeGeometry(12, 26, 12), M(0x3a342c), 16, 13, 4);
      add(new THREE.ConeGeometry(3.2, 3.2, 10), M(0xff6a20, { e: 0xff3a00, ei: 2.4 }), 16, 26, 4);
      lava = makeParticleField(70, 0xffb020, 1.5, true, 0.9);
      lava.position.set(16, 27, 4);
      group.add(lava);
      smoke = makeParticleField(36, 0x555049, 1.8, false, 0.35);
      smoke.position.set(16, 30, 4);
      group.add(smoke);
      break;
    }
    case 6: { // Tegucigalpa — Cristo del Picacho, arms out on a ridge
      side = 32; baseY = 0;
      const ridge = M(0x6a6248, { r: 1 });
      const white = M(0xf4f1ea, { r: 0.55 });
      add(new THREE.BoxGeometry(36, 6, 14), ridge, 0, 2.4, 0);
      add(new THREE.BoxGeometry(1.1, 4.2, 0.7), white, 0, 7.2, 1);
      add(new THREE.BoxGeometry(4.6, 0.45, 0.55), white, 0, 8.4, 1);
      add(new THREE.SphereGeometry(0.55, 8, 6), white, 0, 9.6, 1);
      break;
    }
    case 7: // San Salvador — Divino Salvador, bitcoin on the globe
    default: {
      side = 0; baseY = 0;
      const stone = M(0xf4f1ea, { m: 0.15, r: 0.45 });
      add(new THREE.BoxGeometry(7, 3, 7), stone, 0, 1.5, 0);
      add(new THREE.CylinderGeometry(1.3, 1.7, 22, 12), stone, 0, 13, 0);
      add(new THREE.SphereGeometry(2.3, 16, 12), stone, 0, 25.2, 0);
      add(new THREE.BoxGeometry(0.7, 2.2, 0.45), stone, 0, 28.4, 0);
      add(new THREE.BoxGeometry(1.8, 0.28, 0.35), stone, 0, 29.1, 0);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: makeBtcTexture(), side: THREE.DoubleSide }),
      );
      face.position.set(0, 25.2, -2.35);
      face.rotation.y = Math.PI;
      group.add(face);
      break;
    }
  }
  return { group, side, baseY, lead, lava, smoke };
}
