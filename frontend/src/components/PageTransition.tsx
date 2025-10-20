import { useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * PageTransition wrapper component
 * Provides subtle fade + slide animations when navigating between routes
 * Uses location.pathname as key to trigger re-mount animation
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="page-transition-wrapper"
    >
      {children}
    </div>
  );
}
