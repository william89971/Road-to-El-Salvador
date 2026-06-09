import * as THREE from 'three';
import { gameState } from './gameStateAndRules.js';
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
    this.curMid = new THREE.Color(biome.mid); // displayed colors, lerped toward the active biome
    this.curSky = new THREE.Color(biome.sky);
    this._t1 = new THREE.Color();
    this._t2 = new THREE.Color();

    // reusable day/night output
    this._dn = { dirC: new THREE.Color(), int: 1, elev: 30, zenC: new THREE.Color(), horC: new THREE.Color(), hemi: 0.5, sun: 1, stars: 0, night: false };

    // ---- camera: behind & above the SUV, looking slightly down toward it ----
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 600);
    this.camera.position.set(0, 9, -15);
    this.camera.lookAt(0, 2, 20);

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
    this.roadMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: makeRoadTexture() });
    this.edgeMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });
    this.dashMat = new THREE.MeshLambertMaterial({ color: 0xf5c518, emissive: 0x3a2c00 });
    this.terrainMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(biome.mid), map: makeTerrainTexture(), shininess: 8 });
    this.mountainMat = new THREE.MeshPhongMaterial({ color: this.curMid.clone().multiplyScalar(0.6), shininess: 4 });
    this.propMat = new THREE.MeshLambertMaterial({ color: this.curMid.clone().multiplyScalar(0.8) });
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

    // ---- shared geometries ----
    this.roadGeo = new THREE.PlaneGeometry(ROAD_W, TILE);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.edgeGeo = new THREE.BoxGeometry(0.3, 0.04, TILE);
    this.dashGeo = new THREE.BoxGeometry(0.18, 0.06, 7);
    this.laneGeo = new THREE.BoxGeometry(0.08, 0.05, TILE); // solid yellow lane lines
    this.terrainGeoL = makeTerrainGeo(-TERRAIN_X);
    this.terrainGeoR = makeTerrainGeo(TERRAIN_X);
    this.coneGeo = new THREE.ConeGeometry(1, 1, 6);
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
    this._rebuildProps();    // initial props for the starting biome
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
  }

  _updateEnvironment(dt, s) {
    const jungle = s.biome === 's_mexico';
    const coast = s.biome === 'el_salvador';
    // fog density: tighter mist in the jungle
    const tn = jungle ? 35 : 80, tf = jungle ? 110 : 200;
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
  }

  // ---- approaching city landmarks ----
  _initLandmarks() {
    this.landmarks = ROUTE.map((_, i) => {
      const lm = buildLandmark(i);
      lm.group.visible = false;
      this.scene.add(lm.group);
      return lm; // { group, side, baseY, lava? }
    });
  }

  _updateLandmarks(dt, s) {
    // nearest landmark in the approach window: ahead up to 200 miles, plus a
    // short tail behind so it recedes past the camera (z<0) instead of being
    // clamped onto the SUV at z=0.
    let active = -1, activeRem = 0;
    for (let i = 0; i < ROUTE.length; i++) {
      const rem = ROUTE[i].mile - s.miles;
      if (rem >= -16 && rem <= 200) { active = i; activeRem = rem; break; }
    }
    for (let i = 0; i < this.landmarks.length; i++) {
      const lm = this.landmarks[i];
      const on = i === active;
      lm.group.visible = on;
      if (on) {
        lm.group.position.set(lm.side, lm.baseY, activeRem * 1.25); // negative once passed → behind camera
        if (lm.lava) updateParticleField(lm.lava, dt, true);
        if (lm.smoke) updateParticleField(lm.smoke, dt, true);
      }
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

    // mountains (far back, base seated on the ground)
    for (const m of this.mountainLayout) {
      const cone = new THREE.Mesh(this.coneGeo, this.mountainMat);
      cone.position.set(m.x, m.sy / 2, m.z);
      cone.scale.set(m.sx, m.sy, m.sz);
      tile.add(cone);
    }

    // props container (filled/refilled per biome)
    const props = new THREE.Group();
    tile.add(props);
    tile.userData.props = props;

    return tile;
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

    switch (biome) {
      case 'california': // palms + highway signs + billboards
        if (variant === 0) { add(g.palmTrunk, this.matTrunk, 0, 2.6, 0, 0, 0, 0, 1, 1.3, 1); add(g.palmCrown, this.matFoliage, 0, 5.4, 0, 0, 0, 0, 1.3, 1, 1.3); }
        else if (variant === 1) { add(g.post, this.matDark, 0, 1.5, 0); add(g.board, this.matSign, 0, 2.9, 0); }
        else { add(g.billboardLeg, this.matDark, -1.4, 2, 0); add(g.billboardLeg, this.matDark, 1.4, 2, 0); add(g.billboardPanel, this.matSign, 0, 4, 0); }
        break;
      case 'baja': // saguaro + rocky outcrops + scrub
        if (variant === 0) { add(g.saguaro, this.matCactus, 0, 2.6, 0); add(g.saguaroArm, this.matCactus, -0.45, 3, 0, 0, 0, 0.5); add(g.saguaroArm, this.matCactus, 0.45, 2.6, 0, 0, 0, -0.5); add(g.saguaroArm, this.matCactus, -0.45, 3.6, 0, Math.PI / 2, 0, 0); }
        else if (variant === 1) rockCluster();
        else scrub();
        break;
      case 'sonora': // sparse scrub + rocks + dead trees
        if (variant === 0) scrub();
        else if (variant === 1) rockCluster();
        else { add(g.deadTrunk, this.matDark, 0, 1.8, 0); add(g.branch, this.matDark, 0.3, 3, 0, 0, 0.6, 0.7); add(g.branch, this.matDark, -0.3, 2.6, 0, 0, -0.6, -0.7); }
        break;
      case 'central_mx': // denser trees + power-line poles
        if (variant === 2) { add(g.pole, this.matDark, 0, 3.2, 0); add(g.crossbar, this.matDark, 0, 5.8, 0); add(g.crossbar, this.matDark, 0, 5.2, 0); }
        else tree(this.matFoliage);
        break;
      case 's_mexico': // dense jungle: layered canopy trees + vines
        add(g.trunk, this.matTrunk, 0, 1.6, 0, 0, 0, 0, 1, 1.4, 1);
        add(g.canopy, this.matFoliageDark, 0, 3.6, 0, 0, 0, 0, 1.2, 1, 1.2);
        add(g.canopy, this.matFoliage, 0, 4.7, 0, 0, 0.5, 0, 0.85, 0.9, 0.85);
        if (variant === 1) { add(g.vine, this.matFoliageDark, 0.7, 2.6, 0.2); add(g.vine, this.matFoliageDark, -0.6, 2.4, -0.2); }
        break;
      case 'guatemala': // dark dense trees + rocks
        if (variant === 1) rockCluster();
        else { tree(this.matFoliageDark); }
        break;
      case 'honduras': // tropical palms + banana leaves (lush)
        if (variant === 2) { add(g.trunk, this.matTrunk, 0, 0.9, 0, 0, 0, 0, 0.6, 0.6, 0.6); for (let a = 0; a < 5; a++) add(g.banana, this.matBanana, 0, 1.6, 0, -0.9, (a / 5) * Math.PI * 2, 0, 1.4, 1.4, 1.4); }
        else palm();
        break;
      case 'el_salvador': // coastal palms
      default:
        palm();
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

  // refill props in both tiles from the shared layout
  _rebuildProps() {
    const biome = this.currentProp;
    const keep = Math.round(this.propLayout.length * this._density(biome));
    for (const tile of this.tiles) {
      const props = tile.userData.props;
      props.clear();
      this.propLayout.forEach((p, idx) => {
        if (idx >= keep) return;
        const variant = idx % 3;
        const prop = this._propMesh(biome, variant);
        prop.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        prop.rotation.y = (idx * 1.7) % (Math.PI * 2);
        prop.scale.setScalar(p.s);
        props.add(prop);
      });
    }
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
    this.curMid.lerp(this._t1.set(b.mid), k);
    this.curSky.lerp(this._t2.set(b.sky), k);
    if (s.biome !== this.currentProp) { this.currentProp = s.biome; this._rebuildProps(); }
    this.terrainMat.color.copy(this.curMid);
    this.mountainMat.color.copy(this.curMid).multiplyScalar(0.6);
    this.propMat.color.copy(this.curMid).multiplyScalar(0.8);
    this.hemi.color.copy(this.curSky);
    this.hemi.groundColor.copy(this.curMid);

    // seamless infinite scroll: two tiles leapfrog along Z as the world moves
    const scroll = s.miles * SCROLL;
    const offset = ((scroll % TILE) + TILE) % TILE;
    this.tiles[0].position.z = -offset;
    this.tiles[1].position.z = TILE - offset;

    // spin wheels to match the road motion (axle is along X) — stops when stopped
    const dScroll = scroll - this._lastScroll;
    this._lastScroll = scroll;
    for (const w of this.suv.wheels) w.rotation.x -= dScroll / 0.6;

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
    this.renderer.setClearColor(dn.horC);
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

    // headlights / lamps (lamps are inert glass by day, glow at night)
    for (const hl of this.suv.headlights) hl.intensity = dn.night ? 2.4 : 0;
    for (const lamp of this.suv.lamps) lamp.material.emissiveIntensity = dn.night ? 1.4 : 0;

    // contact shadow fades with the sun (faint at night, strongest at midday)
    this.contact.material.opacity = 0.12 + 0.28 * Math.min(1, dn.int / 1.4);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mm of mats) { if (mm.map) mm.map.dispose(); mm.dispose(); }
      }
    });
    this.dirLight.shadow.map?.dispose();
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
  let side = 0, baseY = 0, lava = null, smoke = null;

  switch (idx) {
    case 0: { // Los Angeles — Hollywood sign on a hill
      side = -55; baseY = 0;
      const hill = M(0x6f5a3a);
      add(new THREE.BoxGeometry(60, 18, 26), hill, 0, 7, 0, 0.12, 0, 0);
      const white = M(0xeeeeea, { e: 0x222222, ei: 0.2 });
      const letters = 'HOLLYWOOD';
      for (let i = 0; i < letters.length; i++) add(new THREE.BoxGeometry(2.6, 7, 0.6), white, -22 + i * 5.5, 17, 12, -0.1, 0, 0);
      break;
    }
    case 1: { // Tijuana — arch gateway over the road (flag colors)
      side = 0; baseY = 0;
      const green = M(0x2e8b57), white = M(0xeeeeea), red = M(0xb02a2a);
      add(new THREE.BoxGeometry(3, 22, 3), green, -9, 11, 0);
      add(new THREE.BoxGeometry(3, 22, 3), red, 9, 11, 0);
      add(new THREE.BoxGeometry(24, 3, 3), white, 0, 21, 0);
      add(new THREE.BoxGeometry(24, 1.4, 3.4), green, 0, 22.6, 0);
      add(new THREE.BoxGeometry(24, 1.4, 3.4), red, 0, 19.4, 0);
      break;
    }
    case 2: { // Hermosillo — cathedral dome
      side = 40; baseY = 0;
      const cream = M(0xddd2b0);
      add(new THREE.BoxGeometry(20, 14, 16), cream, 0, 7, 0);
      add(new THREE.SphereGeometry(8, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), cream, 0, 14, 0);
      add(new THREE.ConeGeometry(1.2, 4, 8), M(0xc9a23a, { m: 0.5 }), 0, 23, 0);
      break;
    }
    case 3: { // Mexico City — Angel of Independence column
      side = 30; baseY = 0;
      const stone = M(0xe6e0cf);
      add(new THREE.BoxGeometry(8, 4, 8), stone, 0, 2, 0);
      add(new THREE.CylinderGeometry(1.6, 2, 30, 12), stone, 0, 19, 0);
      const gold = M(0xd4af37, { m: 0.6, e: 0x4a3a00, ei: 0.3 });
      add(new THREE.BoxGeometry(2, 3, 1.4), gold, 0, 36, 0);
      add(new THREE.BoxGeometry(0.3, 4, 2.6), gold, -1.4, 37, 0, 0, 0, 0.5);
      add(new THREE.BoxGeometry(0.3, 4, 2.6), gold, 1.4, 37, 0, 0, 0, -0.5);
      break;
    }
    case 4: { // Oaxaca — stepped pyramid
      side = -42; baseY = 0;
      const stone = M(0x8d8576);
      for (let i = 0; i < 5; i++) { const w = 30 - i * 5; add(new THREE.BoxGeometry(w, 4, w), stone, 0, 2 + i * 4, 0); }
      break;
    }
    case 5: { // Guatemala City — active volcano with lava glow
      side = -55; baseY = 0;
      add(new THREE.ConeGeometry(34, 46, 24), M(0x2a2622), 0, 23, 0);
      add(new THREE.ConeGeometry(6, 6, 16), M(0x3a1a10, { e: 0xff5a10, ei: 0.6 }), 0, 45, 0);
      lava = makeParticleField(70, 0xff7a1a, 1.4, true, 0.85);
      lava.position.set(0, 46, 0);
      group.add(lava);
      smoke = makeParticleField(50, 0x555049, 2.2, false, 0.35);
      smoke.position.set(0, 49, 0);
      group.add(smoke);
      break;
    }
    case 6: { // Tegucigalpa — fortress wall with crenellations
      side = 34; baseY = 0;
      const stone = M(0x7a6f5c);
      add(new THREE.BoxGeometry(46, 12, 6), stone, 0, 6, 0);
      for (let i = 0; i < 10; i++) add(new THREE.BoxGeometry(2.6, 3, 6), stone, -20 + i * 4.5, 13, 0);
      add(new THREE.BoxGeometry(8, 16, 7), stone, -18, 8, 0);
      add(new THREE.BoxGeometry(8, 16, 7), stone, 18, 8, 0);
      break;
    }
    case 7: // San Salvador — Bitcoin obelisk
    default: {
      side = 0; baseY = 0;
      const stone = M(0xe4e4e0, { m: 0.2, r: 0.5 });
      add(new THREE.BoxGeometry(6, 4, 6), stone, 0, 2, 0);
      add(new THREE.BoxGeometry(4, 30, 4), stone, 0, 19, 0);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: makeBtcTexture() }));
      face.position.set(0, 22, 2.05);
      group.add(face);
      break;
    }
  }
  return { group, side, baseY, lava, smoke };
}
