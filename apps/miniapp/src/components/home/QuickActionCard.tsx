import type { ReactNode } from 'react';
import './QuickActionCard.css';
import { cn } from '../../lib/cn';

export type QuickActionCardProps = {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  artworkSrc?: string;
  accentValue?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function QuickActionCard({
  title,
  subtitle,
  icon,
  artworkSrc,
  accentValue,
  onClick,
  disabled = false,
}: QuickActionCardProps) {
  const subtitleText = accentValue ? subtitle.replace(accentValue, '').trim() : subtitle;

  return (
    <button
      type="button"
      className={cn('quick-action-card-pro', artworkSrc && 'quick-action-card-artwork')}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
    >
      {artworkSrc ? (
        <img className="quick-action-artwork" src={artworkSrc} alt="" aria-hidden="true" />
      ) : (
        icon && <span className="quick-action-icon-pro">{icon}</span>
      )}
      <strong>{title}</strong>
      <span>
        {accentValue && <b>{accentValue}</b>}
        {subtitleText}
      </span>
    </button>
  );
}
