import { useUiStore } from "@/store/uiStore";
import { tr } from "@/lib/compass/preopI18n";

type Vars = Record<string, string | number>;

/**
 * Patient-mode translation. `t` always translates to the patient language;
 * `tp` translates only while patient mode is showing, so components shared
 * with the clinical app (e.g. ModifiableFactorsPanel) stay English there.
 */
export function usePatientT() {
  const lang = useUiStore((s) => s.patientLang);
  const patientView = useUiStore((s) => s.patientView);
  return {
    lang,
    patientView,
    t: (s: string, vars?: Vars) => tr(s, lang, vars),
    tp: (s: string, vars?: Vars) => (patientView ? tr(s, lang, vars) : s),
  };
}
