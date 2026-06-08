import * as THREE from 'three';
import { gameState } from './gameStateAndRules.js';
import { BIOMES } from '../map-data/citiesAndRoute.js';
import { createSUV } from './truckModel3D.js';

const VIEW_HEIGHT = 14;       // world units visible vertically
const HORIZON_Y = -1.6;       // y where land meets sky
const ROAD_SURFACE_Y = -3.0;  // y the SUV's wheels rest on
const METERS_TO_TILES = 1 / 90; // how fast textures scroll per mile

// ---- tileable canvas textures -------------------------------------------

function makeGradientTexture() {
  // grayscale vertical gradient (light at horizon -> mid at top); tinted via material.color
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#cfe8f5');   // top of sky
  grad.addColorStop(1, '#ffffff');   // horizon (brightest)
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMountainTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  // two ridge layers, white silhouettes (tinted later), transparent above
  const drawRidge = (baseY, amp, step, alpha) => {
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.beginPath();
    g.moveTo(0, 256);
    let y = baseY;
    for (let x = 0; x <= 512; x += step) {
      // deterministic, seam-friendly: ends meet near baseY
      const edge = Math.min(x, 512 - x) / 64;
      const wobble = Math.sin(x * 0.05) * amp + Math.sin(x * 0.013) * amp * 0.6;
      y = baseY - wobble * Math.min(1, edge);
      g.lineTo(x, y);
    }
    g.lineTo(512, 256);
    g.closePath();
    g.fill();
  };
  drawRidge(150, 55, 16, 0.55);
  drawRidge(180, 35, 12, 0.9);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeTerrainTexture(prop) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  // opaque terrain (white -> tinted by material.color)
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 256);
  // subtle texture noise
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 240; i++) {
    const x = (i * 113) % 512, y = 40 + ((i * 71) % 200);
    g.fillRect(x, y, 2, 2);
  }
  // props near the top of the band (closest to horizon)
  const dark = 'rgba(0,0,0,0.32)';
  const drawProp = (x) => {
    g.fillStyle = dark;
    const baseY = 60;
    switch (prop) {
      case 'cactus':
        g.fillRect(x - 3, baseY - 34, 6, 34);
        g.fillRect(x - 14, baseY - 22, 11, 5);
        g.fillRect(x - 14, baseY - 22, 5, -12);
        g.fillRect(x + 3, baseY - 28, 11, 5);
        g.fillRect(x + 9, baseY - 28, 5, -14);
        break;
      case 'tree':
        g.fillRect(x - 2, baseY - 18, 4, 18);
        g.beginPath(); g.arc(x, baseY - 24, 13, 0, Math.PI * 2); g.fill();
        break;
      case 'palm':
        g.fillRect(x - 2, baseY - 30, 4, 30);
        for (let a = -2; a <= 2; a++) {
          g.beginPath(); g.moveTo(x, baseY - 30);
          g.quadraticCurveTo(x + a * 9, baseY - 40, x + a * 18, baseY - 30 + Math.abs(a) * 3);
          g.lineWidth = 3; g.strokeStyle = dark; g.stroke();
        }
        break;
      case 'volcano':
        g.beginPath(); g.moveTo(x - 40, baseY); g.lineTo(x, baseY - 50); g.lineTo(x + 40, baseY); g.closePath(); g.fill();
        break;
      case 'building':
        g.fillRect(x - 12, baseY - 40, 24, 40);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        for (let yy = baseY - 34; yy < baseY; yy += 9)
          for (let xx = x - 8; xx < x + 8; xx += 8) g.fillRect(xx, yy, 4, 4);
        break;
      case 'sign':
      default:
        g.fillRect(x - 1, baseY - 30, 2, 30);
        g.fillRect(x - 14, baseY - 30, 28, 12);
        break;
    }
  };
  for (let x = 70; x < 512; x += 150) drawProp(x);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 256, 256);
  // gravel speckle
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.01})`;
    g.fillRect((i * 53) % 256, (i * 97) % 256, 2, 2);
  }
  // dashed yellow centerline (runs along scroll axis = x)
  g.fillStyle = '#e8c54a';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 122, 36, 8);
  // shoulder lines
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 30, 256, 4);
  g.fillRect(0, 222, 256, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 140; i++) {
    const x = (i * 137) % 512, y = (i * 89) % 180; // keep stars in upper sky
    const r = (i % 3) === 0 ? 1.6 : 0.9;
    g.fillStyle = `rgba(255,255,255,${0.5 + (i % 4) * 0.12})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ParallaxScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();

    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;
    this._setupCamera();

    // colors we lerp toward biome targets
    const b = BIOMES[gameState.biome] || BIOMES.california;
    this.curMid = new THREE.Color(b.mid);
    this.curSky = new THREE.Color(b.sky);
    this.currentProp = b.prop;
    this.lastMiles = gameState.miles;

    this._buildLayers();
    this._buildParticles();
    this._buildLights();

    const suv = createSUV();
    this.suv = suv;
    suv.group.position.set(-this._viewWidth() * 0.22, ROAD_SURFACE_Y, 0);
    suv.group.scale.setScalar(0.92);
    this.scene.add(suv.group);

    this._bob = 0;
  }

  _viewWidth() { return VIEW_HEIGHT * (this.width / this.height); }

  _setupCamera() {
    const aspect = this.width / this.height;
    const halfH = VIEW_HEIGHT / 2;
    const halfW = halfH * aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setSize(this.width, this.height, false);
  }

  _buildLayers() {
    const W = this._viewWidth() * 1.05;

    // sky (gradient, tinted)
    this.skyMat = new THREE.MeshBasicMaterial({ map: makeGradientTexture() });
    this.skyMat.color.copy(this.curSky);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W, VIEW_HEIGHT), this.skyMat);
    sky.position.set(0, 0, -6);
    this.scene.add(sky);

    // stars (fade in at night)
    this.starsMat = new THREE.MeshBasicMaterial({ map: makeStarTexture(), transparent: true, opacity: 0, depthWrite: false });
    const stars = new THREE.Mesh(new THREE.PlaneGeometry(W, VIEW_HEIGHT * 0.55), this.starsMat);
    stars.position.set(0, VIEW_HEIGHT * 0.18, -5.5);
    this.starsTex = this.starsMat.map;
    this.starsTex.repeat.x = W / 9;
    this.scene.add(stars);

    // mountains (parallax 0.2x)
    this.mtnMat = new THREE.MeshBasicMaterial({ map: makeMountainTexture(), transparent: true, depthWrite: false });
    this.mtnMat.color.copy(this.curMid).multiplyScalar(0.55);
    const mtn = new THREE.Mesh(new THREE.PlaneGeometry(W, 5), this.mtnMat);
    mtn.position.set(0, HORIZON_Y + 1.4, -5);
    this.mtnTex = this.mtnMat.map;
    this.mtnTex.repeat.x = W / 14;
    this.scene.add(mtn);

    // mid terrain (parallax 0.6x)
    this.midMat = new THREE.MeshBasicMaterial({ map: makeTerrainTexture(this.currentProp) });
    this.midMat.color.copy(this.curMid);
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(W, 8), this.midMat);
    mid.position.set(0, HORIZON_Y - 4, -3);
    this.midTex = this.midMat.map;
    this.midTex.repeat.x = W / 10;
    this.midMesh = mid;
    this.scene.add(mid);

    // road (parallax 1.0x) — baked colors, not tinted by biome
    this.roadMat = new THREE.MeshBasicMaterial({ map: makeRoadTexture() });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(W, 4.2), this.roadMat);
    road.position.set(0, ROAD_SURFACE_Y - 1.6, -2);
    this.roadTex = this.roadMat.map;
    this.roadTex.repeat.x = W / 6;
    this.scene.add(road);
  }

  _buildParticles() {
    const N = 70;
    const W = this._viewWidth();
    this._pW = W + 4;
    const pos = new Float32Array(N * 3);
    this._pSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this._pW;
      pos[i * 3 + 1] = -7 + Math.random() * 12;      // road dust up into low sky
      pos[i * 3 + 2] = -1.5;
      this._pSpeed[i] = 1.2 + Math.random() * 2.6;   // horizontal drift
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._pGeo = geo;
    this.dustMat = new THREE.PointsMaterial({
      size: 0.5, map: makeDotTexture(), transparent: true, depthWrite: false,
      blending: THREE.NormalBlending, opacity: 0.3, color: new THREE.Color('#d8c08a'),
    });
    this.particles = new THREE.Points(geo, this.dustMat);
    this.scene.add(this.particles);
  }

  _buildLights() {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
    this.sun.position.set(4, 8, 6);
    this.scene.add(this.sun);
  }

  // 0 = full day, 1 = full night
  _nightFactor(t) {
    // dusk 0.72->0.85 ramps up, dawn 0.05->0.16 ramps down; deep night between
    if (t >= 0.85 || t <= 0.05) return 1;
    if (t > 0.72 && t < 0.85) return (t - 0.72) / 0.13;
    if (t > 0.05 && t < 0.16) return 1 - (t - 0.05) / 0.11;
    if (t >= 0.16 && t <= 0.72) return 0;
    return 0;
  }

  _maybeUpdateProp() {
    const target = (BIOMES[gameState.biome] || BIOMES.california).prop;
    if (target !== this.currentProp) {
      this.currentProp = target;
      const old = this.midMat.map;
      this.midMat.map = makeTerrainTexture(target);
      this.midMat.map.wrapS = THREE.RepeatWrapping;
      this.midMat.map.repeat.x = this.midTex.repeat.x;
      this.midTex = this.midMat.map;
      this.midMat.needsUpdate = true;
      if (old) old.dispose();
    }
  }

  resize(w, h) {
    this.width = w; this.height = h;
    this._setupCamera();
  }

  update(dt) {
    const s = gameState;
    const b = BIOMES[s.biome] || BIOMES.california;

    // lerp biome colors (~3s feel)
    const k = 1 - Math.exp(-dt / 1.0);
    this.curMid.lerp(new THREE.Color(b.mid), k);
    this.curSky.lerp(new THREE.Color(b.sky), k);
    this._maybeUpdateProp();

    // day/night
    const night = this._nightFactor(s.timeOfDay);
    const nightTint = new THREE.Color(0x2a2f52);
    const dayWhite = new THREE.Color(0xffffff);
    const tint = dayWhite.clone().lerp(nightTint, night);

    this.skyMat.color.copy(this.curSky).multiply(tint);
    this.midMat.color.copy(this.curMid).multiply(tint);
    this.mtnMat.color.copy(this.curMid).multiplyScalar(0.55).multiply(tint);
    this.roadMat.color.copy(dayWhite).multiply(tint);
    this.starsMat.opacity = night;

    this.ambient.intensity = 0.65 - night * 0.4;
    this.sun.intensity = 1.15 - night * 1.0;

    // headlights / beams on at night
    for (const hl of this.suv.headlights) hl.intensity = night * 2.2;
    for (const bm of this.suv.beams) bm.material.opacity = night * 0.22;

    // scroll layers by mileage (parallax multipliers)
    const off = s.miles * METERS_TO_TILES;
    this.mtnTex.offset.x = off * 0.2;
    this.midTex.offset.x = off * 0.6;
    this.roadTex.offset.x = off * 1.0;
    this.starsTex.offset.x = off * 0.05;

    // dust (arid) vs mist (lush) particles
    const arid = ['california', 'baja', 'sonora', 'central_mx'].includes(s.biome);
    const dustTarget = new THREE.Color(arid ? '#d8c08a' : '#cfe6d8');
    this.dustMat.color.lerp(dustTarget.multiply(tint), k);
    this.dustMat.opacity = (arid ? 0.34 : 0.2) * (1 - night * 0.4);
    const pos = this._pGeo.attributes.position;
    const driftBase = s.paused ? 0.15 : 1;
    for (let i = 0; i < this._pSpeed.length; i++) {
      let x = pos.getX(i) - this._pSpeed[i] * dt * driftBase;
      if (x < -this._pW / 2) x += this._pW;
      pos.setX(i, x);
      pos.setY(i, pos.getY(i) + Math.sin((this._bob + i) * 0.7) * dt * 0.12);
    }
    pos.needsUpdate = true;

    // spin wheels with distance traveled; engine idle bob when paused/stopped
    const dMiles = s.miles - this.lastMiles;
    this.lastMiles = s.miles;
    for (const w of this.suv.wheels) w.rotation.z -= dMiles * 1.6 + dt * (s.paused ? 0 : 0.2);

    // gentle bob
    this._bob += dt * (s.paused ? 4 : 9);
    this.suv.group.position.y = ROAD_SURFACE_Y + Math.sin(this._bob) * 0.04;
    this.suv.group.rotation.z = Math.sin(this._bob * 0.5) * 0.006;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    this.renderer.dispose();
  }
}
