import {
  ARENA_H,
  ARENA_W,
  ACE_COUNT,
  ACE_FIRE,
  ACE_HP,
  ACE_POINTS,
  BOMB_BOSS_DAMAGE,
  BOOST_FACTOR,
  BRAKE_FACTOR,
  BOMB_BULLET_POINTS,
  BOMB_COOLDOWN_S,
  BOMB_DAMAGE,
  BOMB_RADIUS,
  BOSS_ATTACK_S,
  BOSS_BULLET_LIFE,
  BOSS_BULLET_SPEED,
  BOSS_DYING_S,
  BOSS_ENTER_S,
  BOSS_EVERY,
  BOSS_HP,
  BOSS_KNOCK,
  BOSS_HP_GROWTH,
  BOSS_POINTS,
  BOSS_RADIUS,
  BOSS_RAGE_ATTACK_S,
  BOSS_RING_BULLETS,
  BOSS_SPIRAL_GAP_S,
  BOSS_SPIRAL_S,
  CHARGE_SPEED,
  CHARGE_TIME_S,
  CHARGE_WINDUP_S,
  COMBO_PER_STEP,
  COMBO_WINDOW_S,
  CONTACT_DAMAGE_TO_ENEMY,
  DASH_SPEED,
  DASH_TIME,
  DROP_CHANCE,
  DT,
  ENEMY_BULLET_SPEEDUP,
  ENEMY_BULLET_SPEEDUP_MAX,
  ENEMY_FIRE_SPEEDUP,
  ENEMY_FIRE_SPEEDUP_MAX,
  ENEMY_GRACE_S,
  ENEMY_HITBOX,
  ENEMY_HP_GROWTH,
  ENEMY_HP_GROWTH_LATE,
  ENEMY_PLAYER_CLEARANCE,
  ENEMY_SEPARATION,
  FIRST_WAVE_DELAY_S,
  HIT_INVULN_S,
  INTERMISSION_S,
  LATE_ACES_FROM,
  LATE_ACES_MAX,
  LATE_ACES_PER_WAVE,
  MAX_ALIVE,
  MAX_BOMBS,
  MAX_MULTIPLIER,
  OVERDRIVE_RATE,
  OVERDRIVE_S,
  PERFECT_WAVE_POINTS,
  PICKUP_GRAB,
  PICKUP_LIFE_S,
  PICKUP_MAGNET,
  PICKUP_PULL_ACCEL,
  PICKUP_PULL_SPEED,
  PICKUP_WEIGHTS,
  PLAYER_GRIP,
  RAM_BUMP_S,
  RAM_DAMAGE,
  RAM_KNOCK,
  PLAYER_HITBOX,
  PLAYER_MARGIN,
  SHIELD_INVULN_S,
  SPARE_PICKUP_POINTS,
  SPAWN_GAP_S,
  SPAWN_WARNING_S,
  SPECIAL_WAVE_CHANCE,
  SPECIAL_WAVE_FROM,
  SWARM_CAP_BONUS,
  SWARM_COUNT,
  SWARM_HP,
  THROTTLE_ACCEL,
  TURN_AT_SLOW,
  TURN_LOSS,
  WALL_TURN,
  WAVE_CLEAR_POINTS,
  MAX_RUN_TICKS,
} from "@/constants/game";
import { AIM_STEPS } from "@/constants/replay";
import {
  AFTERBURNER_PER_LEVEL,
  COMBO_PER_LEVEL_S,
  GUN_ANGLE,
  HEAVY_PER_LEVEL,
  MAGNET_DROP_FACTOR,
  MAGNET_RANGE_FACTOR,
  RAPID_PER_LEVEL,
  REPAIR_HP,
  SEEKER_TURN_PER_LEVEL,
  SHIELD_REGEN_S,
  STRIKE_RADIUS_PER_LEVEL,
  THRUSTERS_PER_LEVEL,
  UPGRADES,
  VELOCITY_PER_LEVEL,
} from "@/constants/upgrades";
import type {
  Boss,
  Bullet,
  BulletOwner,
  Enemy,
  GameEvent,
  GameStats,
  ModelId,
  ModelSpec,
  PendingSpawn,
  Pickup,
  PickupKind,
  Player,
  TickInput,
  UpgradeId,
  WaveKind,
  WaveState,
  WeaponSpec,
} from "@/types/game";
import {
  PI,
  TAU,
  angleDiff,
  clamp,
  datan2,
  dcos,
  dlen,
  dsin,
  turnToward,
} from "@/utils/det-math";
import { modelSpec, rivalsOf } from "@/utils/models";
import { createRng } from "@/utils/rng";

const AIM_ANGLE = TAU / AIM_STEPS;

/**
 * One run of the game. It only advances through `step`, one fixed tick at a time, and draws all its
 * randomness from the seed, so the same seed, model and inputs always end with the same score. The
 * browser plays it; the server replays the recorded inputs to check the score. Nothing in here may
 * touch the DOM, the clock or Math.random.
 */
export class Game {
  readonly spec: ModelSpec;
  readonly rivals: ModelId[];
  readonly player: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  pending: PendingSpawn[] = [];
  boss: Boss | null = null;
  readonly wave: WaveState;
  /** What happened during the last step, for sound and effects. */
  readonly events: GameEvent[] = [];
  score = 0;
  kills = 0;
  bosses = 0;
  ticks = 0;
  combo = 0;
  comboTimer = 0;
  over = false;
  /** Level of every upgrade taken this run. */
  readonly upgrades = Object.fromEntries(
    UPGRADES.map((upgrade) => [upgrade.id, 0])
  ) as Record<UpgradeId, number>;
  private readonly rng: () => number;
  private nextId = 1;
  /** The model's gun with this run's upgrades applied; rebuilt when one is taken. */
  private weapon: WeaponSpec;

  constructor(seed: number, model: ModelId) {
    this.rng = createRng(seed);
    this.spec = modelSpec(model);
    this.rivals = rivalsOf(model);
    this.weapon = this.spec.weapon;
    this.player = {
      x: ARENA_W / 2,
      y: ARENA_H * 0.62,
      vx: 0,
      vy: -this.spec.speed,
      heading: -PI / 2,
      speed: this.spec.speed,
      throttle: 0,
      hp: this.spec.hp,
      maxHp: this.spec.hp,
      invuln: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashAngle: 0,
      fireTimer: 0,
      fireSide: 1,
      bombs: this.spec.bombs,
      bombCooldown: 0,
      shield: false,
      shieldRegen: 0,
      overdrive: 0,
    };
    this.wave = {
      number: 0,
      phase: "intermission",
      timer: FIRST_WAVE_DELAY_S,
      remaining: 0,
      spawnTimer: 0,
      clean: true,
      kind: "normal",
      swarmModel: null,
    };
  }

  get multiplier() {
    return (
      1 + Math.min(MAX_MULTIPLIER - 1, Math.floor(this.combo / COMBO_PER_STEP))
    );
  }

  stats(): GameStats {
    return {
      score: this.score,
      wave: this.wave.number,
      kills: this.kills,
      bosses: this.bosses,
      ticks: this.ticks,
    };
  }

  step(input: TickInput) {
    this.events.length = 0;
    if (this.over) {
      return;
    }
    this.ticks += 1;
    this.updatePlayer(input);
    this.updateWave();
    this.updatePending();
    for (const enemy of this.enemies) {
      this.updateEnemy(enemy);
    }
    this.updateBoss();
    this.updateBullets();
    this.updatePickups();
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    // the server keeps no run longer than this, so the run ends here instead of going unsaved
    if (this.ticks >= MAX_RUN_TICKS) {
      this.over = true;
    }
    if (this.combo > 0) {
      this.comboTimer -= DT;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }
  }

  private between([min, max]: readonly [number, number]) {
    return min + this.rng() * (max - min);
  }

  private sign(): 1 | -1 {
    return this.rng() < 0.5 ? 1 : -1;
  }

  private emit(event: GameEvent) {
    this.events.push(event);
  }

  // ---------------------------------------------------------------- player

  /**
   * The ship always flies forward. Its nose turns toward the steering target at a limited rate, faster
   * the slower it goes, so braking tightens a turn; boosting trades turning for speed. Velocity lags
   * the nose a little, which gives the flight some drift.
   */
  private updatePlayer(input: TickInput) {
    const p = this.player;
    const spec = this.spec;

    p.dashCooldown = Math.max(0, p.dashCooldown - DT);
    p.invuln = Math.max(0, p.invuln - DT);
    p.overdrive = Math.max(0, p.overdrive - DT);
    p.bombCooldown = Math.max(0, p.bombCooldown - DT);

    if (this.upgrades.shieldgen > 0 && !p.shield) {
      p.shieldRegen -= DT;
      if (p.shieldRegen <= 0) {
        p.shield = true;
        this.emit({
          type: "pickup",
          x: p.x,
          y: p.y,
          kind: "shield",
          points: 0,
        });
      }
    }

    const tuned = 1 + THRUSTERS_PER_LEVEL * this.upgrades.thrusters;
    const cruise = spec.speed * tuned;
    const slow = cruise * BRAKE_FACTOR;
    const fast = cruise * BOOST_FACTOR;
    if (input.steering) {
      const fastness = clamp((p.speed - slow) / (fast - slow), 0, 1);
      const turnRate =
        spec.turn * tuned * (TURN_AT_SLOW - TURN_LOSS * fastness);
      p.heading = turnToward(p.heading, input.steer * AIM_ANGLE, turnRate * DT);
    }
    p.throttle = input.throttle;
    let want = cruise;
    if (input.throttle > 0) {
      want = fast;
    } else if (input.throttle < 0) {
      want = slow;
    }
    p.speed += clamp(want - p.speed, -THROTTLE_ACCEL * DT, THROTTLE_ACCEL * DT);

    if (input.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = DASH_TIME;
      p.dashCooldown =
        spec.dashCooldown *
        (1 - AFTERBURNER_PER_LEVEL * this.upgrades.afterburner);
      this.emit({ type: "dash", x: p.x, y: p.y, angle: p.heading });
    }

    if (p.dashTime > 0) {
      // the afterburner: a straight burst along the nose that nothing can hit
      p.dashTime -= DT;
      p.vx = dcos(p.heading) * DASH_SPEED;
      p.vy = dsin(p.heading) * DASH_SPEED;
    } else {
      const grip = Math.min(1, PLAYER_GRIP * DT);
      p.vx += (dcos(p.heading) * p.speed - p.vx) * grip;
      p.vy += (dsin(p.heading) * p.speed - p.vy) * grip;
    }
    // walls stop the part of the motion that goes into them; the ship slides along
    const nx = p.x + p.vx * DT;
    const ny = p.y + p.vy * DT;
    p.x = clamp(nx, PLAYER_MARGIN, ARENA_W - PLAYER_MARGIN);
    p.y = clamp(ny, PLAYER_MARGIN, ARENA_H - PLAYER_MARGIN);
    if (p.x !== nx) {
      p.vx = 0;
    }
    if (p.y !== ny) {
      p.vy = 0;
    }

    p.fireTimer -= DT;
    if (input.fire && p.fireTimer <= 0) {
      this.firePlayer();
      const rate = this.weapon.rate * (p.overdrive > 0 ? OVERDRIVE_RATE : 1);
      p.fireTimer = Math.max(0, p.fireTimer + 1 / rate);
    } else if (p.fireTimer < 0) {
      p.fireTimer = 0;
    }

    if (input.bomb && p.bombs > 0 && p.bombCooldown <= 0) {
      this.bomb();
    }
  }

  private firePlayer() {
    const p = this.player;
    const weapon = this.weapon;
    const muzzle = 8;
    // shots leave at the ship's own speed on top, so it never flies into them
    const carry = 1 + p.speed / weapon.speed;
    const ox = p.x + dcos(p.heading) * muzzle;
    const oy = p.y + dsin(p.heading) * muzzle;
    if (weapon.pattern === "twin") {
      const nx = dcos(p.heading + PI / 2) * 3;
      const ny = dsin(p.heading + PI / 2) * 3;
      this.addBullet(
        "player",
        this.spec.id,
        ox + nx,
        oy + ny,
        p.heading,
        weapon,
        carry
      );
      this.addBullet(
        "player",
        this.spec.id,
        ox - nx,
        oy - ny,
        p.heading,
        weapon,
        carry
      );
    } else if (weapon.pattern === "spread") {
      for (let i = 0; i < weapon.count; i += 1) {
        const angle = p.heading + (i - (weapon.count - 1) / 2) * weapon.spread;
        this.addBullet("player", this.spec.id, ox, oy, angle, weapon, carry);
      }
    } else if (weapon.pattern === "homing") {
      p.fireSide = -p.fireSide;
      this.addBullet(
        "player",
        this.spec.id,
        ox,
        oy,
        p.heading + p.fireSide * 0.5,
        weapon,
        carry
      );
    } else {
      const angle = p.heading + (this.rng() - 0.5) * 2 * weapon.jitter;
      this.addBullet("player", this.spec.id, ox, oy, angle, weapon, carry);
    }
    // side guns: a pair of angled shots per level, on top of the model's own pattern
    for (let gun = 1; gun <= this.upgrades.guns; gun += 1) {
      for (const side of [-1, 1]) {
        this.addBullet(
          "player",
          this.spec.id,
          ox,
          oy,
          p.heading + side * gun * GUN_ANGLE,
          weapon,
          carry
        );
      }
    }
    this.emit({
      type: "shot",
      x: ox,
      y: oy,
      model: this.spec.id,
      owner: "player",
    });
  }

  private addBullet(
    owner: BulletOwner,
    model: ModelId,
    x: number,
    y: number,
    angle: number,
    weapon: WeaponSpec,
    speedScale: number,
    heavy = false
  ) {
    const speed = weapon.speed * speedScale;
    this.bullets.push({
      owner,
      model,
      x,
      y,
      vx: dcos(angle) * speed,
      vy: dsin(angle) * speed,
      life: weapon.life,
      damage: weapon.damage,
      radius: weapon.radius,
      pierce: weapon.pierce,
      homing: weapon.homing,
      homingTime: owner === "player" ? weapon.life : 1.6,
      hits: [],
      heavy,
    });
  }

  private bomb() {
    const radius =
      BOMB_RADIUS * (1 + STRIKE_RADIUS_PER_LEVEL * this.upgrades.strike);
    const p = this.player;
    p.bombs -= 1;
    p.bombCooldown = BOMB_COOLDOWN_S;
    p.invuln = Math.max(p.invuln, 0.6);
    let cleared = 0;
    for (const bullet of this.bullets) {
      if (bullet.owner === "enemy") {
        cleared += 1;
        this.emit({
          type: "fizzle",
          x: bullet.x,
          y: bullet.y,
          model: bullet.model,
        });
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.owner === "player");
    this.score += cleared * BOMB_BULLET_POINTS;
    this.emit({ type: "bomb", x: p.x, y: p.y, cleared });
    for (const enemy of this.enemies) {
      if (enemy.hp > 0 && dlen(enemy.x - p.x, enemy.y - p.y) < radius) {
        this.damageEnemy(enemy, BOMB_DAMAGE);
      }
    }
    const boss = this.boss;
    if (boss && dlen(boss.x - p.x, boss.y - p.y) < radius + BOSS_RADIUS) {
      this.hitBoss(BOMB_BOSS_DAMAGE, boss.x, boss.y);
    }
  }

  private hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.dashTime > 0 || this.over) {
      return;
    }
    if (p.shield) {
      p.shield = false;
      p.shieldRegen = SHIELD_REGEN_S;
      p.invuln = SHIELD_INVULN_S;
      this.emit({ type: "shieldBreak", x: p.x, y: p.y });
      return;
    }
    p.hp -= 1;
    p.invuln = HIT_INVULN_S;
    this.combo = 0;
    this.wave.clean = false;
    this.emit({ type: "playerHit", x: p.x, y: p.y });
    if (p.hp <= 0) {
      this.over = true;
      this.emit({ type: "playerDeath", x: p.x, y: p.y });
    }
  }

  // ---------------------------------------------------------------- waves

  private updateWave() {
    const wave = this.wave;
    if (wave.phase === "intermission") {
      wave.timer -= DT;
      if (wave.timer <= 0) {
        this.startWave(wave.number + 1);
      }
      return;
    }
    if (wave.phase === "boss") {
      return;
    }
    wave.spawnTimer -= DT;
    const alive = this.enemies.length + this.pending.length;
    const cap =
      Math.min(3 + Math.floor(wave.number / 2), MAX_ALIVE) +
      (wave.kind === "swarm" ? SWARM_CAP_BONUS : 0);
    if (wave.remaining > 0 && wave.spawnTimer <= 0 && alive < cap) {
      const group = Math.min(
        wave.remaining,
        cap - alive,
        wave.kind === "aces" ? 1 : 1 + Math.floor(this.rng() * 3)
      );
      for (let i = 0; i < group; i += 1) {
        this.queueSpawn(
          wave.swarmModel ?? this.pickEnemyModel(),
          false,
          wave.kind === "aces" ||
            (wave.kind === "normal" && this.rng() < this.lateAceChance())
        );
      }
      wave.remaining -= group;
      wave.spawnTimer = SPAWN_GAP_S;
    }
    if (wave.remaining === 0 && alive === 0) {
      this.clearWave();
    }
  }

  private startWave(number: number) {
    const wave = this.wave;
    wave.number = number;
    wave.clean = true;
    if (number % BOSS_EVERY === 0) {
      wave.phase = "boss";
      wave.remaining = 0;
      wave.kind = "normal";
      wave.swarmModel = null;
      const boss = this.spawnBoss(number);
      this.emit({ type: "wave", number, boss, kind: "normal", swarm: null });
      return;
    }
    wave.phase = "fight";
    wave.spawnTimer = 0.2;
    wave.kind = this.pickWaveKind(number);
    wave.swarmModel = wave.kind === "swarm" ? this.pickEnemyModel() : null;
    const base = Math.min(4 + Math.floor(number * 1.6), 32);
    if (wave.kind === "swarm") {
      wave.remaining = Math.round(base * SWARM_COUNT);
    } else if (wave.kind === "aces") {
      wave.remaining = Math.max(2, Math.ceil(base * ACE_COUNT));
    } else {
      wave.remaining = base;
    }
    this.emit({
      type: "wave",
      number,
      boss: null,
      kind: wave.kind,
      swarm: wave.swarmModel,
    });
  }

  /** Later normal waves mix in more and more aces, so an upgraded ship still meets a fight. */
  private lateAceChance() {
    return clamp(
      (this.wave.number - LATE_ACES_FROM) * LATE_ACES_PER_WAVE,
      0,
      LATE_ACES_MAX
    );
  }

  /** Mostly normal waves, with a swarm or an aces wave now and then, never two specials in a row. */
  private pickWaveKind(number: number): WaveKind {
    if (number < SPECIAL_WAVE_FROM || this.wave.kind !== "normal") {
      return "normal";
    }
    if (this.rng() >= SPECIAL_WAVE_CHANCE) {
      return "normal";
    }
    return this.rng() < 0.5 ? "swarm" : "aces";
  }

  private clearWave() {
    const wave = this.wave;
    const perfect = wave.clean;
    const points =
      WAVE_CLEAR_POINTS * wave.number +
      (perfect ? PERFECT_WAVE_POINTS * wave.number : 0);
    this.score += points;
    this.emit({ type: "waveClear", number: wave.number, points, perfect });
    // stray enemy shots fizzle, so the next wave starts clean
    for (const bullet of this.bullets) {
      if (bullet.owner === "enemy") {
        this.emit({
          type: "fizzle",
          x: bullet.x,
          y: bullet.y,
          model: bullet.model,
        });
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.owner === "player");
    // every cleared wave makes the ship stronger; the seed picks how
    const upgrade = this.drawUpgrade();
    if (upgrade) {
      this.applyUpgrade(upgrade);
    }
    wave.phase = "intermission";
    wave.timer = INTERMISSION_S;
  }

  // ---------------------------------------------------------------- upgrades

  level(id: UpgradeId) {
    return this.upgrades[id];
  }

  /** One upgrade that can still be taken, drawn from the seed; null once all are maxed. */
  private drawUpgrade(): UpgradeId | null {
    const p = this.player;
    const pool = UPGRADES.filter(
      (upgrade) =>
        this.upgrades[upgrade.id] < upgrade.max &&
        (!upgrade.needsDamage || p.hp < p.maxHp)
    );
    return pool[Math.floor(this.rng() * pool.length)]?.id ?? null;
  }

  private applyUpgrade(id: UpgradeId) {
    const p = this.player;
    const level = this.upgrades[id] + 1;
    this.upgrades[id] = level;
    if (id === "hull") {
      p.maxHp += 1;
      p.hp = Math.min(p.maxHp, p.hp + 1);
    } else if (id === "repair") {
      p.hp = Math.min(p.maxHp, p.hp + REPAIR_HP);
    } else if (id === "strike") {
      p.bombs = Math.min(this.maxBombs(), p.bombs + 1);
    } else if (id === "shieldgen") {
      p.shield = true;
    }
    this.weapon = this.upgradedWeapon();
    this.emit({ type: "upgrade", id, level });
  }

  private upgradedWeapon(): WeaponSpec {
    const base = this.spec.weapon;
    const faster = 1 + VELOCITY_PER_LEVEL * this.upgrades.velocity;
    return {
      ...base,
      rate: base.rate * (1 + RAPID_PER_LEVEL * this.upgrades.rapid),
      damage: base.damage * (1 + HEAVY_PER_LEVEL * this.upgrades.heavy),
      speed: base.speed * faster,
      life: base.life * faster,
      pierce: base.pierce + this.upgrades.pierce,
      homing: base.homing + SEEKER_TURN_PER_LEVEL * this.upgrades.seeker,
    };
  }

  private maxBombs() {
    return MAX_BOMBS + this.upgrades.strike;
  }

  private pickEnemyModel(): ModelId {
    const pool = this.rivals.filter(
      (id) => modelSpec(id).enemy.unlockWave <= this.wave.number
    );
    const options = pool.length > 0 ? pool : this.rivals.slice(0, 1);
    return (
      options[Math.floor(this.rng() * options.length)] ??
      this.rivals[0] ??
      "claude"
    );
  }

  /** Picks a spot on the edge far from the player and warns about it before the enemy flies in. */
  private queueSpawn(model: ModelId, minion: boolean, elite = false) {
    const p = this.player;
    let best = { x: 0, y: 0 };
    let bestDistance = -1;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const side = Math.floor(this.rng() * 4);
      const along = this.rng();
      // sides 0–3: left, right, top, bottom, just off screen
      let x = 16 + along * (ARENA_W - 32);
      let y = 16 + along * (ARENA_H - 32);
      if (side === 0) {
        x = -8;
      } else if (side === 1) {
        x = ARENA_W + 8;
      } else if (side === 2) {
        y = -8;
      } else {
        y = ARENA_H + 8;
      }
      const distance = dlen(x - p.x, y - p.y);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
    this.pending.push({
      model,
      x: best.x,
      y: best.y,
      delay: SPAWN_WARNING_S,
      minion,
      elite,
    });
  }

  private updatePending() {
    if (this.pending.length === 0) {
      return;
    }
    const arrived: PendingSpawn[] = [];
    this.pending = this.pending.filter((spawn) => {
      spawn.delay -= DT;
      if (spawn.delay <= 0) {
        arrived.push(spawn);
        return false;
      }
      return true;
    });
    for (const spawn of arrived) {
      this.spawnEnemy(spawn);
    }
  }

  private spawnEnemy(spawn: PendingSpawn) {
    const spec = modelSpec(spawn.model).enemy;
    // `**` isn't exact in every engine, and this has to replay identically on the server
    const waves = this.wave.number - 1;
    const growth = spawn.minion
      ? 1
      : 1 + ENEMY_HP_GROWTH * waves + ENEMY_HP_GROWTH_LATE * waves * waves;
    let toughness = 1;
    if (spawn.elite) {
      toughness = ACE_HP;
    } else if (this.wave.kind === "swarm" && !spawn.minion) {
      toughness = SWARM_HP;
    }
    const hp = Math.max(1, Math.round(spec.hp * growth * toughness));
    const heading = datan2(ARENA_H / 2 - spawn.y, ARENA_W / 2 - spawn.x);
    this.enemies.push({
      id: this.nextId,
      model: spawn.model,
      x: spawn.x,
      y: spawn.y,
      vx: dcos(heading) * spec.speed,
      vy: dsin(heading) * spec.speed,
      heading,
      speed: spec.speed,
      hp,
      maxHp: hp,
      mode: "enter",
      modeTime: 0.5,
      modeAngle: heading,
      burst: 0,
      burstTimer: 0,
      cooldown: this.between(spec.cooldown) * 0.5,
      orbit: this.sign(),
      flash: 0,
      age: 0,
      minion: spawn.minion,
      elite: spawn.elite,
      bump: 0,
    });
    this.nextId += 1;
  }

  // ---------------------------------------------------------------- enemies

  private fireScale() {
    return (
      1 +
      Math.min(
        ENEMY_FIRE_SPEEDUP_MAX,
        ENEMY_FIRE_SPEEDUP * (this.wave.number - 1)
      )
    );
  }

  private bulletScale() {
    return (
      1 +
      Math.min(
        ENEMY_BULLET_SPEEDUP_MAX,
        ENEMY_BULLET_SPEEDUP * (this.wave.number - 1)
      )
    );
  }

  private updateEnemy(e: Enemy) {
    if (e.hp <= 0) {
      return;
    }
    const spec = modelSpec(e.model).enemy;
    const p = this.player;
    e.age += DT;
    e.flash = Math.max(0, e.flash - DT);
    e.modeTime -= DT;
    e.cooldown -= DT * (e.elite ? ACE_FIRE : 1);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = dlen(dx, dy);
    const bearing = datan2(dy, dx);
    const ready = e.age > ENEMY_GRACE_S && !this.over;

    let desired = e.heading;
    let want = spec.speed;
    let turn = spec.turn;

    if (e.mode === "enter") {
      desired = datan2(ARENA_H / 2 - e.y, ARENA_W / 2 - e.x);
      const inside =
        e.x > 12 && e.x < ARENA_W - 12 && e.y > 12 && e.y < ARENA_H - 12;
      if (inside && e.modeTime <= 0) {
        e.mode = "attack";
        e.modeTime = this.between([2.2, 4]);
      }
    } else if (spec.behavior === "strafe" || spec.behavior === "swarm") {
      const breakDistance = spec.behavior === "swarm" ? 30 : 40;
      if (e.mode === "attack") {
        const lead = dist / (spec.weapon.speed * 2);
        desired = datan2(dy + p.vy * lead, dx + p.vx * lead);
        if (dist < 45) {
          want = spec.speed * 0.75;
        }
        if (dist < breakDistance || e.modeTime <= 0) {
          e.mode = "break";
          e.modeTime = this.between([0.7, 1.3]);
          // peel off to the side the player isn't on, so the pass never ends in a crash
          const away = angleDiff(bearing, e.heading) > 0 ? -1 : 1;
          e.modeAngle = e.heading + away * this.between([1.1, 1.9]);
        }
        if (
          ready &&
          e.burst === 0 &&
          e.cooldown <= 0 &&
          dist < 150 &&
          Math.abs(angleDiff(bearing, e.heading)) < 0.4
        ) {
          e.burst = spec.burst;
          e.burstTimer = 0;
          e.cooldown = this.between(spec.cooldown) / this.fireScale();
        }
      } else {
        desired = e.modeAngle;
        want = spec.speed * 1.35;
        if (e.modeTime <= 0) {
          e.mode = "attack";
          e.modeTime = this.between([2.2, 4]);
        }
      }
    } else if (spec.behavior === "charger") {
      if (e.mode === "windup") {
        desired = bearing;
        want = 0;
        turn = spec.turn * 2;
        if (e.modeTime <= 0) {
          e.mode = "charge";
          e.modeTime = CHARGE_TIME_S;
          e.modeAngle = bearing;
          e.heading = bearing;
          e.speed = CHARGE_SPEED;
        }
      } else if (e.mode === "charge") {
        desired = e.modeAngle;
        want = CHARGE_SPEED;
        turn = 0.5;
        if (e.modeTime <= 0) {
          e.mode = "attack";
          e.modeTime = this.between(spec.cooldown) / this.fireScale();
        }
      } else {
        desired = this.orbitAngle(e, spec.range, dist, bearing);
        if (e.modeTime <= 0 && ready && dist < 140) {
          e.mode = "windup";
          e.modeTime = CHARGE_WINDUP_S;
        }
      }
    } else {
      // snipers and lobbers circle at range and shoot from there
      desired = this.orbitAngle(e, spec.range, dist, bearing);
      if (ready && e.burst === 0 && e.cooldown <= 0 && dist < spec.range + 90) {
        e.burst = spec.burst;
        e.burstTimer = 0;
        e.cooldown = this.between(spec.cooldown) / this.fireScale();
      }
    }

    // walls and other enemies bend the course
    let sx = dcos(desired);
    let sy = dsin(desired);
    if (e.mode !== "enter" && e.mode !== "charge") {
      const ax = e.x + e.vx * 0.5;
      const ay = e.y + e.vy * 0.5;
      if (ax < 14) {
        sx += 2;
      } else if (ax > ARENA_W - 14) {
        sx -= 2;
      }
      if (ay < 14) {
        sy += 2;
      } else if (ay > ARENA_H - 14) {
        sy -= 2;
      }
      for (const other of this.enemies) {
        if (other === e || other.hp <= 0) {
          continue;
        }
        const ox = e.x - other.x;
        const oy = e.y - other.y;
        const d = dlen(ox, oy) || 1;
        if (d < ENEMY_SEPARATION) {
          const push = ((ENEMY_SEPARATION - d) / ENEMY_SEPARATION) * 2;
          sx += (ox / d) * push;
          sy += (oy / d) * push;
        }
      }
      // only chargers ram on purpose; everything else peels off before it hits you
      if (spec.behavior !== "charger" && dist < ENEMY_PLAYER_CLEARANCE) {
        const push =
          ((ENEMY_PLAYER_CLEARANCE - dist) / ENEMY_PLAYER_CLEARANCE) * 4;
        sx -= (dx / (dist || 1)) * push;
        sy -= (dy / (dist || 1)) * push;
      }
      const boss = this.boss;
      if (boss) {
        const ox = e.x - boss.x;
        const oy = e.y - boss.y;
        const d = dlen(ox, oy) || 1;
        const room = BOSS_RADIUS + 12;
        if (d < room) {
          sx += (ox / d) * 3;
          sy += (oy / d) * 3;
        }
      }
    }
    e.heading = turnToward(e.heading, datan2(sy, sx), turn * DT);
    if (e.mode !== "charge") {
      e.speed += clamp(want - e.speed, -120 * DT, 90 * DT);
    }
    const grip = Math.min(1, 6 * DT);
    e.vx += (dcos(e.heading) * e.speed - e.vx) * grip;
    e.vy += (dsin(e.heading) * e.speed - e.vy) * grip;
    e.x += e.vx * DT;
    e.y += e.vy * DT;
    if (e.mode !== "enter") {
      this.confine(e);
    }

    if (e.burst > 0 && !this.over) {
      e.burstTimer -= DT;
      if (e.burstTimer <= 0) {
        this.fireEnemy(e, bearing);
        e.burst -= 1;
        e.burstTimer = spec.burstGap;
      }
    }

    e.bump = Math.max(0, e.bump - DT);
    if (dist < ENEMY_HITBOX + PLAYER_HITBOX + 1 && e.bump <= 0) {
      this.collide(e, spec.behavior === "charger", dx, dy, dist);
    }
  }

  /**
   * The player and an enemy touch. Chargers and aces hurt you; any other ship just gets rammed: it takes
   * damage (double through the afterburner) and both of you bounce apart.
   */
  private collide(
    e: Enemy,
    charger: boolean,
    dx: number,
    dy: number,
    dist: number
  ) {
    const p = this.player;
    if (charger || e.elite) {
      if (p.invuln > 0 || p.dashTime > 0) {
        return;
      }
      this.hurtPlayer();
      this.damageEnemy(e, charger ? e.hp : CONTACT_DAMAGE_TO_ENEMY);
      e.bump = RAM_BUMP_S;
      return;
    }
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    this.emit({ type: "ram", x: (p.x + e.x) / 2, y: (p.y + e.y) / 2 });
    const ram = RAM_DAMAGE * (1 + this.upgrades.ram);
    this.damageEnemy(e, p.dashTime > 0 ? ram * 2 : ram);
    e.bump = RAM_BUMP_S;
    e.vx -= nx * RAM_KNOCK;
    e.vy -= ny * RAM_KNOCK;
    p.vx += nx * RAM_KNOCK * 0.6;
    p.vy += ny * RAM_KNOCK * 0.6;
  }

  private orbitAngle(e: Enemy, range: number, dist: number, bearing: number) {
    if (this.rng() < DT * 0.2) {
      e.orbit = e.orbit === 1 ? -1 : 1;
    }
    if (dist > range + 18) {
      return bearing + e.orbit * 0.4;
    }
    if (dist < range - 18) {
      return bearing + PI - e.orbit * 0.4;
    }
    return bearing + (e.orbit * PI) / 2;
  }

  /**
   * Keeps an enemy inside the arena. It slides along the wall it hit and its nose swings round over a
   * few ticks, so the thruster and trail curve instead of snapping to a new course.
   */
  private confine(e: Enemy) {
    const m = 5;
    if (e.x < m || e.x > ARENA_W - m) {
      e.x = clamp(e.x, m, ARENA_W - m);
      e.vx = 0;
      const down = e.vy === 0 ? dsin(e.heading) >= 0 : e.vy > 0;
      e.heading = turnToward(e.heading, down ? PI / 2 : -PI / 2, WALL_TURN);
    }
    if (e.y < m || e.y > ARENA_H - m) {
      e.y = clamp(e.y, m, ARENA_H - m);
      e.vy = 0;
      const right = e.vx === 0 ? dcos(e.heading) >= 0 : e.vx > 0;
      e.heading = turnToward(e.heading, right ? 0 : PI, WALL_TURN);
    }
  }

  private fireEnemy(e: Enemy, bearing: number) {
    const weapon = modelSpec(e.model).enemy.weapon;
    const scale = this.bulletScale();
    const ox = e.x + dcos(bearing) * 6;
    const oy = e.y + dsin(bearing) * 6;
    if (weapon.pattern === "spread") {
      for (let i = 0; i < weapon.count; i += 1) {
        const angle = bearing + (i - (weapon.count - 1) / 2) * weapon.spread;
        this.addBullet("enemy", e.model, ox, oy, angle, weapon, scale);
      }
    } else {
      const angle = bearing + (this.rng() - 0.5) * 2 * weapon.jitter;
      this.addBullet("enemy", e.model, ox, oy, angle, weapon, scale);
    }
    this.emit({ type: "shot", x: ox, y: oy, model: e.model, owner: "enemy" });
  }

  private damageEnemy(e: Enemy, amount: number) {
    if (e.hp <= 0) {
      return;
    }
    e.hp -= amount;
    e.flash = 0.08;
    this.emit({ type: "hit", x: e.x, y: e.y, model: e.model });
    if (e.hp > 0) {
      return;
    }
    let base = modelSpec(e.model).enemy.points;
    if (e.minion) {
      base /= 2;
    } else if (e.elite) {
      base *= ACE_POINTS;
    }
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW_S + COMBO_PER_LEVEL_S * this.upgrades.combo;
    const points = base * this.multiplier;
    this.score += points;
    this.kills += 1;
    this.emit({ type: "kill", x: e.x, y: e.y, model: e.model, points });
    const dropChance =
      DROP_CHANCE * (this.upgrades.magnet > 0 ? MAGNET_DROP_FACTOR : 1);
    if (e.elite || (!e.minion && this.rng() < dropChance)) {
      this.dropPickup(e.x, e.y, this.rollPickup());
    }
  }

  // ---------------------------------------------------------------- pickups

  private rollPickup(): PickupKind {
    const total = PICKUP_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.rng() * total;
    for (const [kind, weight] of PICKUP_WEIGHTS) {
      roll -= weight;
      if (roll < 0) {
        return kind;
      }
    }
    return "repair";
  }

  private dropPickup(x: number, y: number, kind: PickupKind) {
    const angle = this.rng() * TAU;
    this.pickups.push({
      kind,
      x: clamp(x, 8, ARENA_W - 8),
      y: clamp(y, 8, ARENA_H - 8),
      vx: dcos(angle) * 20,
      vy: dsin(angle) * 20,
      life: PICKUP_LIFE_S,
    });
  }

  private updatePickups() {
    const p = this.player;
    this.pickups = this.pickups.filter((pickup) => {
      pickup.life -= DT;
      const dx = p.x - pickup.x;
      const dy = p.y - pickup.y;
      const d = dlen(dx, dy) || 1;
      if (d < PICKUP_GRAB && !this.over) {
        this.collect(pickup);
        return false;
      }
      const magnet =
        PICKUP_MAGNET * (this.upgrades.magnet > 0 ? MAGNET_RANGE_FACTOR : 1);
      if (d < magnet) {
        // straight at the player and speeding up, so it can't overshoot or orbit
        const speed = Math.min(
          PICKUP_PULL_SPEED,
          dlen(pickup.vx, pickup.vy) + PICKUP_PULL_ACCEL * DT
        );
        pickup.vx = (dx / d) * speed;
        pickup.vy = (dy / d) * speed;
      } else {
        pickup.vx *= 1 - 2 * DT;
        pickup.vy *= 1 - 2 * DT;
      }
      pickup.x = clamp(pickup.x + pickup.vx * DT, 6, ARENA_W - 6);
      pickup.y = clamp(pickup.y + pickup.vy * DT, 6, ARENA_H - 6);
      return pickup.life > 0;
    });
  }

  private collect(pickup: Pickup) {
    const p = this.player;
    let points = 0;
    if (pickup.kind === "repair") {
      if (p.hp < p.maxHp) {
        p.hp += 1;
      } else {
        points = SPARE_PICKUP_POINTS;
      }
    } else if (pickup.kind === "bomb") {
      if (p.bombs < this.maxBombs()) {
        p.bombs += 1;
      } else {
        points = SPARE_PICKUP_POINTS;
      }
    } else if (pickup.kind === "shield") {
      if (p.shield) {
        points = SPARE_PICKUP_POINTS;
      } else {
        p.shield = true;
      }
    } else {
      p.overdrive = OVERDRIVE_S;
    }
    this.score += points;
    this.emit({
      type: "pickup",
      x: pickup.x,
      y: pickup.y,
      kind: pickup.kind,
      points,
    });
  }

  // ---------------------------------------------------------------- bullets

  private updateBullets() {
    const p = this.player;
    const walked = this.bullets;
    const kept: Bullet[] = [];
    for (const b of walked) {
      b.life -= DT;
      if (b.homing > 0 && b.homingTime > 0) {
        b.homingTime -= DT;
        const target = b.owner === "player" ? this.nearestTarget(b.x, b.y) : p;
        if (target) {
          const speed = dlen(b.vx, b.vy);
          const angle = turnToward(
            datan2(b.vy, b.vx),
            datan2(target.y - b.y, target.x - b.x),
            b.homing * DT
          );
          b.vx = dcos(angle) * speed;
          b.vy = dsin(angle) * speed;
        }
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (
        b.life <= 0 ||
        b.x < -10 ||
        b.y < -10 ||
        b.x > ARENA_W + 10 ||
        b.y > ARENA_H + 10
      ) {
        continue;
      }
      if (
        b.owner === "player"
          ? this.playerBulletHits(b)
          : this.enemyBulletHits(b)
      ) {
        continue;
      }
      kept.push(b);
    }
    // A hit can kill the boss, which clears every enemy shot by replacing the list; the survivors
    // kept here must honour that rather than bring those shots back.
    this.bullets =
      this.bullets === walked
        ? kept
        : kept.filter((bullet) => bullet.owner === "player");
  }

  /** Applies a player bullet's hit, if any. Returns whether the bullet is spent. */
  private playerBulletHits(b: Bullet) {
    const boss = this.boss;
    if (boss && boss.phase !== "dying") {
      const reach = BOSS_RADIUS + b.radius;
      const dx = boss.x - b.x;
      const dy = boss.y - b.y;
      if (dx * dx + dy * dy < reach * reach) {
        this.hitBoss(b.damage, b.x, b.y);
        return true;
      }
    }
    const reach = ENEMY_HITBOX + b.radius;
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        continue;
      }
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      // distance first: it rules out nearly every enemy, so the list of ones already hit is rarely read
      if (dx * dx + dy * dy < reach * reach && !b.hits.includes(e.id)) {
        this.damageEnemy(e, b.damage);
        if (b.pierce > 0) {
          b.pierce -= 1;
          b.hits.push(e.id);
          return false;
        }
        return true;
      }
    }
    return false;
  }

  private enemyBulletHits(b: Bullet) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTime > 0 || this.over) {
      return false;
    }
    const reach = PLAYER_HITBOX + b.radius;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    if (dx * dx + dy * dy < reach * reach) {
      this.hurtPlayer();
      return true;
    }
    return false;
  }

  private nearestTarget(x: number, y: number) {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        continue;
      }
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = e;
      }
    }
    const boss = this.boss;
    if (boss && boss.phase !== "dying") {
      const d = (boss.x - x) * (boss.x - x) + (boss.y - y) * (boss.y - y);
      if (d < bestDistance) {
        best = boss;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- boss

  private spawnBoss(number: number): ModelId {
    const index = number / BOSS_EVERY - 1;
    const model =
      this.rivals[index % this.rivals.length] ?? this.rivals[0] ?? "claude";
    const hp = Math.round(BOSS_HP * (1 + BOSS_HP_GROWTH * index));
    this.boss = {
      model,
      x: ARENA_W / 2,
      y: -BOSS_RADIUS * 2,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      phase: "enter",
      phaseTime: 0,
      clock: 0,
      angle: 0,
      attack: 0,
      attackTimer: 1,
      spiralTime: 0,
      spiralClock: 0,
      blastClock: 0,
      flash: 0,
    };
    return model;
  }

  private updateBoss() {
    const boss = this.boss;
    if (!boss) {
      return;
    }
    boss.phaseTime += DT;
    boss.flash = Math.max(0, boss.flash - DT);
    const raging = boss.hp < boss.maxHp / 3;
    let spin = raging ? 2.4 : 0.9;
    let tx = boss.x;
    let ty = boss.y;
    if (boss.phase === "enter") {
      const t = Math.min(1, boss.phaseTime / BOSS_ENTER_S);
      const inv = 1 - t;
      const ease = 1 - inv * inv * inv;
      tx = ARENA_W / 2;
      ty = -BOSS_RADIUS * 2 + (50 + BOSS_RADIUS * 2) * ease;
      spin = 4 * (1 - ease) + 0.9;
      if (t >= 1) {
        boss.phase = "fight";
        boss.phaseTime = 0;
      }
    } else if (boss.phase === "fight") {
      boss.clock += DT * (raging ? 1.5 : 1);
      tx = ARENA_W / 2 + dsin(boss.clock * 0.55) * (ARENA_W / 2 - 56);
      ty = 52 + dsin(boss.clock * 1.1) * 24;
      if (!this.over) {
        this.bossAttack(boss, raging);
      }
    } else {
      spin = 7;
      ty = boss.y + 8 * DT;
      boss.blastClock -= DT;
      if (boss.blastClock <= 0) {
        boss.blastClock = 0.12;
        const angle = this.rng() * TAU;
        const r = this.rng() * BOSS_RADIUS;
        this.emit({
          type: "bossBlast",
          x: boss.x + dcos(angle) * r,
          y: boss.y + dsin(angle) * r,
        });
      }
      if (boss.phaseTime >= BOSS_DYING_S) {
        this.bossFinale(boss);
        return;
      }
    }
    boss.angle += spin * DT;
    boss.vx = (tx - boss.x) / DT;
    boss.vy = (ty - boss.y) / DT;
    boss.x = tx;
    boss.y = ty;

    const p = this.player;
    // ramming only counts once it has arrived, not while it drops in from above
    if (
      boss.phase === "fight" &&
      dlen(p.x - boss.x, p.y - boss.y) < BOSS_RADIUS + PLAYER_HITBOX
    ) {
      this.hurtPlayer();
      // and you bounce off, so you can't stay stuck inside it
      const d = dlen(p.x - boss.x, p.y - boss.y) || 1;
      p.vx = ((p.x - boss.x) / d) * BOSS_KNOCK;
      p.vy = ((p.y - boss.y) / d) * BOSS_KNOCK;
    }
  }

  private bossAttack(boss: Boss, raging: boolean) {
    if (boss.spiralTime > 0) {
      boss.spiralTime -= DT;
      boss.spiralClock -= DT;
      while (boss.spiralClock <= 0) {
        boss.spiralClock += BOSS_SPIRAL_GAP_S;
        const a = boss.angle * 2.2;
        const arms = raging ? 3 : 2;
        for (let i = 0; i < arms; i += 1) {
          this.bossBullet(boss, a + (i / arms) * TAU, 1);
        }
      }
      return;
    }
    boss.attackTimer -= DT;
    if (boss.attackTimer > 0) {
      return;
    }
    boss.attackTimer = this.between(
      raging ? BOSS_RAGE_ATTACK_S : BOSS_ATTACK_S
    );
    const attack = boss.attack % 4;
    boss.attack += 1;
    const p = this.player;
    const bearing = datan2(p.y - boss.y, p.x - boss.x);
    this.emit({ type: "bossAttack", x: boss.x, y: boss.y });
    if (attack === 0) {
      const offset = this.rng() * TAU;
      const count = raging ? BOSS_RING_BULLETS + 4 : BOSS_RING_BULLETS;
      for (let i = 0; i < count; i += 1) {
        this.bossBullet(boss, offset + (i / count) * TAU, 1);
      }
    } else if (attack === 1) {
      const count = raging ? 7 : 5;
      for (let i = 0; i < count; i += 1) {
        this.bossBullet(boss, bearing + (i - (count - 1) / 2) * 0.16, 1.5);
      }
    } else if (attack === 2) {
      boss.spiralTime = BOSS_SPIRAL_S;
      boss.spiralClock = 0;
    } else if (this.enemies.length + this.pending.length < 3) {
      this.queueSpawn(boss.model, true);
      this.queueSpawn(boss.model, true);
    } else {
      for (let i = -1; i <= 1; i += 1) {
        this.bossBullet(boss, bearing + i * 0.08, 2);
      }
    }
  }

  private bossBullet(boss: Boss, angle: number, speedScale: number) {
    const weapon = modelSpec(boss.model).enemy.weapon;
    this.addBullet(
      "enemy",
      boss.model,
      boss.x + dcos(angle) * BOSS_RADIUS,
      boss.y + dsin(angle) * BOSS_RADIUS,
      angle,
      {
        ...weapon,
        pattern: "single",
        homing: 0,
        speed: BOSS_BULLET_SPEED * this.bulletScale(),
        radius: 2.5,
        life: BOSS_BULLET_LIFE,
      },
      speedScale,
      true
    );
  }

  private hitBoss(amount: number, x: number, y: number) {
    const boss = this.boss;
    if (!boss || boss.phase === "dying") {
      return;
    }
    boss.hp -= amount;
    boss.flash = 0.06;
    this.emit({ type: "bossHit", x, y });
    if (boss.hp > 0) {
      return;
    }
    boss.phase = "dying";
    boss.phaseTime = 0;
    boss.spiralTime = 0;
    for (const bullet of this.bullets) {
      if (bullet.owner === "enemy") {
        this.emit({
          type: "fizzle",
          x: bullet.x,
          y: bullet.y,
          model: bullet.model,
        });
      }
    }
    this.bullets = this.bullets.filter((bullet) => bullet.owner === "player");
  }

  private bossFinale(boss: Boss) {
    const points = BOSS_POINTS * (this.bosses + 1);
    this.score += points;
    this.bosses += 1;
    this.emit({
      type: "bossDeath",
      x: boss.x,
      y: boss.y,
      model: boss.model,
      points,
    });
    this.boss = null;
    // its escorts go down with it
    for (const enemy of this.enemies) {
      this.damageEnemy(enemy, enemy.hp);
    }
    this.pending = [];
    this.dropPickup(boss.x - 8, boss.y, "repair");
    this.dropPickup(boss.x + 8, boss.y, this.rollPickup());
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + 1);
    this.clearWave();
  }
}
