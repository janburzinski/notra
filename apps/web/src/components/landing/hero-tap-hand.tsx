import { motion, useScroll, useTransform } from "motion/react";

export function HeroTapHand() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 160], [1, 0]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 z-10 w-0 motion-reduce:hidden"
      style={{ opacity }}
    >
      <span className="absolute -top-5 -left-5 size-10 [animation:heroTapRipple_2.4s_ease-out_1.5s_2] rounded-full bg-white/70 opacity-0" />
      <div className="[animation:heroTapEnter_1.1s_cubic-bezier(0.32,0.72,0,1)_0.4s_both,heroTapExit_0.9s_cubic-bezier(0.5,0,0.75,0)_6.3s_forwards]">
        <img
          alt=""
          className="w-[7rem] max-w-none origin-[2.73rem_0.42rem] -translate-x-[2.73rem] -translate-y-[0.42rem] rotate-[-12deg] [animation:heroTapLoop_2.4s_cubic-bezier(0.32,0.72,0,1)_1.5s_2] drop-shadow-[0_0.75rem_1.25rem_rgba(0,0,0,0.18)]"
          decoding="async"
          height={256}
          src="/landing/tap-hand.png"
          width={256}
        />
      </div>
    </motion.div>
  );
}
