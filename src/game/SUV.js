import * as THREE from 'three';

// Builds a tall, boxy, beat-up SUV as a THREE.Group, viewed from the side
// (the camera looks down -Z; +X is the direction of travel).
// Returns { group, wheels, headlights, beams } so the scene can spin the
// wheels with mileage and toggle the headlights at night.
export function createSUV() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9c9a6e, roughness: 0.85, metalness: 0.15 }); // faded olive/beige
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3631, roughness: 0.9 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 1 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.5, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfe0ea, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55,
  });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcc55, emissiveIntensity: 1.4 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.7, 1.9), bodyMat);
  body.position.y = 1.55;
  group.add(body);

  // Lower body / skirts (slightly darker)
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.45, 1.95), darkMat);
  skirt.position.y = 0.95;
  group.add(skirt);

  // Cabin / greenhouse (a touch narrower, sits on top of body front-half)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 1.75), bodyMat);
  cabin.position.set(-0.15, 2.55, 0);
  group.add(cabin);

  // Rust patches
  const rust1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.02), rustMat);
  rust1.position.set(1.1, 1.4, 0.97);
  group.add(rust1);
  const rust2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.02), rustMat);
  rust2.position.set(-1.3, 1.2, 0.97);
  group.add(rust2);

  // Roof rack + luggage
  const rack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.7), darkMat);
  rack.position.set(-0.1, 3.12, 0);
  group.add(rack);
  const lugMat = new THREE.MeshStandardMaterial({ color: 0x5b6e8c, roughness: 0.9 });
  const lug1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 1.2), lugMat);
  lug1.position.set(-0.55, 3.43, 0);
  group.add(lug1);
  const lug2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.0), new THREE.MeshStandardMaterial({ color: 0x8c5b3a, roughness: 0.9 }));
  lug2.position.set(0.45, 3.38, 0.05);
  group.add(lug2);

  // Windshield (semi-opaque, slightly raked)
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glassMat);
  windshield.position.set(0.78, 2.55, 0.0);
  windshield.rotation.y = Math.PI / 2;
  group.add(windshield);
  // Side window
  const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), glassMat);
  sideWin.position.set(-0.15, 2.6, 0.89);
  group.add(sideWin);

  // Dented, offset front bumper (rotated a touch to look bent)
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 2.0), darkMat);
  bumper.position.set(1.85, 1.0, 0.05);
  bumper.rotation.z = 0.12;
  group.add(bumper);

  // Rear exhaust
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), hubMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-1.95, 0.75, 0.6);
  group.add(exhaust);

  // Wheels — 4 fat cylinders (axis along Z so they roll about Z)
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 18);
  const positions = [
    [1.1, 0.6, 0.95], [-1.1, 0.6, 0.95],
    [1.1, 0.6, -0.95], [-1.1, 0.6, -0.95],
  ];
  for (const [x, y, z] of positions) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.x = Math.PI / 2; // lay the cylinder so its circular face points along Z
    w.add(tire);
    // hub spokes for visible spin
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.06), hubMat);
    hub.position.z = 0.26;
    w.add(hub);
    const hub2 = hub.clone();
    hub2.rotation.z = Math.PI / 2;
    w.add(hub2);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }

  // Headlights (lamps + PointLights + glow beams), off in daytime
  const headlights = [];
  const beams = [];
  for (const dz of [0.6, -0.6]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), lampMat);
    lamp.position.set(2.02, 1.45, dz);
    group.add(lamp);

    const light = new THREE.PointLight(0xffd27a, 0, 9, 2);
    light.position.set(2.4, 1.5, dz);
    group.add(light);
    headlights.push(light);

    // Soft beam cone (a flat glow we fade in at night)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 16, 1, true), beamMat);
    beam.rotation.z = -Math.PI / 2;
    beam.position.set(3.6, 1.4, dz);
    group.add(beam);
    beams.push(beam);
  }

  return { group, wheels, headlights, beams };
}
