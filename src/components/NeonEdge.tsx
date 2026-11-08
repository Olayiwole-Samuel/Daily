// A glowing neon "tube" down the left edge of a card, in the goal's colour.
// The card needs `relative overflow-hidden` and some left padding.
export default function NeonEdge({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-y-3 left-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
    />
  );
}
