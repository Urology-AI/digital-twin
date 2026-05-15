import { useEffect, useRef, useState } from "react";
import {
  createProstateScene,
  type ProstateDims,
  type ProstateSceneHandles,
} from "@/lib/three/prostateScene";
import { ZOOM_NUDGE_EVENT } from "@/lib/three/zoomBridge";
import { useUiStore } from "@/store/uiStore";
import type { OverlayType } from "@/types/prediction";
import type { ThreeZoneRuntime } from "@/types/prediction";

export function useThreeProstate(
  containerRef: React.RefObject<HTMLDivElement | null>,
  zones: ThreeZoneRuntime[],
  overlay: OverlayType,
  dims: ProstateDims,
  medianLobeGrade: number,
  volumeScale: number,
  heatmapVisible: boolean,
  lesionsOnly: boolean,
) {
  const handlesRef = useRef<ProstateSceneHandles | null>(null);
  const currentRot = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{
    startDist: number;
    startZ: number;
  } | null>(null);
  const [glbLoading, setGlbLoading] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setGlbLoading(true);
    const h = createProstateScene(el, zones, overlay, dims, medianLobeGrade, () => setGlbLoading(false));
    handlesRef.current = h;
    h.model.scale.setScalar(0.85 * volumeScale);
    h.setBackground(useUiStore.getState().dark ? 0x1e1e24 : 0xf5f5f7);
    el.style.touchAction = "none";

    const applyOrbitDelta = (dx: number, dy: number) => {
      useUiStore.setState((s) => ({
        targetRot: {
          x: Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, s.targetRot.x + dy * 0.007),
          ),
          y: s.targetRot.y + dx * 0.007,
        },
      }));
    };

    const onDown = (e: MouseEvent) => {
      dragging.current = true;
      pinchRef.current = null;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };
      applyOrbitDelta(dx, dy);
    };
    const onUp = () => {
      dragging.current = false;
      pinchRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!handlesRef.current) return;
      const z = handlesRef.current.camera.position.z;
      const factor = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      const delta = e.deltaY * factor;
      handlesRef.current.camera.position.z = Math.max(
        2,
        Math.min(8, z + delta * 0.002),
      );
    };

    const touchDist = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging.current = true;
        pinchRef.current = null;
        prevMouse.current = {
          x: e.touches[0]!.clientX,
          y: e.touches[0]!.clientY,
        };
      } else if (e.touches.length >= 2 && handlesRef.current) {
        dragging.current = false;
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        pinchRef.current = {
          startDist: touchDist(t0, t1),
          startZ: handlesRef.current.camera.position.z,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!handlesRef.current) return;
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        const d = touchDist(t0, t1);
        if (d < 1 || pinchRef.current.startDist < 1) return;
        const scale = pinchRef.current.startDist / d;
        const z = pinchRef.current.startZ * scale;
        handlesRef.current.camera.position.z = Math.max(2, Math.min(8, z));
        return;
      }
      if (e.touches.length === 1 && dragging.current && !pinchRef.current) {
        e.preventDefault();
        const x = e.touches[0]!.clientX;
        const y = e.touches[0]!.clientY;
        const dx = x - prevMouse.current.x;
        const dy = y - prevMouse.current.y;
        prevMouse.current = { x, y };
        applyOrbitDelta(dx, dy);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        dragging.current = false;
        pinchRef.current = null;
      } else if (e.touches.length === 1) {
        pinchRef.current = null;
        dragging.current = true;
        prevMouse.current = {
          x: e.touches[0]!.clientX,
          y: e.touches[0]!.clientY,
        };
      }
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    const onZoomNudge = (ev: Event) => {
      const dz = (ev as CustomEvent<{ deltaZ: number }>).detail?.deltaZ ?? 0;
      if (!handlesRef.current || dz === 0) return;
      const z = handlesRef.current.camera.position.z;
      handlesRef.current.camera.position.z = Math.max(
        2,
        Math.min(8, z + dz),
      );
    };
    window.addEventListener(ZOOM_NUDGE_EVENT, onZoomNudge);

    const ro = new ResizeObserver(() => {
      if (!handlesRef.current || !containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      handlesRef.current.setSize(
        Math.max(1, clientWidth),
        Math.max(1, clientHeight),
      );
    });
    ro.observe(el);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!handlesRef.current) return;
      const t = useUiStore.getState().targetRot;
      currentRot.current.x += (t.x - currentRot.current.x) * 0.08;
      currentRot.current.y += (t.y - currentRot.current.y) * 0.08;
      handlesRef.current.model.rotation.x = currentRot.current.x;
      handlesRef.current.model.rotation.y = currentRot.current.y;
      handlesRef.current.renderer.render(
        handlesRef.current.scene,
        handlesRef.current.camera,
      );
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener(ZOOM_NUDGE_EVENT, onZoomNudge);
      el.style.touchAction = "";
      ro.disconnect();
      h.dispose();
      handlesRef.current = null;
    };
  }, [containerRef, dims.ap, dims.tr, dims.cc, medianLobeGrade, volumeScale]);

  useEffect(() => {
    const h = handlesRef.current;
    if (!h) return;
    h.model.scale.setScalar(0.85 * volumeScale);
  }, [volumeScale]);

  useEffect(() => {
    const h = handlesRef.current;
    if (!h) return;
    h.updateZones(zones, overlay, { heatmapVisible, lesionsOnly });
  }, [zones, overlay, heatmapVisible, lesionsOnly]);

  // Sync 3D scene background with the dark/light theme.
  const dark = useUiStore((s) => s.dark);
  useEffect(() => {
    const h = handlesRef.current;
    if (!h) return;
    h.setBackground(dark ? 0x1e1e24 : 0xf5f5f7);
  }, [dark]);

  return glbLoading;
}
