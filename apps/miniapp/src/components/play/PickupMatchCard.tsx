import { CalendarIcon } from '../../icons/CalendarIcon';
import { PinIcon } from '../../icons/PinIcon';
import { UsersIcon } from '../../icons/UsersIcon';
import './PickupMatchCard.css';
export type PickupMatchCardProps = {
  title: string;
  dateLabel: string;
  venueName?: string | null | undefined;
  sourceLabel?: string | null | undefined;
  goingCount: number;
  capacity?: number | null | undefined;
  format?: string | null | undefined;
  onClick: () => void;
};
export function PickupMatchCard(props: PickupMatchCardProps) {
  return (
    <button type="button" className="pickup-match-card-pro" onClick={props.onClick}>
      <div className="pickup-match-card-top">
        <span>{props.format || 'Pickup'}</span>
        <strong>{props.title}</strong>
      </div>
      <div className="pickup-match-card-meta">
        {props.sourceLabel && <span>{props.sourceLabel}</span>}
        <span>
          <CalendarIcon size={16} />
          {props.dateLabel}
        </span>
        {props.venueName && (
          <span>
            <PinIcon size={16} />
            {props.venueName}
          </span>
        )}
        <span>
          <UsersIcon size={16} />
          {props.goingCount}
          {props.capacity ? ` / ${props.capacity}` : ''} going
        </span>
      </div>
      <div className="pickup-match-card-cta">View match →</div>
    </button>
  );
}
