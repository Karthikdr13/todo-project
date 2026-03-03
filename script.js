const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoDurationInput = document.getElementById('todo-duration');
const todoList = document.getElementById('todo-list');
const finishedList = document.getElementById('finished-list');
const clearFinishedButton = document.getElementById('clear-finished');

const STORAGE_KEY = 'todoAppStateV1';

const state = {
  activeTasks: [],
  finishedTasks: [],
};

function loadState() {
  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (!rawValue) return;

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') return;

    state.activeTasks = Array.isArray(parsed.activeTasks)
      ? parsed.activeTasks.filter(isValidTask)
      : [];

    state.finishedTasks = Array.isArray(parsed.finishedTasks)
      ? parsed.finishedTasks.filter(isValidFinishedTask)
      : [];
  } catch {
    state.activeTasks = [];
    state.finishedTasks = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    typeof task.createdAt === 'number' &&
    typeof task.endsAt === 'number' &&
    Number.isFinite(task.createdAt) &&
    Number.isFinite(task.endsAt)
  );
}

function isValidFinishedTask(task) {
  return (
    isValidTask(task) &&
    typeof task.finishedAt === 'number' &&
    Number.isFinite(task.finishedAt)
  );
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function parseDurationToSeconds(value) {
  const trimmedValue = value.trim();
  const isMatch = /^\d{2}:\d{2}$/.test(trimmedValue);
  if (!isMatch) return null;

  const [hoursText, minutesText] = trimmedValue.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  const totalSeconds = (hours * 60 + minutes) * 60;
  if (totalSeconds < 60) return null;

  return totalSeconds;
}

function formatRemainingTime(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildTaskItem(task, isFinished, nowTimestamp) {
  const listItem = document.createElement('li');
  listItem.className = isFinished ? 'todo-item finished' : 'todo-item';

  const content = document.createElement('div');
  content.className = 'todo-content';

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = task.text;

  const created = document.createElement('span');
  created.className = 'todo-meta';
  created.textContent = `Created: ${formatDateTime(task.createdAt)}`;

  const extra = document.createElement('span');
  extra.className = 'todo-countdown';

  if (isFinished) {
    extra.textContent = `Finished: ${formatDateTime(task.finishedAt)}`;
  } else {
    extra.textContent = `Time left: ${formatRemainingTime(task.endsAt - nowTimestamp)}`;
  }

  content.appendChild(title);
  content.appendChild(created);
  content.appendChild(extra);
  listItem.appendChild(content);

  if (!isFinished) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      state.activeTasks = state.activeTasks.filter((item) => item.id !== task.id);
      saveState();
      render();
    });

    listItem.appendChild(deleteButton);
  }

  return listItem;
}

function moveExpiredTasksToFinished(nowTimestamp) {
  const remainingActive = [];
  const newlyFinished = [];

  for (const task of state.activeTasks) {
    if (task.endsAt <= nowTimestamp) {
      newlyFinished.push({ ...task, finishedAt: nowTimestamp });
    } else {
      remainingActive.push(task);
    }
  }

  if (newlyFinished.length > 0) {
    state.activeTasks = remainingActive;
    state.finishedTasks = [...newlyFinished, ...state.finishedTasks];
    saveState();
    return true;
  }

  return false;
}

function render() {
  const nowTimestamp = Date.now();

  moveExpiredTasksToFinished(nowTimestamp);

  todoList.innerHTML = '';
  finishedList.innerHTML = '';

  for (const task of state.activeTasks) {
    todoList.appendChild(buildTaskItem(task, false, nowTimestamp));
  }

  for (const task of state.finishedTasks) {
    finishedList.appendChild(buildTaskItem(task, true, nowTimestamp));
  }

  clearFinishedButton.disabled = state.finishedTasks.length === 0;
}

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = todoInput.value.trim();
  const duration = parseDurationToSeconds(todoDurationInput.value);

  if (!text) return;
  if (!duration) {
    alert('Enter duration in HH:mm format and use at least 00:01.');
    todoDurationInput.focus();
    return;
  }

  const createdAt = Date.now();
  const newTask = {
    id: crypto.randomUUID(),
    text,
    createdAt,
    endsAt: createdAt + duration * 1000,
  };

  state.activeTasks = [newTask, ...state.activeTasks];
  saveState();
  render();

  todoInput.value = '';
  todoDurationInput.value = '';
  todoInput.focus();
});

clearFinishedButton.addEventListener('click', () => {
  state.finishedTasks = [];
  saveState();
  render();
});

loadState();
render();

setInterval(() => {
  render();
}, 1000);
