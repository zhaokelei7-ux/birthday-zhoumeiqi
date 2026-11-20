import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLayout, starPath, constellationPath, SKY, STAR_RADIUS, TEACHER_RADIUS,
} from '../js/geometry.js';

const people = JSON.parse(
  readFileSync(new URL('../data/people.json', import.meta.url), 'utf8'),
);
const layout = buildLayout(people);

test('layout contains all 28 people with unique names', () => {
  assert.equal(layout.length, 28);
  assert.equal(new Set(layout.map((p) => p.name)).size, 28);
});

test('each team owns 5 stars', () => {
  for (const team of ['冲刺队', '战神队', '超越队', '力量队']) {
    assert.equal(layout.filter((p) => p.team === team).length, 5);
  }
});

test('volunteers own 7 stars and the teacher owns the one big star', () => {
  const volunteers = layout.filter((p) => p.group === 'volunteer');
  assert.equal(volunteers.length, 7);
  assert.ok(volunteers.every((p) => p.radius === STAR_RADIUS));

  const teacher = layout.filter((p) => p.group === 'teacher');
  assert.equal(teacher.length, 1);
  assert.equal(teacher[0].name, '卢钰涵');
  assert.equal(teacher[0].radius, TEACHER_RADIUS);
  assert.ok(teacher[0].radius > STAR_RADIUS);
});

test('every star and label sits comfortably inside the sky', () => {
  for (const entry of layout) {
    assert.ok(entry.x > 60 && entry.x < SKY.width - 60, `${entry.name} 横坐标越界`);
    assert.ok(entry.y > 60 && entry.y < SKY.height - 60, `${entry.name} 纵坐标越界`);
    assert.ok(entry.labelX > 20 && entry.labelX < SKY.width - 20, `${entry.name} 标签横坐标越界`);
    assert.ok(entry.labelY > 20 && entry.labelY < SKY.height - 20, `${entry.name} 标签纵坐标越界`);
  }
});

test('stars do not crowd each other', () => {
  const minimum = 45;
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      const distance = Math.hypot(layout[i].x - layout[j].x, layout[i].y - layout[j].y);
      assert.ok(
        distance >= minimum,
        `${layout[i].name} 与 ${layout[j].name} 距离过近：${distance.toFixed(1)}`,
      );
    }
  }
});

test('positions are deterministic', () => {
  const again = buildLayout(people);
  assert.deepEqual(
    again.map((p) => [p.name, p.x, p.y]),
    layout.map((p) => [p.name, p.x, p.y]),
  );
});

test('buildLayout rejects the wrong number of people', () => {
  assert.throws(() => buildLayout(people.slice(0, 27)));
});

test('starPath returns a closed ten-point star', () => {
  const d = starPath(500, 500, 20);
  assert.match(d, /^M /);
  assert.match(d, / Z$/);
  assert.equal((d.match(/ L /g) || []).length, 9);
});

test('constellationPath connects each member once', () => {
  const team = layout.filter((p) => p.team === '冲刺队');
  const d = constellationPath(team);
  assert.match(d, /^M /);
  assert.equal((d.match(/ L /g) || []).length, team.length - 1);
  assert.equal(constellationPath([]), '');
});
