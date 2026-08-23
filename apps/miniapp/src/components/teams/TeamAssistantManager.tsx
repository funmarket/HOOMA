import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';
import {
  listTeamAssistants,
  revokeTeamAssistant,
  saveTeamAssistant,
  teamQueryKeys,
  type TeamAssistantItem,
  type TeamDelegatedPermission,
  type TeamRosterPlayer,
} from '../../features/teams/api';
import { notify } from '../../lib/telegram';

const PERMISSIONS: Array<{ value: TeamDelegatedPermission; label: string; detail: string }> = [
  { value: 'EDIT_TEAM', label: 'Edit Team', detail: 'Change Team identity and settings.' },
  { value: 'MANAGE_ROSTER', label: 'Manage roster', detail: 'Add and remove Team players.' },
  { value: 'MANAGE_LINEUP', label: 'Manage lineup', detail: 'Create and manage Team lineups.' },
  { value: 'CREATE_CHALLENGE', label: 'Send challenges', detail: 'Challenge other Teams.' },
  {
    value: 'RESPOND_CHALLENGE',
    label: 'Respond to challenges',
    detail: 'Accept or decline incoming challenges.',
  },
  {
    value: 'MESSAGE_CHALLENGE',
    label: 'Challenge messages',
    detail: 'Message inside Team challenge threads.',
  },
];

function permissionLabel(permission: TeamDelegatedPermission) {
  return PERMISSIONS.find((item) => item.value === permission)?.label ?? permission;
}

export function TeamAssistantManager({
  teamId,
  rosterPlayers,
  enabled,
}: {
  teamId: string;
  rosterPlayers: TeamRosterPlayer[];
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
  const [teamPlayerId, setTeamPlayerId] = useState('');
  const [permissions, setPermissions] = useState<TeamDelegatedPermission[]>([]);

  const assistantsQuery = useQuery({
    queryKey: teamQueryKeys.assistants(teamId),
    queryFn: () => listTeamAssistants(teamId),
    enabled: Boolean(teamId) && enabled,
    retry: false,
  });

  const assistants = assistantsQuery.data?.items ?? [];
  const assistantPlayerIds = new Set(assistants.map((assistant) => assistant.player.id));
  const linkedPlayers = rosterPlayers.filter((player) => Boolean(player.userId));
  const selectablePlayers = linkedPlayers.filter(
    (player) => player.id === teamPlayerId || !assistantPlayerIds.has(player.id),
  );

  const refreshAssistants = async () => {
    await queryClient.invalidateQueries({ queryKey: teamQueryKeys.assistants(teamId) });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingAssistantId(null);
    setTeamPlayerId('');
    setPermissions([]);
  };

  const saveMutation = useMutation({
    mutationFn: () => saveTeamAssistant(teamId, { teamPlayerId, permissions }),
    onSuccess: async () => {
      await refreshAssistants();
      closeForm();
      notify('success');
    },
    onError: () => notify('error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (responsibilityId: string) => revokeTeamAssistant(teamId, responsibilityId),
    onSuccess: async () => {
      await refreshAssistants();
      notify('success');
    },
    onError: () => notify('error'),
  });

  const beginNew = () => {
    saveMutation.reset();
    setEditingAssistantId(null);
    setTeamPlayerId('');
    setPermissions([]);
    setFormOpen(true);
  };

  const beginEdit = (assistant: TeamAssistantItem) => {
    saveMutation.reset();
    setEditingAssistantId(assistant.id);
    setTeamPlayerId(assistant.player.id);
    setPermissions([...assistant.permissions]);
    setFormOpen(true);
  };

  const togglePermission = (permission: TeamDelegatedPermission) => {
    saveMutation.reset();
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  // The API is intentionally Coach-only. A Manager or delegated Assistant may be able to edit
  // other Team surfaces, but must never receive Assistant appointment controls.
  if (!enabled || !assistantsQuery.isSuccess) return null;

  return (
    <section className="teams-section">
      <div className="vintage-section-heading">
        <div>
          <div className="vintage-kicker">Coach authority</div>
          <h2 className="section-title">Assistants</h2>
        </div>
        <button type="button" className="ghost-button shrink-0 px-3 py-2.5" onClick={beginNew}>
          <Plus size={17} /> Appoint
        </button>
      </div>

      <p className="mt-2 text-sm muted">
        Assistants remain Team-scoped. Choose only the authority they need; community Admin and
        HOOMA Platform Admin roles are not changed.
      </p>

      <div className="mt-4 grid gap-3">
        {assistants.length ? (
          assistants.map((assistant) => (
            <article
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
              key={assistant.id}
            >
              <div className="flex items-start gap-3">
                <span className="team-profile-badge h-11 w-11 shrink-0 text-sm">
                  {assistant.player.photoUrl ? (
                    <img src={assistant.player.photoUrl} alt="" />
                  ) : (
                    assistant.player.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-black">{assistant.player.displayName}</div>
                  <div className="mt-1 text-xs muted">
                    {assistant.player.position ?? 'ANY'}
                    {assistant.player.shirtNumber != null
                      ? ` #${assistant.player.shirtNumber}`
                      : ''}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assistant.permissions.map((permission) => (
                      <span className="chip" key={permission}>
                        {permissionLabel(permission)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="ghost-button" onClick={() => beginEdit(assistant)}>
                  <Pencil size={16} /> Permissions
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={revokeMutation.isPending}
                  onClick={() => {
                    revokeMutation.reset();
                    if (
                      window.confirm(
                        `Revoke Assistant authority from ${assistant.player.displayName}? They remain an active Team player.`,
                      )
                    ) {
                      revokeMutation.mutate(assistant.id);
                    }
                  }}
                >
                  <Trash2 size={16} /> Revoke
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="vintage-empty">
            <UserCog size={20} />
            <strong>No Assistants appointed.</strong>
          </div>
        )}
      </div>

      {revokeMutation.isError ? (
        <div className="vintage-empty mt-4" role="alert">
          {revokeMutation.error instanceof Error
            ? revokeMutation.error.message
            : 'Assistant authority could not be revoked.'}
        </div>
      ) : null}

      {formOpen ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <div className="font-black">
              {editingAssistantId ? 'Change Assistant permissions' : 'Appoint Assistant'}
            </div>
            <p className="mt-1 text-sm muted">
              Only active roster players linked to a real HOOMA account are eligible.
            </p>
          </div>

          <label className="grid gap-2 text-[17px] font-semibold">
            Team player
            <select
              className="hooma-input"
              value={teamPlayerId}
              disabled={Boolean(editingAssistantId)}
              onChange={(event) => {
                saveMutation.reset();
                setTeamPlayerId(event.target.value);
              }}
            >
              <option value="">Choose a linked roster player</option>
              {selectablePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.displayName}
                  {player.position ? ` · ${player.position}` : ''}
                </option>
              ))}
            </select>
          </label>

          {!editingAssistantId && !selectablePlayers.length ? (
            <div className="vintage-empty">
              No eligible linked players. Guest roster entries cannot receive Assistant authority.
            </div>
          ) : null}

          <fieldset className="grid gap-2">
            <legend className="text-[17px] font-semibold">Delegated permissions</legend>
            {PERMISSIONS.map((permission) => (
              <label
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                key={permission.value}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={permissions.includes(permission.value)}
                  onChange={() => togglePermission(permission.value)}
                />
                <span>
                  <strong className="block">{permission.label}</strong>
                  <small className="muted">{permission.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>

          {saveMutation.isError ? (
            <div className="vintage-empty" role="alert">
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : 'Assistant authority could not be saved.'}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="ghost-button"
              onClick={closeForm}
              disabled={saveMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="accent-button"
              disabled={saveMutation.isPending || !teamPlayerId || !permissions.length}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : editingAssistantId
                  ? 'Save permissions'
                  : 'Appoint Assistant'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
