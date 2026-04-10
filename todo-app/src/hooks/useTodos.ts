import { useState, useEffect } from 'react';
import type { Todo, FilterType } from '../types';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('todos') || '[]');
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const filteredTodos = todos.filter(t =>
    filter === 'all' ? true :
    filter === 'done' ? t.done :
    !t.done
  );

  const activeCount = todos.filter(t => !t.done).length;

  function addTodo(text: string) {
    setTodos(prev => [{ id: Date.now(), text, done: false }, ...prev]);
  }

  function toggleTodo(id: number) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function deleteTodo(id: number) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  function editTodo(id: number, newText: string) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
  }

  function clearDone() {
    setTodos(prev => prev.filter(t => !t.done));
  }

  return { filteredTodos, activeCount, filter, setFilter, addTodo, toggleTodo, deleteTodo, editTodo, clearDone };
}
