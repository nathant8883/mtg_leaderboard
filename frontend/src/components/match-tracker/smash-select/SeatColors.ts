// Seat color definitions matching the player slot gradients
// Each seat gets a distinct color for header bars and visual identity

export const SEAT_COLORS = {
  1: { primary: '#667eea', light: '#8b9cf5', dark: '#764ba2', name: 'purple' },
  2: { primary: '#f093fb', light: '#f5b8fc', dark: '#f5576c', name: 'pink' },
  3: { primary: '#4facfe', light: '#7ec4fe', dark: '#00f2fe', name: 'cyan' },
  4: { primary: '#f27a8d', light: '#f5a3b0', dark: '#f5d680', name: 'coral' },
  5: { primary: '#30e8a7', light: '#6aefc4', dark: '#1cb5e0', name: 'teal' },
  6: { primary: '#ff6b6b', light: '#ff9999', dark: '#ee5a6f', name: 'red' },
} as const;

export type SeatNumber = keyof typeof SEAT_COLORS;

export const getSeatColor = (seat: number) => {
  const validSeat = Math.max(1, Math.min(6, seat)) as SeatNumber;
  return SEAT_COLORS[validSeat];
};

// Get CSS gradient for a seat's header bar
export const getSeatGradient = (seat: number) => {
  const color = getSeatColor(seat);
  return `linear-gradient(135deg, ${color.primary} 0%, ${color.dark} 100%)`;
};
