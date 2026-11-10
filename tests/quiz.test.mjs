// Ausführen: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, disabledReason, recommended, toggleOption, sanitize, answerLabel, firstOpenIndex, isAnswered,
} from '../js/quiz.js';

const q = (id) => QUESTIONS.find((x) => x.id === id);

test('alle 8 Fragen in der richtigen Reihenfolge', () => {
  assert.deepEqual(QUESTIONS.map((x) => x.id), ['mood', 'duration', 'budget', 'setting', 'distance', 'adrenaline', 'when', 'prep']);
  assert.equal(q('mood').options.length, 6);
  assert.equal(q('duration').options.length, 5);
  assert.equal(q('budget').options.length, 6);
  assert.equal(q('setting').options.length, 4);
  assert.equal(q('distance').options.length, 7);
  assert.equal(q('adrenaline').options.length, 4);
  assert.equal(q('when').options.length, 5);
  assert.equal(q('prep').options.length, 4);
});

test('Optionswerte sind pro Frage eindeutig', () => {
  for (const question of QUESTIONS) {
    const values = question.options.map((o) => o.value);
    assert.equal(new Set(values).size, values.length, question.id);
  }
});

test('Mehrfachauswahl: an- und abwählen', () => {
  let a = toggleOption(q('mood'), undefined, 'nature');
  a = toggleOption(q('mood'), a, 'adrenaline');
  assert.deepEqual(a, ['nature', 'adrenaline']);
  a = toggleOption(q('mood'), a, 'nature');
  assert.deepEqual(a, ['adrenaline']);
});

test('exklusive Option "Egal" ersetzt andere Auswahl und umgekehrt', () => {
  let a = toggleOption(q('setting'), ['outdoor', 'city'], 'any');
  assert.deepEqual(a, ['any']);
  a = toggleOption(q('setting'), a, 'indoor');
  assert.deepEqual(a, ['indoor']);
});

test('Einzelauswahl setzt den Wert', () => {
  assert.equal(toggleOption(q('budget'), 'free', 'lt30'), 'lt30');
  assert.equal(toggleOption(q('budget'), 'lt30', 'lt30'), 'lt30');
});

test('Entfernung passt sich der Dauer an', () => {
  const hours = { duration: 'hours' };
  assert.equal(disabledReason('distance', '30', hours), null);
  assert.equal(disabledReason('distance', '60', hours), null);
  assert.ok(disabledReason('distance', '120', hours));
  assert.ok(disabledReason('distance', 'fly', hours));
  assert.equal(disabledReason('distance', '120', { duration: 'halfday' }), null);
  assert.ok(disabledReason('distance', '180', { duration: 'halfday' }));
  assert.ok(disabledReason('distance', 'fly', { duration: 'day' }));
  assert.equal(disabledReason('distance', 'fly', { duration: 'weekend' }), null);
});

test('Flüge sind bei kleinem Budget gesperrt', () => {
  assert.ok(disabledReason('distance', 'fly', { duration: 'multiday', budget: 'free' }));
  assert.ok(disabledReason('distance', 'fly', { duration: 'multiday', budget: 'lt30' }));
  assert.equal(disabledReason('distance', 'fly', { duration: 'multiday', budget: 'gt300' }), null);
});

test('große Vorbereitung passt nicht zu "heute/morgen"', () => {
  assert.ok(disabledReason('prep', 'big', { when: 'now' }));
  assert.ok(disabledReason('prep', 'big', { when: 'weekend' }));
  assert.equal(disabledReason('prep', 'big', { when: 'weeks' }), null);
  assert.equal(disabledReason('prep', 'none', { when: 'now' }), null);
});

test('Empfehlungen reagieren auf frühere Antworten', () => {
  assert.ok(recommended('adrenaline', { mood: ['adrenaline'] }).has('4'));
  assert.ok(recommended('setting', { mood: ['nature'] }).has('outdoor'));
  assert.ok(recommended('duration', { mood: ['weekend'] }).has('weekend'));
  assert.equal(recommended('adrenaline', { mood: ['special'] }).size, 0);
});

test('sanitize entfernt ungültig gewordene spätere Antworten', () => {
  const { answers, removed } = sanitize({ duration: 'hours', distance: '180', prep: 'none' });
  assert.equal(answers.distance, null);
  assert.equal(answers.prep, 'none');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].questionId, 'distance');
});

test('sanitize lässt gültige Antworten unverändert', () => {
  const input = { mood: ['nature', 'adrenaline'], duration: 'day', budget: 'lt30', distance: '120', adrenaline: '4', prep: 'none' };
  const { answers, removed } = sanitize(input);
  assert.deepEqual(removed, []);
  assert.deepEqual(answers, input);
});

test('Hilfsfunktionen', () => {
  assert.equal(answerLabel('budget', 'lt30'), 'Unter 30 €');
  assert.equal(answerLabel('budget', null), 'Egal');
  assert.equal(answerLabel('mood', ['nature', 'adrenaline']), 'Natur und Outdoor, Adrenalin und Action');
  assert.equal(firstOpenIndex({}), 0);
  assert.equal(firstOpenIndex({ mood: ['nature'] }), 1);
  assert.equal(firstOpenIndex({ mood: ['nature'] }, ['duration']), 2);
  assert.equal(isAnswered([]), false);
  assert.equal(isAnswered('x'), true);
});
