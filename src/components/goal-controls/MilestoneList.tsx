import type { ISODate, Milestone } from '../../types';
import { formatLong } from '../../lib/dates';
import DailyCheck from './DailyCheck';

interface Props {
  milestones: Milestone[];
  date: ISODate;
  color: string;
  disabled?: boolean;
  onToggle: (milestoneId: string) => void;
}

// One checkbox per milestone. Overdue ones say when they were planned.
export default function MilestoneList({ milestones, date, color, disabled, onToggle }: Props) {
  return (
    <ul className="space-y-1">
      {milestones.map((m) => {
        const overdue = m.plannedDate !== undefined && m.plannedDate < date;
        return (
          <li key={m.id}>
            <DailyCheck
              checked={m.doneDate !== undefined && m.doneDate <= date}
              onChange={() => onToggle(m.id)}
              color={color}
              label={m.title}
              disabled={disabled}
              text={m.title}
            />
            {overdue && !m.doneDate && <p className="ml-12 text-xs font-medium text-amber-600 dark:text-amber-400">Planned {formatLong(m.plannedDate!)}</p>}
          </li>
        );
      })}
    </ul>
  );
}
