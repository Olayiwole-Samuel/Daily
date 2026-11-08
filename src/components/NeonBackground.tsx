// Fixed decorative layer behind everything: three blurred colour blobs drifting
// around, plus a synthwave grid floor scrolling toward you. Purely visual.
export default function NeonBackground() {
  return (
    <div className="neon-bg" aria-hidden>
      <div className="blob animate-blob-drift bg-neon-pink" style={{ top: '-20vmax', left: '-15vmax' }} />
      <div className="blob animate-blob-drift bg-neon-cyan" style={{ top: '30vh', right: '-25vmax', animationDelay: '-6s' }} />
      <div className="blob animate-blob-drift bg-neon-violet" style={{ bottom: '-25vmax', left: '10vw', animationDelay: '-12s' }} />
      <div className="grid-floor" />
    </div>
  );
}
