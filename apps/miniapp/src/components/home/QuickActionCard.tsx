import type { ReactNode } from 'react';
import './QuickActionCard.css';
import { cn } from '../../lib/cn';

export type QuickActionCardProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  artworkSrc?: string;
  accentValue?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function QuickActionCard({
  title,
  subtitle,
  icon,
  artworkSrc,
  accentValue,
  disabled = false,
  onClick,
}: QuickActionCardProps) {
  const subtitleText = subtitle
    ? accentValue
      ? subtitle.replace(accentValue, '').trim()
      : subtitle
    : '';

  return (
    <button
      type="button"
      className={cn(
        'quick-action-card-pro',
        artworkSrc && 'quick-action-card-artwork',
        disabled && 'quick-action-card-disabled',
      )}
      disabled={disabled}
      aria-label={disabled ? `${title} — coming soon` : title}
      onClick={onClick}
    >
      {artworkSrc ? (
        <img className="quick-action-artwork" src={artworkSrc} alt="" aria-hidden="true" />
      ) : (
        icon && <span className="quick-action-icon-pro">{icon}</span>
      )}
      <strong>{title}</strong>
      {subtitle ? (
        <span>
          {accentValue && <b>{accentValue}</b>}
          {subtitleText}
        </span>
      ) : null}
    </button>
  );
}
