import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHighlightParts, filterParticipantsByKeyword, sortParticipantsBySelection } from './sapaScheduleRules.js';

test('filterParticipantsByKeyword returns all when keyword empty', () => {
  const rows = [
    { nama_lengkap: 'Budi Santoso', role: 'guru' },
    { nama_lengkap: 'Rina Puspita', role: 'tu' },
  ];

  const result = filterParticipantsByKeyword(rows, '');
  assert.equal(result.length, 2);
});

test('filterParticipantsByKeyword matches by nama', () => {
  const rows = [
    { nama_lengkap: 'Budi Santoso', role: 'guru' },
    { nama_lengkap: 'Rina Puspita', role: 'tu' },
  ];

  const result = filterParticipantsByKeyword(rows, 'rina');
  assert.equal(result.length, 1);
  assert.equal(result[0].nama_lengkap, 'Rina Puspita');
});

test('filterParticipantsByKeyword matches by role', () => {
  const rows = [
    { nama_lengkap: 'Budi Santoso', role: 'guru' },
    { nama_lengkap: 'Rina Puspita', role: 'tu' },
  ];

  const result = filterParticipantsByKeyword(rows, 'guru');
  assert.equal(result.length, 1);
  assert.equal(result[0].nama_lengkap, 'Budi Santoso');
});

test('buildHighlightParts marks matched substring', () => {
  const parts = buildHighlightParts('Rina Puspita', 'rina');
  assert.equal(parts.length, 2);
  assert.equal(parts[0].match, true);
  assert.equal(parts[0].text.toLowerCase(), 'rina');
});

test('sortParticipantsBySelection keeps selected participants at top', () => {
  const rows = [
    { id: 'u2', nama_lengkap: 'Budi Santoso', role: 'guru' },
    { id: 'u1', nama_lengkap: 'Rina Puspita', role: 'tu' },
    { id: 'u3', nama_lengkap: 'Andi Saputra', role: 'guru' },
  ];

  const result = sortParticipantsBySelection(rows, ['u2']);
  assert.equal(result[0].id, 'u2');
});
