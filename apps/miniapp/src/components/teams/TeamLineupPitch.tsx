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

  return (
    <section className="team-lineup-pitch" aria-label={`${teamName} lineup`}>
      <header>
        <strong>{teamName}</strong>
        <span>{lineup?.formation ?? 'Unpublished lineup'}</span>
      </header>
      <div className="team-lineup-field">
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
              <small>{displayName}</small>
            </span>
          );
        })}
        {!starters.length && (
          <div className="team-lineup-empty">
            <strong>Lineup not published.</strong>
            <small>The Coach can publish starters from the Coach Control Room.</small>
          </div>
        )}
      </div>
    </section>
  );
}
