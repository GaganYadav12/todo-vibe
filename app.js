(() => {
  const htmlElement = document.documentElement;
  const boardElement = document.getElementById("board");
  const inputElement = document.getElementById("todoInput");
  const dueTimeInput = document.getElementById("dueTime");
  const addForm = document.getElementById("addForm");
  const itemsLeftElement = document.getElementById("itemsLeft");
  const addColumnButton = null;
  const themeToggle = document.getElementById("themeToggle");
  const calendarView = document.getElementById("calendarView");
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const backToCalendarBtn = document.getElementById("backToCalendar");

  const STORAGE_KEY_TASKS = "todoTasks.v2";
  const STORAGE_KEY_COLUMNS = "todoColumns.v1";
  const STORAGE_KEY_THEME = "todoTheme.v1";
  const STORAGE_KEY_SELECTED_DATE = "todoSelectedDate.v1";
  const STORAGE_KEY_BACKGROUND_IMAGES = "todoBackgroundImages.v1";

  /** @typedef {{ id: string, text: string, completed: boolean, date?: string, createdAt: number, dueAt?: number }} Task */
  /** @typedef {{ id: string, name: string, taskIds: string[] }} Column */
  /** @type {Task[]} */
  let tasks = [];
  /** @type {Column[]} */
  let columns = [];
  /** @type {string} */
  let selectedDateISO = "";
  let calendarYear = 0;
  let calendarMonth = 0; // 0-based
  /** @type {Object.<string, string>} */
  let backgroundImages = {}; // date -> imageDataURL

  function load() {
    try {
      const rawTasks = localStorage.getItem(STORAGE_KEY_TASKS);
      const rawCols = localStorage.getItem(STORAGE_KEY_COLUMNS);
      tasks = rawTasks ? JSON.parse(rawTasks) : [];
      columns = rawCols ? JSON.parse(rawCols) : [];
      if (tasks.length === 0 || columns.length === 0) {
        const seed = sampleData();
        tasks = seed.tasks;
        columns = seed.columns;
      }
    } catch {
      const seed = sampleData();
      tasks = seed.tasks;
      columns = seed.columns;
    }

    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    setTheme(savedTheme || inferSystemTheme());
    const savedDate = localStorage.getItem(STORAGE_KEY_SELECTED_DATE);
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    selectedDateISO = savedDate || isoToday;
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();

    // Load background images
    try {
      const savedImages = localStorage.getItem(STORAGE_KEY_BACKGROUND_IMAGES);
      backgroundImages = savedImages ? JSON.parse(savedImages) : {};
    } catch {
      backgroundImages = {};
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columns));
    localStorage.setItem(STORAGE_KEY_SELECTED_DATE, selectedDateISO);
    localStorage.setItem(
      STORAGE_KEY_BACKGROUND_IMAGES,
      JSON.stringify(backgroundImages)
    );
  }

  function inferSystemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(theme) {
    htmlElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }

  function toggleTheme() {
    const current = htmlElement.getAttribute("data-theme") || "light";
    setTheme(current === "light" ? "dark" : "light");
  }

  function uid() {
    return (
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4)
    );
  }

  function sampleData() {
    const now = Date.now();
    const t1 = {
      id: uid(),
      text: "Plan the day",
      completed: false,
      createdAt: now,
    };
    const t2 = {
      id: uid(),
      text: "Design beautiful UI",
      completed: false,
      createdAt: now,
    };
    const t3 = {
      id: uid(),
      text: "Drag to reorder tasks",
      completed: false,
      createdAt: now,
    };
    const t4 = { id: uid(), text: "Ship it", completed: true, createdAt: now };
    const todo = { id: uid(), name: "Todo", taskIds: [t1.id, t3.id] };
    const doing = { id: uid(), name: "Doing", taskIds: [t2.id] };
    const done = { id: uid(), name: "Done", taskIds: [t4.id] };
    return { tasks: [t1, t2, t3, t4], columns: [todo, doing, done] };
  }

  function render() {
    expireOldTasks();
    boardElement.innerHTML = "";
    let total = 0;
    const taskSetForDate = new Set(
      tasks
        .filter((t) => (t.date || selectedDateISO) === selectedDateISO)
        .map((t) => t.id)
    );

    // Apply background image for current date
    applyBackgroundImage(selectedDateISO);
    for (const col of columns) {
      const colEl = document.createElement("div");
      colEl.className = "column";
      colEl.dataset.colId = col.id;
      const filteredTaskIds = col.taskIds.filter((id) =>
        taskSetForDate.has(id)
      );
      const count = filteredTaskIds.length;
      total += count;
      const allowAddHere = !/^(doing|done)$/i.test(col.name || "");
      colEl.innerHTML = `
        <div class="column__header">
          <h2 contenteditable="true" spellcheck="false" class="col-title" data-col-id="${
            col.id
          }">${escapeHtml(col.name)}</h2>
          <div class="col-actions">
            ${
              allowAddHere
                ? '<button class="col-btn add-task-btn" title="Add task" aria-label="Add task">➕</button>'
                : ""
            }
            <span class="count">${count}</span>
            <button class="col-btn remove-col-btn" title="Delete column" aria-label="Delete column">🗑️</button>
          </div>
        </div>
        <ul class="list" aria-live="polite" aria-label="${escapeHtml(
          col.name
        )}" data-col-id="${col.id}"></ul>
        ${
          allowAddHere
            ? `
        <form class="add-task" data-col-id="${col.id}">
          <button class="add__icon" type="submit" aria-label="Add task">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <input class="add__input" type="text" placeholder="Add a task…" autocomplete="off" />
        </form>`
            : ""
        }
      `;
      boardElement.appendChild(colEl);

      const ul = colEl.querySelector("ul");
      for (const taskId of filteredTaskIds) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) continue;
        const li = document.createElement("li");
        li.className = "item enter";
        li.dataset.id = task.id;
        li.innerHTML = templateItem(task);
        ul.appendChild(li);
      }
    }
    itemsLeftElement.textContent = `${total} item${total === 1 ? "" : "s"}`;
    // Ensure DnD is always initialized after any render
    initSortable();
  }

  function renderCalendar() {
    if (!calendarGrid || !monthLabel) return;
    const first = new Date(calendarYear, calendarMonth, 1);
    const last = new Date(calendarYear, calendarMonth + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    monthLabel.textContent = first.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });
    calendarGrid.innerHTML = "";
    const todayISO = new Date().toISOString().slice(0, 10);
    const counts = countTasksByDate(calendarYear, calendarMonth);

    // Apply background image for current date
    applyBackgroundImage(selectedDateISO);
    for (let i = 0; i < startDay; i++) {
      const blank = document.createElement("div");
      calendarGrid.appendChild(blank);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const localDate = new Date(calendarYear, calendarMonth, d);
      const dateISO = new Date(
        localDate.getTime() - localDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 10);
      const cell = document.createElement("button");
      cell.className = "cal-cell";
      cell.type = "button";
      cell.dataset.date = dateISO;

      // Apply background image if exists for this date
      if (backgroundImages[dateISO]) {
        cell.style.backgroundImage = `url(${backgroundImages[dateISO]})`;
      }

      cell.innerHTML = `
         <div class="cal-cell__day">
           <span>${d}</span>
           ${
             counts[dateISO]
               ? `<span class=\"cal-cell__badge\">${counts[dateISO]}</span>`
               : ""
           }
         </div>
         <div class="cal-cell__list">
           ${tasks
             .filter((t) => (t.date || "") === dateISO)
             .slice(0, 3)
             .map(
               (t) =>
                 `<div class=\"cal-cell__item\">${escapeHtml(t.text)}</div>`
             )
             .join("")}
         </div>
       `;
      if (dateISO === selectedDateISO) {
        cell.style.outline =
          "2px solid color-mix(in oklab, var(--brand) 60%, transparent)";
      } else if (dateISO === todayISO) {
        cell.style.outline =
          "1px dashed color-mix(in oklab, var(--brand-2) 60%, transparent)";
      }
      calendarGrid.appendChild(cell);
    }
  }

  function showBoardForSelectedDate() {
    const boardFooter = document.querySelector(".board__footer");
    if (calendarView) calendarView.classList.remove("is-visible");
    boardElement.classList.remove("hidden");
    boardFooter?.classList.remove("hidden");
    render();
  }

  function countTasksByDate(year, month) {
    const result = {};
    for (const t of tasks) {
      const d = t.date || new Date().toISOString().slice(0, 10);
      const dt = new Date(d);
      if (dt.getFullYear() === year && dt.getMonth() === month) {
        result[d] = (result[d] || 0) + 1;
      }
    }
    return result;
  }

  function templateItem(task) {
    const now = Date.now();
    const overdue = task.dueAt && now > task.dueAt && !task.completed;
    const dueBadge = task.dueAt
      ? `<span class="due ${overdue ? "overdue" : ""}">due ${formatRelativeTime(
          task.dueAt - now
        )}</span>`
      : "";

    // Don't render checkbox for completed tasks (Done column), but add a placeholder to maintain grid layout
    const checkbox = task.completed
      ? '<div class="checkbox-placeholder"></div>'
      : `<input class="check" type="checkbox" ${
          task.completed ? "checked" : ""
        } aria-label="Toggle complete" />`;

    return `
      ${checkbox}
      <div class="text ${
        task.completed ? "completed" : ""
      }" title="Double‑click to edit">${escapeHtml(task.text)} ${dueBadge}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="icon-btn edit" aria-label="Edit" title="Edit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
        </button>
        <button class="icon-btn remove" aria-label="Delete" title="Delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
        </button>
      </div>
    `;
  }

  function escapeHtml(str) {
    return str.replace(
      /[&<>"]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])
    );
  }

  function formatRelativeTime(deltaMs) {
    const abs = Math.abs(deltaMs);
    const s = Math.round(abs / 1000);
    const m = Math.round(s / 60);
    const h = Math.round(m / 60);
    const d = Math.round(h / 24);
    const fmt = (n, unit) => `${n} ${unit}${n !== 1 ? "s" : ""}`;
    let text;
    if (s < 45) text = "moments";
    else if (m < 45) text = fmt(m, "min");
    else if (h < 36) text = fmt(h, "hr");
    else text = fmt(d, "day");
    return deltaMs >= 0 ? `in ${text}` : `${text} ago`;
  }

  function addTask(text, columnId) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const createdAt = Date.now();
    let dueAt;
    const timeVal =
      dueTimeInput && dueTimeInput.value ? dueTimeInput.value : "";
    if (timeVal) {
      // timeVal is HH:MM
      const [hh, mm] = timeVal.split(":").map(Number);
      const dt = new Date(selectedDateISO);
      dt.setHours(hh || 0, mm || 0, 0, 0);
      dueAt = dt.getTime();
    } else {
      const endOfDay = new Date(selectedDateISO + "T23:59:59");
      dueAt = endOfDay.getTime();
    }
    const newTask = {
      id: uid(),
      text: trimmed,
      completed: false,
      date: selectedDateISO,
      createdAt,
      dueAt,
    };
    tasks.unshift(newTask);
    const col = columns.find((c) => c.id === columnId) || columns[0];
    col.taskIds.unshift(newTask.id);
    save();
    render();
    initSortable();
  }

  function removeTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    for (const col of columns) {
      col.taskIds = col.taskIds.filter((tid) => tid !== id);
    }
    save();
    render();
    initSortable();
  }

  function toggleTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    // Move task to appropriate column immediately
    const targetCol = t.completed
      ? findColumnByNames(["Done", "Completed", "Complete"]) ||
        columns[columns.length - 1]
      : findColumnByNames(["Todo", "To Do", "Backlog", "Tasks"]) || columns[0];
    if (targetCol) {
      moveTaskToColumn(id, targetCol.id, "top");
    }
    save();
    render();
    initSortable();
  }

  // Expire tasks at day change or when overdue
  function expireOldTasks() {
    const now = Date.now();
    const todayISO = new Date().toISOString().slice(0, 10);
    // Remove tasks whose date is before today
    const validIds = new Set();
    tasks = tasks.filter((t) => {
      const dateISO = t.date || todayISO;
      if (dateISO === todayISO) {
        validIds.add(t.id);
        return true;
      }
      // Keep for calendar history? For this requirement, drop previous day tasks
      return false;
    });
    // Clean columns
    for (const col of columns) {
      col.taskIds = col.taskIds.filter((id) => validIds.has(id));
    }
    // Visual overdue styling is handled in template; no hard deletion by dueAt here
    save();
  }

  function updateTask(id, newText) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const trimmed = newText.trim();
    t.text = trimmed || t.text;
    // keep dueAt tied to the task's date end-of-day
    if (t.date) {
      const end = new Date(t.date + "T23:59:59");
      t.dueAt = end.getTime();
    }
    save();
    render();
    initSortable();
  }

  function bindDomEvents() {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addTask(inputElement.value, columns[0]?.id);
      inputElement.value = "";
      if (dueTimeInput) dueTimeInput.value = "";
      inputElement.focus();
    });

    // Background image upload
    const backgroundImageInput = document.getElementById("backgroundImage");
    const clearBackgroundBtn = document.getElementById("clearBackground");

    if (backgroundImageInput) {
      backgroundImageInput.addEventListener(
        "change",
        handleBackgroundImageUpload
      );
    }

    if (clearBackgroundBtn) {
      clearBackgroundBtn.addEventListener("click", clearBackgroundImage);
    }

    document.addEventListener("click", (e) => {
      const li = e.target.closest(".item");
      if (!li) {
        const addTaskBtn = e.target.closest(".add-task-btn");
        if (addTaskBtn) {
          const colEl = addTaskBtn.closest(".column");
          const input = colEl.querySelector(".add-task .add__input");
          input?.focus();
          return;
        }
        const removeColBtn = e.target.closest(".remove-col-btn");
        if (removeColBtn) {
          const colId = removeColBtn.closest(".column").dataset.colId;
          removeColumn(colId);
          return;
        }
        return;
      }
      const id = li.dataset.id;
      if (e.target.closest(".remove")) {
        removeTask(id);
      } else if (e.target.closest(".edit")) {
        enterEditMode(li, id);
      }
    });

    document.addEventListener("change", (e) => {
      const li = e.target.closest(".item");
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.matches(".check")) {
        const task = tasks.find((t) => t.id === id);
        // Prevent toggling completed tasks (Done column)
        if (task && !task.completed) {
          toggleTask(id);
        }
      }
    });

    document.addEventListener("dblclick", (e) => {
      const li = e.target.closest(".item");
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.matches(".text")) {
        enterEditMode(li, id);
      }
    });

    themeToggle.addEventListener("click", toggleTheme);

    // Calendar interactions
    const boardFooter = document.querySelector(".board__footer");
    if (prevMonthBtn)
      prevMonthBtn.addEventListener("click", () => {
        calendarMonth -= 1;
        if (calendarMonth < 0) {
          calendarMonth = 11;
          calendarYear -= 1;
        }
        renderCalendar();
      });
    if (nextMonthBtn)
      nextMonthBtn.addEventListener("click", () => {
        calendarMonth += 1;
        if (calendarMonth > 11) {
          calendarMonth = 0;
          calendarYear += 1;
        }
        renderCalendar();
      });
    if (calendarGrid)
      calendarGrid.addEventListener("click", (e) => {
        const cell = e.target.closest(".cal-cell");
        if (!cell) return;
        selectedDateISO = cell.dataset.date;
        save();
        showBoardForSelectedDate();
        e.stopPropagation();
      });
    if (backToCalendarBtn)
      backToCalendarBtn.addEventListener("click", () => {
        // Go back to calendar
        if (calendarView) calendarView.classList.add("is-visible");
        boardElement.classList.add("hidden");
        document.querySelector(".board__footer")?.classList.add("hidden");
        renderCalendar();
      });

    // Add task within column
    document.addEventListener("submit", (e) => {
      const form = e.target.closest(".add-task");
      if (!form) return;
      e.preventDefault();
      const colName = (
        columns.find((c) => c.id === form.dataset.colId)?.name || ""
      ).toLowerCase();
      if (colName === "doing" || colName === "done") return; // guard
      const colId = form.dataset.colId;
      const input = form.querySelector(".add__input");
      addTask(input.value, colId);
      input.value = "";
    });

    // Column title rename
    document.addEventListener(
      "blur",
      (e) => {
        const title = e.target.closest(".col-title");
        if (!title) return;
        const colId = title.dataset.colId;
        const col = columns.find((c) => c.id === colId);
        if (!col) return;
        col.name = title.textContent.trim() || col.name;
        save();
      },
      true
    );

    // Add column button removed per requirements

    // Global keyboard: '/' focuses the add input and opens board if needed
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        const isTyping =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);
        // If currently typing in a standard input (other than due time), let it pass
        if (isTyping && active !== dueTimeInput) return;
        e.preventDefault();
        if (calendarView && calendarView.classList.contains("is-visible")) {
          showBoardForSelectedDate();
        }
        inputElement?.focus();
      }
    });
  }

  function findColumnByNames(names) {
    const set = new Set(names.map((n) => n.toLowerCase()));
    return columns.find((c) => set.has((c.name || "").toLowerCase()));
  }

  function moveTaskToColumn(taskId, columnId, position) {
    for (const col of columns) {
      col.taskIds = col.taskIds.filter((tid) => tid !== taskId);
    }
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    if (position === "bottom") col.taskIds.push(taskId);
    else col.taskIds.unshift(taskId);
  }

  function removeColumn(colId) {
    const index = columns.findIndex((c) => c.id === colId);
    if (index === -1) return;
    const removed = columns[index];
    // Determine target column for orphaned tasks (next, else previous)
    let target = columns[index + 1] || columns[index - 1];
    // Remove the column
    columns.splice(index, 1);
    // If no columns remain, create one
    if (!columns.length) {
      const newCol = { id: uid(), name: "Column", taskIds: [] };
      columns.push(newCol);
      target = newCol;
    }
    // Move tasks to target
    if (removed && removed.taskIds && removed.taskIds.length && target) {
      // prepend to keep them visible
      target.taskIds = [...removed.taskIds, ...target.taskIds];
    }
    save();
    render();
    initSortable();
  }

  function enterEditMode(li, id) {
    const textEl = li.querySelector(".text");
    const current = textEl.textContent;
    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = current;
    textEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(current.length, current.length);

    function commit() {
      updateTask(id, input.value);
    }
    function cancel() {
      render();
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", commit);
  }

  function applyBackgroundImage(dateISO) {
    const mainElement = document.querySelector(".app__main");
    if (!mainElement) return;

    if (backgroundImages[dateISO]) {
      mainElement.style.backgroundImage = `url(${backgroundImages[dateISO]})`;
      // Show clear button
      const clearBtn = document.getElementById("clearBackground");
      if (clearBtn) clearBtn.style.display = "inline-flex";
    } else {
      mainElement.style.backgroundImage = "none";
      // Hide clear button
      const clearBtn = document.getElementById("clearBackground");
      if (clearBtn) clearBtn.style.display = "none";
    }
  }

  function handleBackgroundImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image file size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      backgroundImages[selectedDateISO] = e.target.result;
      save();
      applyBackgroundImage(selectedDateISO);
      renderCalendar(); // Update calendar to show background on the date
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = "";
  }

  function clearBackgroundImage() {
    delete backgroundImages[selectedDateISO];
    save();
    applyBackgroundImage(selectedDateISO);
    renderCalendar(); // Update calendar to remove background from the date
  }

  function initSortable() {
    // If Sortable is not yet loaded (slow network), retry shortly
    if (typeof Sortable === "undefined") {
      setTimeout(initSortable, 80);
      return;
    }
    const lists = Array.from(document.querySelectorAll(".list"));
    lists.forEach((ul) => {
      if (ul._sortableInstance) {
        try {
          ul._sortableInstance.destroy();
        } catch {}
      }
    });

    const sharedOptions = {
      animation: 220,
      easing: "cubic-bezier(.2,.8,.2,1)",
      handle: ".item",
      direction: "vertical",
      // Prevent drag start from these controls
      filter:
        "a,button,input,textarea,select,option,[contenteditable],.check,.edit,.remove,.add__icon,.add__input,.col-btn,.add-task",
      preventOnFilter: true,
      ghostClass: "ghost",
      chosenClass: "chosen",
      dragClass: "drag",
      group: "kanban",
      fallbackOnBody: true,
      swapThreshold: 0.5,
      onAdd: persistAndSync,
      onUpdate: persistAndSync,
      onSort: persistAndSync,
      onEnd: () => render(),
    };

    for (const ul of document.querySelectorAll(".list")) {
      const instance = new Sortable(ul, sharedOptions);
      ul._sortableInstance = instance;
      // Make items explicitly draggable for robustness
      Array.from(ul.children).forEach((li) =>
        li.setAttribute("draggable", "true")
      );
    }

    function persistAndSync() {
      const colLists = Array.from(document.querySelectorAll(".list"));
      for (const ul of colLists) {
        const colEl = ul.closest(".column");
        if (!colEl) continue;
        const colId = colEl.dataset.colId;
        const col = columns.find((c) => c.id === colId);
        if (!col) continue;
        col.taskIds = Array.from(ul.children).map((li) => li.dataset.id);

        // Update task completion status based on column
        const isDoneColumn = /^(done|completed|complete)$/i.test(
          col.name || ""
        );
        for (const taskId of col.taskIds) {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            task.completed = isDoneColumn;
          }
        }
      }
      save();
    }
  }

  // Boot
  load();
  // Start at calendar view by default
  if (calendarView) {
    calendarView.classList.add("is-visible");
    boardElement.classList.add("hidden");
    document.querySelector(".board__footer")?.classList.add("hidden");
    renderCalendar();
  }
  render();
  bindDomEvents();
  initSortable();
})();
