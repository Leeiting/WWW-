import { useState, type KeyboardEvent } from 'react';
import styles from './TodoInput.module.css';

interface Props {
  onAdd: (text: string) => void;
}

export function TodoInput({ onAdd }: Props) {
  const [value, setValue] = useState('');

  function handleAdd() {
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  return (
    <div className={styles.inputRow}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="新增待辦事項..."
        maxLength={200}
      />
      <button onClick={handleAdd}>新增</button>
    </div>
  );
}
