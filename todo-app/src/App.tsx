import { useTodos } from './hooks/useTodos';
import { TodoInput } from './components/TodoInput/TodoInput';
import { FilterBar } from './components/FilterBar/FilterBar';
import { TodoList } from './components/TodoList/TodoList';
import { Footer } from './components/Footer/Footer';
import styles from './App.module.css';

function App() {
  const { filteredTodos, activeCount, filter, setFilter, addTodo, toggleTodo, deleteTodo, editTodo, clearDone } = useTodos();

  return (
    <div className={styles.container}>
      <h1>待辦事項</h1>
      <TodoInput onAdd={addTodo} />
      <FilterBar currentFilter={filter} onFilterChange={setFilter} />
      <TodoList todos={filteredTodos} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={editTodo} />
      <Footer activeCount={activeCount} onClearDone={clearDone} />
    </div>
  );
}

export default App;
