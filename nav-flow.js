/* RPM Area V38 — moving continuous-flow ribbon. Purely presentational. */
(() => {
  'use strict';
  function initializeFlowNavigation() {
    const sidebar = document.querySelector('aside.sidebar');
    const nav = sidebar && sidebar.querySelector('nav.nav-modern');
    if (!sidebar || !nav || sidebar.querySelector('.rpm-flow-svg')) return;

    const brand = document.createElement('div');
    brand.className = 'rpm-brand-disc';
    brand.textContent = 'R';
    brand.setAttribute('aria-hidden', 'true');
    sidebar.insertBefore(brand, nav);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'rpm-flow-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<defs><filter id="rpm-red-glow" x="-15%" y="-100%" width="130%" height="300%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path class="rpm-crest-fill" fill="#222127"/>
      <path class="rpm-flow-glow" stroke="#ef3755" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.30" filter="url(#rpm-red-glow)"/>
      <path class="rpm-flow-line" stroke="#d9354e" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
    sidebar.insertBefore(svg, nav);
    const fill = svg.querySelector('.rpm-crest-fill');
    const line = svg.querySelector('.rpm-flow-line');
    const glow = svg.querySelector('.rpm-flow-glow');
    let position = null;
    let raf = 0;
    let timer = null;

    function draw(x) {
      if (!window.matchMedia('(max-width: 920px)').matches) return;
      const sidebarRect = sidebar.getBoundingClientRect();
      const w = sidebarRect.width;
      if (!w) return;
      svg.setAttribute('viewBox', `0 0 ${w} 114`);
      // 24px offset accounts for the SVG extending above the dark base capsule.
      const shoulderY = 94;
      const crestY = 21;
      const left = x - 25;
      const right = x + 25;
      const fillD = [
        `M ${x-55} ${shoulderY}`,
        `C ${x-38} ${shoulderY-2} ${x-43} ${crestY+10} ${left} ${crestY+3}`,
        `C ${x-14} ${crestY-4} ${x+14} ${crestY-4} ${right} ${crestY+3}`,
        `C ${x+43} ${crestY+10} ${x+38} ${shoulderY-2} ${x+55} ${shoulderY}`,
        `L ${x+55} 96 L ${x-55} 96 Z`
      ].join(' ');
      const lineD = [
        `M ${Math.max(5,x-55)} ${shoulderY}`,
        `C ${x-38} ${shoulderY-2} ${x-43} ${crestY+10} ${left} ${crestY+3}`,
        `C ${x-14} ${crestY-4} ${x+14} ${crestY-4} ${right} ${crestY+3}`,
        `C ${x+43} ${crestY+10} ${x+38} ${shoulderY-2} ${x+55} ${shoulderY}`,
        `Q ${Math.min(w-25,x+66)} ${shoulderY+6} ${Math.min(w-17,x+80)} ${shoulderY+6}`,
        `L ${w-25} ${shoulderY+6}`
      ].join(' ');
      fill.setAttribute('d', fillD);
      line.setAttribute('d', lineD);
      glow.setAttribute('d', lineD);
    }
    function measureTarget() {
      const selected = nav.querySelector('.navbtn.active') || nav.querySelector('.navbtn');
      if (!selected) return null;
      const r = selected.getBoundingClientRect();
      const s = sidebar.getBoundingClientRect();
      return r.left + r.width/2 - s.left;
    }
    function update(animate = true) {
      cancelAnimationFrame(raf);
      if (!window.matchMedia('(max-width: 920px)').matches) return;
      const goal = measureTarget();
      if (goal === null) return;
      if (position === null || !animate || window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
        position = goal;
        draw(position);
        return;
      }
      const start = performance.now();
      const from = position;
      const duration = 280;
      function frame(now) {
        const t = Math.min(1,(now-start)/duration);
        const e = 1 - Math.pow(1-t, 3);
        position = from + (goal-from)*e;
        draw(position);
        if (t<1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }
    const changes = new MutationObserver(mutations => {
      if (mutations.some(m => m.type === 'attributes' && m.attributeName === 'class')) {
        clearTimeout(timer);
        timer = setTimeout(() => update(true), 16);
      }
    });
    nav.querySelectorAll('.navbtn').forEach(btn => changes.observe(btn, {attributes:true, attributeFilter:['class']}));
    window.addEventListener('resize', () => update(false), {passive:true});
    window.addEventListener('orientationchange', () => setTimeout(() => update(false),200), {passive:true});
    window.addEventListener('pageshow', () => update(false));
    requestAnimationFrame(() => update(false));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeFlowNavigation, {once:true});
  else initializeFlowNavigation();
})();
