import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Todo } from '../../types';
import styles from './TodoItem.module.css';

interface Props {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
}

export function TodoItem({ todo, onToggle, onDelete, onEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEdit() {
    setEditValue(todo.text);
    setIsEditing(true);
  }

  function saveEdit() {
    const text = editValue.trim();
    if (text) onEdit(todo.id, text);
    setIsEditing(false);
  }

  function cancelEdit() {
    setEditValue(todo.text);
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  }

  return (
    <li className={`${styles.todoItem} ${todo.done ? styles.done : ''}`}>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.editInput}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveEdit}
          maxLength={200}
        />
      ) : (
        <span className={styles.todoText} onDoubleClick={startEdit}>
          {todo.text}
        </span>
      )}
      <button className={`${styles.btnIcon} ${styles.btnEdit}`} onClick={startEdit} title="編輯">✏️</button>
      <button className={`${styles.btnIcon} ${styles.btnDelete}`} onClick={() => onDelete(todo.id)} title="刪除">🗑️</button>
    </li>
  );
}
