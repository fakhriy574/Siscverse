<!-- components/SpaceSky.vue -->
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const farY = ref(0)
const nearY = ref(0)
const solarY = ref(0)
let ticking = false

function update() {
  const y = window.scrollY
  farY.value = -((y * 0.03) % 360)   // modulo tile size = seamless loop
  nearY.value = -((y * 0.07) % 260)
  solarY.value = -Math.min(y * 0.05, 240)
  ticking = false
}
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(update)
}
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="sky" aria-hidden="true">
    <div class="milkyway"></div>
    <div class="nebula nebula-a"></div>
    <div class="nebula nebula-b"></div>
    <div class="galaxy"><span></span></div>

    <div class="stars stars-far" :style="{ transform: `translate3d(0, ${farY}px, 0)` }"></div>
    <div class="stars stars-near" :style="{ transform: `translate3d(0, ${nearY}px, 0)` }"></div>

    <div class="solar" :style="{ transform: `translate3d(0, ${solarY}px, 0)` }">
      <div class="solar-scale">
        <div class="sun"><span class="sun-glow"></span><span class="sun-core"></span></div>

        <div class="orbit" style="--d: 280px; --dur: 26s">
          <span class="planet p-lava"><span class="sphere"></span></span>
        </div>
        <div class="orbit" style="--d: 440px; --dur: 48s">
          <span class="planet p-earth">
            <span class="sphere"></span>
            <span class="moon-orbit"><span class="moon"></span></span>
          </span>
        </div>
        <div class="belt"></div>
        <div class="orbit" style="--d: 740px; --dur: 84s">
          <span class="planet p-gas">
            <span class="ring-wrap"><span class="ring ring-a"></span><span class="ring ring-b"></span></span>
            <span class="sphere"><span class="bands"></span></span>
            <span class="ring-wrap front"><span class="ring ring-a"></span><span class="ring ring-b"></span></span>
          </span>
        </div>
        <div class="orbit" style="--d: 960px; --dur: 130s">
          <span class="planet p-ice"><span class="sphere"></span></span>
        </div>
      </div>
    </div>

    <span class="comet c1"></span>
    <span class="comet c2"></span>
  </div>
</template>

<style scoped>
.sky { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }

/* deep space */
.milkyway { position: absolute; left: -20%; top: 8%; width: 140%; height: 38%; transform: rotate(-14deg);
  background: linear-gradient(100deg, transparent 25%, rgba(190,200,255,.05) 45%, rgba(230,215,255,.07) 52%, rgba(190,200,255,.04) 60%, transparent 78%); }
.nebula { position: absolute; border-radius: 50%; will-change: transform; animation: drift 34s ease-in-out infinite alternate; }
.nebula-a { width: 900px; height: 900px; left: -320px; top: -360px; background: radial-gradient(circle, rgba(70,90,200,.2), rgba(70,90,200,.06) 45%, transparent 70%); }
.nebula-b { width: 800px; height: 800px; right: -300px; bottom: -320px; animation-delay: -12s; background: radial-gradient(circle, rgba(200,90,140,.13), rgba(200,90,140,.04) 45%, transparent 70%); }
@keyframes drift { to { transform: translate3d(40px, -30px, 0) scale(1.06); } }

.galaxy { position: absolute; left: -90px; bottom: 6%; width: 340px; height: 340px; opacity: .55; transform: rotate(-24deg) scaleY(.48); }
.galaxy::before { content: ''; position: absolute; inset: 38%; border-radius: 50%; background: radial-gradient(circle, rgba(255,240,210,.85), transparent 65%); }
.galaxy span { display: block; width: 100%; height: 100%; border-radius: 50%; animation: turn 320s linear infinite;
  background: conic-gradient(transparent 0 8%, rgba(150,175,255,.45) 14%, transparent 30%, transparent 50%, rgba(255,205,160,.35) 64%, transparent 80%);
  -webkit-mask-image: radial-gradient(circle, #000, rgba(0,0,0,.6) 35%, transparent 70%); mask-image: radial-gradient(circle, #000, rgba(0,0,0,.6) 35%, transparent 70%); }

.stars { position: absolute; left: 0; right: 0; top: -360px; bottom: -360px; will-change: transform; }
.stars-far { background-size: 360px 360px; opacity: .5; animation: tw 7s ease-in-out infinite alternate;
  background-image: radial-gradient(1px 1px at 8% 12%, #fff, transparent), radial-gradient(1px 1px at 22% 47%, rgba(255,255,255,.8), transparent),
    radial-gradient(1.2px 1.2px at 37% 81%, #dfe8ff, transparent), radial-gradient(1px 1px at 51% 26%, #fff, transparent),
    radial-gradient(1px 1px at 63% 62%, rgba(255,255,255,.7), transparent), radial-gradient(1.2px 1.2px at 74% 9%, #ffeed6, transparent),
    radial-gradient(1px 1px at 86% 41%, #fff, transparent), radial-gradient(1px 1px at 93% 88%, rgba(255,255,255,.8), transparent),
    radial-gradient(1px 1px at 45% 96%, #fff, transparent), radial-gradient(1px 1px at 15% 74%, rgba(255,255,255,.7), transparent); }
.stars-near { background-size: 260px 260px; opacity: .85; animation: tw 4.5s ease-in-out infinite alternate-reverse;
  background-image: radial-gradient(1.6px 1.6px at 14% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 44% 12%, #fff, transparent),
    radial-gradient(2.2px 2.2px at 66% 58%, #ffdcae, transparent), radial-gradient(1.5px 1.5px at 84% 20%, #fff, transparent),
    radial-gradient(2px 2px at 28% 72%, #b9d6ff, transparent), radial-gradient(1.5px 1.5px at 92% 84%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 6% 92%, #fff, transparent); }
@keyframes tw { from { opacity: .3; } to { opacity: .8; } }

/* solar system: anchor = sun centre */
.solar { position: absolute; left: 80%; top: 24%; width: 0; height: 0; }
.solar-scale { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.sun { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.sun-core { position: absolute; left: -46px; top: -46px; width: 92px; height: 92px; border-radius: 50%;
  background: radial-gradient(circle at 42% 40%, #fffdf0, #ffe08a 30%, #f5a83a 65%, #d9691c);
  box-shadow: 0 0 40px 8px rgba(255,170,60,.5), 0 0 110px 40px rgba(255,120,30,.22); }
.sun-glow { position: absolute; left: -260px; top: -260px; width: 520px; height: 520px; border-radius: 50%; animation: glow 8s ease-in-out infinite alternate;
  background: radial-gradient(circle, rgba(255,170,70,.2), rgba(255,120,40,.07) 40%, transparent 68%); }
@keyframes glow { to { transform: scale(1.12); opacity: .8; } }

.orbit, .belt { position: absolute; left: 0; top: 0; width: var(--d); height: var(--d); margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2); border-radius: 50%; }
.orbit { border: 1px solid rgba(255,255,255,.06); animation: turn var(--dur) linear infinite; }
.belt { --d: 590px; border: 3px dotted rgba(210,200,180,.2); animation: counter 140s linear infinite; }
@keyframes turn { to { transform: rotate(360deg); } }
@keyframes counter { to { transform: rotate(-360deg); } }

/* planets sit at the top of their orbit, so the sun is always "below" them: light comes from the bottom */
.planet { position: absolute; left: 50%; top: 0; width: 0; height: 0; }
.sphere { position: absolute; left: calc(var(--s) / -2); top: calc(var(--s) / -2); width: var(--s); height: var(--s); border-radius: 50%; overflow: hidden; }
.p-lava { --s: 18px; } .p-earth { --s: 28px; } .p-gas { --s: 44px; } .p-ice { --s: 22px; }
.p-lava .sphere { background: radial-gradient(circle at 50% 82%, #ffb48c, #e2532a 50%, #4a1205 95%); box-shadow: 0 0 14px rgba(255,110,60,.4); }
.p-earth .sphere { background: radial-gradient(circle at 50% 82%, #9ddcff, #2b86c9 45%, #0a2b4d 95%); box-shadow: 0 0 16px rgba(80,170,255,.35); }
.p-ice .sphere { background: radial-gradient(circle at 50% 82%, #d2f5f8, #2ea9bb 48%, #093f49 95%); box-shadow: 0 0 14px rgba(60,200,220,.3); }
.p-gas .sphere { box-shadow: 0 0 22px rgba(242,184,75,.25); }
.bands { position: absolute; inset: -40%; animation: counter var(--dur) linear infinite;
  background: repeating-linear-gradient(0deg, #f3c56f 0 5px, #d38a2e 5px 9px, #efb650 9px 14px, #b8701f 14px 17px); }
.p-gas .sphere::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 50% 82%, rgba(255,240,205,.28), transparent 42%), radial-gradient(circle at 50% 18%, rgba(0,0,0,.72), transparent 70%); }

/* rings counter-rotate so their tilt stays fixed; the "front" copy is clipped to the near half and drawn over the sphere */
.ring-wrap { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: counter var(--dur) linear infinite; }
.ring { position: absolute; left: 0; top: 0; border-radius: 50%; transform: translate(-50%, -50%) rotate(-20deg) scaleY(.28); }
.ring-a { width: 104px; height: 104px; border: 3px solid rgba(240,200,120,.55); }
.ring-b { width: 84px; height: 84px; border: 2px solid rgba(200,150,70,.4); }
.front .ring { clip-path: inset(50% 0 0 0); }

.moon-orbit { position: absolute; left: -26px; top: -26px; width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,.1); animation: turn 9s linear infinite; }
.moon { position: absolute; left: 50%; top: 0; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: radial-gradient(circle at 50% 80%, #fff, #b9bcc6 60%, #555); }

@media (max-width: 1023px) { .solar-scale { transform: scale(.62); } }
@media (max-width: 640px) { .solar-scale { transform: scale(.5); } .galaxy { display: none; } }

/* comets: head at the left end, tail fades to the right; travels down-left */
.comet { position: absolute; width: 130px; height: 2px; border-radius: 2px; opacity: 0; animation: shoot 12s linear infinite;
  background: linear-gradient(90deg, #fff, rgba(210,225,255,.5) 18%, transparent); filter: drop-shadow(0 0 4px rgba(255,255,255,.8)); }
.c1 { top: 12%; left: 92%; animation-delay: 3s; }
.c2 { top: 48%; left: 105%; animation-delay: 9s; animation-duration: 15s; }
@keyframes shoot {
  0% { opacity: 0; transform: translate(0, 0) rotate(-37deg); }
  3% { opacity: 1; }
  12%, 100% { opacity: 0; transform: translate(-760px, 570px) rotate(-37deg); }
}

@media (prefers-reduced-motion: reduce) {
  .stars, .nebula, .sun-glow, .orbit, .belt, .bands, .ring-wrap, .moon-orbit, .galaxy span { animation: none; }
  .comet { display: none; }
}
</style>