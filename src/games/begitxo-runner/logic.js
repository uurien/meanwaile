export const MAX_LEVEL = 4;

export function nextLevel(previousLevel, rng = Math.random) {
  let level;
  if (!previousLevel || previousLevel <= 1) {
    level = rng() < 0.5 ? previousLevel : previousLevel + 1;
  } else {
    const roll = rng();
    if (roll < 1 / 3) {
      level = previousLevel - 1;
    } else if (roll < 2 / 3) {
      level = previousLevel;
    } else {
      level = previousLevel + 1;
    }
  }
  return Math.min(level, MAX_LEVEL);
}

export function shouldAddSpikes(previousSectionHasPlatforms, rng = Math.random) {
  const roll = rng();
  return (previousSectionHasPlatforms && roll < 0.7) || roll < 0.4;
}

export function shouldAddAlien(rng = Math.random) {
  return rng() < 0.4;
}

export function nextSpeed(speed, growthFactor = 1.1) {
  return speed * growthFactor;
}
