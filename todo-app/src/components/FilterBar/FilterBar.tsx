import type { FilterType } from '../../types';
import styles from './FilterBar.module.css';

interface Props {
  currentFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
}

const FILTERS: { label: string; value: FilterType }[] = [
  { label: '全部', value: 'all' },
  { label: '待完成', value: 'active' },
  { label: '已完成', value: 'done' },
];

export function FilterBar({ currentFilter, onFilterChange }: Props) {
  return (
    <div className={styles.filters}>
      {FILTERS.map(f => (
        <button
          key={f.value}
          className={currentFilter === f.value ? styles.active : ''}
          onClick={() => onFilterChange(f.value)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
