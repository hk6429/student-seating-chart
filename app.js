const STORAGE_KEY = "teacher_seating_chart_v1";

const state = {
  className: "",
  seatsPerRow: 6,
  rowCount: 5,
  studentNames: "",
  seats: []
};

const classNameInput = document.getElementById("className");
const seatsPerRowInput = document.getElementById("seatsPerRow");
const rowCountInput = document.getElementById("rowCount");
const studentNamesInput = document.getElementById("studentNames");
const arrangeBtn = document.getElementById("arrangeBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const printBtn = document.getElementById("printBtn");
const clearBtn = document.getElementById("clearBtn");
const seatGrid = document.getElementById("seatGrid");
const classTitle = document.getElementById("classTitle");
const chartInfo = document.getElementById("chartInfo");
const saveStatus = document.getElementById("saveStatus");

let draggedIndex = null;
let saveTimer = null;

function init() {
  loadState();
  bindEvents();
  syncInputs();
  ensureSeatCount();
  render();
}

function bindEvents() {
  classNameInput.addEventListener("input", () => updateFromInputs());
  seatsPerRowInput.addEventListener("input", () => updateFromInputs(true));
  rowCountInput.addEventListener("input", () => updateFromInputs(true));
  studentNamesInput.addEventListener("input", () => updateFromInputs());

  arrangeBtn.addEventListener("click", arrangeByList);
  shuffleBtn.addEventListener("click", shuffleSeats);
  printBtn.addEventListener("click", () => window.print());
  clearBtn.addEventListener("click", clearAll);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.className = parsed.className || "";
    state.seatsPerRow = clampNumber(parsed.seatsPerRow, 1, 12, 6);
    state.rowCount = clampNumber(parsed.rowCount, 1, 12, 5);
    state.studentNames = parsed.studentNames || "";
    state.seats = Array.isArray(parsed.seats) ? parsed.seats : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function syncInputs() {
  classNameInput.value = state.className;
  seatsPerRowInput.value = state.seatsPerRow;
  rowCountInput.value = state.rowCount;
  studentNamesInput.value = state.studentNames;
}

function updateFromInputs(resizeSeats = false) {
  state.className = classNameInput.value.trim();
  state.seatsPerRow = clampNumber(seatsPerRowInput.value, 1, 12, 6);
  state.rowCount = clampNumber(rowCountInput.value, 1, 12, 5);
  state.studentNames = studentNamesInput.value;

  if (resizeSeats) {
    ensureSeatCount();
  }

  render();
  scheduleSave();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function getSeatCount() {
  return state.seatsPerRow * state.rowCount;
}

function ensureSeatCount() {
  const count = getSeatCount();
  const nextSeats = state.seats.slice(0, count);
  while (nextSeats.length < count) {
    nextSeats.push("");
  }
  state.seats = nextSeats;
}

function getNames() {
  return state.studentNames
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
}

function arrangeByList() {
  ensureSeatCount();
  const names = getNames();
  state.seats = Array.from({ length: getSeatCount() }, (_, index) => names[index] || "");
  render();
  saveNow("已依名單排座並保存。");
}

function shuffleSeats() {
  ensureSeatCount();
  const names = state.seats.filter(Boolean);
  if (names.length === 0) {
    const listNames = getNames();
    if (listNames.length === 0) {
      setStatus("請先輸入名單或排座。");
      return;
    }
    state.seats = listNames.slice(0, getSeatCount());
    ensureSeatCount();
  }

  const filled = state.seats.filter(Boolean);
  const shuffled = shuffle(filled);
  state.seats = Array.from({ length: getSeatCount() }, (_, index) => shuffled[index] || "");
  render();
  saveNow("已隨機洗座並保存。");
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function clearAll() {
  const confirmed = confirm("確定要清空班級、名單和座位嗎？");
  if (!confirmed) return;

  state.className = "";
  state.seatsPerRow = 6;
  state.rowCount = 5;
  state.studentNames = "";
  state.seats = [];
  ensureSeatCount();
  syncInputs();
  render();
  saveNow("已清空並保存。");
}

function render() {
  ensureSeatCount();
  classTitle.textContent = state.className || "未命名班級";
  chartInfo.textContent = `${state.rowCount} 排，每排 ${state.seatsPerRow} 人，共 ${getSeatCount()} 個座位`;
  seatGrid.style.gridTemplateColumns = `repeat(${state.seatsPerRow}, minmax(86px, 1fr))`;
  seatGrid.innerHTML = "";

  state.seats.forEach((name, index) => {
    const seat = document.createElement("div");
    seat.className = `seat${name ? "" : " empty"}`;
    seat.draggable = true;
    seat.dataset.index = index;
    seat.textContent = name || "空位";
    seat.title = `第 ${Math.floor(index / state.seatsPerRow) + 1} 排，第 ${(index % state.seatsPerRow) + 1} 位`;

    seat.addEventListener("dragstart", handleDragStart);
    seat.addEventListener("dragover", handleDragOver);
    seat.addEventListener("dragleave", handleDragLeave);
    seat.addEventListener("drop", handleDrop);
    seat.addEventListener("dragend", handleDragEnd);

    seatGrid.appendChild(seat);
  });
}

function handleDragStart(event) {
  draggedIndex = Number(event.currentTarget.dataset.index);
  event.currentTarget.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(draggedIndex));
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drop-target");
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove("drop-target");
}

function handleDrop(event) {
  event.preventDefault();
  const targetIndex = Number(event.currentTarget.dataset.index);
  event.currentTarget.classList.remove("drop-target");

  if (draggedIndex === null || draggedIndex === targetIndex) return;

  [state.seats[draggedIndex], state.seats[targetIndex]] = [state.seats[targetIndex], state.seats[draggedIndex]];
  draggedIndex = null;
  render();
  saveNow("已交換座位並保存。");
}

function handleDragEnd() {
  draggedIndex = null;
  document.querySelectorAll(".seat").forEach((seat) => {
    seat.classList.remove("dragging", "drop-target");
  });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  setStatus("正在保存...");
  saveTimer = setTimeout(() => saveNow("已自動保存。"), 350);
}

function saveNow(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setStatus(message);
}

function setStatus(message) {
  saveStatus.textContent = message;
}

init();
