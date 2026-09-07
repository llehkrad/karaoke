import { useEffect, useRef, useState } from "react";

// A small, dependency-free drag-to-reorder hook built on the Pointer Events
// API (works for mouse AND touch, unlike native HTML5 drag-and-drop, which
// is what matters here since guests reorder their queue picks on a phone).
//
// Usage: give each row a ref via setRowRef(id) and spread
// dragHandleProps(id) onto a small drag-handle element within that row.
// Reordering happens live as you drag (the closest row swaps in), and the
// final order is reported via onReorder once you let go.
//
// Move/up/cancel listeners are attached to `window` while a drag is active
// (not just the handle element) — a small drag-handle icon is an easy
// target to slip off of mid-gesture, and if that happens with listeners
// only on the handle, pointerup never fires and the drag gets stuck
// forever, silently freezing this list against any further updates from
// the server (new songs added by other guests stop appearing). Global
// listeners guarantee the drag always terminates cleanly.
export function useSortableList({ items, getId, onReorder, canDrag }) {
  const [localItems, setLocalItems] = useState(items);
  const [activeId, setActiveId] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const rowRefs = useRef(new Map());
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const localItemsRef = useRef(items);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    if (!draggingRef.current) {
      setLocalItems(items);
      localItemsRef.current = items;
    }
  }, [items]);

  function setRowRef(id) {
    return (el) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    };
  }

  function moveTo(clientY, activeIdNow) {
    let closestId = null;
    let closestDist = Infinity;
    for (const [id, el] of rowRefs.current) {
      if (id === activeIdNow) continue;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }

    const current = localItemsRef.current;
    const fromIdx = current.findIndex((it) => getId(it) === activeIdNow);
    const toIdx = closestId != null ? current.findIndex((it) => getId(it) === closestId) : -1;

    if (toIdx !== -1 && fromIdx !== -1 && fromIdx !== toIdx) {
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      localItemsRef.current = next;
      setLocalItems(next);
      startYRef.current = clientY;
      setDragOffset(0);
      return true;
    }
    return false;
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setActiveId(null);
    setDragOffset(0);

    const newIds = localItemsRef.current.map(getId);
    const originalIds = itemsRef.current.map(getId);

    if (newIds.length !== originalIds.length) {
      // The queue changed underneath this drag (another guest added or
      // removed a song mid-gesture) -- discard the stale local reorder
      // rather than commit an order that's missing/adding items, and
      // resync to whatever the server actually has.
      setLocalItems(itemsRef.current);
      localItemsRef.current = itemsRef.current;
      return;
    }

    const changed = newIds.some((id, i) => id !== originalIds[i]);
    if (changed) onReorder(newIds);
  }

  useEffect(() => {
    if (activeId == null) return;

    function onMove(e) {
      const reordered = moveTo(e.clientY, activeId);
      if (!reordered) setDragOffset(e.clientY - startYRef.current);
    }
    function onUp() {
      endDrag();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function handlePointerDown(id, e) {
    if (canDrag && !canDrag(id)) return;
    e.preventDefault();
    draggingRef.current = true;
    setActiveId(id);
    startYRef.current = e.clientY;
    setDragOffset(0);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not load-bearing: the window-level listeners above are what
      // actually guarantee the drag terminates.
    }
  }

  return {
    items: localItems,
    activeId,
    dragOffset,
    setRowRef,
    dragHandleProps: (id) => ({
      onPointerDown: (e) => handlePointerDown(id, e),
    }),
  };
}
