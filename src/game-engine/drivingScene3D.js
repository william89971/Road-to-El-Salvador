import * as THREE from 'three';
import { gameState } from './gameStateAndRules.js';
import { BIOMES } from '../map-data/citiesAndRoute.js';
import { createSUV } from './truckModel3D.js';

// A true 3D driving scene: a perspective camera chases a fixed SUV while the
// road, rolling terrain, props and mountains scroll toward it on a seamless
// two-tile treadmill. Same exported class/interface as before, so
// GameController.jsx needs zero changes.

const TILE = 600;          // length of one scrolling tile on the Z axis
const ROAD_W = 14;         // road width
const TERRAIN_W = 120;     // each terrain tile width
const TERRAIN_X = 67;      // terrain tile center offset (road half 7 + terrain half 60)
const SCROLL = 5;          // world units scrolled per mile (driving-feel speed)
const HILL_FREQ = Math.PI / 60; // z hill frequency: period 120 → exactly 5 per TILE,
                                // so the terrain is periodic over TILE and the
                                // treadmill wrap is perfectly seamless (no crease)
const NIGHT_SKY = '#0a0814';

// Rolling-hill height at a world (x,z). Ramped to 0 near the road so the
// shoulders sit flat (no walls beside the road) and props rest on the surface.
function terrainHeight(x, z) {
  const ramp = Math.min(1, Math.max(0, (Math.abs(x) - ROAD_W / 2) / 25));
  return Math.sin(x * 0.08) * Math.cos(z * HILL_FREQ) * 6 * ramp;
}

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
    this.currentProp = biome.prop;
    this.curMid = new THREE.Color(biome.mid); // displayed colors, lerped toward the active biome
    this.curSky = new THREE.Color(biome.sky);
    this._t1 = new THREE.Color();
    this._t2 = new THREE.Color();

    // ---- camera: behind & above the SUV, looking slightly down toward it ----
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 600);
    this.camera.position.set(0, 9, -15);
    this.camera.lookAt(0, 1, 14);

    // ---- lights ----
    this.dirLight = new THREE.DirectionalLight(0xfff2d6, 1.2);
    this.dirLight.position.set(-15, 30, 25); // upper-front
    this.scene.add(this.dirLight);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);

    // ---- fog: matches sky, gives depth ----
    this.scene.fog = new THREE.Fog(biome.sky, 80, 200);
    this.renderer.setClearColor(biome.sky);

    // ---- shared materials (updated on biome change) ----
    this.roadMat = new THREE.MeshLambertMaterial({ color: 0x3b3b3d });
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
    this.suv.group.position.set(0, 0, 0);
    this.scene.add(this.suv.group);

    this._lastScroll = gameState.miles * SCROLL;

    this._rebuildProps(); // initial props for the starting biome
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
        prop.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        prop.scale.setScalar(p.s);
        props.add(prop);
      }
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
    const b = BIOMES[s.biome] || BIOMES.california;

    // smoothly lerp biome colors (terrain / mountains / props / sky / fog)
    const k = 1 - Math.exp(-dt / 0.8);
    this.curMid.lerp(this._t1.set(b.mid), k);
    this.curSky.lerp(this._t2.set(b.sky), k);
    if (b.prop !== this.currentProp) { this.currentProp = b.prop; this._rebuildProps(); }
    this.terrainMat.color.copy(this.curMid);
    this.mountainMat.color.copy(this.curMid).multiplyScalar(0.6);
    this.propMat.color.copy(this.curMid).multiplyScalar(0.8);

    // seamless infinite scroll: two tiles leapfrog along Z as the world moves
    const scroll = s.miles * SCROLL;
    const offset = ((scroll % TILE) + TILE) % TILE;
    this.tiles[0].position.z = -offset;
    this.tiles[1].position.z = TILE - offset;

    // spin wheels to match the road motion (stops when the SUV is stopped)
    const dScroll = scroll - this._lastScroll;
    this._lastScroll = scroll;
    for (const w of this.suv.wheels) w.rotation.z -= dScroll / 0.6;

    // day/night
    const t = s.timeOfDay;
    const night = t >= 0.75 || t <= 0.1;
    if (night) {
      this.renderer.setClearColor(NIGHT_SKY);
      this.scene.fog.color.set(NIGHT_SKY);
      this.ambient.intensity = 0.12;
      this.dirLight.intensity = 0.3;
      for (const hl of this.suv.headlights) hl.intensity = 2.2;
      for (const bm of this.suv.beams) bm.material.opacity = 0.3;
    } else {
      this.renderer.setClearColor(this.curSky);
      this.scene.fog.color.copy(this.curSky);
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
    pos.setY(i, terrainHeight(x + offsetX, z));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
