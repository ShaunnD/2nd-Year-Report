/* ============================================================
   Belgium Campus — Marks Tracker  |  app.js
   ============================================================
   Mark structure (per subject):
     - Each task has a weight (%) and a mark (%).
     - classworkMark = Σ (weight_i / 100 × mark_i / 100)   [0–1 fraction]
     - For subjects WITH an exam  →  total = CW × 0.30 + exam × 0.70
     - For INL261 (no exam)       →  total = classworkMark  (weights sum to 100%)
   All display values are multiplied ×100 to show as %.
   ============================================================ */

'use strict';

// ── Default Subject Definitions ─────────────────────────────
const DEFAULTS = {
  sem1: [
    {
      code: 'ERP261', name: 'Enterprise Systems',
      hasExam: true,
      tasks: [
        { name: 'Assignment',      weight: 25, mark: '' },
        { name: 'Summative Test',  weight: 75, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'ILE261', name: 'IT Law & Ethics',
      hasExam: true,
      tasks: [
        { name: 'Assignment',      weight: 35, mark: '' },
        { name: 'Summative Test',  weight: 65, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'PMM261', name: 'Project Management',
      hasExam: true,
      tasks: [
        { name: 'Assignment 1',    weight: 25, mark: '' },
        { name: 'Assignment 2',    weight: 25, mark: '' },
        { name: 'Quizzes',         weight: 20, mark: '' },
        { name: 'Summative Test',  weight: 30, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'DBD261', name: 'Database Development',
      hasExam: true,
      tasks: [
        { name: 'Assignment 1',    weight: 10, mark: '' },
        { name: 'Assignment 2',    weight: 20, mark: '' },
        { name: 'Test 1',          weight: 20, mark: '' },
        { name: 'Summative Test',  weight: 50, mark: '' }
      ],
      examMark: ''
    },
    {
      // INL261 has NO separate exam — the classwork IS the final mark
      code: 'INL261', name: 'Innovation & Leadership',
      hasExam: false,
      tasks: [
        { name: 'Milestone 1',     weight: 20, mark: '' },
        { name: 'Milestone 2',     weight: 60, mark: '' },
        { name: 'Summative Test',  weight: 20, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'OPS261', name: 'Operating Systems',
      hasExam: true,
      tasks: [
        { name: 'Project',         weight: 20, mark: '' },
        { name: 'Class Test',      weight: 30, mark: '' },
        { name: 'Summative Test',  weight: 50, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'IOT261', name: 'Internet of Things',
      hasExam: true,
      tasks: [
        { name: 'Assignment',      weight: 20, mark: '' },
        { name: 'Class Test',      weight: 30, mark: '' },
        { name: 'Summative Test',  weight: 50, mark: '' }
      ],
      examMark: ''
    }
  ],
  sem2: [
    {
      code: 'SEC261', name: 'Security',
      hasExam: true,
      tasks: [
        { name: 'Project',  weight: 20, mark: '' },
        { name: 'Test 1',   weight: 30, mark: '' },
        { name: 'Test 2',   weight: 50, mark: '' }
      ],
      examMark: ''
    },
    {
      code: 'CNA261', name: 'Computer Networking & Admin',
      hasExam: true, tasks: [], examMark: ''
    },
    {
      code: 'OPS262', name: 'Operating Systems 2',
      hasExam: true, tasks: [], examMark: ''
    },
    {
      code: 'OPS263', name: 'Operating Systems 3',
      hasExam: true, tasks: [], examMark: ''
    },
    {
      code: 'DBD262', name: 'Database Development 2',
      hasExam: true, tasks: [], examMark: ''
    },
    {
      code: 'DBR261', name: 'Database Reporting',
      hasExam: true, tasks: [], examMark: ''
    },
    {
      code: 'DBA261', name: 'Database Administration',
      hasExam: true, tasks: [], examMark: ''
    }
  ]
};

// ── State & Persistence ─────────────────────────────────────
const STORAGE_KEY = 'belgium_marks_v2';
let state = loadState();
let activeTab = 'sem1';

// Track which card is pending a new task
let pendingAdd = { semKey: null, code: null };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate basic shape
      if (parsed.sem1 && parsed.sem2) return parsed;
    }
  } catch (_) {}
  return deepClone(DEFAULTS);
}

function saveState() {
  const dot  = document.getElementById('saveDot');
  const text = document.getElementById('saveText');
  dot.classList.add('saving');
  text.textContent = 'Saving…';
  clearTimeout(saveState._timer);
  saveState._timer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dot.classList.remove('saving');
    text.textContent = 'Saved';
  }, 350);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Calculations ─────────────────────────────────────────────
/**
 * Returns:
 *  classworkPct  — weighted classwork mark, 0–100
 *  cwContrib     — classworkPct × 0.30  (null for INL261)
 *  examPct       — raw exam entry, 0–100  (null if blank / no exam)
 *  examContrib   — examPct × 0.70  (null if blank / no exam)
 *  totalPct      — final combined mark, 0–100
 *  weightTotal   — sum of task weights (to detect when ≠ 100)
 */
function calcSubject(subject) {
  const weightTotal = subject.tasks.reduce((s, t) => s + Number(t.weight || 0), 0);

  // Classwork = Σ ( (w_i / weightTotal) * mark_i )
  // We normalise by weightTotal so partial task sets still give a 0–100 value.
  let classworkPct = 0;
  if (subject.tasks.length > 0 && weightTotal > 0) {
    for (const t of subject.tasks) {
      const m = parseFloat(t.mark);
      if (!isNaN(m) && t.mark !== '') {
        classworkPct += (Number(t.weight) / weightTotal) * m;
      }
    }
  }

  if (!subject.hasExam) {
    // INL261: total IS classworkPct (no exam component)
    return {
      classworkPct,
      cwContrib:    null,
      examPct:      null,
      examContrib:  null,
      totalPct:     classworkPct,
      weightTotal
    };
  }

  const examVal   = parseFloat(subject.examMark);
  const examPct   = (!isNaN(examVal) && subject.examMark !== '') ? examVal : null;
  const cwContrib = classworkPct * 0.30;
  const examContrib = examPct !== null ? examPct * 0.70 : null;

  // Show a running total even before the exam mark is entered
  const totalPct = cwContrib + (examContrib !== null ? examContrib : 0);

  return { classworkPct, cwContrib, examPct, examContrib, totalPct, weightTotal };
}

function fmt(n) {
  // Format a 0-100 percentage to 2 decimal places
  return n.toFixed(2) + '%';
}

function gradeClass(pct, hasData) {
  if (!hasData) return '';
  if (pct >= 75) return 'pass';
  if (pct >= 50) return 'warn';
  return 'fail';
}

// ── Averages ─────────────────────────────────────────────────
function semesterAvg(semKey) {
  const subjects = state[semKey];
  const totals = [];
  for (const sub of subjects) {
    const { totalPct, examPct, cwContrib } = calcSubject(sub);
    // Only include in average if the subject has some data
    const hasData = sub.tasks.some(t => t.mark !== '') ||
                    (sub.hasExam && sub.examMark !== '');
    if (hasData) totals.push(totalPct);
  }
  if (!totals.length) return null;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function updateSummaryBar() {
  const s1 = semesterAvg('sem1');
  const s2 = semesterAvg('sem2');

  const el = id => document.getElementById(id);

  setAvg(el('sem1Avg'), s1);
  setAvg(el('sem2Avg'), s2);

  const both = [s1, s2].filter(v => v !== null);
  setAvg(el('yearAvg'), both.length ? both.reduce((a, b) => a + b, 0) / both.length : null);
}

function setAvg(el, val) {
  if (val === null) { el.textContent = '—'; el.style.color = ''; return; }
  el.textContent = val.toFixed(1) + '%';
  el.style.color = val >= 75 ? 'var(--green)' : val >= 50 ? 'var(--yellow)' : 'var(--red)';
}

// ── Rendering ────────────────────────────────────────────────
function renderAll() {
  renderSemester('sem1');
  renderSemester('sem2');
  updateSummaryBar();
}

function renderSemester(semKey) {
  const grid = document.getElementById(semKey === 'sem1' ? 'gridSem1' : 'gridSem2');
  grid.innerHTML = '';
  for (const subject of state[semKey]) {
    grid.appendChild(buildCard(semKey, subject));
  }
}

function buildCard(semKey, subject) {
  const calc = calcSubject(subject);
  const hasData = subject.tasks.some(t => t.mark !== '') ||
                  (subject.hasExam && subject.examMark !== '');

  const card = el('div', 'subject-card');
  card.dataset.code = subject.code;

  // Restore open state
  if (openCards.has(subject.code)) card.classList.add('open');

  // ── Header ──
  const header = el('div', 'card-header');

  const left = el('div', 'card-left');
  const codeEl = el('span', 'subject-code', subject.code);
  const nameEl = el('span', 'subject-name', subject.name);
  left.append(codeEl, nameEl);

  const right = el('div', 'card-right');
  const totalEl = el('span', 'card-total', hasData ? fmt(calc.totalPct) : '—');
  if (hasData) totalEl.classList.add(gradeClass(calc.totalPct, hasData));
  const chev = el('span', 'chevron', '▼');

  right.append(totalEl, chev);
  header.append(left, right);

  header.addEventListener('click', () => toggleCard(card, subject.code));

  // ── Body ──
  const body = el('div', 'card-body');

  // Tasks table
  if (subject.tasks.length > 0) {
    const colHead = el('div', 'tasks-cols');
    colHead.innerHTML = '<span>Task</span><span>Weight</span><span>Mark (%)</span><span>Contrib.</span><span></span>';
    body.appendChild(colHead);

    for (let i = 0; i < subject.tasks.length; i++) {
      body.appendChild(buildTaskRow(semKey, subject, i));
    }
  } else {
    body.appendChild(el('div', 'empty-tasks-notice', 'No tasks yet — add one below.'));
  }

  // Weight warning
  const warn = el('div', 'weight-warning');
  warn.id = `warn-${subject.code}`;
  warn.style.display = 'none';
  warn.textContent = '⚠ Task weights do not sum to 100%.';
  body.appendChild(warn);

  // Add task button
  const addWrap = el('div', 'add-task-wrap');
  const addBtn  = el('button', 'btn-add-task', '+ Add Task');
  addBtn.addEventListener('click', () => openAddTaskModal(semKey, subject.code));
  addWrap.appendChild(addBtn);
  body.appendChild(addWrap);

  // Exam section (only for subjects with exam)
  if (subject.hasExam) {
    const examSec = el('div', 'exam-section');

    const examLabel = el('span', 'exam-label', 'Exam Mark');
    const badge     = el('span', 'exam-badge', '70%');
    const labelWrap = el('div', '');
    labelWrap.style.display = 'flex';
    labelWrap.style.alignItems = 'center';
    labelWrap.style.gap = '8px';
    labelWrap.append(examLabel, badge);

    const examRight = el('div', 'exam-right');
    const examInput = el('input', 'exam-input');
    examInput.type        = 'number';
    examInput.min         = '0';
    examInput.max         = '100';
    examInput.step        = '0.01';
    examInput.placeholder = '0 – 100';
    examInput.value       = subject.examMark;
    examInput.addEventListener('change', e => {
      subject.examMark = e.target.value;
      saveState();
      refreshCard(semKey, subject);
    });

    const examNote = el('span', 'exam-note', '/ 100');
    examRight.append(examInput, examNote);
    examSec.append(labelWrap, examRight);
    body.appendChild(examSec);
  }

  // Totals strip
  body.appendChild(buildTotalsStrip(subject, calc, hasData));

  card.append(header, body);
  return card;
}

function buildTaskRow(semKey, subject, index) {
  const task = subject.tasks[index];
  const row  = el('div', 'task-row');

  // Task name
  const nameCell = el('div', 'task-name-cell', task.name);
  nameCell.title = task.name;

  // Weight input
  const weightInput = el('input', 'cell-input');
  weightInput.type        = 'number';
  weightInput.min         = '1';
  weightInput.max         = '100';
  weightInput.step        = '1';
  weightInput.value       = task.weight;
  weightInput.placeholder = '%';
  weightInput.title       = 'Task weight (%)';
  weightInput.addEventListener('change', e => {
    task.weight = e.target.value === '' ? 0 : Number(e.target.value);
    saveState();
    refreshCard(semKey, subject);
  });

  // Mark input
  const markInput = el('input', 'cell-input');
  markInput.type        = 'number';
  markInput.min         = '0';
  markInput.max         = '100';
  markInput.step        = '0.01';
  markInput.value       = task.mark;
  markInput.placeholder = '0–100';
  markInput.title       = 'Mark achieved (%)';
  markInput.addEventListener('change', e => {
    task.mark = e.target.value;
    saveState();
    refreshCard(semKey, subject);
  });

  // Contribution display
  const contrib = el('div', 'contribution-cell');
  const m = parseFloat(task.mark);
  const w = Number(task.weight);
  const weightTotal = subject.tasks.reduce((s, t) => s + Number(t.weight || 0), 0);
  if (!isNaN(m) && task.mark !== '' && weightTotal > 0) {
    const c = (w / weightTotal) * m;
    contrib.textContent = c.toFixed(2) + '%';
  } else {
    contrib.textContent = '—';
  }

  // Delete button
  const delBtn = el('button', 'btn-delete', '×');
  delBtn.title = 'Remove task';
  delBtn.addEventListener('click', () => {
    subject.tasks.splice(index, 1);
    saveState();
    refreshCard(semKey, subject);
  });

  row.append(nameCell, weightInput, markInput, contrib, delBtn);
  return row;
}

function buildTotalsStrip(subject, calc, hasData) {
  const strip = el('div', 'totals-strip');

  if (!subject.hasExam) {
    // INL261 — single final block
    const b1 = totalBlock('Weighted Total', hasData ? fmt(calc.classworkPct) : '—', false, hasData ? gradeClass(calc.classworkPct, hasData) : '');
    const b2 = totalBlock('Exam', 'N/A', false, '');
    const b3 = totalBlock('Final Mark', hasData ? fmt(calc.totalPct) : '—', true, hasData ? gradeClass(calc.totalPct, hasData) : '');
    strip.append(b1, b2, b3);
  } else {
    const cwVal   = hasData ? fmt(calc.cwContrib)   : '—';
    const exVal   = calc.examContrib !== null ? fmt(calc.examContrib) : '—';
    const totVal  = hasData ? fmt(calc.totalPct)    : '—';

    const b1 = totalBlock('CW (×30%)',  cwVal,  false, hasData ? gradeClass(calc.cwContrib, hasData) : '');
    const b2 = totalBlock('Exam (×70%)', exVal, false, calc.examContrib !== null ? gradeClass(calc.examContrib, calc.examContrib !== null) : '');
    const b3 = totalBlock('Final Mark', totVal, true,  hasData ? gradeClass(calc.totalPct, hasData) : '');
    strip.append(b1, b2, b3);
  }

  return strip;
}

function totalBlock(label, value, isFinal, cls) {
  const wrap  = el('div', isFinal ? 'total-block total-block--final' : 'total-block');
  const lbl   = el('div', 'total-block-label', label);
  const val   = el('div', 'total-block-value ' + cls, value);
  wrap.append(lbl, val);
  return wrap;
}

// ── Card Open/Close ──────────────────────────────────────────
const openCards = new Set();

function toggleCard(cardEl, code) {
  cardEl.classList.toggle('open');
  if (cardEl.classList.contains('open')) openCards.add(code);
  else openCards.delete(code);
}

// ── Refresh a single card in place ──────────────────────────
function refreshCard(semKey, subject) {
  const grid = document.getElementById(semKey === 'sem1' ? 'gridSem1' : 'gridSem2');
  const old  = grid.querySelector(`[data-code="${subject.code}"]`);
  if (!old) return;
  const newCard = buildCard(semKey, subject);
  grid.replaceChild(newCard, old);

  // Update weight warning visibility
  const calc      = calcSubject(subject);
  const warnEl    = document.getElementById(`warn-${subject.code}`);
  if (warnEl) {
    const off = Math.abs(calc.weightTotal - 100) > 0.5 && subject.tasks.length > 0;
    warnEl.style.display = off ? 'flex' : 'none';
  }

  updateSummaryBar();
}

// ── Add Task Modal ───────────────────────────────────────────
function openAddTaskModal(semKey, code) {
  pendingAdd = { semKey, code };
  const subject = findSubject(semKey, code);
  const used    = subject.tasks.reduce((s, t) => s + Number(t.weight || 0), 0);
  const rem     = Math.max(0, 100 - used);

  document.getElementById('inputTaskName').value   = '';
  document.getElementById('inputTaskWeight').value = rem > 0 ? rem : '';
  document.getElementById('weightHint').textContent =
    `${used}% already assigned — ${rem}% remaining`;

  document.getElementById('modalBackdrop').classList.add('open');
  setTimeout(() => document.getElementById('inputTaskName').focus(), 60);
}

function closeAddTaskModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  pendingAdd = { semKey: null, code: null };
}

function confirmAddTask() {
  const name   = document.getElementById('inputTaskName').value.trim();
  const weight = parseFloat(document.getElementById('inputTaskWeight').value);

  if (!name)          return alert('Please enter a task name.');
  if (isNaN(weight) || weight <= 0)
    return alert('Please enter a valid weight (> 0).');

  const subject = findSubject(pendingAdd.semKey, pendingAdd.code);
  subject.tasks.push({ name, weight, mark: '' });
  saveState();
  refreshCard(pendingAdd.semKey, subject);
  closeAddTaskModal();
}

// ── Reset Modal ──────────────────────────────────────────────
function openResetModal()  { document.getElementById('resetBackdrop').classList.add('open'); }
function closeResetModal() { document.getElementById('resetBackdrop').classList.remove('open'); }

function confirmReset() {
  // Clear all mark values but keep task structures
  for (const semKey of ['sem1', 'sem2']) {
    for (const sub of state[semKey]) {
      sub.examMark = '';
      for (const t of sub.tasks) t.mark = '';
    }
  }
  saveState();
  renderAll();
  closeResetModal();
}

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('panelSem1').classList.toggle('hidden', tab !== 'sem1');
  document.getElementById('panelSem2').classList.toggle('hidden', tab !== 'sem2');
}

// ── Utilities ────────────────────────────────────────────────
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) {
    className.trim().split(/\s+/).forEach(c => c && e.classList.add(c));
  }
  if (text !== undefined) e.textContent = text;
  return e;
}

function findSubject(semKey, code) {
  return state[semKey].find(s => s.code === code);
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  renderAll();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', openResetModal);

  // Add Task modal
  document.getElementById('modalCancel').addEventListener('click',  closeAddTaskModal);
  document.getElementById('modalConfirm').addEventListener('click', confirmAddTask);
  document.getElementById('inputTaskName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inputTaskWeight').focus();
  });
  document.getElementById('inputTaskWeight').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmAddTask();
  });

  // Reset modal
  document.getElementById('resetCancel').addEventListener('click',  closeResetModal);
  document.getElementById('resetConfirm').addEventListener('click', confirmReset);

  // Close modals on backdrop click
  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modalBackdrop')) closeAddTaskModal();
  });
  document.getElementById('resetBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('resetBackdrop')) closeResetModal();
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAddTaskModal();
      closeResetModal();
    }
  });
});
