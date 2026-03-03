const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = todoInput.value.trim();
  if (!text) return;

  const listItem = document.createElement('li');
  listItem.className = 'todo-item';

  const todoText = document.createElement('span');
  todoText.textContent = text;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';

  deleteButton.addEventListener('click', () => {
    listItem.remove();
  });

  listItem.appendChild(todoText);
  listItem.appendChild(deleteButton);
  todoList.appendChild(listItem);

  todoInput.value = '';
  todoInput.focus();
});
