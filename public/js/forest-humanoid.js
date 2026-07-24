export const FOREST_HUMANOID_PRESENTATION_VERSION = 3;
export const FOREST_HUMANOID_RUN_THRESHOLD = 112;
export const FOREST_HUMANOID_MAX_RUN_CYCLES_PER_SECOND = 2.8;

export const FOREST_HUMANOID_PROFILES = Object.freeze({
  player: Object.freeze({
    id: 'player', skin: '#e3b98c', skinShadow: '#b9785d', hair: '#63412f',
    hairHighlight: '#87583a', headwear: '#dc793c', headwearShadow: '#a94e31',
    headwearHighlight: '#f09a4a', torso: '#39749b', torsoShadow: '#28526f',
    torsoHighlight: '#5593b7', legs: '#25282d', legHighlight: '#3b3e46',
    shoes: '#a63f38', shoeHighlight: '#d05a45', patch: null
  }),
  visitor: Object.freeze({
    id: 'visitor', skin: '#c99572', skinShadow: '#98624f', hair: '#b8afa0',
    hairHighlight: '#d0c8ba', headwear: '#536947', headwearShadow: '#344938',
    headwearHighlight: '#70835d', torso: '#69784b', torsoShadow: '#485638',
    torsoHighlight: '#879563', legs: '#4b4037', legHighlight: '#66584a',
    shoes: '#59402f', shoeHighlight: '#78563c', patch: '#a9824f', staff: '#6b4b32'
  })
});

const FACINGS = Object.freeze(['up', 'right', 'down', 'left']);

export function createForestHumanoidMotion(facing = 'down') {
  const facingRadians = facing === 'right' ? 0 : facing === 'up' ? -Math.PI / 2
    : facing === 'left' ? Math.PI : Math.PI / 2;
  return {
    facingRadians: FACINGS.includes(facing) ? facingRadians : Math.PI / 2,
    targetFacingRadians: FACINGS.includes(facing) ? facingRadians : Math.PI / 2,
    speed: 0,
    distance: 0,
    stepPhase: 0
  };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function turnToward(current, target, maximumTurn) {
  const difference = normalizeAngle(target - current);
  if (Math.abs(difference) <= maximumTurn) return target;
  return normalizeAngle(current + (Math.sign(difference) * maximumTurn));
}

export function forestHumanoidCadence(speed) {
  if (!Number.isFinite(speed) || speed <= 1) return 0;
  if (speed < FOREST_HUMANOID_RUN_THRESHOLD) {
    return Math.min(2.4, 0.7 + (Math.sqrt(speed / FOREST_HUMANOID_RUN_THRESHOLD) * 1.75));
  }
  return Math.min(
    FOREST_HUMANOID_MAX_RUN_CYCLES_PER_SECOND,
    2.4 + ((speed - FOREST_HUMANOID_RUN_THRESHOLD) / 95)
  );
}

export function forestHumanoidFootTravel(stepPhase) {
  const cycle = ((stepPhase / (Math.PI * 2)) % 1 + 1) % 1;
  const plantedFraction = 0.62;
  if (cycle < plantedFraction) return 1 - ((cycle / plantedFraction) * 2);
  const recovery = (cycle - plantedFraction) / (1 - plantedFraction);
  const eased = recovery * recovery * (3 - (2 * recovery));
  return -1 + (eased * 2);
}

export function advanceForestHumanoidMotion(motion, {
  from, to, direction = null, elapsedSeconds, reducedMotion = false
}) {
  const deltaX = Number(to?.worldX) - Number(from?.worldX);
  const deltaY = Number(to?.worldY) - Number(from?.worldY);
  const travelled = Number.isFinite(deltaX) && Number.isFinite(deltaY)
    ? Math.hypot(deltaX, deltaY) : 0;
  const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const speed = elapsed ? travelled / elapsed : 0;
  const distance = motion.distance + travelled;
  const cadence = forestHumanoidCadence(speed);
  const intendedX = Number(direction?.x);
  const intendedY = Number(direction?.y);
  const hasIntendedDirection = Number.isFinite(intendedX) && Number.isFinite(intendedY)
    && Math.hypot(intendedX, intendedY) > 0.01;
  const hasTravelDirection = travelled > 0.01;
  const targetFacingRadians = hasIntendedDirection ? Math.atan2(intendedY, intendedX)
    : hasTravelDirection ? Math.atan2(deltaY, deltaX) : motion.targetFacingRadians;
  const maximumTurn = elapsed * (speed >= FOREST_HUMANOID_RUN_THRESHOLD ? 11 : 8);
  return {
    facingRadians: reducedMotion ? targetFacingRadians
      : turnToward(motion.facingRadians, targetFacingRadians, maximumTurn),
    targetFacingRadians,
    speed: reducedMotion ? 0 : speed,
    distance,
    stepPhase: reducedMotion ? 0
      : motion.stepPhase + (elapsed * cadence * Math.PI * 2)
  };
}

export function forestHumanoidGait(motion, reducedMotion = false) {
  const moving = !reducedMotion && motion.speed > 1;
  const running = moving && motion.speed >= FOREST_HUMANOID_RUN_THRESHOLD;
  const signal = moving ? Math.sin(motion.stepPhase) : 0;
  const stride = running ? 4 : 3;
  return {
    moving,
    running,
    bob: moving && Math.abs(Math.cos(motion.stepPhase)) > 0.72 ? 1 : 0,
    leftForward: moving ? forestHumanoidFootTravel(motion.stepPhase) * stride : 0,
    rightForward: moving
      ? forestHumanoidFootTravel(motion.stepPhase + Math.PI) * stride : 0,
    leftArm: -signal * (running ? 3 : 2),
    rightArm: signal * (running ? 3 : 2)
  };
}

function paintPixelLimb(context, fromX, fromY, toX, toY, color, thickness = 3) {
  context.fillStyle = color;
  for (let step = 0; step <= 3; step += 1) {
    const progress = step / 3;
    const x = Math.round(fromX + ((toX - fromX) * progress));
    const y = Math.round(fromY + ((toY - fromY) * progress));
    context.fillRect(x - Math.floor(thickness / 2), y - 1, thickness, 3);
  }
}

function paintPixelJointedLeg(context, hip, knee, foot, color) {
  paintPixelLimb(context, hip.x, hip.y, knee.x, knee.y, color, 4);
  paintPixelLimb(context, knee.x, knee.y, foot.x, foot.y, color, 4);
  context.fillStyle = color;
  context.fillRect(Math.round(knee.x) - 2, Math.round(knee.y) - 1, 4, 3);
}

export function paintForestHumanoid(context, x, y, {
  profile = FOREST_HUMANOID_PROFILES.player,
  motion = createForestHumanoidMotion(),
  reducedMotion = false,
  resting = false
} = {}) {
  const gait = forestHumanoidGait(motion, reducedMotion || resting);
  const bob = resting ? 0 : gait.bob;
  const forwardX = Math.cos(motion.facingRadians);
  const forwardY = Math.sin(motion.facingRadians);
  const lateralX = -forwardY;
  const lateralY = forwardX;
  const frontness = Math.abs(forwardY);
  const rearFacing = forwardY < -0.45;
  const sideFacing = Math.abs(forwardX) > 0.55;
  const bodyWidth = 11 + Math.round(frontness * 3);
  const headWidth = 10 + Math.round(frontness * 3);
  const footY = y - bob;

  context.fillStyle = 'rgba(22, 35, 31, 0.27)';
  context.fillRect(x - (resting ? 8 : 9), y - 3, resting ? 16 : 18, 4);

  const legs = [
    { side: -3.2, forward: gait.leftForward },
    { side: 3.2, forward: gait.rightForward }
  ].map(leg => ({
    hipX: x + (lateralX * leg.side),
    hipY: footY - 10 + (lateralY * leg.side * 0.25),
    footX: x + (lateralX * leg.side) + (forwardX * leg.forward),
    footY: footY - 2 + (lateralY * leg.side * 0.3) + (forwardY * leg.forward * 0.55),
    rearBend: Math.min(1.6, Math.abs(leg.forward) * 0.4)
  })).sort((left, right) => left.footY - right.footY);
  legs.forEach((leg) => {
    const knee = {
      x: ((leg.hipX + leg.footX) / 2) - (forwardX * leg.rearBend),
      y: ((leg.hipY + leg.footY) / 2) - (forwardY * leg.rearBend * 0.55)
    };
    paintPixelJointedLeg(context, { x: leg.hipX, y: leg.hipY }, knee, {
      x: leg.footX, y: leg.footY
    }, profile.legs);
    context.fillStyle = profile.legHighlight;
    context.fillRect(Math.round(knee.x) - 1, Math.round(knee.y) - 1, 2, 2);
    const shoeX = Math.round(leg.footX);
    const shoeY = Math.round(leg.footY);
    context.fillStyle = profile.shoes;
    context.fillRect(shoeX - 2, shoeY - 2, 4, 1);
    context.fillRect(shoeX - 3, shoeY - 1, 6, 2);
    context.fillRect(shoeX - 2, shoeY + 1, 5, 1);
    context.fillStyle = profile.shoeHighlight;
    context.fillRect(Math.round(leg.footX + (forwardX * 2)) - 1, shoeY - 1, 2, 1);
  });

  const arms = [
    { side: -1, forward: gait.leftArm },
    { side: 1, forward: gait.rightArm }
  ];
  if (profile.staff) {
    const staffSide = 7;
    const staffX = x + (lateralX * staffSide) + (forwardX * 1.5);
    const staffTopY = footY - 21 + (lateralY * staffSide * 0.25);
    paintPixelLimb(context, staffX, staffTopY, staffX + (forwardX * 2), footY - 1,
      profile.staff, 2);
  }
  arms.forEach((arm) => {
    const shoulderX = x + (lateralX * arm.side * ((bodyWidth / 2) + 1));
    const shoulderY = footY - 20 + (lateralY * arm.side * 0.4);
    const handX = shoulderX + (forwardX * arm.forward);
    const handY = footY - 13 + (forwardY * arm.forward * 0.45);
    const elbowX = shoulderX + ((handX - shoulderX) * 0.52);
    const elbowY = shoulderY + ((handY - shoulderY) * 0.52);
    paintPixelLimb(context, shoulderX, shoulderY, elbowX, elbowY, profile.torsoShadow, 4);
    paintPixelLimb(context, elbowX, elbowY, handX, handY, profile.skinShadow, 3);
    context.fillStyle = profile.skin;
    context.fillRect(Math.round(handX) - 1, Math.round(handY) - 2, 3, 5);
    context.fillRect(Math.round(handX) - 2, Math.round(handY) - 1, 5, 3);
    context.fillStyle = profile.skinShadow;
    context.fillRect(Math.round(handX) - 2, Math.round(handY) + 1, 1, 1);
  });

  const torsoLeft = x - Math.ceil(bodyWidth / 2);
  context.fillStyle = profile.torsoShadow;
  context.fillRect(torsoLeft + 1, footY - 22, bodyWidth - 2, 1);
  context.fillRect(torsoLeft, footY - 21, bodyWidth, 3);
  context.fillRect(torsoLeft + 1, footY - 18, bodyWidth - 2, 9);
  context.fillStyle = profile.torso;
  context.fillRect(torsoLeft + 2, footY - 21, bodyWidth - 4, 3);
  context.fillRect(torsoLeft + 2, footY - 18, bodyWidth - 4, 8);
  context.fillStyle = profile.torsoHighlight;
  context.fillRect(torsoLeft + 3, footY - 20, 2, 7);
  context.fillStyle = profile.skinShadow;
  context.fillRect(x - 2, footY - 24, 4, 4);
  context.fillStyle = profile.skin;
  context.fillRect(x - 1, footY - 24, 2, 4);
  context.fillStyle = profile.torsoShadow;
  context.fillRect(x - 3, footY - 22, 2, 2);
  context.fillRect(x + 1, footY - 22, 2, 2);
  context.fillStyle = profile.legs;
  context.fillRect(x - 4, footY - 11, 8, 2);

  if (profile.patch) {
    context.fillStyle = profile.patch;
    context.fillRect(x + 1, footY - 15, 3, 3);
    context.fillStyle = profile.torsoShadow;
    context.fillRect(x - 6, footY - 10, 3, 2);
    context.fillRect(x + 3, footY - 10, 4, 2);
  }

  const headLeft = x - Math.ceil(headWidth / 2);
  context.fillStyle = profile.hair;
  context.fillRect(headLeft + 1, footY - 32, headWidth - 2, 1);
  context.fillRect(headLeft, footY - 31, headWidth, 10);
  context.fillRect(headLeft - 1, footY - 28, 3, 9);
  context.fillRect(headLeft + headWidth - 2, footY - 28, 3, 9);
  context.fillStyle = profile.hairHighlight;
  context.fillRect(headLeft + 2, footY - 31, 4, 2);
  context.fillRect(headLeft + headWidth - 3, footY - 26, 2, 4);
  const faceWidth = headWidth - 2;
  const faceLeft = x - Math.floor(faceWidth / 2) + Math.round(forwardX);
  context.fillStyle = rearFacing ? profile.hair : profile.skinShadow;
  context.fillRect(faceLeft + 1, footY - 30, faceWidth - 2, 1);
  context.fillRect(faceLeft, footY - 29, faceWidth, 6);
  context.fillRect(faceLeft + 1, footY - 23, faceWidth - 2, 1);
  if (!rearFacing) {
    context.fillStyle = profile.skin;
    context.fillRect(faceLeft + 1, footY - 29, faceWidth - 2, 5);
  }
  if (!rearFacing) {
    if (sideFacing) {
      const eyeX = x + Math.round(forwardX * ((headWidth / 2) - 2));
      context.fillStyle = '#f2ead8';
      context.fillRect(eyeX - (forwardX < 0 ? 1 : 0), footY - 28, 2, 2);
      context.fillStyle = '#27302e';
      context.fillRect(eyeX, footY - 28, 1, 2);
      context.fillStyle = profile.skinShadow;
      context.fillRect(x + Math.round(forwardX * (headWidth / 2)), footY - 25, 2, 2);
    } else {
      context.fillStyle = '#f2ead8';
      context.fillRect(x - 4, footY - 28, 3, 2);
      context.fillRect(x + 2, footY - 28, 3, 2);
      context.fillStyle = '#27302e';
      context.fillRect(x - 2, footY - 28, 1, 2);
      context.fillRect(x + 2, footY - 28, 1, 2);
      context.fillStyle = profile.skinShadow;
      context.fillRect(x, footY - 26, 1, 2);
      context.fillRect(x - 1, footY - 23, 3, 1);
    }
  }

  context.fillStyle = profile.headwearShadow;
  context.fillRect(x - Math.ceil((headWidth + 2) / 2), footY - 34, headWidth + 2, 4);
  context.fillStyle = profile.headwear;
  context.fillRect(x - Math.ceil(headWidth / 2), footY - 37, headWidth, 4);
  if (profile.id === 'visitor') {
    context.fillRect(x - Math.ceil((headWidth - 4) / 2), footY - 40, headWidth - 4, 3);
    context.fillRect(x - 2 - Math.round(forwardX), footY - 42, 5, 2);
    context.fillRect(x - 2 - Math.round(forwardX * 2), footY - 44, 3, 2);
  } else {
    context.fillRect(x - Math.ceil((headWidth - 4) / 2), footY - 39, headWidth - 4, 2);
  }
  context.fillStyle = profile.headwearHighlight;
  context.fillRect(x - Math.floor(headWidth / 2) + 1, footY - 37, 4, 1);
  context.fillRect(x - Math.round(forwardX * 2) - 1,
    footY - (profile.id === 'visitor' ? 40 : 39), 3, 1);

  return gait;
}
