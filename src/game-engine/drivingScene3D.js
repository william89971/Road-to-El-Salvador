import * as THREE from 'three';
import { gameState } from './gameStateAndRules.js';
import { BIOMES } from '../map-data/citiesAndRoute.js';
import { createSUV } from './truckModel3D.js';

// A true 3D driving scene: a perspective camera chases a fixed SUV while the
// road, rolling terrain, props and mountains scroll toward it on a seamless
// two-tile treadmill. Same exported class/interface as before, so
// GameController.jsx needs zero changes.

const TILE = 600;          // length of one scrolling tile on the Z axis
const ROAD_W = 20;         // road width
const TERRAIN_W = 120;     // each terrain tile width
const TERRAIN_X = 70;      // terrain tile center offset (road half 10 + terrain half 60)
const NIGHT_SKY = '#0a0814';

// lighten (amt>0) / darken (amt<0) a hex color, returns a THREE.Color
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const f = amt < 0 ? 0 : 1, p = Math.abs(amt);
  c.r += (f - c.r) * p; c.g += (f - c.g) * p; c.b += (f - c.b) * p;
  return c;
}

// deterministic pseudo-random so both treadmill tiles share an identical
// layout (props/mountains line up across the seam → invisible loop)
function rand(seed) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

export class ParallaxScene {
  constructor(canvas) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);

    this.scene = new THREE.Scene();

    const biome = BIOMES[gameState.biome] || BIOMES.california;
    this.currentBiome = gameState.biome;
    this.currentProp = biome.prop;
    this.skyHex = biome.sky;

    // ---- camera: behind & above the SUV, looking slightly down toward it ----
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 600);
    this.camera.position.set(0, 8, -14);
    this.camera.lookAt(0, 1.5, 8);

    // ---- lights ----
    this.dirLight = new THREE.DirectionalLight(0xfff2d6, 1.2);
    this.dirLight.position.set(-15, 30, 25); // upper-front
    this.scene.add(this.dirLight);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);

    // ---- fog: matches sky, gives depth ----
    this.scene.fog = new THREE.Fog(this.skyHex, 80, 200);
    this.renderer.setClearColor(this.skyHex);

    // ---- shared materials (updated on biome change) ----
    this.roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    this.dashMat = new THREE.MeshLambertMaterial({ color: 0xe8c54a, emissive: 0x3a2f00 });
    this.terrainMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(biome.mid) });
    this.mountainMat = new THREE.MeshLambertMaterial({ color: shade(biome.mid, -0.35) });
    this.propMat = new THREE.MeshLambertMaterial({ color: shade(biome.mid, -0.2) });

    // ---- shared geometries ----
    this.roadGeo = new THREE.PlaneGeometry(ROAD_W, TILE);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.dashGeo = new THREE.BoxGeometry(0.35, 0.06, 7);
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

    // ---- the SUV (fixed in world space, facing down the road = +Z) ----
    this.suv = createSUV();
    this.suv.group.rotation.y = -Math.PI / 2;
    this.suv.group.position.set(0, 0.5, 0);
    this.scene.add(this.suv.group);

    this._props = false;
    this._applyBiome(); // colors + props for the starting biome
  }

  _makeTile() {
    const tile = new THREE.Group();

    // road
    tile.add(new THREE.Mesh(this.roadGeo, this.roadMat));

    // 20 dashed centerline strips, evenly spaced
    for (let i = 0; i < 20; i++) {
      const dash = new THREE.Mesh(this.dashGeo, this.dashMat);
      dash.position.set(0, 0.04, -TILE / 2 + i * (TILE / 20) + TILE / 40);
      tile.add(dash);
    }

    // terrain tiles (left + right of the road)
    const tl = new THREE.Mesh(this.terrainGeoL, this.terrainMat); tl.position.x = -TERRAIN_X; tile.add(tl);
    const tr = new THREE.Mesh(this.terrainGeoR, this.terrainMat); tr.position.x = TERRAIN_X; tile.add(tr);

    // mountains (far back)
    for (const m of this.mountainLayout) {
      const cone = new THREE.Mesh(this.coneGeo, this.mountainMat);
      cone.position.set(m.x, m.y, m.z);
      cone.scale.set(m.sx, m.sy, m.sz);
      tile.add(cone);
    }

    // props container (filled/refilled per biome)
    const props = new THREE.Group();
    tile.add(props);
    tile.userData.props = props;

    return tile;
  }

  // build one prop mesh for the current biome's prop type
  _propMesh(type) {
    const g = this.propGeo;
    const m = this.propMat;
    const grp = new THREE.Group();
    const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      grp.add(mesh);
    };
    switch (type) {
      case 'cactus':
        add(g.cyl, 0, 2, 0);
        add(g.arm, -0.5, 2.2, 0, 0, 0, 0.4);
        add(g.arm, 0.5, 1.8, 0, 0, 0, -0.4);
        break;
      case 'tree':
        add(g.trunk, 0, 1.3, 0);
        add(g.bush, 0, 3.3, 0);
        break;
      case 'palm':
        add(g.palmTrunk, 0, 2.1, 0);
        for (let a = 0; a < 5; a++) add(g.leaf, 0, 4.1, 0, 0.2, (a / 5) * Math.PI * 2, 0.5);
        break;
      case 'building':
        add(g.box, 0, 3, 0);
        break;
      case 'sign':
        add(g.post, 0, 1.5, 0);
        add(g.board, 0, 2.7, 0);
        break;
      case 'volcano':
      default:
        add(g.cone, 0, 2, 0);
        break;
    }
    return grp;
  }

  // refill props in both tiles from the shared layout
  _rebuildProps() {
    for (const tile of this.tiles) {
      const props = tile.userData.props;
      props.clear();
      for (const p of this.propLayout) {
        const prop = this._propMesh(this.currentProp);
        prop.position.set(p.x, 0, p.z);
        prop.scale.setScalar(p.s);
        props.add(prop);
      }
    }
  }

  // push biome colors into the shared materials + sky/fog, rebuild props
  _applyBiome() {
    const b = BIOMES[gameState.biome] || BIOMES.california;
    this.terrainMat.color.set(b.mid);
    this.mountainMat.color.copy(shade(b.mid, -0.35));
    this.propMat.color.copy(shade(b.mid, -0.2));
    this.skyHex = b.sky;
    this.scene.fog.color.set(b.sky);
    if (b.prop !== this.currentProp || !this._props) {
      this.currentProp = b.prop;
      this._rebuildProps();
      this._props = true;
    }
  }

  resize(w, h) {
    this.width = w; this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(dt) {
    const s = gameState;

    // biome change → update colors, sky, props
    if (s.biome !== this.currentBiome) {
      this.currentBiome = s.biome;
      this._applyBiome();
    }

    // seamless infinite scroll: two tiles leapfrog along Z by miles * 0.1
    const offset = ((s.miles * 0.1) % TILE + TILE) % TILE;
    this.tiles[0].position.z = -offset;
    this.tiles[1].position.z = TILE - offset;

    // spin wheels
    for (const w of this.suv.wheels) w.rotation.z -= dt * 2;

    // day/night
    const t = s.timeOfDay;
    const night = t >= 0.75 || t <= 0.1;
    if (night) {
      this.renderer.setClearColor(NIGHT_SKY);
      this.scene.fog.color.set(NIGHT_SKY);
      this.ambient.intensity = 0.1;
      this.dirLight.intensity = 0.25;
      for (const hl of this.suv.headlights) hl.intensity = 2.6;
      for (const bm of this.suv.beams) bm.material.opacity = 0.25;
    } else {
      this.renderer.setClearColor(this.skyHex);
      this.scene.fog.color.set(this.skyHex);
      this.ambient.intensity = 0.4;
      this.dirLight.intensity = 1.2;
      for (const hl of this.suv.headlights) hl.intensity = 0;
      for (const bm of this.suv.beams) bm.material.opacity = 0;
    }

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
    this.renderer.dispose();
  }
}

// PlaneGeometry laid flat with sin/cos vertex displacement for rolling hills.
function makeTerrainGeo(offsetX) {
  const g = new THREE.PlaneGeometry(TERRAIN_W, TILE, 24, 80);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin((x + offsetX) * 0.08) * Math.cos(z * 0.05) * 6);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
