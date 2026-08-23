import type { TeamLineupItem } from '../../types/domain';
import './TeamLineupPitch.css';

type RosterIdentity = {
  id: string;
  userId?: string | null;
  displayName: string;
  photoUrl?: string | null;
  shirtNumber?: number | null;
};

type TeamLineupPitchProps = {
  lineup?: TeamLineupItem | null;
  teamName: string;
  roster?: RosterIdentity[];
  onOpenProfile?: (userId: string) => void;
};

export function TeamLineupPitch({
  lineup,
  teamName,
  roster = [],
  onOpenProfile,
}: TeamLineupPitchProps) {
  const starters = lineup?.slots.filter((slot) => slot.isStarter) ?? [];
  const rosterByPlayerId = new Map(roster.map((player) => [player.id, player]));
  const published = starters.length > 0;

  return (
    <section className="team-lineup-pitch" aria-label={`${teamName} lineup`}>
      <header className="team-lineup-header">
        <div className="team-lineup-identity">
          <span className="team-lineup-kicker">Matchday XI</span>
          <strong>{teamName}</strong>
        </div>
        <div className="team-lineup-status">
          <span className={published ? 'is-live' : 'is-pending'}>
            {published ? `${starters.length} starters` : 'Awaiting lineup'}
          </span>
          <b>{lineup?.formation ?? 'Unpublished'}</b>
        </div>
      </header>

      <div className="team-lineup-field">
        <div className="team-lineup-floodlight team-lineup-floodlight-left" aria-hidden="true" />
        <div className="team-lineup-floodlight team-lineup-floodlight-right" aria-hidden="true" />
        <div className="team-lineup-goal team-lineup-goal-top" aria-hidden="true" />
        <div className="team-lineup-goal team-lineup-goal-bottom" aria-hidden="true" />
        <div className="team-lineup-center-circle" aria-hidden="true" />
        <div className="team-lineup-center-spot" aria-hidden="true" />

        {starters.map((slot) => {
          const rosterPlayer = slot.player ? rosterByPlayerId.get(slot.player.id) : undefined;
          const displayName = rosterPlayer?.displayName ?? slot.player?.displayName ?? slot.role;
          const photoUrl = rosterPlayer?.photoUrl ?? slot.player?.photoUrl ?? null;
          const shirtNumber = rosterPlayer?.shirtNumber ?? slot.player?.shirtNumber;
          const userId = rosterPlayer?.userId ?? null;
          const avatar = photoUrl ? (
            <img src={photoUrl} alt="" />
          ) : (
            <b>{shirtNumber ?? slot.sortOrder + 1}</b>
          );

          return (
            <span
              key={slot.id}
              className="team-lineup-player"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={displayName}
            >
              <span className="team-lineup-player-glow" aria-hidden="true" />
              {userId && onOpenProfile ? (
                <button
                  type="button"
                  className="team-lineup-avatar"
                  onClick={() => onOpenProfile(userId)}
                  aria-label={`Open ${displayName} profile`}
                >
                  {avatar}
                </button>
              ) : (
                <span className="team-lineup-avatar">{avatar}</span>
              )}
              <span className="team-lineup-nameplate">
                <small>{displayName}</small>
                <em>{slot.role}</em>
              </span>
            </span>
          );
        })}

        {!starters.length && (
          <div className="team-lineup-empty">
            <span className="team-lineup-empty-mark">XI</span>
            <strong>Lineup not published.</strong>
            <small>Authorized Team staff can publish starters from the Team Control Room.</small>
          </div>
        )}
      </div>
    </section>
  );
}
