// components/AssignBlContainersModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BlType = 'draft' | 'original' | 'seaway';

type ShipmentContainerLite = {
  containerNumber: string;
  capacity?: string | null;
  tare?: string | null;
};

type ShipmentLite = {
  id: number;
  jobNumber: string;
  houseBL?: string | null;
  containers: ShipmentContainerLite[];
};

type Group = {
  title: string;           // heading above the "containers in {Nth} BL"
  notes?: string;          // if you want a text box per BL (optional)
  containers: string[];    // selected containerNumbers
};

interface Props {
  open: boolean;
  onClose: () => void;
  shipment: ShipmentLite;
  defaultBlType?: BlType;
  onSavedPlan?: (args: {
    shipmentId: number;
    blType: BlType;
    groups: Group[];
  }) => void;
}

function ordinal(n: number) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

export default function AssignBlContainersModal({
  open,
  onClose,
  shipment,
  defaultBlType = 'draft',
  onSavedPlan,
}: Props) {
  const [blCount, setBlCount] = useState<number>(1);
  const [blType, setBlType] = useState<BlType>(defaultBlType);
  const [groups, setGroups] = useState<Group[]>([
    { title: `Containers in ${ordinal(1)} BL`, notes: '', containers: [] },
  ]);

  // container -> groupIndex (or -1 if unassigned)
  const [belongsTo, setBelongsTo] = useState<Record<string, number>>({});

  useEffect(() => {
    // init mapping
    const init: Record<string, number> = {};
    for (const c of shipment.containers) init[c.containerNumber] = -1;
    setBelongsTo(init);
  }, [shipment.id]);

  // When blCount changes, resize groups elegantly
  useEffect(() => {
    setGroups((prev) => {
      const next = [...prev];
      if (blCount > prev.length) {
        for (let i = prev.length; i < blCount; i++) {
          next.push({
            title: `Containers in ${ordinal(i + 1)} BL`,
            notes: '',
            containers: [],
          });
        }
      } else if (blCount < prev.length) {
        // if we are reducing, push removed groups' containers to "unassigned"
        const removed = next.splice(blCount);
        const removedCons = removed.flatMap(g => g.containers);
        if (removedCons.length) {
          setBelongsTo((b) => {
            const copy = { ...b };
            for (const cn of removedCons) copy[cn] = -1;
            return copy;
          });
        }
      }
      return next;
    });
  }, [blCount]);

  const unassigned = useMemo(() => {
    return shipment.containers.filter(c => (belongsTo[c.containerNumber] ?? -1) === -1);
  }, [belongsTo, shipment.containers]);

  const toggle = (cn: string, idx: number) => {
    setBelongsTo((b) => {
      const prevGroup = b[cn] ?? -1;
      const copy = { ...b, [cn]: prevGroup === idx ? -1 : idx };
      return copy;
    });
  };

  useEffect(() => {
    setGroups((prev) => {
      const next = prev.map(g => ({ ...g, containers: [] as string[] }));
      for (const [cn, gi] of Object.entries(belongsTo)) {
        if (gi >= 0 && next[gi]) next[gi].containers.push(cn);
      }
      return next;
    });
  }, [belongsTo]);

  const handleGeneratePlan = () => {
    // sanity: all containers are assigned? (you can relax this)
    // Here we allow partial assignment; unassigned remain ignored.
    onSavedPlan?.({
      shipmentId: shipment.id,
      blType,
      groups,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-5xl rounded-2xl shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div className="font-semibold">Split into multiple BLs & assign containers</div>
          <button onClick={onClose} className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* ---- Top controls (above shipper section) ---- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm mb-1">No. of BLs</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={blCount}
                  onChange={(e) => setBlCount(Math.max(1, Number(e.target.value || 1)))}
                  className="w-28 rounded-md border px-3 py-2 bg-transparent"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm mb-1">BL Type</label>
              <select
                value={blType}
                onChange={(e) => setBlType(e.target.value as BlType)}
                className="rounded-md border px-3 py-2 bg-transparent"
              >
                <option value="draft">Draft</option>
                <option value="original">Original</option>
                <option value="seaway">Seaway</option>
              </select>
            </div>
          </div>

          {/* ---- Unassigned panel ---- */}
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">Unassigned containers ({unassigned.length})</div>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((c) => (
                <span key={c.containerNumber} className="text-xs px-2 py-1 rounded-full border">
                  {c.containerNumber}
                </span>
              ))}
              {unassigned.length === 0 && (
                <span className="text-xs text-neutral-500">All containers are assigned.</span>
              )}
            </div>
          </div>

          {/* ---- Groups (each has a “rich text” area title + list of containers) ---- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((g, idx) => {
              const visibleContainers = shipment.containers.filter((c) => {
                const b = belongsTo[c.containerNumber] ?? -1;
                // show only if unassigned or assigned to THIS group
                return b === -1 || b === idx;
              });

              return (
                <div key={idx} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      value={g.title}
                      onChange={(e) =>
                        setGroups((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...prev[idx], title: e.target.value };
                          return copy;
                        })
                      }
                      className="font-medium bg-transparent border-b focus:outline-none px-1 py-0.5 w-full"
                    />
                  </div>

                  {/* “Rich text” box — using a textarea; swap with TipTap/Quill if you want */}
                  <label className="block text-xs text-neutral-500 mb-1">Notes (optional)</label>
                  <textarea
                    value={g.notes ?? ''}
                    onChange={(e) =>
                      setGroups((prev) => {
                        const copy = [...prev];
                        copy[idx] = { ...prev[idx], notes: e.target.value };
                        return copy;
                      })
                    }
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 bg-transparent mb-3"
                    placeholder="Any extra text for this BL (e.g., marks & numbers, handling, etc.)"
                  />

                  <div className="text-sm font-medium mb-2">
                    Select containers ({g.containers.length})
                  </div>
                  <div className="max-h-56 overflow-auto pr-2 space-y-2">
                    {visibleContainers.map((c) => {
                      const selected = (belongsTo[c.containerNumber] ?? -1) === idx;
                      return (
                        <label
                          key={c.containerNumber}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(c.containerNumber, idx)}
                          />
                          <span className="font-mono">{c.containerNumber}</span>
                          {c.capacity ? <span className="text-xs text-neutral-500">• {c.capacity}</span> : null}
                          {c.tare ? <span className="text-xs text-neutral-500">• {c.tare}</span> : null}
                        </label>
                      );
                    })}
                    {visibleContainers.length === 0 && (
                      <div className="text-xs text-neutral-500">
                        No containers available for this group.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGeneratePlan} className="gap-2">
            <Download size={16} />
            Generate {blCount} {blType === 'draft' ? 'Draft' : blType === 'original' ? 'Original' : 'Seaway'} BL{blCount > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
