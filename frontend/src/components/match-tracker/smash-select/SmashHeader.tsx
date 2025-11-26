import { getSeatGradient } from './SeatColors';

interface SmashHeaderProps {
  seatNumber: number;
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: {
    label: string;
    onClick: () => void;
  };
}

function SmashHeader({ seatNumber, title, subtitle, onBack, rightAction }: SmashHeaderProps) {
  return (
    <div
      className="smash-header"
      style={{ background: getSeatGradient(seatNumber) }}
    >
      <button
        className="smash-header-back"
        onClick={onBack}
        aria-label="Go back"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="smash-header-content">
        <div className="smash-header-title">{title}</div>
        {subtitle && <div className="smash-header-subtitle">{subtitle}</div>}
      </div>

      {rightAction ? (
        <button
          className="smash-header-action"
          onClick={rightAction.onClick}
        >
          {rightAction.label}
        </button>
      ) : (
        <div className="smash-header-spacer" />
      )}
    </div>
  );
}

export default SmashHeader;
