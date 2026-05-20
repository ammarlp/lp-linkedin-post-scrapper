import { useState, useCallback } from 'react';

/**
 * Generic selection hook for managing a Set of selected item IDs.
 * Eliminates duplicate select-all / toggle logic across tools.
 */
export function useSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const selectAll = useCallback((items) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (items) => (e) => {
      if (e.target.checked) selectAll(items);
      else deselectAll();
    },
    [selectAll, deselectAll],
  );

  return { selectedIds, setSelectedIds, selectAll, deselectAll, toggle, handleSelectAll };
}
