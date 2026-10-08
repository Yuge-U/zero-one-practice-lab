// Adapted rendering and compatibility helpers from ZERO ONE CANVAS.
// Source: Yuge-U/basketball-tactics-board@207c9417acf9fca7050b1f7cfd1d30fd8812cf93, 1_App/js/app.js.
// Viewer-only copy: no editor, authentication, storage, media loading or CANVAS side effects.
export function createCanvasCompat(snapshot) {
let state;
const viewport={scale:1};
const groupCache=new WeakMap();
let sequence=0;
const makeId=prefix=>prefix+'-viewer-'+(++sequence);
function getPlayerStyle(){const style=PLAYER_SIZES[normalizePlayerSize(state.playerSize)];const scale=Math.max(0.01,viewport.scale);const factor=typeof window!=='undefined'&&window.innerWidth<=600?0.78:1;return {radius:style.radius*factor/scale,fontSize:style.fontSize*factor/scale,lineWidth:style.lineWidth*factor/scale};}
function getBallRadius(){const factor=typeof window!=='undefined'&&window.innerWidth<=600?0.78:1;return BALL_SIZES[normalizeBallSize(state.ballSize)]*factor/Math.max(0.01,viewport.scale);}
const HALF_COURT = { width: 1050, height: 980 };
const FULL_COURT = { width: 1120, height: 600 };
const COURT_OUTER_MARGIN = 60;
const COPYRIGHT_TEXT = "© 2026 Yuge-U. All rights reserved.";
const V8_HALF_COURT = { width: 1280, height: 760 };
const V6_HALF_COURT = { width: 1400, height: 760 };
const PREVIOUS_HALF_COURT = { width: 980, height: 840 };
const V2_HALF_COURT = { width: 900, height: 840 };
const LEGACY_HALF_COURT = { width: 1000, height: 600 };
const LEGACY_FULL_COURT = { width: 1200, height: 700 };
const SCHEMA_VERSION = 18;
const PLAYER_SIZES = {
  large: { radius: 17, fontSize: 15, lineWidth: 3 },
  medium: { radius: 14, fontSize: 12, lineWidth: 2.5 },
  small: { radius: 11, fontSize: 10, lineWidth: 2 }
};

function normalizePlayerSize(value) {
  if (PLAYER_SIZES[value]) {
    return value;
  }
  return "medium";
}


const BALL_SIZES = {
  large: 13,
  medium: 10,
  small: 8
};

const CONE_WIDTH = 34;

const CONE_HEIGHT = 42;

const MIN_SPEED = 0.5;

const MAX_SPEED = 2;

const TEXT_FONT_SIZE = 34;

const TEXT_FONTS = {
  gothic: {
    label: "ゴシック",
    family: '"Noto Sans JP", "Yu Gothic UI", "Yu Gothic", sans-serif'
  },
  mincho: {
    label: "明朝",
    family: '"Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif'
  },
  rounded: {
    label: "丸ゴシック",
    family: '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif'
  },
  arial: {
    label: "Arial",
    family: 'Arial, Helvetica, sans-serif'
  },
  times: {
    label: "Times",
    family: '"Times New Roman", Times, serif'
  },
  handwritten: {
    label: "手書き風",
    family: '"Comic Sans MS", "Bradley Hand", "Yu Gothic", cursive'
  }
};

const LINE_COLORS = {
  black: "#111827",
  red: "#dc2626",
  blue: "#2563eb"
};

const MOVEMENT_LINE_TYPES = new Set(["move", "dribbleFree", "dribbleStraight", "screenFree", "screenStraight", "dribble", "screen"]);

const DRIBBLE_LINE_TYPES = new Set(["dribbleFree", "dribbleStraight", "dribble"]);

const SCREEN_LINE_TYPES = new Set(["screenFree", "screenStraight", "screen"]);

function migrateSnapshot(snapshot) {
  const migrated = JSON.parse(JSON.stringify(snapshot ?? {}));
  const sourceVersion = Number(migrated.schemaVersion ?? 1);
  const mode = migrated.courtMode === "full" ? "full" : "half";
  if (sourceVersion < SCHEMA_VERSION) {
    const previousHalfSize = sourceVersion >= 8 ? HALF_COURT : sourceVersion >= 7 ? V8_HALF_COURT : sourceVersion >= 4 ? V6_HALF_COURT : sourceVersion >= 3 ? PREVIOUS_HALF_COURT : sourceVersion >= 2 ? V2_HALF_COURT : LEGACY_HALF_COURT;
    const previousFullSize = sourceVersion >= 2 ? FULL_COURT : LEGACY_FULL_COURT;
    const oldSize = mode === "full" ? previousFullSize : previousHalfSize;
    const newSize = mode === "full" ? FULL_COURT : HALF_COURT;
    const scaleX = newSize.width / oldSize.width;
    const scaleY = newSize.height / oldSize.height;
    (migrated.steps ?? []).forEach((step) => {
      (step.players ?? []).forEach((player) => {
        player.x *= scaleX;
        player.y *= scaleY;
      });
      const savedBalls = Array.isArray(step.balls) && step.balls.length > 0 ? step.balls : step.ball ? [step.ball] : [];
      savedBalls.forEach((ball) => {
        ball.x *= scaleX;
        ball.y *= scaleY;
      });
      (step.cones ?? []).forEach((cone) => {
        cone.x *= scaleX;
        cone.y *= scaleY;
      });
      (step.lines ?? []).forEach((line) => {
        if (line.start) {
          line.start.x *= scaleX;
          line.start.y *= scaleY;
        }
        if (line.end) {
          line.end.x *= scaleX;
          line.end.y *= scaleY;
        }
        (line.points ?? []).forEach((point) => {
          point.x *= scaleX;
          point.y *= scaleY;
        });
      });
      (step.texts ?? []).forEach((textItem) => {
        textItem.x *= scaleX;
        textItem.y *= scaleY;
        textItem.fontSize = Number(textItem.fontSize ?? TEXT_FONT_SIZE) * Math.min(scaleX, scaleY);
      });
    });
  }
  (migrated.steps ?? []).forEach((step) => {
    const balls = normalizeStepBalls(step);
    step.cones = Array.isArray(step.cones) ? step.cones : [];
    step.cones.forEach((cone) => {
      cone.color = cone.color === "blue" ? "blue" : "red";
    });
    step.lines = Array.isArray(step.lines) ? step.lines : [];
    step.texts = Array.isArray(step.texts) ? step.texts : [];
    step.texts.forEach((textItem) => {
      textItem.text = String(textItem.text ?? "テキスト");
      textItem.color = LINE_COLORS[textItem.color] ? textItem.color : "black";
      textItem.fontSize = Number.isFinite(Number(textItem.fontSize)) ? Number(textItem.fontSize) : TEXT_FONT_SIZE;
      textItem.font = normalizeTextFont(textItem.font);
      textItem.outline = textItem.outline !== false;
      textItem.scale = Math.max(0.25, Math.min(5, Number(textItem.scale) || 1));
      textItem.rotation = Number(textItem.rotation) || 0;
    });
    step.media = Array.isArray(step.media) ? step.media : [];
    step.lines.forEach((line) => {
      if (line.type === "dribble") {
        line.type = "dribbleFree";
      }
      if (line.type === "screen") {
        line.type = "screenStraight";
      }
      line.color = LINE_COLORS[line.color] ? line.color : "black";
      if (isBallSequenceLineType(line.type)) {
        line.ballId = balls.some((ball) => ball.id === line.ballId) ? line.ballId : balls[0].id;
      }
    });
    assignDefaultPlayOrders(step, true);
  });
  migrated.activeLineColor = LINE_COLORS[migrated.activeLineColor] ? migrated.activeLineColor : "black";
  migrated.activeTextFont = normalizeTextFont(migrated.activeTextFont);
  migrated.activeTextOutline = migrated.activeTextOutline !== false;
  migrated.playerSize = normalizePlayerSize(migrated.playerSize);
  migrated.ballSize = normalizeBallSize(migrated.ballSize);
  migrated.movementSpeed = normalizeSpeed(migrated.movementSpeed);
  migrated.playbackSpeed = normalizeSpeed(migrated.playbackSpeed);
  migrated.showMovementLines = migrated.showMovementLines !== false;
  migrated.courtRotation = normalizeCourtRotation(migrated.courtRotation);
  migrated.libraryMeta = migrated.libraryMeta ?? { folder: "Shared", tags: [], favorite: false };
  migrated.libraryMeta.folder = String(migrated.libraryMeta.folder || "Shared");
  migrated.libraryMeta.tags = Array.isArray(migrated.libraryMeta.tags) ? migrated.libraryMeta.tags.map(String) : [];
  migrated.libraryMeta.favorite = Boolean(migrated.libraryMeta.favorite);
  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}

function normalizeBallSize(value) {
  return BALL_SIZES[value] ? value : "medium";
}

function normalizeSpeed(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(parsed * 4) / 4));
}

function normalizeTextFont(value) {
  return TEXT_FONTS[value] ? value : "gothic";
}

function normalizeCourtRotation(value) {
  const normalized = ((Number(value) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function isMovementLineType(type) {
  return MOVEMENT_LINE_TYPES.has(type);
}

function isDribbleLineType(type) {
  return DRIBBLE_LINE_TYPES.has(type);
}

function isScreenLineType(type) {
  return SCREEN_LINE_TYPES.has(type);
}

function isAnimatedLineType(type) {
  return type === "pass" || isMovementLineType(type);
}

function isBallSequenceLineType(type) {
  return type === "pass" || isDribbleLineType(type);
}

function normalizePlayOrder(value, fallback = 1) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1) {
    return parsed;
  }
  return fallback;
}

function assignDefaultPlayOrders(step, onlyMissing = false) {
  if (!step || !Array.isArray(step.lines)) {
    return;
  }
  const nextBallOrder = {};
  const lastPlayerOrder = {};
  step.lines.forEach((line) => {
    if (!isAnimatedLineType(line.type)) {
      return;
    }
    const nextPlayerOrder = line.playerId ? (lastPlayerOrder[line.playerId] ?? 0) + 1 : 1;
    const ballId = getLineBallId(step, line);
    const nextOrderForBall = nextBallOrder[ballId] ?? 1;
    let suggestedOrder = 1;
    if (line.type === "pass") {
      suggestedOrder = nextOrderForBall;
    } else if (isDribbleLineType(line.type)) {
      suggestedOrder = Math.max(nextOrderForBall, nextPlayerOrder);
    } else {
      suggestedOrder = Math.max(1, nextPlayerOrder);
    }
    const keepExisting = onlyMissing && Number.isInteger(Number(line.playOrder)) && Number(line.playOrder) >= 1;
    line.playOrder = keepExisting ? Number(line.playOrder) : suggestedOrder;
    if (isBallSequenceLineType(line.type)) {
      nextBallOrder[ballId] = Math.max(nextOrderForBall, line.playOrder + 1);
    }
    if (line.playerId && isMovementLineType(line.type)) {
      lastPlayerOrder[line.playerId] = Math.max(lastPlayerOrder[line.playerId] ?? 0, line.playOrder);
    }
  });
}

function getOrderedActionGroups(step) {
  const actions = (step?.lines ?? []).map((line, index) => ({ line, index })).filter(({ line }) => line.type === "pass" || (line.playerId && isMovementLineType(line.type)));
  const grouped = new Map();
  actions.forEach((action) => {
    const order = normalizePlayOrder(action.line.playOrder, 1);
    if (!grouped.has(order)) {
      grouped.set(order, []);
    }
    grouped.get(order).push(action);
  });
  return [...grouped.entries()].sort((left, right) => left[0] - right[0]).map(([order, items]) => ({ order, items: items.sort((left, right) => left.index - right.index) }));
}

function normalizeStepBalls(step) {
  if (!step) {
    return [];
  }
  const source = Array.isArray(step.balls) && step.balls.length > 0
    ? step.balls
    : step.ball
      ? [step.ball]
      : [{ id: "ball", x: 0, y: 0 }];
  const usedIds = new Set();
  const balls = source.map((ball, index) => {
    const normalizedBall = ball && typeof ball === "object" ? ball : {};
    let id = String(normalizedBall.id || (index === 0 ? "ball" : makeId("ball")));
    if (usedIds.has(id)) {
      id = makeId("ball");
    }
    usedIds.add(id);
    normalizedBall.id = id;
    normalizedBall.label = String(normalizedBall.label || index + 1);
    normalizedBall.x = Number(normalizedBall.x) || 0;
    normalizedBall.y = Number(normalizedBall.y) || 0;
    return normalizedBall;
  });
  step.balls = balls;
  step.ball = balls[0];
  return balls;
}

function getStepBalls(step) {
  return normalizeStepBalls(step);
}

function getPrimaryBall(step) {
  return getStepBalls(step)[0];
}

function getLineBallId(step, line) {
  const balls = getStepBalls(step);
  const requestedId = String(line?.ballId || "");
  return balls.some((ball) => ball.id === requestedId) ? requestedId : balls[0]?.id || "ball";
}

function getBaseCourtSize(mode = state.courtMode) {
  if (mode === "full") {
    return FULL_COURT;
  }
  return HALF_COURT;
}

function getCourtSize() {
  const baseSize = getBaseCourtSize();
  const rotation = normalizeCourtRotation(state.courtRotation);
  if (rotation === 90 || rotation === 270) {
    return { width: baseSize.height, height: baseSize.width };
  }
  return baseSize;
}

function getCourtDisplaySize() {
  const size = getCourtSize();
  return {
    width: size.width + COURT_OUTER_MARGIN * 2,
    height: size.height + COURT_OUTER_MARGIN * 2
  };
}

function getLinePoints(line) {
  if (line.points?.length >= 2) {
    return line.points.map((point) => ({ ...point }));
  }
  return [{ ...line.start }, { ...line.end }];
}

function getBallPositionBesidePlayer(point) {
  const ballRadius = getBallRadius();
  return { x: point.x + ballRadius + 8, y: point.y - ballRadius - 4 };
}

function interpolatePoint(start, end, progress) {
  const ratio = Math.max(0, Math.min(1, progress));
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
}

function calculateStepStateAfterGroups(step, completedGroupCount) {
  const players = {};
  step.players.forEach((player) => {
    players[player.id] = { x: player.x, y: player.y };
  });
  const balls = {};
  getStepBalls(step).forEach((ball) => {
    balls[ball.id] = { x: ball.x, y: ball.y };
  });
  const groups = getOrderedActionGroups(step);
  const safeCount = Math.max(0, Math.min(groups.length, Number(completedGroupCount) || 0));
  groups.slice(0, safeCount).forEach((group) => {
    group.items.forEach(({ line }) => {
      if (line.type === "pass") {
        balls[getLineBallId(step, line)] = { ...line.end };
        return;
      }
      if (!line.playerId || !isMovementLineType(line.type)) {
        return;
      }
      const points = getLinePoints(line);
      const end = points[points.length - 1];
      players[line.playerId] = { ...end };
      if (isDribbleLineType(line.type)) {
        balls[getLineBallId(step, line)] = getBallPositionBesidePlayer(end);
      }
    });
  });
  const primaryBallId = getPrimaryBall(step).id;
  return { players, balls, ball: { ...balls[primaryBallId] }, groups };
}

function buildActionPath(currentPoint, line) {
  const linePoints = getLinePoints(line);
  if (line.type === "pass") {
    return [{ ...currentPoint }, { ...line.end }];
  }
  const points = [{ ...currentPoint }];
  if (distance(currentPoint, linePoints[0]) < 10) {
    points.push(...linePoints.slice(1));
  } else {
    points.push(...linePoints);
  }
  return points;
}

function calculateActionDuration(line, path) {
  const length = pathLength(path);
  const speed = normalizeSpeed(state.movementSpeed);
  if (line.type === "pass") {
    return Math.max(220, Math.min(2600, Math.max(450, Math.min(1300, length * 1.7)) / speed));
  }
  return Math.max(350, Math.min(4800, Math.max(700, Math.min(2400, length * 3.2)) / speed));
}

function easeInOut(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function drawCourt(ctx) {
  const size = getBaseCourtSize();
  const rotation = normalizeCourtRotation(state.courtRotation);
  ctx.save();
  if (rotation === 90) {
    ctx.translate(size.height, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(size.width, size.height);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, size.width);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.fillStyle = "#d7a760";
  ctx.fillRect(0, 0, size.width, size.height);
  drawWoodPattern(ctx, size);
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeRect(3, 3, size.width - 6, size.height - 6);
  if (state.courtMode === "half") {
    drawHalfCourtFiba(ctx, size);
  } else {
    drawFullCourtFiba(ctx, size);
  }
  ctx.restore();
}

function drawWoodPattern(ctx, size) {
  ctx.strokeStyle = "rgba(91, 59, 25, 0.12)";
  ctx.lineWidth = 1;
  const spacing = state.courtMode === "half" ? size.width / 15 : size.height / 15;
  if (state.courtMode === "half") {
    for (let x = 0; x <= size.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
  } else {
    for (let y = 0; y <= size.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }
  }
}

function drawHalfCourtFiba(ctx, size) {
  const unitX = size.width / 15;
  const unitY = size.height / 14;
  const symbolUnit = Math.min(unitX, unitY);
  const centerX = size.width / 2;
  const hoopY = 1.575 * unitY;
  const boardY = 1.2 * unitY;
  const freeThrowY = 5.8 * unitY;
  const keyWidth = 4.9 * unitX;
  const freeThrowRadiusX = 1.8 * unitX;
  const freeThrowRadiusY = 1.8 * unitY;
  const threeRadiusX = 6.75 * unitX;
  const threeRadiusY = 6.75 * unitY;
  const leftCornerX = 0.9 * unitX;
  const rightCornerX = size.width - 0.9 * unitX;
  const cornerDistanceMeters = 7.5 - 0.9;
  const cornerJoinMeters = 1.575 + Math.sqrt(Math.max(0, 6.75 ** 2 - cornerDistanceMeters ** 2));
  const cornerJoinY = cornerJoinMeters * unitY;
  const cornerAngle = Math.atan2(cornerJoinMeters - 1.575, cornerDistanceMeters);
  ctx.strokeRect(centerX - keyWidth / 2, 0, keyWidth, freeThrowY);
  ctx.beginPath();
  ctx.moveTo(centerX - 0.9 * unitX, boardY);
  ctx.lineTo(centerX + 0.9 * unitX, boardY);
  ctx.stroke();
  drawHoop(ctx, centerX, hoopY, symbolUnit);
  ctx.beginPath();
  ctx.ellipse(centerX, hoopY, 1.25 * unitX, 1.25 * unitY, 0, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(centerX, freeThrowY, freeThrowRadiusX, freeThrowRadiusY, 0, 0, Math.PI);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.ellipse(centerX, freeThrowY, freeThrowRadiusX, freeThrowRadiusY, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(leftCornerX, 0);
  ctx.lineTo(leftCornerX, cornerJoinY);
  ctx.moveTo(rightCornerX, 0);
  ctx.lineTo(rightCornerX, cornerJoinY);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(centerX, hoopY, threeRadiusX, threeRadiusY, 0, cornerAngle, Math.PI - cornerAngle);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, size.height - 3);
  ctx.lineTo(size.width, size.height - 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(centerX, size.height, 1.8 * unitX, 1.8 * unitY, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  drawHalfLaneMarks(ctx, centerX, keyWidth, unitX, unitY);
}

function drawHalfLaneMarks(ctx, centerX, keyWidth, unitX, unitY) {
  const marks = [1.75, 2.65, 3.65, 4.65];
  const leftX = centerX - keyWidth / 2;
  const rightX = centerX + keyWidth / 2;
  marks.forEach((meter) => {
    const y = meter * unitY;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(leftX - 0.18 * unitX, y);
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX + 0.18 * unitX, y);
    ctx.stroke();
  });
}

function drawFullCourtFiba(ctx, size) {
  const unit = size.width / 28;
  const centerY = size.height / 2;
  ctx.beginPath();
  ctx.moveTo(size.width / 2, 0);
  ctx.lineTo(size.width / 2, size.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size.width / 2, centerY, 1.8 * unit, 0, Math.PI * 2);
  ctx.stroke();
  drawFullBasketEnd(ctx, "left", size, unit);
  drawFullBasketEnd(ctx, "right", size, unit);
}

function drawFullBasketEnd(ctx, side, size, unit) {
  const isLeft = side === "left";
  const centerY = size.height / 2;
  const hoopX = isLeft ? 1.575 * unit : size.width - 1.575 * unit;
  const boardX = isLeft ? 1.2 * unit : size.width - 1.2 * unit;
  const freeThrowX = isLeft ? 5.8 * unit : size.width - 5.8 * unit;
  const keyWidth = 4.9 * unit;
  const keyX = isLeft ? 0 : freeThrowX;
  const keyLength = 5.8 * unit;
  ctx.strokeRect(keyX, centerY - keyWidth / 2, keyLength, keyWidth);
  ctx.beginPath();
  ctx.moveTo(boardX, centerY - 0.9 * unit);
  ctx.lineTo(boardX, centerY + 0.9 * unit);
  ctx.stroke();
  drawHoop(ctx, hoopX, centerY, unit);
  ctx.beginPath();
  if (isLeft) {
    ctx.arc(hoopX, centerY, 1.25 * unit, -Math.PI / 2, Math.PI / 2);
  } else {
    ctx.arc(hoopX, centerY, 1.25 * unit, Math.PI / 2, Math.PI * 1.5);
  }
  ctx.stroke();
  drawFullFreeThrowCircle(ctx, freeThrowX, centerY, 1.8 * unit, isLeft);
  drawFullThreePoint(ctx, hoopX, centerY, isLeft, size, unit);
  drawFullLaneMarks(ctx, isLeft, centerY, keyWidth, unit, size);
}

function drawFullFreeThrowCircle(ctx, x, y, radius, isLeft) {
  ctx.beginPath();
  ctx.arc(x, y, radius, isLeft ? -Math.PI / 2 : Math.PI / 2, isLeft ? Math.PI / 2 : Math.PI * 1.5);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(x, y, radius, isLeft ? Math.PI / 2 : -Math.PI / 2, isLeft ? Math.PI * 1.5 : Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

function drawFullThreePoint(ctx, hoopX, centerY, isLeft, size, unit) {
  const radius = 6.75 * unit;
  const topY = 0.9 * unit;
  const bottomY = size.height - 0.9 * unit;
  const joinOffset = Math.sqrt(Math.max(0, radius ** 2 - (centerY - topY) ** 2));
  const joinX = isLeft ? hoopX + joinOffset : hoopX - joinOffset;
  ctx.beginPath();
  ctx.moveTo(isLeft ? 0 : size.width, topY);
  ctx.lineTo(joinX, topY);
  ctx.moveTo(isLeft ? 0 : size.width, bottomY);
  ctx.lineTo(joinX, bottomY);
  ctx.stroke();
  const topAngle = Math.atan2(topY - centerY, joinX - hoopX);
  const bottomAngle = Math.atan2(bottomY - centerY, joinX - hoopX);
  ctx.beginPath();
  if (isLeft) {
    ctx.arc(hoopX, centerY, radius, topAngle, bottomAngle);
  } else {
    ctx.arc(hoopX, centerY, radius, topAngle, bottomAngle, true);
  }
  ctx.stroke();
}

function drawFullLaneMarks(ctx, isLeft, centerY, keyWidth, unit, size) {
  const marks = [1.75, 2.65, 3.65, 4.65];
  const topY = centerY - keyWidth / 2;
  const bottomY = centerY + keyWidth / 2;
  marks.forEach((meter) => {
    const x = isLeft ? meter * unit : size.width - meter * unit;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, topY - 0.18 * unit);
    ctx.moveTo(x, bottomY);
    ctx.lineTo(x, bottomY + 0.18 * unit);
    ctx.stroke();
  });
}

function drawHoop(ctx, x, y, unit) {
  ctx.save();
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 0.225 * unit, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCone(ctx, cone) {
  ctx.save();
  const fillColor = cone.color === "blue" ? "#2563eb" : "#dc2626";
  const strokeColor = cone.color === "blue" ? "#1e3a8a" : "#7f1d1d";
  ctx.beginPath();
  ctx.moveTo(cone.x, cone.y - CONE_HEIGHT / 2);
  ctx.lineTo(cone.x + CONE_WIDTH / 2, cone.y + CONE_HEIGHT / 2 - 7);
  ctx.lineTo(cone.x - CONE_WIDTH / 2, cone.y + CONE_HEIGHT / 2 - 7);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cone.x - CONE_WIDTH * 0.22, cone.y + 2);
  ctx.lineTo(cone.x + CONE_WIDTH * 0.22, cone.y + 2);
  ctx.lineTo(cone.x + CONE_WIDTH * 0.31, cone.y + 9);
  ctx.lineTo(cone.x - CONE_WIDTH * 0.31, cone.y + 9);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.fillStyle = fillColor;
  ctx.fillRect(cone.x - CONE_WIDTH * 0.65, cone.y + CONE_HEIGHT / 2 - 8, CONE_WIDTH * 1.3, 9);
  ctx.strokeRect(cone.x - CONE_WIDTH * 0.65, cone.y + CONE_HEIGHT / 2 - 8, CONE_WIDTH * 1.3, 9);
  ctx.restore();
}

function drawPlayer(ctx, player, isActive = false) {
  const isOffense = player.side === "offense";
  const playerStyle = getPlayerStyle();
  ctx.fillStyle = isActive ? (isOffense ? "#60a5fa" : "#fee2e2") : (isOffense ? "#1d4ed8" : "#ffffff");
  ctx.strokeStyle = isActive ? (isOffense ? "#1e40af" : "#ef4444") : (isOffense ? "#172554" : "#b91c1c");
  ctx.lineWidth = playerStyle.lineWidth;
  ctx.beginPath();
  ctx.arc(player.x, player.y, playerStyle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isOffense ? "#ffffff" : "#b91c1c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${playerStyle.fontSize}px sans-serif`;
  const markerText = isOffense ? player.label : `×${player.label}`;
  ctx.fillText(markerText, player.x, player.y + 1);
}

function drawBall(ctx, ball, label = "") {
  const ballRadius = getBallRadius();
  ctx.save();
  const ballFill = ctx.createRadialGradient(
    ball.x - ballRadius * 0.36,
    ball.y - ballRadius * 0.42,
    ballRadius * 0.08,
    ball.x,
    ball.y,
    ballRadius * 1.08
  );
  ballFill.addColorStop(0, "#fdba74");
  ballFill.addColorStop(0.48, "#f97316");
  ballFill.addColorStop(1, "#c2410c");
  ctx.fillStyle = ballFill;
  ctx.strokeStyle = "#431407";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, Math.max(1, ballRadius - 1.2), 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "#57210f";
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y - ballRadius);
  ctx.lineTo(ball.x, ball.y + ballRadius);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ball.x - ballRadius, ball.y);
  ctx.lineTo(ball.x + ballRadius, ball.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y - ballRadius);
  ctx.bezierCurveTo(
    ball.x - ballRadius * 0.78,
    ball.y - ballRadius * 0.62,
    ball.x - ballRadius * 0.78,
    ball.y + ballRadius * 0.62,
    ball.x,
    ball.y + ballRadius
  );
  ctx.moveTo(ball.x, ball.y - ballRadius);
  ctx.bezierCurveTo(
    ball.x + ballRadius * 0.78,
    ball.y - ballRadius * 0.62,
    ball.x + ballRadius * 0.78,
    ball.y + ballRadius * 0.62,
    ball.x,
    ball.y + ballRadius
  );
  ctx.stroke();
  ctx.restore();
  if (label) {
    const badgeRadius = Math.max(6, ballRadius * 0.58);
    const badgeX = ball.x + ballRadius * 0.78;
    const badgeY = ball.y - ballRadius * 0.78;
    ctx.beginPath();
    ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 1.3 / Math.max(0.01, viewport.scale));
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.max(8, badgeRadius * 1.25)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label), badgeX, badgeY + 0.5);
  }
  ctx.restore();
}

function drawCourtText(ctx, textItem) {
  ctx.save();
  const fontSize = Number(textItem.fontSize ?? TEXT_FONT_SIZE);
  ctx.translate(textItem.x, textItem.y);
  ctx.rotate(Number(textItem.rotation) || 0);
  const scale = Math.max(0.25, Math.min(5, Number(textItem.scale) || 1));
  ctx.scale(scale, scale);
  const fontFamily = TEXT_FONTS[normalizeTextFont(textItem.font)].family;
  ctx.font = `800 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (textItem.outline !== false) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = Math.max(5, fontSize * 0.22);
    ctx.lineJoin = "round";
    ctx.strokeText(String(textItem.text ?? ""), 0, 0);
  }
  ctx.fillStyle = LINE_COLORS[textItem.color] ?? LINE_COLORS.black;
  ctx.fillText(String(textItem.text ?? ""), 0, 0);
  ctx.restore();
}

function drawTacticLine(ctx, line) {
  if (!line.start || !line.end) {
    return;
  }
  const points = line.points?.length >= 2 ? line.points : [line.start, line.end];
  ctx.save();
  ctx.globalAlpha = line.preview ? 0.62 : 1;
  const lineColor = LINE_COLORS[line.color] ?? LINE_COLORS.black;
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.lineWidth = line.type === "free" ? 5 : 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (line.type === "free") {
    drawSmoothPath(ctx, points);
    ctx.restore();
    return;
  }
  if (line.type === "pass") {
    ctx.setLineDash([18, 14]);
  }
  if (isDribbleLineType(line.type)) {
    drawWavyPathArrow(ctx, points);
    ctx.restore();
    return;
  }
  if (isScreenLineType(line.type)) {
    drawScreenPath(ctx, points);
    ctx.restore();
    return;
  }
  if (line.type === "move") {
    drawPathArrow(ctx, points);
    ctx.restore();
    return;
  }
  drawArrow(ctx, line.start, line.end);
  ctx.restore();
}

function drawSmoothPath(ctx, points) {
  if (!points || points.length < 2) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const beforeLast = points[points.length - 2];
    const last = points[points.length - 1];
    ctx.quadraticCurveTo(beforeLast.x, beforeLast.y, last.x, last.y);
  }
  ctx.stroke();
}

function drawPathArrow(ctx, points) {
  drawSmoothPath(ctx, points);
  const end = points[points.length - 1];
  const previous = points[Math.max(0, points.length - 2)];
  const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
  drawArrowHead(ctx, end, angle);
}

function drawWavyPathArrow(ctx, points) {
  const samples = resamplePath(points, 7);
  if (samples.length < 2) {
    drawPathArrow(ctx, points);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(samples[0].x, samples[0].y);
  samples.forEach((sample, index) => {
    if (index === 0) {
      return;
    }
    const previous = samples[index - 1];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const offset = Math.sin(index * 0.9) * 10;
    const x = sample.x + normalX * offset;
    const y = sample.y + normalY * offset;
    ctx.lineTo(x, y);
  });
  ctx.stroke();
  const end = points[points.length - 1];
  const previous = points[Math.max(0, points.length - 2)];
  const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
  drawArrowHead(ctx, end, angle);
}

function resamplePath(points, spacing) {
  if (!points || points.length < 2) {
    return points ?? [];
  }
  spacing = Math.max(spacing, pathLength(points) / 2048);
  const result = [{ ...points[0] }];
  let previous = { ...points[0] };
  for (let index = 1; index < points.length; index += 1) {
    const target = points[index];
    let segmentLength = distance(previous, target);
    while (segmentLength >= spacing) {
      const ratio = spacing / segmentLength;
      const x = previous.x + (target.x - previous.x) * ratio;
      const y = previous.y + (target.y - previous.y) * ratio;
      previous = { x, y };
      result.push(previous);
      segmentLength = distance(previous, target);
    }
    previous = { ...target };
  }
  if (distance(result[result.length - 1], points[points.length - 1]) > 1) {
    result.push({ ...points[points.length - 1] });
  }
  return result;
}

function drawArrowHead(ctx, end, angle) {
  ctx.setLineDash([]);
  const headLength = 24;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawArrow(ctx, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  drawArrowHead(ctx, end, angle);
}

function drawScreenPath(ctx, points) {
  if (!points || points.length < 2) {
    return;
  }
  drawSmoothPath(ctx, points);
  const end = points[points.length - 1];
  const previous = points[Math.max(0, points.length - 2)];
  const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
  const cap = 24;
  ctx.beginPath();
  ctx.moveTo(end.x + Math.cos(angle + Math.PI / 2) * cap, end.y + Math.sin(angle + Math.PI / 2) * cap);
  ctx.lineTo(end.x + Math.cos(angle - Math.PI / 2) * cap, end.y + Math.sin(angle - Math.PI / 2) * cap);
  ctx.stroke();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < (points?.length ?? 0); index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}
state=migrateSnapshot(snapshot);
const cachedGroups=step=>{if(!groupCache.has(step))groupCache.set(step,getOrderedActionGroups(step));return groupCache.get(step);};
return {
 snapshot:state, dimensions:()=>getCourtDisplaySize(), setScale:value=>{viewport.scale=value;},
 groups:cachedGroups, after:calculateStepStateAfterGroups, path:buildActionPath,
 duration:calculateActionDuration, ballId:getLineBallId, isMove:isMovementLineType,
 isDribble:isDribbleLineType, beside:getBallPositionBesidePlayer, ease:easeInOut,
 background(ctx,step,showLines){drawCourt(ctx);for(const line of step.lines)if(showLines||line.type!=='move')drawTacticLine(ctx,line);for(const cone of step.cones)drawCone(ctx,cone);},
 foreground(ctx,step){for(const text of step.texts)drawCourtText(ctx,text);},
 markers(ctx,step,positions){for(const side of ['defense','offense'])for(const player of step.players)if(player.side===side)drawPlayer(ctx,{...player,...positions.players[player.id]});for(const ball of step.balls)drawBall(ctx,{...ball,...positions.balls[ball.id]},step.balls.length>1?ball.label:'');},
};
}
