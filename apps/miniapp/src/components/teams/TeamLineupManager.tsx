import { useMutation } from '@tanstack/react-query';
import type { TeamLineupCreateInput } from '@hooma/contracts';
import { Check, Eye, EyeOff, Plus, Save, Shirt } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createTeamLineup,
  updateTeamLineup,
  type TeamEditableLineup,
  type TeamRosterPlayer,
} from '../../features/teams/api';
import { notify } from '../../lib/telegram';
import { TeamLineupPitch } from './TeamLineupPitch';

const MATCH_FORMATS: Array<{ value: TeamLineupCreateInput['matchFormat']; label: string; size: number }> = [
  { value: 'FIVE_V_FIVE', label: '5v5', size: 5 },
  { value: 'SIX_V_SIX', label: '6v6', size: 6 },
  { value: 'SEVEN_V_SEVEN', label: '7v7', size: 7 },
  { value: 'EIGHT_V_EIGHT', label: '8v8', size: 8 },
  { value: 'NINE_V_NINE', label: '9v9', size: 9 },
  { value: 'ELEVEN_V_ELEVEN', label: '11v11', size: 11 },
];

const FORMATIONS: Record<TeamLineupCreateInput['matchFormat'], TeamLineupCreateInput['formation'][]> = {
  FIVE_V_FIVE: ['1-2-1', '2-1-1', '2-2', 'CUSTOM'],
  SIX_V_SIX: ['2-2-1', '1-3-1', '2-1-2', 'CUSTOM'],
  SEVEN_V_SEVEN: ['2-3-1', '3-2-1', '2-2-2', 'CUSTOM'],
  EIGHT_V_EIGHT: ['3-3-1', '2-3-2', '3-2-2', 'CUSTOM'],
  NINE_V_NINE: ['3-3-2', '4-3-1', '3-4-1', 'CUSTOM'],
  ELEVEN_V_ELEVEN: ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', 'CUSTOM'],
};

const POSITIONS = ['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST', 'ANY'] as const;

type Position = (typeof POSITIONS)[number];
type DraftSlot = {
  playerId: string | null;
  role: Position;
  x: number;
  y: number;
  isStarter: boolean;
  sortOrder: number;
};

function matchSize(format: TeamLineupCreateInput['matchFormat']) {
  return MATCH_FORMATS.find((item) => item.value === format)?.size ?? 11;
}

function lineRole(index: number, totalLines: number): Position {
  if (index === 0) return 'CB';
  if (index === totalLines - 1) return 'ST';
  if (totalLines >= 4 && index === 1) return 'DM';
  if (totalLines >= 4 && index === totalLines - 2) return 'AM';
  return 'CM';
}

function presetSlots(
  formation: TeamLineupCreateInput['formation'],
  format: TeamLineupCreateInput['matchFormat'],
): DraftSlot[] {
  const size = matchSize(format);
  if (formation === 'CUSTOM') {
    return Array.from({ length: size }, (_, index) => ({
      playerId: null,
      role: index === 0 ? 'GK' : 'ANY',
      x: index === 0 ? 50 : 15 + ((index - 1) % 4) * 23,
      y: index === 0 ? 90 : 68 - Math.floor((index - 1) / 4) * 32,
      isStarter: true,
      sortOrder: index,
    }));
  }

  const lines = formation.split('-').map(Number);
  const slots: DraftSlot[] = [
    { playerId: null, role: 'GK', x: 50, y: 90, isStarter: true, sortOrder: 0 },
  ];
  const top = 68;
  const bottom = 22;
  lines.forEach((count, lineIndex) => {
    const y = lines.length === 1 ? 45 : top - ((top - bottom) * lineIndex) / (lines.length - 1);
    const role = lineRole(lineIndex, lines.length);
    for (let playerIndex = 0; playerIndex < count; playerIndex += 1) {
      slots.push({
        playerId: null,
        role,
        x: ((playerIndex + 1) * 100) / (count + 1),
        y,
        isStarter: true,
        sortOrder: slots.length,
      });
    }
  });
  return slots.slice(0, size);
}

function slotsFromLineup(
  lineup: TeamEditableLineup | null,
  formation: TeamLineupCreateInput['formation'],
  format: TeamLineupCreateInput['matchFormat'],
): DraftSlot[] {
  if (!lineup?.slots.length) return presetSlots(formation, format);
  return lineup.slots.map((slot, index) => ({
    playerId: slot.player?.id ?? null,
    role: POSITIONS.includes(slot.role as Position) ? (slot.role as Position) : 'ANY',
    x: slot.x,
    y: slot.y,
    isStarter: slot.isStarter,
    sortOrder: index,
  }));
}

export function TeamLineupManager({
  teamId,
  teamName,
  lineup,
  roster,
  onSaved,
}: {
  teamId: string;
  teamName: string;
  lineup: TeamEditableLineup | null;
  roster: TeamRosterPlayer[];
  onSaved: () => Promise<void> | void;
}) {
  const initialFormat =
    (lineup?.matchFormat as TeamLineupCreateInput['matchFormat'] | undefined) ?? 'ELEVEN_V_ELEVEN';
  const initialFormation =
    (lineup?.formation as TeamLineupCreateInput['formation'] | undefined) ??
    FORMATIONS[initialFormat][0];
  const [name, setName] = useState(lineup?.name ?? `${teamName} Matchday`);
  const [format, setFormat] = useState<TeamLineupCreateInput['matchFormat']>(initialFormat);
  const [formation, setFormation] = useState<TeamLineupCreateInput['formation']>(initialFormation);
  const [slots, setSlots] = useState<DraftSlot[]>(() =>
    slotsFromLineup(lineup, initialFormation, initialFormat),
  );

  const rosterById = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  const selectedIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.playerId ? [slot.playerId] : []))),
    [slots],
  );

  const preview: TeamEditableLineup = {
    id: lineup?.id ?? 'draft',
    name,
    formation,
    matchFormat: format,
    isCurrent: true,
    isPublished: lineup?.isPublished ?? false,
    slots: slots.map((slot, index) => ({
      id: `draft-${index}`,
      role: slot.role,
      x: slot.x,
      y: slot.y,
      isStarter: slot.isStarter,
      sortOrder: index,
      player: slot.playerId
        ? (() => {
            const player = rosterById.get(slot.playerId);
            return player
              ? {
                  id: player.id,
                  displayName: player.displayName,
                  shirtNumber: player.shirtNumber,
                  position: player.position,
                  photoUrl: player.photoUrl,
                }
              : null;
          })()
        : null,
    })),
  };

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const input: TeamLineupCreateInput = {
        name: name.trim(),
        formation,
        matchFormat: format,
        isCurrent: true,
        isPublished: publish,
        slots: slots.map((slot, index) => ({ ...slot, sortOrder: index })),
      };
      return lineup?.id
        ? updateTeamLineup(teamId, lineup.id, input)
        : createTeamLineup(teamId, input);
    },
    onSuccess: async () => {
      await onSaved();
      notify('success');
    },
    onError: () => notify('error'),
  });

  const chooseFormat = (nextFormat: TeamLineupCreateInput['matchFormat']) => {
    const nextFormation = FORMATIONS[nextFormat][0];
    setFormat(nextFormat);
    setFormation(nextFormation);
    setSlots(presetSlots(nextFormation, nextFormat));
  };

  const chooseFormation = (nextFormation: TeamLineupCreateInput['formation']) => {
    setFormation(nextFormation);
    setSlots(presetSlots(nextFormation, format));
  };

  const assignedCount = slots.filter((slot) => slot.playerId).length;
  const requiredCount = matchSize(format);
  const canPublish = assignedCount === requiredCount && name.trim().length > 0;

  return (
    <section className="teams-section">
      <div className="vintage-section-heading">
        <div>
          <div className="vintage-kicker">Team HQ · Lineup control</div>
          <h2 className="section-title">Build the shape</h2>
        </div>
        <span className="chip">{assignedCount}/{requiredCount}</span>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-[15px] font-semibold">
          Lineup name
          <input className="hooma-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <div className="grid gap-2">
          <strong className="text-[15px]">Match size</strong>
          <div className="grid grid-cols-3 gap-2">
            {MATCH_FORMATS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={format === item.value ? 'accent-button' : 'ghost-button'}
                onClick={() => chooseFormat(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-2 text-[15px] font-semibold">
          Formation
          <select
            className="hooma-input"
            value={formation}
            onChange={(event) =>
              chooseFormation(event.target.value as TeamLineupCreateInput['formation'])
            }
          >
            {FORMATIONS[format].map((item) => (
              <option key={item} value={item}>
                {item === 'CUSTOM' ? 'Custom shape' : item}
              </option>
            ))}
          </select>
        </label>

        <TeamLineupPitch teamName={teamName} lineup={preview} roster={roster} />

        <div className="grid gap-2">
          {slots.map((slot, index) => (
            <article className="rounded-2xl border border-white/10 bg-white/5 p-3" key={index}>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/30">
                  <Shirt size={16} />
                </span>
                <select
                  className="hooma-input min-w-0 flex-1"
                  value={slot.playerId ?? ''}
                  onChange={(event) => {
                    const playerId = event.target.value || null;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, playerId } : item,
                      ),
                    );
                  }}
                >
                  <option value="">Choose player</option>
                  {roster.map((player) => (
                    <option
                      key={player.id}
                      value={player.id}
                      disabled={selectedIds.has(player.id) && slot.playerId !== player.id}
                    >
                      {player.displayName}
                    </option>
                  ))}
                </select>
                <select
                  className="hooma-input w-24 shrink-0"
                  value={slot.role}
                  onChange={(event) => {
                    const role = event.target.value as Position;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, role } : item,
                      ),
                    );
                  }}
                >
                  {POSITIONS.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </div>

              {formation === 'CUSTOM' ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs muted">
                  <label className="grid gap-1">
                    Horizontal {Math.round(slot.x)}%
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={slot.x}
                      onChange={(event) => {
                        const x = Number(event.target.value);
                        setSlots((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, x } : item,
                          ),
                        );
                      }}
                    />
                  </label>
                  <label className="grid gap-1">
                    Vertical {Math.round(slot.y)}%
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={slot.y}
                      onChange={(event) => {
                        const y = Number(event.target.value);
                        setSlots((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, y } : item,
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {saveMutation.isError ? (
          <div className="vintage-empty" role="alert">
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'The lineup could not be saved.'}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="ghost-button"
            disabled={saveMutation.isPending || !name.trim()}
            onClick={() => saveMutation.mutate(false)}
          >
            {lineup?.isPublished ? <EyeOff size={16} /> : <Save size={16} />}
            {lineup?.isPublished ? 'Unpublish' : 'Save draft'}
          </button>
          <button
            type="button"
            className="accent-button"
            disabled={saveMutation.isPending || !canPublish}
            onClick={() => saveMutation.mutate(true)}
          >
            {lineup?.isPublished ? <Check size={16} /> : <Eye size={16} />}
            {lineup?.isPublished ? 'Update published' : 'Publish lineup'}
          </button>
        </div>

        {!canPublish ? (
          <p className="text-center text-xs muted">
            Assign all {requiredCount} starters before publishing. Drafts can be saved incomplete.
          </p>
        ) : null}
      </div>
    </section>
  );
}
