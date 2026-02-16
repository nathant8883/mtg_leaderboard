import { motion } from 'framer-motion';
import { OrbitRing, RoundProgressDots } from './CinematicParts';
import type { EventPlayer } from '../../services/api';
import './cinematic-effects.css';

/* ============================================================
   InterstitialPhase
   Full-screen dramatic moment for "SEEDING PODS" / "RESEEDING".
   Broadcast / esports energy with glitch text and orbit ring.
   ============================================================ */

interface InterstitialPhaseProps {
  text: string;
  players: EventPlayer[];
}

export function InterstitialPhase({ text, players }: InterstitialPhaseProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex flex-col items-center justify-center gap-10"
    >
      {/* CRT / broadcast scan line overlay */}
      <div className="scan-line" />

      {/* Title with glitch effect */}
      <h2
        className="glitch-text text-7xl font-bold uppercase tracking-[0.15em]"
        data-text={text}
        style={{
          fontFamily: 'Chakra Petch, sans-serif',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {text}
      </h2>

      {/* Orbiting player dots */}
      <OrbitRing players={players} size={240} />

      {/* Ambient atmospheric glow */}
      <div className="ambient-glow" />
    </motion.div>
  );
}

/* ============================================================
   SettledPhase
   Resting state — "Round N Ready" pill with pulsing green
   indicator and round progress dots.
   ============================================================ */

interface SettledPhaseProps {
  roundNumber: number;
  totalRounds: number;
  completedRounds: number;
}

export function SettledPhase({ roundNumber, totalRounds, completedRounds }: SettledPhaseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex flex-col items-center justify-center gap-8"
    >
      {/* Ready pill with pulsing green glow */}
      <div className="ready-pulse px-12 py-5 rounded-full border border-[#51CF66]/40 bg-[#51CF66]/10">
        <span
          className="text-2xl font-bold text-[#51CF66]"
          style={{ fontFamily: 'Chakra Petch, sans-serif' }}
        >
          Round {roundNumber} Ready
        </span>
      </div>

      {/* Round progress dots */}
      <RoundProgressDots
        totalRounds={totalRounds}
        currentRound={roundNumber}
        completedRounds={completedRounds}
      />
    </motion.div>
  );
}
