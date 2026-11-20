export const SKY = { width: 1000, height: 1000 };

export const STAR_RADIUS = 14;
export const TEACHER_RADIUS = 26;

export const GROUP_COLORS = {
  冲刺队: '#ff8a65',
  战神队: '#ffd166',
  超越队: '#7fd1ae',
  力量队: '#7fb7ff',
  志工团: '#ff9fb2',
  班主任: '#ffe9a8',
};

// 每颗星的位置与名字标签的偏移：dx/dy 为相对星心的屏幕偏移。
const TEAM_POINTS = {
  冲刺队: [
    { x: 150, y: 320, dx: 0, dy: 44 },
    { x: 240, y: 265, dx: 0, dy: -40 },
    { x: 320, y: 330, dx: 0, dy: -40 },
    { x: 310, y: 430, dx: 0, dy: 44 },
    { x: 185, y: 430, dx: -6, dy: 44 },
  ],
  战神队: [
    { x: 850, y: 320, dx: 0, dy: 44 },
    { x: 760, y: 265, dx: 0, dy: -40 },
    { x: 680, y: 330, dx: 0, dy: -40 },
    { x: 725, y: 435, dx: 0, dy: -40 },
    { x: 855, y: 455, dx: 0, dy: 44 },
  ],
  超越队: [
    { x: 140, y: 640, dx: 0, dy: 44 },
    { x: 235, y: 590, dx: 0, dy: -40 },
    { x: 320, y: 650, dx: 0, dy: -40 },
    { x: 315, y: 755, dx: 0, dy: 44 },
    { x: 195, y: 755, dx: -6, dy: 44 },
  ],
  力量队: [
    { x: 860, y: 640, dx: 0, dy: 44 },
    { x: 765, y: 590, dx: 62, dy: 0, anchor: 'start' },
    { x: 680, y: 650, dx: 0, dy: -40 },
    { x: 685, y: 755, dx: 0, dy: 44 },
    { x: 805, y: 755, dx: 6, dy: 44 },
  ],
};

// 志工团横跨星空中段，名字上下错开排布。
const VOLUNTEER_POINTS = [
  { x: 330, y: 500, dx: 0, dy: 44 },
  { x: 400, y: 485, dx: 0, dy: -44 },
  { x: 450, y: 520, dx: 0, dy: 44 },
  { x: 510, y: 475, dx: 0, dy: -44 },
  { x: 570, y: 520, dx: 0, dy: 44 },
  { x: 630, y: 480, dx: 14, dy: -44 },
  { x: 680, y: 500, dx: 0, dy: 44 },
];

const TEACHER_POINT = { x: 500, y: 140, dx: 0, dy: 66 };

const OUTER_COUNT = 20;
const MIDDLE_COUNT = 7;

function round(value) {
  return Math.round(value * 100) / 100;
}

export function starPath(cx, cy, outer, inner = outer * 0.42) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    points.push(`${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`);
  }
  return `M ${points.join(' L ')} Z`;
}

export function constellationPath(entries) {
  if (!entries.length) return '';
  return entries
    .map((entry, index) => `${index === 0 ? 'M' : 'L'} ${round(entry.x)} ${round(entry.y)}`)
    .join(' ');
}

function makeStar(person, point, radius) {
  return {
    ...person,
    x: point.x,
    y: point.y,
    labelX: point.x + (point.dx || 0),
    labelY: point.y + (point.dy || 0),
    anchor: point.anchor || 'middle',
    radius,
  };
}

export function buildLayout(people) {
  const classmates = people.filter((p) => p.group === 'classmate');
  const volunteers = people.filter((p) => p.group === 'volunteer');
  const teachers = people.filter((p) => p.group === 'teacher');

  if (classmates.length !== OUTER_COUNT) {
    throw new Error(`同学数量应为 ${OUTER_COUNT}，实际 ${classmates.length}`);
  }
  if (volunteers.length !== MIDDLE_COUNT) {
    throw new Error(`志工数量应为 ${MIDDLE_COUNT}，实际 ${volunteers.length}`);
  }
  if (teachers.length !== 1) {
    throw new Error(`班主任数量应为 1，实际 ${teachers.length}`);
  }

  const layout = [];

  for (const team of Object.keys(TEAM_POINTS)) {
    const members = classmates.filter((person) => person.team === team);
    if (members.length !== TEAM_POINTS[team].length) {
      throw new Error(`${team} 应有 ${TEAM_POINTS[team].length} 位同学，实际 ${members.length}`);
    }
    members.forEach((person, index) => {
      layout.push(makeStar(person, TEAM_POINTS[team][index], STAR_RADIUS));
    });
  }

  volunteers.forEach((person, index) => {
    layout.push(makeStar(person, VOLUNTEER_POINTS[index], STAR_RADIUS));
  });

  layout.push(makeStar(teachers[0], TEACHER_POINT, TEACHER_RADIUS));

  return layout;
}

export function groupOf(entry) {
  return entry.group === 'classmate' ? entry.team : entry.group === 'volunteer' ? '志工团' : '班主任';
}
