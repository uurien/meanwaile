import { nextLevel, shouldAddSpikes, shouldAddAlien, nextSpeed } from './logic.js';

// Matches the popover's actual game-area box (440x540 popover minus the
// ~70px header), so Scale.FIT renders close to full-bleed instead of
// letterboxing a chunk of it away.
const GAME_WIDTH = 440;
const GAME_HEIGHT = 470;
const GROUND_HEIGHT = 32;
const PLATFORM_LEVEL_HEIGHT = 70;
const PLATFORM_WIDTH = 180;
const OFFSCREEN_BUFFER = 400;
const INITIAL_SPEED = 12;
const SPEED_GROWTH_INTERVAL_MS = 5000;
const JUMP_VELOCITY = -800;
const GRAVITY_Y = 2200;
const JUMP_LOCK_MS = 300;

const pointsEl = document.getElementById('points');
const gameOverEl = document.getElementById('game-over');
const pointsSummaryEl = document.getElementById('points_summary');
const retryBtn = document.getElementById('retry-btn');

let game = null;
let currentPause = null;
let currentResume = null;

function platformY(level) {
  return GAME_HEIGHT - GROUND_HEIGHT - level * PLATFORM_LEVEL_HEIGHT - 16;
}

// Every run gets its own closure (mirrors the original main.js) so a restart
// after game-over can throw away all state - sections, timers, sprites -
// just by building a fresh one instead of resetting fields piecemeal.
function createRun(startPaused) {
  if (game) {
    game.destroy(true);
    game = null;
  }

  let gameOverHappened = false;
  let player;
  let smoke;
  let spaceBar;
  let jumpRequested = false;
  let speed = INITIAL_SPEED;
  let points = 0;
  let pointsInterval = null;
  let speedInterval = null;
  const sections = [];
  const backgrounds = [];
  const playerStatus = { inSecondJump: false, jumpBlocked: false };

  pointsEl.classList.add('hidden');
  gameOverEl.hidden = true;

  function startTimers() {
    if (pointsInterval) return;
    pointsInterval = setInterval(() => {
      points++;
      pointsEl.textContent = `Score: ${points}`;
    }, 50);
    speedInterval = setInterval(() => {
      speed = nextSpeed(speed);
    }, SPEED_GROWTH_INTERVAL_MS);
  }

  function stopTimers() {
    clearInterval(pointsInterval);
    clearInterval(speedInterval);
    pointsInterval = null;
    speedInterval = null;
  }

  function endRun() {
    if (gameOverHappened) return;
    gameOverHappened = true;
    stopTimers();
    pointsSummaryEl.textContent = `Score: ${points}`;
    game.pause();
    setTimeout(() => {
      pointsEl.classList.add('hidden');
      gameOverEl.hidden = false;
    }, 300);
  }

  function createPlatform(self, x, level) {
    const platform = self.physics.add.sprite(x, platformY(level), 'platform');
    platform.setImmovable(true);
    platform.body.allowGravity = false;
    platform.setVelocityX(-20 * speed);
    platform.displayWidth = PLATFORM_WIDTH;
    platform.body.setFriction(0, 0);
    self.physics.add.collider(player, platform, () => {
      if (player.body.touching.right) {
        endRun();
        return;
      }
      if (player.body.touching.down) {
        playerStatus.inSecondJump = false;
      }
    });
    return platform;
  }

  function createSpikes(self, x) {
    const spikes = self.physics.add.sprite(x, platformY(0), 'spike');
    spikes.setImmovable(true);
    spikes.body.allowGravity = false;
    spikes.setVelocityX(-20 * speed);
    spikes.displayWidth = PLATFORM_WIDTH;
    spikes.displayHeight = 24;
    spikes.body.setFriction(0, 0);
    self.physics.add.collider(player, spikes, endRun);
    return spikes;
  }

  function createAlien(self, x, level) {
    const y = platformY(level) - 32;
    const deltaX = Math.floor(30 + Math.random() * 70);
    const deltaY = Math.floor(Math.random() * 50);
    const alien = self.physics.add.sprite(x + deltaX, y - deltaY, 'alien');
    alien.body.allowGravity = false;
    alien.setVelocityX(-22 * speed);
    alien.body.setFriction(0, 0);
    alien.anims.play('alienmovement');
    self.physics.add.collider(player, alien, endRun);
    return alien;
  }

  function createFirstSection(self) {
    const x = GAME_WIDTH + 200;
    const platforms = [createPlatform(self, x, 1), createSpikes(self, x)];
    sections.push({ platforms, level: 1 });
  }

  function createSection(self, previousSection) {
    const level = nextLevel(previousSection.level);
    const prevPlatform = previousSection.platforms[0];
    const x = prevPlatform.x + prevPlatform.displayWidth;
    const platforms = [createPlatform(self, x, level)];

    if (shouldAddSpikes(previousSection.platforms.length > 0)) {
      platforms.push(createSpikes(self, x));
    }

    const section = { platforms, level };
    if (shouldAddAlien()) {
      section.aliens = [createAlien(self, x, level)];
    }
    sections.push(section);
  }

  function getFirstSectionRightPoint() {
    const platform = sections[0].platforms[0];
    return platform.x + platform.displayWidth;
  }

  function getLastSectionRightPoint() {
    const platform = sections[sections.length - 1].platforms[0];
    return platform.x + platform.displayWidth;
  }

  function updateSections(self) {
    while (sections.length > 0 && getFirstSectionRightPoint() < 0) {
      const section = sections.shift();
      section.platforms.forEach((platform) => platform.destroy());
      section.aliens?.forEach((alien) => alien.destroy());
    }
    while (sections.length > 0 && getLastSectionRightPoint() < GAME_WIDTH + OFFSCREEN_BUFFER) {
      createSection(self, sections[sections.length - 1]);
    }
    for (const section of sections) {
      section.platforms.forEach((platform) => platform.setVelocityX(-20 * speed));
      section.aliens?.forEach((alien) => alien.setVelocityX(-22 * speed));
    }
  }

  function syncSections() {
    for (let i = 1; i < sections.length; i++) {
      const prevPlatform = sections[i - 1].platforms[0];
      sections[i].platforms.forEach((platform) => {
        platform.x = prevPlatform.x + prevPlatform.displayWidth;
      });
    }
  }

  function moveBackgrounds() {
    for (const background of backgrounds) {
      background.tile.tilePositionX += background.speedFactor * speed;
    }
  }

  function preload() {
    this.load.image('background_0', 'assets/background_0.jpg');
    this.load.image('background_1', 'assets/background_1.png');
    this.load.image('background_2', 'assets/background_2.png');
    this.load.image('spike', 'assets/spike.png');
    this.load.spritesheet('player', 'assets/player-jump.png', { frameWidth: 40, frameHeight: 40 });
    this.load.spritesheet('smoke', 'assets/smoke_sprite.png', { frameWidth: 20, frameHeight: 16 });
    this.load.spritesheet('alien', 'assets/alien.png', { frameWidth: 27, frameHeight: 29 });
    this.load.image('platform', 'assets/platform.png');
    this.load.image('ground', 'assets/ground.png');
  }

  function create() {
    this.physics.world.roundPixels = true;

    const layers = [
      { key: 'background_0', speedFactor: 0.01 },
      { key: 'background_1', speedFactor: 0.03 },
      { key: 'background_2', speedFactor: 0.06 },
    ];
    for (const layer of layers) {
      const tile = this.add.tileSprite(0, 0, this.sys.canvas.width, this.sys.canvas.height, layer.key);
      tile.setOrigin(0, 0);
      tile.setScrollFactor(0);
      backgrounds.push({ tile, speedFactor: layer.speedFactor });
    }

    const ground = this.add.tileSprite(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT, 'ground');
    ground.setOrigin(0, 0);
    this.physics.add.existing(ground, true);

    const startX = 110;
    const startY = GAME_HEIGHT - GROUND_HEIGHT - 30;

    smoke = this.physics.add.sprite(startX, startY, 'smoke');
    smoke.body.allowGravity = false;
    this.physics.add.collider(smoke, ground);

    player = this.physics.add.sprite(startX, startY, 'player');
    player.body.setFriction(0, 0);
    player.setBodySize(32, 32);
    player.setBounce(0);
    player.name = 'player';

    this.physics.add.collider(player, ground, () => {
      playerStatus.inSecondJump = false;
    });

    spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', () => {
      jumpRequested = true;
    });

    createFirstSection(this);
    pointsEl.textContent = 'Score: 0';
    pointsEl.classList.remove('hidden');

    this.anims.create({
      key: 'rotate',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 25,
      repeat: 1,
    });
    this.anims.create({
      key: 'alienmovement',
      frames: this.anims.generateFrameNumbers('alien', { start: 0, end: 1 }),
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: 'smokemovement',
      frames: [
        { key: 'smoke', frame: 0 },
        { key: 'smoke', frame: 1 },
        { key: 'smoke', frame: 2 },
        { key: 'smoke', frame: 1 },
      ],
      frameRate: 9,
      repeat: -1,
    });
    smoke.anims.play('smokemovement');

    if (startPaused) {
      this.game.pause();
    } else {
      startTimers();
    }
  }

  function update() {
    moveBackgrounds();
    updateSections(this);
    syncSections();

    player.setVelocityX(0);

    const wantsJump = (spaceBar.isDown || jumpRequested) && !playerStatus.jumpBlocked && !playerStatus.inSecondJump;
    jumpRequested = false;

    if (wantsJump) {
      playerStatus.jumpBlocked = true;
      if (!player.body.touching.down) {
        playerStatus.inSecondJump = true;
      }
      player.setVelocityY(JUMP_VELOCITY);
      setTimeout(() => {
        playerStatus.jumpBlocked = false;
      }, JUMP_LOCK_MS);
      player.anims.play('rotate');
    }

    if (player.body.touching.down) {
      smoke.visible = true;
      smoke.x = player.x - 24 + 2;
      smoke.y = player.y + 8;
    } else {
      smoke.visible = false;
    }
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game_container',
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: GRAVITY_Y }, debug: false },
    },
    render: { antialias: true, roundPixels: true },
    scene: { preload, create, update },
  });

  currentPause = () => {
    if (gameOverHappened || game.isPaused) return;
    game.pause();
    stopTimers();
  };

  currentResume = () => {
    if (gameOverHappened) return;
    if (game.isPaused) game.resume();
    startTimers();
  };
}

retryBtn.addEventListener('click', () => createRun(false));

window.addEventListener('message', (e) => {
  if (e.data?.type === 'game:pause') currentPause?.();
  if (e.data?.type === 'game:resume') currentResume?.();
});

// No start screen of our own - the popover owns the "has this game ever
// been started" decision (see project_circle_tap_start_screen memory) and
// its first game:resume is what actually kicks the run off.
createRun(true);
