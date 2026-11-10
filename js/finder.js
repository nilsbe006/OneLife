// Adventure Finder – Oberfläche (Einstieg, Fragen, Profil/Ergebnisse)
import {
  QUESTIONS, QUESTION_COUNT, questionById, disabledReason, recommended,
  toggleOption, sanitize, isAnswered, answerLabel, firstOpenIndex,
} from './quiz.js';
import { loadQuiz, saveQuiz, resetQuiz } from './storage.js';
import { esc } from './util.js';

const go = (hash) => { location.hash = hash; };
const notices = {}; // questionId -> [Hinweise zu automatisch entfernten Antworten]
let lastStep = 0;   // für die Richtung der Übergangsanimation

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3200);
}

/* ---------- Einstieg: #/finder ---------- */
export function finderView(el, session, params) {
  const step = Number(params[0]);
  if (step >= 1 && step <= QUESTION_COUNT) {
    questionView(el, session, step, params[1] === 'edit');
    return;
  }

  const quiz = loadQuiz(session.me.uid);
  const answered = QUESTIONS.filter((q) => isAnswered(quiz.answers[q.id])).length;
  if (!answered && !quiz.completedAt) {
    location.replace('#/finder/1');
    return;
  }
  const next = firstOpenIndex(quiz.answers, quiz.skipped) + 1;
  el.innerHTML = `
    <section class="container finder-intro">
      <header class="page-head">
        <p class="eyebrow">Adventure Finder</p>
        <h1 class="display page-title">Willkommen zurück</h1>
        <p class="page-lead">${quiz.completedAt
          ? 'Du hast den Finder schon einmal ausgefüllt. Schau dir dein Profil an oder starte neu.'
          : `Du warst bei Frage ${Math.min(next, QUESTION_COUNT)} von ${QUESTION_COUNT}.`}</p>
      </header>
      <div class="intro-actions">
        ${quiz.completedAt
          ? '<a class="btn btn-primary btn-lg" href="#/results" id="intro-results">Zu meinen Vorschlägen</a>'
          : `<a class="btn btn-primary btn-lg" href="#/finder/${Math.min(next, QUESTION_COUNT)}" id="intro-resume">Weitermachen</a>`}
        <button class="btn btn-ghost btn-lg" type="button" id="intro-restart">Neu starten</button>
      </div>
    </section>`;
  el.querySelector('#intro-restart').addEventListener('click', () => {
    resetQuiz(session.me.uid);
    go('#/finder/1');
  });
}

/* ---------- Eine Frage: #/finder/3 ---------- */
function questionView(el, session, step, editMode) {
  const uid = session.me.uid;
  const question = QUESTIONS[step - 1];
  let quiz = loadQuiz(uid);
  const dir = step >= lastStep ? 'forward' : 'back';
  lastStep = step;

  const nextHash = () => (editMode || step === QUESTION_COUNT ? '#/results' : `#/finder/${step + 1}`);
  const prevHash = step > 1 ? `#/finder/${step - 1}${editMode ? '/edit' : ''}` : '#/';

  function finishIfLast() {
    if (step === QUESTION_COUNT || editMode) {
      quiz.completedAt = quiz.completedAt || new Date().toISOString();
      saveQuiz(uid, quiz);
    }
  }

  el.innerHTML = `
    <section class="container quiz quiz-${dir}">
      <div class="quiz-top">
        <div class="quiz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${QUESTION_COUNT}" aria-valuenow="${step}" aria-label="Fortschritt">
          <div class="quiz-progress-bar" style="width:${(step / QUESTION_COUNT) * 100}%"></div>
        </div>
        <div class="quiz-meta">
          <span>Frage ${step} von ${QUESTION_COUNT}</span>
          <a href="#/all" class="quiz-all">Alle Abenteuer anzeigen</a>
        </div>
      </div>
      <h1 class="display quiz-title">${esc(question.title)}</h1>
      ${question.hint ? `<p class="quiz-hint">${esc(question.hint)}</p>` : ''}
      <div class="quiz-notice" role="status" hidden></div>
      <div class="options ${question.options.some((o) => o.image) ? 'options-images' : ''}"
           role="group" aria-label="${esc(question.title)}"></div>
      <div class="quiz-actions">
        <a class="btn btn-ghost" href="${prevHash}" id="quiz-back">← Zurück</a>
        <button class="link-btn" type="button" id="quiz-skip">Überspringen</button>
        <button class="btn btn-primary" type="button" id="quiz-next">${editMode ? 'Fertig' : step === QUESTION_COUNT ? 'Vorschläge zeigen' : 'Weiter'}</button>
      </div>
    </section>`;

  const grid = el.querySelector('.options');
  const nextBtn = el.querySelector('#quiz-next');

  const notice = notices[question.id];
  if (notice?.length) {
    const box = el.querySelector('.quiz-notice');
    box.textContent = `Hinweis: ${notice.join(' · ')}`;
    box.hidden = false;
    delete notices[question.id];
  }

  function renderOptions() {
    const answer = quiz.answers[question.id];
    const rec = recommended(question.id, quiz.answers);
    grid.innerHTML = question.options.map((o) => {
      const selected = Array.isArray(answer) ? answer.includes(o.value) : answer === o.value;
      const reason = disabledReason(question.id, o.value, quiz.answers);
      return `
        <button type="button" class="opt${selected ? ' selected' : ''}${o.image ? ' has-img' : ''}"
                data-value="${esc(o.value)}" aria-pressed="${selected}" ${reason ? 'disabled' : ''}>
          ${o.image ? `<span class="opt-img" style="background-image:url('${o.image}')" aria-hidden="true"></span>` : ''}
          <span class="opt-icon" aria-hidden="true">${o.icon || ''}</span>
          <span class="opt-text">
            <span class="opt-label">${esc(o.label)}</span>
            ${o.sub ? `<span class="opt-sub">${esc(o.sub)}</span>` : ''}
            ${reason ? `<span class="opt-reason">${esc(reason)}</span>`
              : rec.has(o.value) ? '<span class="opt-rec">Passt gut</span>' : ''}
          </span>
          <span class="opt-check" aria-hidden="true">✓</span>
        </button>`;
    }).join('');
    nextBtn.disabled = !isAnswered(answer);
  }

  function commit(answer) {
    quiz.answers = { ...quiz.answers, [question.id]: answer };
    quiz.skipped = quiz.skipped.filter((id) => id !== question.id);
    const { answers, removed } = sanitize(quiz.answers);
    quiz.answers = answers;
    for (const r of removed) {
      const q = questionById(r.questionId);
      const label = q.options.find((o) => o.value === r.value)?.label;
      (notices[r.questionId] ||= []).push(`„${label}“ wurde abgewählt (${r.reason}).`);
      toast(`Auswahl bei „${q.short}“ angepasst: ${r.reason}`);
    }
    saveQuiz(uid, quiz);
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt');
    if (!btn || btn.disabled) return;
    const value = btn.dataset.value;
    commit(toggleOption(question, quiz.answers[question.id], value));
    renderOptions();
    if (!question.multi) {
      // Einzelauswahl: kurz Auswahl zeigen, dann automatisch weiter
      clearTimeout(questionView.auto);
      questionView.auto = setTimeout(() => {
        if (location.hash !== `#/finder/${step}${editMode ? '/edit' : ''}`) return;
        finishIfLast();
        go(nextHash());
      }, 320);
    }
  });

  nextBtn.addEventListener('click', () => {
    finishIfLast();
    go(nextHash());
  });

  el.querySelector('#quiz-skip').addEventListener('click', () => {
    quiz.answers = { ...quiz.answers, [question.id]: null };
    if (!quiz.skipped.includes(question.id)) quiz.skipped.push(question.id);
    saveQuiz(uid, quiz);
    finishIfLast();
    go(nextHash());
  });

  renderOptions();
}

/* ---------- Profil / Ergebnisse: #/results ---------- */
export function resultsView(el, session) {
  const quiz = loadQuiz(session.me.uid);
  const answered = QUESTIONS.filter((q) => isAnswered(quiz.answers[q.id])).length;
  if (!answered && !quiz.completedAt) {
    location.replace('#/finder/1');
    return;
  }
  el.innerHTML = `
    <section class="container">
      <header class="page-head">
        <p class="eyebrow">Euer Abenteuer-Profil</p>
        <h1 class="display page-title">Deine Auswahl</h1>
        <p class="page-lead">Tippe auf eine Antwort, um sie zu ändern.</p>
      </header>
      <ul class="profile" id="profile">
        ${QUESTIONS.map((q, i) => `
          <li>
            <a class="profile-item${isAnswered(quiz.answers[q.id]) ? '' : ' is-empty'}" href="#/finder/${i + 1}/edit" data-q="${q.id}">
              <span class="profile-key">${esc(q.short)}</span>
              <span class="profile-val">${esc(answerLabel(q.id, quiz.answers[q.id]))}</span>
              <span class="profile-edit" aria-hidden="true">Ändern</span>
            </a>
          </li>`).join('')}
      </ul>
      <div class="empty results-pending" id="results-list">
        <strong>Vorschläge folgen in Phase 4</strong>
        <p>Sobald die Aktivitäten-Datenbank steht, siehst du hier passende Abenteuer, sortiert nach deinen Antworten.</p>
      </div>
      <div class="intro-actions">
        <a class="btn btn-ghost" href="#/all">Alle Abenteuer anzeigen</a>
        <button class="btn btn-ghost" type="button" id="results-restart">Finder neu starten</button>
      </div>
    </section>`;
  el.querySelector('#results-restart').addEventListener('click', () => {
    resetQuiz(session.me.uid);
    go('#/finder/1');
  });
}
