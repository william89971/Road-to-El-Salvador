import * as THREE from 'three';

// Builds a beat-up adventure 4x4 (Land Cruiser / Bronco silhouette) as a
// THREE.Group, oriented so the FRONT faces +Z (down the road, away from the
// chase camera) — so the camera behind it sees the rear (taillights, spare
// tyre, roof rack). Primitives only, no external assets.
//
// Returns { group, wheels, lamps, headlights }:
//   wheels     – the 4 wheel Groups (scene spins them about X to roll)
//   lamps      – the 2 emissive headlight spheres (scene drives emissive at night)
//   headlights – the 2 forward PointLights (scene drives intensity at night)
export function createSUV() {
  const group = new THREE.Group();

  // ---- materials ----
  const bodyMat   = new THREE.MeshStandardMaterial({ color: 0x7a8c6e, roughness: 0.82, metalness: 0.12 }); // faded olive
  const hoodMat   = new THREE.MeshStandardMaterial({ color: 0x6a7c5e, roughness: 0.85 });                  // slightly darker
  const trimMat   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });                   // bumpers/dark trim
  const rackMat   = new THREE.MeshStandardMaterial({ color: 0x36382f, roughness: 0.8, metalness: 0.4 });   // roof rack
  const tireMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
  const hubMat    = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.45, metalness: 0.7 });
  const rustMat   = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1.0 });
  const glassMat  = new THREE.MeshStandardMaterial({ color: 0x4a6080, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.6 });
  const lampMat   = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0 }); // inert by day
  const tailMat   = new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0xcc2222, emissiveIntensity: 0.7 });

  const mesh = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };

  // ---- body (cab clearly narrower than the lower body) ----
  mesh(new THREE.BoxGeometry(2.8, 0.9, 4.8), bodyMat, 0, 0.9, 0);          // lower body
  mesh(new THREE.BoxGeometry(2.4, 1.0, 3.0), bodyMat, 0, 1.85, 0);         // upper cab (greenhouse)
  mesh(new THREE.BoxGeometry(2.6, 0.25, 1.4), hoodMat, 0, 1.1, 2.5);       // hood nose (extends forward)

  // rear panel + taillights
  mesh(new THREE.BoxGeometry(2.6, 1.8, 0.2), hoodMat, 0, 1.1, -2.45);
  mesh(new THREE.BoxGeometry(0.45, 0.22, 0.06), tailMat, -0.95, 1.35, -2.56);
  mesh(new THREE.BoxGeometry(0.45, 0.22, 0.06), tailMat, 0.95, 1.35, -2.56);

  // front bumper (slightly dented = small rotation)
  mesh(new THREE.BoxGeometry(2.7, 0.35, 0.15), trimMat, 0, 0.5, 2.55, 0, 0, 0.05);
  // rear bumper (plain)
  mesh(new THREE.BoxGeometry(2.7, 0.35, 0.15), trimMat, 0, 0.5, -2.55);

  // ---- windshield (raked back ~15°) ----
  mesh(new THREE.BoxGeometry(2.2, 0.85, 0.08), glassMat, 0, 2.05, 1.45, -0.26);
  // rear window
  mesh(new THREE.BoxGeometry(2.0, 0.7, 0.06), glassMat, 0, 2.1, -1.45, 0.2);

  // ---- roof rack (on the cab roof, top ≈ y 2.35) ----
  const rackY = 2.5;
  for (const rx of [-0.95, 0.95]) mesh(new THREE.BoxGeometry(0.1, 0.1, 2.8), rackMat, rx, rackY, 0); // rails
  for (const rz of [-1.1, 0, 1.1]) mesh(new THREE.BoxGeometry(2.0, 0.08, 0.1), rackMat, 0, rackY, rz); // crossbars
  // loaded luggage (different heights → lived-in)
  const lug1 = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.9 });
  const lug2 = new THREE.MeshStandardMaterial({ color: 0x837a55, roughness: 0.9 });
  mesh(new THREE.BoxGeometry(0.6, 0.25, 0.5), lug1, -0.45, rackY + 0.18, -0.5);
  mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), lug2, 0.45, rackY + 0.2, -0.2);
  // rolled tarp / sleeping bag at the front of the rack (axis along X)
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 1 }),
    0, rackY + 0.14, 1.15, 0, 0, Math.PI / 2);

  // ---- wheels (axle along X; each is a Group the scene spins about X) ----
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 12);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 6);
  for (const wx of [-1.5, 1.5]) {
    for (const wz of [-1.6, 1.6]) {
      const w = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat); tire.rotation.z = Math.PI / 2; w.add(tire);
      const hub = new THREE.Mesh(hubGeo, hubMat); hub.rotation.z = Math.PI / 2; w.add(hub);
      w.position.set(wx, 0.52, wz);
      group.add(w);
      wheels.push(w);
    }
  }

  // ---- wear & accessories ----
  // rust patches flush against body sides / rear
  mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), rustMat, 1.41, 1.0, -0.8, 0, Math.PI / 2);
  mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), rustMat, -1.41, 0.8, 1.1, 0, Math.PI / 2);
  mesh(new THREE.BoxGeometry(0.25, 0.18, 0.05), rustMat, 0.6, 0.65, -2.55);
  mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), rustMat, 1.41, 1.4, 1.3, 0, Math.PI / 2);

  // spare tyre mounted flat on the rear (axis along Z, faces the camera)
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10), tireMat, 0, 1.25, -2.62, Math.PI / 2, 0, 0);
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 6), hubMat, 0, 1.25, -2.68, Math.PI / 2, 0, 0);

  // exhaust pipe (rear-right)
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), trimMat, 0.8, 0.4, -2.6, Math.PI / 2, 0, 0);

  // side mirrors on stalks
  for (const mx of [-1.3, 1.3]) {
    mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), trimMat, mx, 1.95, 1.5);       // stalk
    mesh(new THREE.BoxGeometry(0.08, 0.1, 0.15), trimMat, mx * 1.12, 1.95, 1.5); // mirror head
  }

  // ---- headlights: emissive lamps + forward PointLights (driven by scene at night) ----
  const lamps = [];
  const headlights = [];
  for (const hx of [-1.0, 1.0]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), lampMat);
    lamp.position.set(hx, 1.1, 3.22);
    group.add(lamp);
    lamps.push(lamp);

    const pl = new THREE.PointLight(0xfff0d0, 0, 12, 2);
    pl.position.set(hx, 1.1, 3.4);
    group.add(pl);
    headlights.push(pl);
  }

  return { group, wheels, lamps, headlights };
}
