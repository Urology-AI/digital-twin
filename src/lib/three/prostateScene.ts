import {
  Box3,
  CatmullRomCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  BufferAttribute,
  Line,
  LineBasicMaterial,
  EdgesGeometry,
  LineSegments,
  MeshBasicMaterial,
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  ACESFilmicToneMapping,
  DoubleSide,
  Material,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  RepeatWrapping,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { fbm3D, noise3D } from "@/lib/three/noise";
import type { ThreeZoneRuntime } from "@/types/prediction";
import type { OverlayType } from "@/types/prediction";

export interface ProstateDims {
  ap: number;
  tr: number;
  cc: number;
}

export const VIEWS: Record<string, { x: number; y: number }> = {
  anterior: { x: 0, y: 0 },
  posterior: { x: 0, y: Math.PI },
  base: { x: Math.PI / 2.4, y: 0 },
  apex: { x: -Math.PI / 2.4, y: 0 },
  left: { x: 0, y: -Math.PI / 2 },
  right: { x: 0, y: Math.PI / 2 },
};

function transformToProstate(
  ox: number,
  oy: number,
  oz: number,
  offset: number,
  dims: ProstateDims,
  medianLobeGrade: number,
): { x: number; y: number; z: number } {
  const d = dims;
  let x = ox;
  let y = oy;
  let z = oz;
  x *= d.tr;
  z *= d.ap;
  y *= d.cc;
  let tf = 0.98;
  if (oy < -0.6) tf = 0.98 + (oy + 0.6) * 0.1;
  x *= tf;
  z *= tf;
  if (z > 0) {
    z *= 1.0;
    z += 0.08 * (1 - Math.abs(oy));
  }
  if (z < 0) {
    z *= 0.38;
    const xn = Math.abs(x) / d.tr;
    if (xn < 0.25) z -= 0.06 * Math.pow(Math.cos((xn / 0.25) * Math.PI * 0.5), 1.5);
  }
  if (oy > 0.45) {
    const bf = (oy - 0.45) / 0.55;
    const lat = Math.abs(x) / d.tr;
    if (lat > 0.35) x *= 1 + Math.pow((lat - 0.35) / 0.65, 0.5) * 0.1 * bf;
  }
  if (medianLobeGrade > 0 && oy > 0.3) {
    const mlf = medianLobeGrade / 3;
    const dist = Math.abs(x) / d.tr;
    if (dist < 0.25) {
      const baseFactor = Math.min((oy - 0.3) / 0.4, 1.0);
      const lateralFalloff = Math.cos((dist / 0.25) * Math.PI * 0.5);
      const protrusionHeight = mlf * 0.35 * baseFactor * lateralFalloff;
      y += protrusionHeight;
      if (z < 0.1) z -= mlf * 0.08 * baseFactor * lateralFalloff;
    }
  }
  if (oy < -0.5) {
    const af = (-oy - 0.5) / 0.5;
    x *= 1 - af * 0.1;
    z *= 1 - af * 0.1;
    y -= af * 0.16;
  }
  if (offset !== 0) {
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 0.01) {
      x += (x / len) * offset;
      y += (y / len) * offset * 0.3;
      z += (z / len) * offset;
    }
  }
  return { x, y, z };
}

function getECERiskAtPoint(
  ox: number,
  oy: number,
  oz: number,
  zones: ThreeZoneRuntime[],
): number {
  const level = oy > 0.27 ? "Base" : oy > (oz > 0 ? -0.50 : -0.95) ? "Mid" : "Apex";
  const region = oz > 0 ? "Anterior" : "Posterior";
  const side = ox < 0 ? "R" : "L";
  const phi = Math.atan2(ox, oz);
  let subregion = "full";
  if (region === "Posterior" && level !== "Apex") {
    subregion = Math.abs(phi) > Math.PI * 0.75 ? "medial" : "lateral";
  }
  for (const z of zones) {
    if (
      z.level === level &&
      (level === "Apex" || z.region === region) &&
      z.side === side &&
      (z.subregion === "full" || z.subregion === subregion)
    ) {
      return z.ece;
    }
  }
  return 0.01;
}

export function overlayColor(val: number, type: OverlayType): Color {
  if (type === "cancer") {
    if (val < 0.1) return new Color(0.18, 0.8, 0.44);
    if (val < 0.25) {
      const t = (val - 0.1) / 0.15;
      return new Color(0.18 + t * 0.72, 0.8 - t * 0.3, 0.44 - t * 0.34);
    }
    if (val < 0.5) {
      const t = (val - 0.25) / 0.25;
      return new Color(0.9, 0.5 - t * 0.2, 0.1);
    }
    const t = Math.min(1, (val - 0.5) / 0.3);
    return new Color(0.95, 0.3 - t * 0.25, 0.08);
  }
  if (type === "ece") {
    if (val < 0.1) return new Color(0.18, 0.78, 0.44);
    if (val < 0.25) {
      const t = (val - 0.1) / 0.15;
      return new Color(0.18 + t * 0.72, 0.78 - t * 0.28, 0.44 - t * 0.34);
    }
    if (val < 0.5) {
      const t = (val - 0.25) / 0.25;
      return new Color(0.9, 0.5 - t * 0.15, 0.1);
    }
    const t = Math.min(1, (val - 0.5) / 0.3);
    return new Color(0.95, 0.35 - t * 0.3, 0.06);
  }
  if (type === "svi") {
    if (val < 0.1) return new Color(0.25, 0.35, 0.65);
    if (val < 0.3) {
      const t = (val - 0.1) / 0.2;
      return new Color(0.25 + t * 0.45, 0.35 + t * 0.2, 0.65 - t * 0.25);
    }
    const t = Math.min(1, (val - 0.3) / 0.4);
    return new Color(0.7, 0.55 - t * 0.4, 0.4 - t * 0.3);
  }
  if (type === "psm") {
    if (val < 0.15) return new Color(0.2, 0.5, 0.75);
    if (val < 0.35) {
      const t = (val - 0.15) / 0.2;
      return new Color(0.2 + t * 0.6, 0.5 - t * 0.1, 0.75 - t * 0.45);
    }
    const t = Math.min(1, (val - 0.35) / 0.35);
    return new Color(0.8, 0.4 - t * 0.3, 0.3 - t * 0.2);
  }
  return new Color(0.5, 0.5, 0.5);
}

/**
 * Look up the overlay value for a zone containing the given normalised
 * unit-sphere direction (nx=TR, ny=CC, nz=AP with +nz = anterior).
 */
function lookupZoneValue(
  nx: number,
  ny: number,
  nz: number,
  zones: ThreeZoneRuntime[],
  overlay: OverlayType,
): number {
  // Anatomical proportions: Base ≈37% (top), Mid ≈33% (middle), Apex ≈30% (bottom).
  // ny is normalised on the prostate CC half-dimension so ±1 = surface poles.
  const level = ny > 0.27 ? "Base" : ny > (nz > 0 ? -0.50 : -0.95) ? "Mid" : "Apex";
  const region = nz > 0 ? "Anterior" : "Posterior";
  const side = nx < 0 ? "R" : "L";
  const phi = Math.atan2(nx, nz);
  let subregion = "full";
  if (region === "Posterior" && level !== "Apex") {
    subregion = Math.abs(phi) > Math.PI * 0.75 ? "medial" : "lateral";
  }
  for (const z of zones) {
    if (
      z.level === level &&
      (level === "Apex" || z.region === region) &&
      z.side === side &&
      (z.subregion === "full" || z.subregion === subregion)
    ) {
      return overlay === "cancer"
        ? z.cancer
        : overlay === "ece"
          ? z.ece
          : overlay === "svi"
            ? z.svi
            : z.psm;
    }
  }
  return 0.01;
}

/**
 * Paint vertex colours on the GLB prostate meshes.
 * When heatmapVisible is true each vertex is coloured by its zone risk;
 * otherwise an anatomical tissue palette is used.
 */
function paintGlbProstate(
  meshes: Mesh[],
  zones: ThreeZoneRuntime[],
  overlay: OverlayType,
  dims: ProstateDims,
  heatmapVisible: boolean,
  lesionsOnly: boolean,
): void {
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position as BufferAttribute | undefined;
    if (!pos) continue;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // Convert Three.js world coords back to normalised unit-sphere directions.
      const nx = pos.getX(i) / dims.tr;
      const ny = pos.getY(i) / dims.cc;
      const nz = pos.getZ(i) / dims.ap;
      // At the mid-gland equator, barely-posterior edge vertices are visible
      // from the front — clamp them to anterior so posterior data doesn't bleed
      // to the front-facing edge.  At the apex the tip curves sharply; use no
      // clamp (0) so that edge-band vertices stay on the posterior side and
      // anterior apex data only shows on truly anterior (nz > 0) vertices.
      const apexClamp = ny < -0.35 ? 0 : -0.18;
      const nzQ = nz >= apexClamp ? Math.max(nz, 0.005) : nz;
      const val = lookupZoneValue(nx, ny, nzQ, zones, overlay);
      let cr: number, cg: number, cb: number;
      if (heatmapVisible && (!lesionsOnly || val >= 0.15)) {
        const c = overlayColor(val, overlay);
        cr = c.r; cg = c.g; cb = c.b;
      } else {
        // Anatomical tissue palette — lighter anterior, darker posterior.
        cr = 0.52; cg = 0.24; cb = 0.22;
        if (nz > 0.08)  { cr += 0.12; cg += 0.09; cb += 0.07; }
        if (nz < -0.12) { cr -= 0.05; cg -= 0.03; cb -= 0.02; }
        if (ny > 0.32)  { cr += 0.03; cg += 0.02; }
        if (ny < -0.28) { cr += 0.05; cg += 0.04; cb += 0.03; }
        cr = Math.max(0.32, Math.min(0.88, cr));
        cg = Math.max(0.16, Math.min(0.58, cg));
        cb = Math.max(0.14, Math.min(0.52, cb));
      }
      col[i * 3]     = cr;
      col[i * 3 + 1] = cg;
      col[i * 3 + 2] = cb;
    }
    mesh.geometry.setAttribute("color", new Float32BufferAttribute(col, 3));
    (mesh.material as MeshPhysicalMaterial).vertexColors = true;
    (mesh.material as MeshPhysicalMaterial).needsUpdate = true;
  }
}

/**
 * Paint vertex colours on the GLB seminal-vesicle meshes.
 * When overlay === "svi" and heatmapVisible the SVI risk from the
 * adjacent posterior-base zones is used; otherwise anatomical cream.
 */
function paintGlbSV(
  leftMeshes: Mesh[],
  rightMeshes: Mesh[],
  zones: ThreeZoneRuntime[],
  overlay: OverlayType,
  heatmapVisible: boolean,
): void {
  const maxSVI = (side: "L" | "R") =>
    zones
      .filter(z => z.side === side && z.region === "Posterior" && z.level === "Base")
      .reduce((mx, z) => Math.max(mx, z.svi ?? 0), 0.01);
  const lSVI = maxSVI("L");
  const rSVI = maxSVI("R");

  const paint = (meshes: Mesh[], svi: number) => {
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position as BufferAttribute | undefined;
      if (!pos) continue;
      const col = new Float32Array(pos.count * 3);
      let cr: number, cg: number, cb: number;
      if (heatmapVisible && overlay === "svi") {
        const c = overlayColor(svi, "svi");
        cr = c.r; cg = c.g; cb = c.b;
      } else {
        // Anatomical cream — matches 0xd0c0b0
        cr = 0.816; cg = 0.753; cb = 0.690;
      }
      for (let i = 0; i < pos.count; i++) {
        col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;
      }
      mesh.geometry.setAttribute("color", new Float32BufferAttribute(col, 3));
      (mesh.material as MeshPhysicalMaterial).vertexColors = true;
      (mesh.material as MeshPhysicalMaterial).needsUpdate = true;
    }
  };

  paint(leftMeshes, lSVI);
  paint(rightMeshes, rSVI);
}

function createProstateMesh(
  dims: ProstateDims,
  zones: ThreeZoneRuntime[],
  medianLobeGrade: number,
): Mesh {
  const geo = new SphereGeometry(1, 96, 96);
  const pos = geo.attributes.position!.array as Float32Array;
  const col = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const ox = pos[i]!;
    const oy = pos[i + 1]!;
    const oz = pos[i + 2]!;
    let { x, y, z } = transformToProstate(ox, oy, oz, 0, dims, medianLobeGrade);
    const er = getECERiskAtPoint(ox, oy, oz, zones);
    if (er > 0.1) {
      const ba = Math.pow((er - 0.1) / 0.9, 1.3) * 0.28;
      const ir = noise3D(ox * 8, oy * 8, oz * 8, 2) * 0.35 + 0.82;
      const fb = ba * ir;
      const ln = Math.sqrt(x * x + y * y + z * z);
      if (ln > 0.01) {
        x += (x / ln) * fb;
        y += (y / ln) * fb * 0.4;
        z += (z / ln) * fb;
        if (er > 0.6) {
          const nn = Math.pow(Math.max(0, noise3D(ox * 14, oy * 14, oz * 14, 3)), 2);
          const nb = nn * (er - 0.6) * 0.22;
          x += (x / ln) * nb;
          z += (z / ln) * nb;
        }
      }
    }
    const sf = fbm3D(ox * 9, oy * 9, oz * 9, 4) * 0.024;
    const fn = noise3D(ox * 22, oy * 28, oz * 22, 1) * 0.008;
    const l2 = Math.sqrt(x * x + y * y + z * z);
    if (l2 > 0.01) {
      const dd = sf + fn;
      x += (x / l2) * dd;
      y += (y / l2) * dd * 0.35;
      z += (z / l2) * dd;
    }
    pos[i] = x;
    pos[i + 1] = y;
    pos[i + 2] = z;
    const ant = oz > 0.08;
    const pst = oz < -0.12;
    const bas = oy > 0.32;
    const apx = oy < -0.28;
    let cr = 0.52;
    let cg = 0.24;
    let cb = 0.22;
    if (ant) {
      cr += 0.12;
      cg += 0.09;
      cb += 0.07;
    }
    if (pst) {
      cr -= 0.05;
      cg -= 0.03;
      cb -= 0.02;
    }
    if (bas) {
      cr += 0.03;
      cg += 0.02;
    }
    if (apx) {
      cr += 0.05;
      cg += 0.04;
      cb += 0.03;
    }
    const cv = fbm3D(ox * 7, oy * 7, oz * 7, 3) * 0.11;
    const sp = noise3D(ox * 15, oy * 15, oz * 15, 1) * 0.06;
    col[i] = Math.max(0.32, Math.min(0.88, cr + cv + sp));
    col[i + 1] = Math.max(0.16, Math.min(0.58, cg + cv * 0.7 + sp * 0.5));
    col[i + 2] = Math.max(0.14, Math.min(0.52, cb + cv * 0.5 + sp * 0.3));
  }
  geo.setAttribute("color", new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new Mesh(
    geo,
    new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.18,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
    }),
  );
}

function createZoneMesh(
  zone: ThreeZoneRuntime,
  dims: ProstateDims,
  medianLobeGrade: number,
  overlay: OverlayType,
  zones: ThreeZoneRuntime[],
): { mesh: Mesh; edges: LineSegments } {
  const iR = zone.side === "R";
  const iA = zone.region === "Anterior";
  const iL = zone.subregion === "lateral";
  const iM = zone.subregion === "medial";
  const iF = zone.subregion === "full";
  let yMn: number;
  let yMx: number;
  if (zone.level === "Base") {
    yMn = 0.27;
    yMx = 0.92;   // clamped within valid sphere (avoids degenerate r=0 cap at oy>1)
  } else if (zone.level === "Mid") {
    yMn = -0.65;
    yMx = 0.27;
  } else {
    yMn = -0.92;
    yMx = -0.72;
  }
  const uS = 20;
  const vS = 16;
  const vts: number[] = [];
  for (let v = 0; v <= vS; v++) {
    const vt = v / vS;
    const oy = yMn + vt * (yMx - yMn);
    for (let u = 0; u <= uS; u++) {
      const ut = u / uS;
      let phi: number;
      if (iA) phi = iR ? -ut * (Math.PI / 2) : ut * (Math.PI / 2);
      else if (iF) phi = iR ? -Math.PI / 2 - ut * (Math.PI / 2) : Math.PI / 2 + ut * (Math.PI / 2);
      else if (iL) phi = iR ? -Math.PI / 2 - ut * (Math.PI / 4) : Math.PI / 2 + ut * (Math.PI / 4);
      else if (iM) phi = iR ? (-3 * Math.PI) / 4 - ut * (Math.PI / 4) : (3 * Math.PI) / 4 + ut * (Math.PI / 4);
      else phi = 0;
      const r = Math.sqrt(Math.max(0, 1 - oy * oy)); // clamp: apex yMn=-1.15 would give NaN
      const ox = r * Math.sin(phi);
      const oz = r * Math.cos(phi);
      let p = transformToProstate(ox, oy, oz, 0.065, dims, medianLobeGrade);
      const er = getECERiskAtPoint(ox, oy, oz, zones);
      if (er > 0.1) {
        const ba = Math.pow((er - 0.1) / 0.9, 1.3) * 0.28;
        const ir = noise3D(ox * 8, oy * 8, oz * 8, 2) * 0.35 + 0.82;
        const fb = ba * ir;
        const ln = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (ln > 0.01) {
          p.x += (p.x / ln) * fb;
          p.y += (p.y / ln) * fb * 0.4;
          p.z += (p.z / ln) * fb;
          if (er > 0.6) {
            const nn = Math.pow(Math.max(0, noise3D(ox * 14, oy * 14, oz * 14, 3)), 2);
            const nb = nn * (er - 0.6) * 0.22;
            p.x += (p.x / ln) * nb;
            p.z += (p.z / ln) * nb;
          }
        }
      }
      vts.push(p.x, p.y, p.z);
    }
  }
  const ids: number[] = [];
  for (let v = 0; v < vS; v++)
    for (let u = 0; u < uS; u++) {
      const a = v * (uS + 1) + u;
      const b = a + (uS + 1);
      ids.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(vts, 3));
  geo.setIndex(ids);
  geo.computeVertexNormals();
  const prob =
    overlay === "cancer"
      ? zone.cancer
      : overlay === "ece"
        ? zone.ece
        : overlay === "svi"
          ? zone.svi
          : zone.psm;
  const mesh = new Mesh(
    geo,
    new MeshBasicMaterial({
      color: overlayColor(prob, overlay),
      transparent: true,
      opacity: 0.78,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  mesh.renderOrder = 1;
  mesh.userData.zone = zone;
  const eg = new EdgesGeometry(geo, 25);
  const ls = new LineSegments(
    eg,
    new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    }),
  );
  ls.renderOrder = 2;
  return { mesh, edges: ls };
}

/** Simplified SV / VD / urethra (anatomical guides; full vertex model in legacy HTML). */
function createAccessoryMeshes(dims: ProstateDims): { sv: Group; vd: Group; urethra: Mesh } {
  const yOff = dims.cc - 0.82;
  const sv = new Group();
  for (const side of [-1, 1] as const) {
    const curve = new CatmullRomCurve3([
      new Vector3(side * 0.13, 0.47 + yOff, -0.05),
      new Vector3(side * 0.24, 0.6 + yOff, 0),
      new Vector3(side * 0.38, 0.78 + yOff, 0.02),
      new Vector3(side * 0.48, 0.94 + yOff, 0.03),
      new Vector3(side * 0.56, 1.1 + yOff, 0.02),
      new Vector3(side * 0.62, 1.28 + yOff, 0),
    ]);
    sv.add(
      new Mesh(
        new TubeGeometry(curve, 32, 0.06, 10, false),
        new MeshPhysicalMaterial({ color: 0xd0c0b0, roughness: 0.55 }),
      ),
    );
  }
  const vd = new Group();
  for (const s of [-1, 1] as const) {
    const c = new CatmullRomCurve3([
      new Vector3(s * 0.06, 0.45 + yOff, -0.04),
      new Vector3(s * 0.1, 0.6 + yOff, -0.02),
      new Vector3(s * 0.16, 0.8 + yOff, 0),
      new Vector3(s * 0.22, 1.0 + yOff, 0.02),
      new Vector3(s * 0.28, 1.18 + yOff, 0.01),
      new Vector3(s * 0.32, 1.4 + yOff, 0),
    ]);
    vd.add(
      new Mesh(
        new TubeGeometry(c, 28, 0.052, 12, false),
        new MeshPhysicalMaterial({ color: 0xf0e8dc, roughness: 0.42, metalness: 0.03 }),
      ),
    );
  }
  const uc = new CatmullRomCurve3([
    new Vector3(0, 0.25, 0.12),
    new Vector3(0.02, 0, 0.1),
    new Vector3(-0.01, -0.25, 0.08),
    new Vector3(0.03, -0.5, 0.04),
    new Vector3(-0.02, -0.75, 0.02),
    new Vector3(0.04, -1.0, -0.01),
    new Vector3(-0.01, -1.3, -0.03),
    new Vector3(0.03, -1.55, -0.05),
  ]);
  const urethra = new Mesh(
    new TubeGeometry(uc, 36, 0.028, 10, false),
    new MeshPhysicalMaterial({
      color: 0x353535,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
      clearcoat: 0.2,
    }),
  );
  return { sv, vd, urethra };
}

function createMedianLobeLine(dims: ProstateDims, grade: number): Group | null {
  if (grade <= 0) return null;
  const g = new Group();
  const mlf = grade / 3;
  const pts: Vector3[] = [];
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2;
    const rx = 0.22 * dims.tr;
    const rz = 0.15 * dims.ap;
    const x = Math.cos(angle) * rx;
    const z = Math.sin(angle) * rz - 0.02;
    const y = dims.cc + mlf * 0.25;
    pts.push(new Vector3(x, y, z));
  }
  const lineGeo = new BufferGeometry().setFromPoints(pts);
  const line = new Line(
    lineGeo,
    new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }),
  );
  line.renderOrder = 8;
  g.add(line);
  return g;
}

export interface ProstateSceneHandles {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  model: Group;
  zoneMeshes: Mesh[];
  dispose: () => void;
  setSize: (w: number, h: number) => void;
  updateZones: (
    zones: ThreeZoneRuntime[],
    overlay: OverlayType,
    opts: { heatmapVisible: boolean; lesionsOnly: boolean },
  ) => void;
}

export function createProstateScene(
  container: HTMLElement,
  zones: ThreeZoneRuntime[],
  overlay: OverlayType,
  dims: ProstateDims,
  medianLobeGrade: number,
): ProstateSceneHandles {
  // ── Procedural bump texture (created once, shared across all prostate meshes) ─
  // A tileable FBM noise map gives the surface a subtle organic bump/lump texture
  // that resembles biological tissue without altering any vertex colours.
  const BUMP_SIZE = 256;
  const bumpData = new Uint8Array(BUMP_SIZE * BUMP_SIZE * 4);
  for (let by = 0; by < BUMP_SIZE; by++) {
    for (let bx = 0; bx < BUMP_SIZE; bx++) {
      const nx = bx / BUMP_SIZE;
      const ny = by / BUMP_SIZE;
      const n = fbm3D(nx * 5, ny * 5, 0.37, 4);
      const v = Math.round(Math.max(0, Math.min(255, (n * 0.5 + 0.5) * 255)));
      const idx = (by * BUMP_SIZE + bx) * 4;
      bumpData[idx] = v; bumpData[idx + 1] = v; bumpData[idx + 2] = v; bumpData[idx + 3] = 255;
    }
  }
  const prostateNoiseBump = new DataTexture(bumpData, BUMP_SIZE, BUMP_SIZE, RGBAFormat, UnsignedByteType);
  prostateNoiseBump.wrapS = prostateNoiseBump.wrapT = RepeatWrapping;
  prostateNoiseBump.needsUpdate = true;

  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  const scene = new Scene();
  scene.background = new Color(0x1e1e24);
  const camera = new PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 0.3, 4.5);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  scene.add(new AmbientLight(0xfff8f0, 0.5));
  const ml = new DirectionalLight(0xffffff, 1.0);
  ml.position.set(3, 5, 4);
  scene.add(ml);
  const fl = new DirectionalLight(0xffeedd, 0.5);
  fl.position.set(-3, 2, 3);
  scene.add(fl);

  const model = new Group();
  scene.add(model);

  const heatmapGroup = new Group();
  const boundaryGroup = new Group();
  const zoneMeshes: Mesh[] = [];

  function buildZones(z: ThreeZoneRuntime[], ov: OverlayType) {
    while (heatmapGroup.children.length) {
      const ch = heatmapGroup.children[0]!;
      heatmapGroup.remove(ch);
      if (ch instanceof Mesh) {
        ch.geometry.dispose();
        (ch.material as Material).dispose();
      }
    }
    while (boundaryGroup.children.length) {
      const ch = boundaryGroup.children[0]!;
      boundaryGroup.remove(ch);
      if (ch instanceof LineSegments) {
        ch.geometry.dispose();
        (ch.material as Material).dispose();
      }
    }
    zoneMeshes.length = 0;
    for (const zone of z) {
      const { mesh, edges } = createZoneMesh(zone, dims, medianLobeGrade, ov, z);
      heatmapGroup.add(mesh);
      boundaryGroup.add(edges);
      zoneMeshes.push(mesh);
    }
  }

  const prostateMesh = createProstateMesh(dims, zones, medianLobeGrade);
  model.add(prostateMesh);
  const { sv, vd, urethra } = createAccessoryMeshes(dims);
  model.add(sv, vd, urethra);
  buildZones(zones, overlay);
  model.add(heatmapGroup, boundaryGroup);

  const medianMesh = createMedianLobeLine(dims, medianLobeGrade);
  if (medianMesh) model.add(medianMesh);

  model.scale.setScalar(0.85);

  // GLB prostate meshes for vertex-colour heatmap updates.
  const glbProstateMeshes: Mesh[] = [];
  const glbSVLeft: Mesh[] = [];
  const glbSVRight: Mesh[] = [];
  let glbLoaded = false;

  // Load the real anatomical GLB asynchronously; procedural mesh is the fallback
  // while loading (and if the file is absent).
  const glbLoader = new GLTFLoader();
  glbLoader.load(
    `${import.meta.env.BASE_URL}models/prostate_anatomy.glb`,
    (gltf) => {
      // Force world-matrix propagation before bbox measurement.
      gltf.scene.updateMatrixWorld(true);

      const prostateNode = gltf.scene.getObjectByName("Prostate");
      if (!prostateNode) return;

      // Bake every mesh's world transform into vertex positions so all nodes
      // end up with identity local transforms before we rescale.
      gltf.scene.traverse((node) => {
        if (node === gltf.scene) return;
        if (node instanceof Mesh && node.geometry) {
          node.geometry = node.geometry.clone();
          node.geometry.applyMatrix4(node.matrixWorld);
        }
        node.position.set(0, 0, 0);
        node.quaternion.set(0, 0, 0, 1);
        node.scale.set(1, 1, 1);
        node.updateMatrix();
      });

      // Propagate identity transforms so Box3.setFromObject reads baked positions.
      gltf.scene.updateMatrixWorld(true);

      // Measure Prostate bbox in baked world space.
      const prostateBox = new Box3().setFromObject(prostateNode);
      const prostateCenter = new Vector3();
      const prostateSize = new Vector3();
      prostateBox.getCenter(prostateCenter);
      prostateBox.getSize(prostateSize);
      if (Math.max(prostateSize.x, prostateSize.y, prostateSize.z) < 1e-5) return;

      // Confirmed baked axis convention from full GLB matrix-chain analysis:
      //   baked X = TR  (transverse)
      //   baked Y = CC  (positive = cranial / base)
      //   baked Z = −AP (positive = posterior)
      //
      // Map each axis to Three.js scene centimetres while preserving the
      // purchased model's actual geometry:
      //   new X =  (baked X − Cx) × sx        TR unchanged
      //   new Y =  (baked Y − Cy) × sy        CC: higher = base ✓
      //   new Z = −(baked Z − Cz) × sz        negate: baked+ = posterior → new− ✓
      const sx = (2 * dims.tr) / prostateSize.x;
      const sy = (2 * dims.cc) / prostateSize.y;
      const sz = (2 * dims.ap) / prostateSize.z;

      // Apply the same linear transform to every mesh in the scene so all
      // anatomical parts stay in the correct relative position.
      gltf.scene.traverse((child) => {
        if (!(child instanceof Mesh) || !child.geometry) return;
        const pos = child.geometry.attributes.position;
        const arr = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          arr[i * 3]     =  (pos.getX(i) - prostateCenter.x) * sx;
          arr[i * 3 + 1] =  (pos.getY(i) - prostateCenter.y) * sy;
          arr[i * 3 + 2] = -(pos.getZ(i) - prostateCenter.z) * sz;
        }
        child.geometry.setAttribute("position", new Float32BufferAttribute(arr, 3));
        child.geometry.computeVertexNormals();
      });

      gltf.scene.scale.set(1, 1, 1);
      gltf.scene.position.set(0, 0, 0);

      // Assign materials.  Prostate gets a vertexColors physical material so
      // the heatmap can be painted directly onto its surface.
      prostateNode.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.material = new MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.52,
          metalness: 0.18,
          clearcoat: 0.35,
          clearcoatRoughness: 0.5,
          bumpMap: prostateNoiseBump,
          bumpScale: 0.012,
        });
        glbProstateMeshes.push(child);
      });

      const svNames: [string, Mesh[]][] = [
        ["Seminal_L", glbSVLeft],
        ["Seminal_R", glbSVRight],
      ];
      for (const [name, arr] of svNames) {
        const node = gltf.scene.getObjectByName(name);
        if (!node) continue;
        node.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.material = new MeshPhysicalMaterial({
            vertexColors: true,
            roughness: 0.55,
            metalness: 0.05,
          });
          arr.push(child);
        });
      }

      // Ampulla_01 is the bilateral vas deferens / ampullae mesh — the two thinner
      // tubes medial to the SVs that form the 3rd and 4th structures at the base.
      const ampullaNode = gltf.scene.getObjectByName("Ampulla_01");
      if (ampullaNode) {
        ampullaNode.visible = true;
        ampullaNode.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.material = new MeshPhysicalMaterial({
            color: 0xe2d6c8,   // slightly paler/cooler than SVs (vas = firmer, whiter)
            roughness: 0.48,
            metalness: 0.04,
          });
        });
      }

      // Show the GLB urethra.
      const urethraNode = gltf.scene.getObjectByName("Urethra");
      if (urethraNode) {
        urethraNode.visible = true;
        urethraNode.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.material = new MeshPhysicalMaterial({
            color: 0x353535,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.5,
            clearcoat: 0.2,
          });
        });
      }

      // Paint initial tissue colours onto the GLB prostate and SVs.
      paintGlbProstate(glbProstateMeshes, zones, overlay, dims, false, false);
      paintGlbSV(glbSVLeft, glbSVRight, zones, overlay, false);

      // Swap procedural anatomy for the GLB.  Floating heatmap tiles are
      // replaced by vertex colours; zone boundary outlines remain visible.
      model.remove(prostateMesh);
      prostateMesh.geometry.dispose();
      (prostateMesh.material as Material).dispose();
      sv.visible = false;
      vd.visible = false;
      urethra.visible = false;
      heatmapGroup.visible = false;
      boundaryGroup.visible = false;   // shown/hidden per heatmapVisible in updateZones

      model.add(gltf.scene);
      glbLoaded = true;
    },
    undefined,
    () => {
      // GLB unavailable — procedural mesh remains as fallback.
    },
  );

  const dispose = () => {
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    scene.clear();
  };

  return {
    scene,
    camera,
    renderer,
    model,
    zoneMeshes,
    dispose,
    setSize: (nw: number, nh: number) => {
      const ww = Math.max(1, Math.floor(nw));
      const hh = Math.max(1, Math.floor(nh));
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh);
    },
    updateZones: (z, ov, opts) => {
      if (glbLoaded) {
        // GLB mode: paint vertex colours on the real prostate surface and SVs.
        paintGlbProstate(
          glbProstateMeshes,
          z,
          ov,
          dims,
          opts.heatmapVisible,
          opts.lesionsOnly,
        );
        paintGlbSV(glbSVLeft, glbSVRight, z, ov, opts.heatmapVisible);
        // Rebuild boundary lines so zone outlines reflect updated data.
        buildZones(z, ov);
        for (const mesh of zoneMeshes) {
          const zn = mesh.userData.zone as ThreeZoneRuntime;
          const val =
            ov === "cancer" ? zn.cancer : ov === "ece" ? zn.ece : ov === "svi" ? zn.svi : zn.psm;
          mesh.visible = opts.lesionsOnly ? (val ?? 0) >= 0.15 : true;
        }
        // Zone faces replaced by vertex colours; outlines shown when heatmap active.
        heatmapGroup.visible = false;
        boundaryGroup.visible = false;
      } else {
        buildZones(z, ov);
        for (const mesh of zoneMeshes) {
          const zn = mesh.userData.zone as ThreeZoneRuntime;
          const val =
            ov === "cancer"
              ? zn.cancer
              : ov === "ece"
                ? zn.ece
                : ov === "svi"
                  ? zn.svi
                  : zn.psm;
          (mesh.material as MeshBasicMaterial).color.copy(
            overlayColor(val ?? 0.02, ov),
          );
          mesh.visible = opts.lesionsOnly ? (val ?? 0) >= 0.15 : true;
        }
        heatmapGroup.visible = opts.heatmapVisible;
      }
    },
  };
}
