import type { Todo } from '../../types';
import { TodoItem } from '../TodoItem/TodoItem';
import styles from './TodoList.module.css';

interface Props {
  todos: Todo[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
}

export function TodoList({ todos, onToggle, onDelete, onEdit }: Props) {
  if (todos.length === 0) {
    return <div className={styles.empty}>沒有待辦事項</div>;
  }

  return (
    <ul className={styles.todoList}>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}
