import { AIM_STEPS } from "@/constants/replay";
import type { TickInput } from "@/types/game";
import type { Overlay } from "@/types/render";

const BOOST_KEYS = new Set(["ShiftLeft", "ShiftRight"]);
const BRAKE_KEYS = new Set(["KeyC"]);
const DASH_KEYS = new Set(["Space", "KeyK"]);
const FIRE_KEYS = new Set(["KeyJ"]);
const BOMB_KEYS = new Set(["KeyE", "KeyQ", "KeyL"]);
/** Keys whose browser default (scrolling, mostly) the game swallows. */
const GAME_KEYS = new Set([...BOOST_KEYS, ...BRAKE_KEYS, ...DASH_KEYS]);
const STICK_RADIUS = 48;
const STICK_DEADZONE = 0.25;
/** Past this much of the stick's reach, the ship boosts. */
const STICK_BOOST = 0.92;
/** The mouse steers only while it is at least this many art pixels from the ship. */
const MOUSE_DEADZONE = 10;

interface Stick {
  id: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
}

function steerIndex(angle: number) {
  return (
    ((Math.round((angle / (Math.PI * 2)) * AIM_STEPS) % AIM_STEPS) +
      AIM_STEPS) %
    AIM_STEPS
  );
}

/**
 * Turns keyboard, mouse, touch and gamepad into one TickInput per simulation tick. The ship flies on
 * its own; the player steers its nose, fires forward, and can boost, brake, dash and strike.
 *
 * - Mouse: the nose turns toward the cursor; left button fires, right button strikes.
 * - Keyboard: Shift boosts, C brakes, J fires, Space dashes, E strikes; steering is the mouse's.
 * - Touch: the left thumb steers (push to the edge to boost), the right thumb holds to boost; with
 *   no buttons to spare, the guns fire on their own.
 * - Gamepad: left stick steers, RT fires, RB boosts, LT brakes, A dashes, B strikes.
 */
export class InputController {
  private readonly surface: HTMLElement;
  private readonly keys = new Set<string>();
  private mouse: { x: number; y: number } | null = null;
  private mouseDown = false;
  private dashLatch = false;
  private bombLatch = false;
  private steerStick: Stick | null = null;
  private boostTouch: number | null = null;
  private padButtons: boolean[] = [];
  private readonly cleanup: (() => void)[] = [];
  /** Set when the last input came from touch, so the UI can show its buttons. */
  touch = false;

  constructor(surface: HTMLElement) {
    this.surface = surface;
    const on = <K extends keyof WindowEventMap>(
      type: K,
      handler: (event: WindowEventMap[K]) => void,
      target: Window | HTMLElement = window
    ) => {
      target.addEventListener(type, handler as EventListener, {
        passive: false,
      });
      this.cleanup.push(() =>
        target.removeEventListener(type, handler as EventListener)
      );
    };
    on("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (GAME_KEYS.has(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        if (DASH_KEYS.has(event.code)) {
          this.dashLatch = true;
        }
        if (BOMB_KEYS.has(event.code)) {
          this.bombLatch = true;
        }
      }
      this.keys.add(event.code);
      this.touch = false;
    });
    on("keyup", (event) => this.keys.delete(event.code));
    on("blur", () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    on("pointermove", (event) => {
      if (event.pointerType === "mouse") {
        this.mouse = { x: event.clientX, y: event.clientY };
        this.touch = false;
      }
    });
    on(
      "pointerdown",
      (event) => {
        if (event.pointerType !== "mouse") {
          return;
        }
        this.mouse = { x: event.clientX, y: event.clientY };
        if (event.button === 0) {
          this.mouseDown = true;
        } else if (event.button === 2) {
          this.bombLatch = true;
        }
      },
      surface
    );
    on("pointerup", (event) => {
      if (event.pointerType === "mouse" && event.button === 0) {
        this.mouseDown = false;
      }
    });
    on("contextmenu", (event) => event.preventDefault(), surface);
    on("touchstart", (event) => this.touchStart(event), surface);
    on("touchmove", (event) => this.touchMove(event), surface);
    on("touchend", (event) => this.touchEnd(event), surface);
    on("touchcancel", (event) => this.touchEnd(event), surface);
  }

  destroy() {
    for (const off of this.cleanup) {
      off();
    }
  }

  /** Drops presses that haven't reached a tick yet, so keys mashed during a pause don't fire on resume. */
  clearPresses() {
    this.dashLatch = false;
    this.bombLatch = false;
  }

  pressDash() {
    this.dashLatch = true;
  }

  pressBomb() {
    this.bombLatch = true;
  }

  private touchStart(event: TouchEvent) {
    this.touch = true;
    const bounds = this.surface.getBoundingClientRect();
    for (const touch of Array.from(event.changedTouches)) {
      if ((touch.target as Element | null)?.closest("button")) {
        continue;
      }
      event.preventDefault();
      if (touch.clientX < bounds.left + bounds.width / 2) {
        this.steerStick ??= {
          id: touch.identifier,
          originX: touch.clientX,
          originY: touch.clientY,
          dx: 0,
          dy: 0,
        };
      } else {
        this.boostTouch ??= touch.identifier;
      }
    }
  }

  private touchMove(event: TouchEvent) {
    const stick = this.steerStick;
    for (const touch of Array.from(event.changedTouches)) {
      if (stick?.id !== touch.identifier) {
        continue;
      }
      event.preventDefault();
      let dx = (touch.clientX - stick.originX) / STICK_RADIUS;
      let dy = (touch.clientY - stick.originY) / STICK_RADIUS;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        // drag the stick's centre along so it never runs off under the thumb
        stick.originX += (dx / length) * (length - 1) * STICK_RADIUS;
        stick.originY += (dy / length) * (length - 1) * STICK_RADIUS;
        dx /= length;
        dy /= length;
      }
      stick.dx = dx;
      stick.dy = dy;
    }
  }

  private touchEnd(event: TouchEvent) {
    for (const touch of Array.from(event.changedTouches)) {
      if (this.steerStick?.id === touch.identifier) {
        this.steerStick = null;
      }
      if (this.boostTouch === touch.identifier) {
        this.boostTouch = null;
      }
    }
  }

  private pollPad() {
    const pads =
      typeof navigator.getGamepads === "function"
        ? navigator.getGamepads()
        : [];
    const pad = Array.from(pads).find((entry) => entry?.connected);
    if (!pad) {
      return null;
    }
    const pressed = (index: number) => pad.buttons[index]?.pressed ?? false;
    const edge = (index: number) => {
      const now = pressed(index);
      const was = this.padButtons[index] ?? false;
      this.padButtons[index] = now;
      return now && !was;
    };
    if (edge(0)) {
      this.dashLatch = true;
    }
    if (edge(1)) {
      this.bombLatch = true;
    }
    return {
      x: pad.axes[0] ?? 0,
      y: pad.axes[1] ?? 0,
      fire: pressed(7),
      boost: pressed(5),
      brake: pressed(6),
    };
  }

  private held(keys: Set<string>) {
    for (const key of keys) {
      if (this.keys.has(key)) {
        return true;
      }
    }
    return false;
  }

  /** The input for the next tick, steering from the ship's spot on screen. */
  sample(
    ship: { x: number; y: number; heading: number },
    canvas: HTMLCanvasElement
  ): TickInput {
    const pad = this.pollPad();
    let steer: number | null = null;
    let throttle: -1 | 0 | 1 = 0;
    let fire = this.mouseDown || this.held(FIRE_KEYS) || this.touch;

    if (this.mouse && !this.touch) {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.width || 1;
      const dx = (this.mouse.x - rect.left) / scale - (ship.x + 0.5);
      const dy = (this.mouse.y - rect.top) / scale - (ship.y + 0.5);
      if (Math.hypot(dx, dy) > MOUSE_DEADZONE) {
        steer = Math.atan2(dy, dx);
      }
    }
    if (this.held(BOOST_KEYS)) {
      throttle = 1;
    } else if (this.held(BRAKE_KEYS)) {
      throttle = -1;
    }

    if (pad) {
      if (Math.hypot(pad.x, pad.y) > STICK_DEADZONE) {
        steer = Math.atan2(pad.y, pad.x);
      }
      if (pad.boost) {
        throttle = 1;
      } else if (pad.brake) {
        throttle = -1;
      }
      fire ||= pad.fire;
    }

    const stick = this.steerStick;
    if (stick) {
      const reach = Math.hypot(stick.dx, stick.dy);
      if (reach > STICK_DEADZONE) {
        steer = Math.atan2(stick.dy, stick.dx);
        if (reach > STICK_BOOST) {
          throttle = 1;
        }
      }
    }
    if (this.boostTouch !== null) {
      throttle = 1;
    }

    const input: TickInput = {
      steer: steerIndex(steer ?? ship.heading),
      steering: steer !== null,
      throttle,
      fire,
      dash: this.dashLatch,
      bomb: this.bombLatch,
    };
    this.dashLatch = false;
    this.bombLatch = false;
    return input;
  }

  /** The reticle and touch stick, in art pixels, for the renderer. */
  overlay(canvas: HTMLCanvasElement, hud: boolean, paused: boolean): Overlay {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width || 1;
    const toArt = (x: number, y: number) => ({
      x: Math.round((x - rect.left) / scale),
      y: Math.round((y - rect.top) / scale),
    });
    const stick = this.steerStick;
    return {
      // while paused the system cursor is back, so a reticle would be a second pointer
      reticle:
        this.mouse && !this.touch && !paused
          ? toArt(this.mouse.x, this.mouse.y)
          : null,
      sticks: stick
        ? [
            {
              ...toArt(stick.originX, stick.originY),
              dx: stick.dx,
              dy: stick.dy,
            },
          ]
        : [],
      hud,
    };
  }
}
