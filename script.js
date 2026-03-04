// **SECURITY FIX**: Added null checks for DOM elements to prevent crashes
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoHoursInput = document.getElementById('todo-hours');
const todoMinutesInput = document.getElementById('todo-minutes');
const todoList = document.getElementById('todo-list');
const finishedList = document.getElementById('finished-list');
const clearFinishedButton = document.getElementById('clear-finished');
const themeToggle = document.getElementById('theme-toggle');

// Validate DOM elements exist before proceeding
if (!todoForm || !todoInput || !todoHoursInput || !todoMinutesInput || !todoList || !finishedList || !clearFinishedButton || !themeToggle) {
  console.error('Required DOM elements not found. Check HTML structure.');
  throw new Error('Missing required DOM elements');
}

// ===== THEME MANAGEMENT =====
const THEME_KEY = 'themePreference';

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  
  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}

// Initialize theme immediately to prevent flash
initTheme();

const STORAGE_KEY = 'todoAppStateV1';
let renderIntervalId = null;

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

// **SECURITY FIX**: Added error handling for localStorage operations
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Unable to save state.');
    } else if (error.name === 'SecurityError') {
      console.error('localStorage access denied (private browsing or blocked).');
    } else {
      console.error('Failed to save state to localStorage:', error);
    }
  }
}

function isValidTask(task) {
  const hasDeadline = typeof task.endsAt === 'number' && Number.isFinite(task.endsAt);
  const noDeadline = task.endsAt === null || typeof task.endsAt === 'undefined';

  return (
    task &&
    typeof task.id === 'string' &&
    typeof task.text === 'string' &&
    typeof task.createdAt === 'number' &&
    (hasDeadline || noDeadline) &&
    Number.isFinite(task.createdAt) &&
    (!hasDeadline || task.endsAt >= task.createdAt)
  );
}

// **SECURITY FIX**: Enhanced validation for finished tasks
function isValidFinishedTask(task) {
  return (
    isValidTask(task) &&
    typeof task.finishedAt === 'number' &&
    Number.isFinite(task.finishedAt) &&
    task.finishedAt >= 0 &&
    task.finishedAt <= Date.now() + 1000 // Prevent future timestamps
  );
}

function parseOptionalDurationToSeconds(hoursValue, minutesValue) {
  const trimmedHours = hoursValue.trim();
  const trimmedMinutes = minutesValue.trim();

  if (!trimmedHours && !trimmedMinutes) return 0;

  if ((trimmedHours && !/^\d+$/.test(trimmedHours)) || (trimmedMinutes && !/^\d+$/.test(trimmedMinutes))) {
    return null;
  }

  const hours = trimmedHours ? Number(trimmedHours) : 0;
  const minutes = trimmedMinutes ? Number(trimmedMinutes) : 0;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return null;
  }

  const totalSeconds = (hours * 3600) + (minutes * 60);
  const maxSeconds = 8760 * 3600;

  if (totalSeconds < 0 || totalSeconds > maxSeconds) {
    return null;
  }

  return totalSeconds;
}

// **SECURITY FIX**: Text validation and sanitization function
function isValidTaskText(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= 500; // Prevent excessively long text
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// **SECURITY FIX**: UUID fallback for older browsers
function generateTaskId() {
  // Try crypto.randomUUID() first (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

// Calculate urgency class based on time remaining
function getUrgencyClass(msRemaining) {
  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  
  if (hoursRemaining <= 1) return 'task-critical';  // Less than 1 hour
  if (hoursRemaining <= 3) return 'task-urgent';    // 1-3 hours
  if (hoursRemaining <= 24) return 'task-warning';  // 3-24 hours
  return 'task-safe';                               // More than 24 hours
}

// Format relative time for finished tasks
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDateTime(timestamp);
}

function buildTaskItem(task, isFinished, nowTimestamp) {
  const listItem = document.createElement('li');
  
  // Build class list with urgency indicator for active tasks
  let className = 'todo-item';
  if (isFinished) {
    className += ' finished';
  } else {
    const hasDeadline = typeof task.endsAt === 'number' && Number.isFinite(task.endsAt);
    if (hasDeadline) {
      const msRemaining = task.endsAt - nowTimestamp;
      className += ` ${getUrgencyClass(msRemaining)}`;
    }
  }
  listItem.className = className;

  const content = document.createElement('div');
  content.className = 'todo-content';

  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = task.text;

  const created = document.createElement('span');
  created.className = 'todo-meta';
  created.innerHTML = `<span class="meta-icon">📅</span> Created: ${formatDateTime(task.createdAt)}`;

  const extra = document.createElement('span');
  extra.className = 'todo-countdown';

  if (isFinished) {
    extra.innerHTML = `<span class="countdown-icon">✅</span> Completed ${formatRelativeTime(task.finishedAt)}`;
  } else {
    const hasDeadline = typeof task.endsAt === 'number' && Number.isFinite(task.endsAt);
    if (hasDeadline) {
      extra.innerHTML = `<span class="countdown-icon">⏱️</span> ${formatRemainingTime(task.endsAt - nowTimestamp)}`;
    } else {
      extra.innerHTML = '<span class="countdown-icon">📌</span> No deadline';
    }
  }

  content.appendChild(title);
  content.appendChild(created);
  content.appendChild(extra);
  listItem.appendChild(content);

  if (!isFinished) {
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    
    // Finish button
    const finishButton = document.createElement('button');
    finishButton.type = 'button';
    finishButton.className = 'btn-finish';
    finishButton.innerHTML = '✓ Done';
    finishButton.addEventListener('click', () => {
      const finishedTask = { ...task, finishedAt: Date.now() };
      state.activeTasks = state.activeTasks.filter((item) => item.id !== task.id);
      state.finishedTasks = [finishedTask, ...state.finishedTasks];
      saveState();
      render();
    });
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn-delete';
    deleteButton.innerHTML = '✕';
    deleteButton.addEventListener('click', () => {
      // Add removing animation
      listItem.classList.add('removing');
      setTimeout(() => {
        state.activeTasks = state.activeTasks.filter((item) => item.id !== task.id);
        saveState();
        render();
      }, 250);
    });

    btnGroup.appendChild(finishButton);
    btnGroup.appendChild(deleteButton);
    listItem.appendChild(btnGroup);
  }

  return listItem;
}

// Render empty state message
function renderEmptyState(container, message, icon) {
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'empty-state';
  emptyDiv.innerHTML = `
    <span class="empty-icon">${icon}</span>
    <span class="empty-text">${message}</span>
  `;
  container.appendChild(emptyDiv);
}

function moveExpiredTasksToFinished(nowTimestamp) {
  const remainingActive = [];
  const newlyFinished = [];

  for (const task of state.activeTasks) {
    const hasDeadline = typeof task.endsAt === 'number' && Number.isFinite(task.endsAt);

    if (hasDeadline && task.endsAt <= nowTimestamp) {
      // **SECURITY FIX**: Validate timestamp before creating finished task
      const finishedTask = { 
        ...task, 
        finishedAt: Math.min(nowTimestamp, task.endsAt) // Ensure finishedAt doesn't exceed current time
      };
      
      if (isValidFinishedTask(finishedTask)) {
        newlyFinished.push(finishedTask);
      }
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

  // Render active tasks or empty state
  if (state.activeTasks.length === 0) {
    renderEmptyState(
      todoList,
      'No active tasks yet.<br>Add one to get started!',
      '🎯'
    );
  } else {
    for (const task of state.activeTasks) {
      todoList.appendChild(buildTaskItem(task, false, nowTimestamp));
    }
  }

  // Render finished tasks or empty state
  if (state.finishedTasks.length === 0) {
    renderEmptyState(
      finishedList,
      'No completed tasks yet.<br>Finish a task to see it here!',
      '🏆'
    );
  } else {
    for (const task of state.finishedTasks) {
      finishedList.appendChild(buildTaskItem(task, true, nowTimestamp));
    }
  }

  clearFinishedButton.disabled = state.finishedTasks.length === 0;
}

// **SECURITY FIX**: Form submission debouncing to prevent spam and duplicate tasks
let isSubmitting = false;

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();

  // Prevent rapid submissions
  if (isSubmitting) {
    console.warn('Form submission in progress. Please wait.');
    return;
  }

  const text = todoInput.value.trim();
  const durationSeconds = parseOptionalDurationToSeconds(todoHoursInput.value, todoMinutesInput.value);

  // **SECURITY FIX**: Validate input text and optional duration before processing
  if (!isValidTaskText(text)) {
    alert('Please enter a valid task (1-500 characters).');
    todoInput.focus();
    return;
  }

  if (durationSeconds === null) {
    alert('Duration is optional. If provided, use valid hours and minutes (minutes 0-59, max 1 year).');
    todoHoursInput.focus();
    return;
  }

  isSubmitting = true;

  try {
    const createdAt = Date.now();
    const newTask = {
      id: generateTaskId(),
      text: text.substring(0, 500), // Enforce max length at creation
      createdAt,
      endsAt: durationSeconds > 0 ? createdAt + durationSeconds * 1000 : null,
    };

    // Validate the task before adding
    if (!isValidTask(newTask)) {
      throw new Error('Created task failed validation');
    }

    state.activeTasks = [newTask, ...state.activeTasks];
    saveState();
    render();

    todoInput.value = '';
    todoHoursInput.value = '';
    todoMinutesInput.value = '';
    todoInput.focus();
  } catch (error) {
    console.error('Error creating task:', error);
    alert('Failed to create task. Please try again.');
  } finally {
    isSubmitting = false;
  }
});

clearFinishedButton.addEventListener('click', () => {
  state.finishedTasks = [];
  saveState();
  render();
});

// Theme toggle event listener
themeToggle.addEventListener('click', toggleTheme);

loadState();
render();

// **SECURITY FIX**: Store interval ID and set up cleanup on page unload
renderIntervalId = setInterval(() => {
  render();
}, 1000);

// **SECURITY FIX**: Cleanup interval and listeners on page unload to prevent memory leaks
window.addEventListener('unload', () => {
  if (renderIntervalId !== null) {
    clearInterval(renderIntervalId);
    renderIntervalId = null;
  }
});

// **SECURITY FIX**: Also cleanup on page hide (tab switch, minimize, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (renderIntervalId !== null) {
      clearInterval(renderIntervalId);
      renderIntervalId = null;
    }
  } else {
    // Resume interval when page becomes visible again
    if (renderIntervalId === null) {
      renderIntervalId = setInterval(() => {
        render();
      }, 1000);
    }
  }
});
