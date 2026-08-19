import { COLORS } from '../theme';

export function ProgressRing({
  ratio,
  size = 64,
  /** Цвет дуги. Красный — когда проект не успевает: цвет тут несёт смысл. */
  color = COLORS.accent,
}: {
  ratio: number;
  size?: number;
  color?: string;
}) {
  const stroke = size * 0.12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = circumference * (1 - clamped);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.lightGreenBg}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={size * 0.26}
        fontWeight={700}
        fill={COLORS.darkText}
      >
        {Math.round(clamped * 100)}%
      </text>
    </svg>
  );
}
