import { IllustrationButton } from '@/components/IllustrationButton'
import type { CalendarEventType } from '../api'
import { NewEventMenu } from './NewEventMenu'

interface CalendarEmptyProps {
  /** What the viewer can create; the first one is what the drawing starts. */
  types: CalendarEventType[]
  onCreate: (type: CalendarEventType) => void
}

/**
 * A day with nothing on it. Drawn rather than written, like the clients and
 * reports empty states: the drawing itself schedules something on this day,
 * and Create below offers each type, like New event at the top.
 */
export function CalendarEmpty({ types, onCreate }: CalendarEmptyProps) {
  // Meetings first: everyone can schedule one; announcements are owner/manager only.
  const ordered = types.includes('meeting') ? ['meeting' as const, ...types.filter((t) => t !== 'meeting')] : types
  return (
    <div className="grid flex-1 place-items-center px-5 py-8 text-center">
      <div className="max-w-xs">
        <IllustrationButton
          label={ordered[0] === 'meeting' ? 'Schedule a meeting on this day' : 'Post an announcement on this day'}
          onClick={() => onCreate(ordered[0])}
        >
          <CalendarIllustration />
        </IllustrationButton>
        <h3 className="mt-4 text-title font-semibold tracking-title text-ink">Nothing scheduled</h3>
        <p className="mx-auto mt-1.5 max-w-[30ch] text-body text-ink-2">
          This day is free. Add something and it will show up here for everyone it’s meant for.
        </p>
        <div className="mt-4">
          <NewEventMenu types={ordered} onPick={onCreate} label="Create" align="center" />
        </div>
      </div>
    </div>
  )
}

/**
 * A calendar page with ring tabs and a grid of days, one of them marked, and
 * an event waiting to be added. Drawn with the theme tokens, so it follows
 * light and dark without an asset.
 */
function CalendarIllustration() {
  const cells = Array.from({ length: 15 }, (_, i) => ({ x: 82 + (i % 5) * 16, y: 52 + Math.floor(i / 5) * 16 }))
  return (
    <svg viewBox="0 0 240 120" aria-hidden className="mx-auto block h-auto w-full max-w-[220px]" fill="none">
      {/* A page behind, for depth. */}
      <rect
        x="70"
        y="18"
        width="100"
        height="96"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        transform="rotate(-5 120 66)"
      />
      {/* The page. */}
      <rect x="70" y="20" width="100" height="96" rx="10" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
      {/* Its header band and the two ring tabs. */}
      <path d="M70 30a10 10 0 0 1 10-10h80a10 10 0 0 1 10 10v12H70z" fill="var(--secondary-soft)" />
      <path d="M70 42h100" stroke="var(--line-strong)" strokeWidth="1.5" />
      <rect x="92" y="13" width="5" height="14" rx="2.5" fill="var(--secondary)" />
      <rect x="143" y="13" width="5" height="14" rx="2.5" fill="var(--secondary)" />
      {/* Days, one marked. */}
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width="11"
          height="11"
          rx="2.5"
          fill={i === 7 ? 'var(--secondary)' : 'var(--line-strong)'}
          opacity={i === 7 ? 1 : 0.55}
        />
      ))}
      {/* Something to add. */}
      <circle cx="170" cy="22" r="13" fill="var(--secondary)" />
      <path d="M170 15.5v13M163.5 22h13" stroke="var(--on-secondary)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
