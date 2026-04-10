import styles from './Footer.module.css';

interface Props {
  activeCount: number;
  onClearDone: () => void;
}

export function Footer({ activeCount, onClearDone }: Props) {
  return (
    <div className={styles.footer}>
      <span>剩餘 {activeCount} 項待完成</span>
      <button className={styles.btnClear} onClick={onClearDone}>清除已完成</button>
    </div>
  );
}
