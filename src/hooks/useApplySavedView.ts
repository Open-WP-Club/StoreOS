import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSearch from '../stores/searchStore';
import type { FilterPreset } from '../types';

/**
 * Applies the saved view named by `?view=<id>` (set by the command palette), then drops the param.
 * Syncs `?search=` to the view; `apply` handles the page's own state (filters, page size, search state).
 */
export function useApplySavedView(apply: (preset: FilterPreset) => void): void {
  const [params, setParams] = useSearchParams();
  const id = params.get('view');
  const preset = useSearch((s) => (id ? s.savedFilterPresets.find((p) => p.id === id) : undefined));

  useEffect(() => {
    if (!preset) return;
    apply(preset);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('view');
        if (preset.search) next.set('search', preset.search);
        else next.delete('search');
        return next;
      },
      { replace: true }
    );
  }, [preset, apply, setParams]);
}
