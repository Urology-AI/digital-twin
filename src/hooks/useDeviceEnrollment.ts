import { useEffect, useState } from "react";

export interface DeviceEnrollment {
  managed: boolean;
  org: string | null;
  detail: string;
  platform: string;
}

/**
 * Advisory device-management state in the packaged desktop app: is this Mac/PC
 * enrolled in Mount Sinai device management? Null on the web, and in desktop
 * builds packaged before the check existed.
 *
 * It is the machine reporting on itself and is therefore spoofable — display
 * only, never a gate. See electron/managed.cjs.
 */
export function useDeviceEnrollment(): DeviceEnrollment | null {
  const [state, setState] = useState<DeviceEnrollment | null>(null);

  useEffect(() => {
    const check = window.desktop?.deviceEnrollment;
    if (!check) return;
    let cancelled = false;
    void check()
      .then((r) => { if (!cancelled) setState(r); })
      .catch(() => { /* nothing useful to say */ });
    return () => { cancelled = true; };
  }, []);

  return state;
}
