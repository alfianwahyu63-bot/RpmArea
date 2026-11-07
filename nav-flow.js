/* RPM Area V40 — 5 navigasi inti + menu sekunder, tanpa mengubah logika aplikasi.
 * Menu yang tidak ditampilkan di dock tetap memakai data-page bawaan. */
(() => {
  'use strict';
  const secondary = ['history', 'tools', 'settings'];
  const descriptions = {
    history: 'Rekap mingguan & bulanan',
    tools: 'Statistik, laporan & alat',
    settings: 'Tema & pengaturan aplikasi'
  };
  function boot() {
    const sidebar = document.querySelector('aside.sidebar');
    const dock = sidebar?.querySelector('nav.nav-modern');
    if (!sidebar || !dock || dock.querySelector('.rpm-more-button')) return;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'rpm-more-button';
    more.setAttribute('aria-label', 'Menu lainnya');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', 'rpm-more-panel');
    more.innerHTML = `<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="6" height="6" rx="1.8"/><rect x="14" y="4" width="6" height="6" rx="1.8"/><rect x="4" y="14" width="6" height="6" rx="1.8"/><rect x="14" y="14" width="6" height="6" rx="1.8"/></svg></span><span class="nav-short" aria-hidden="true">Lainnya</span>`;
    dock.append(more);

    const shade = document.createElement('div');
    shade.className = 'rpm-more-backdrop';
    shade.hidden = true;
    const panel = document.createElement('section');
    panel.className = 'rpm-more-panel';
    panel.id = 'rpm-more-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Menu navigasi tambahan');
    panel.innerHTML = `<div class="rpm-more-heading"><strong>Menu lainnya</strong><button type="button" class="rpm-more-close" aria-label="Tutup menu">×</button></div>`;
    const iconFallback = '<span>●</span>';
    for (const page of secondary) {
      const original = dock.querySelector(`.navbtn[data-page="${page}"]`);
      if (!original) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'rpm-more-link';
      el.dataset.page = page;
      const label = page === 'history' ? 'Arsip' : page === 'tools' ? 'Analitik' : 'Setelan';
      const ico = original.querySelector('.nav-icon')?.innerHTML || iconFallback;
      el.innerHTML = `<span class="nav-icon" aria-hidden="true">${ico}</span><span><strong>${label}</strong><small>${descriptions[page]}</small></span>`;
      panel.append(el);
    }
    document.body.append(shade, panel);
    let lastFocus = null;
    function setOpen(value) {
      const open = !!value && matchMedia('(max-width:920px)').matches;
      shade.hidden = !open;
      panel.hidden = !open;
      more.setAttribute('aria-expanded', String(open));
      more.classList.toggle('rpm-menu-open', open);
      if (open) {
        lastFocus = document.activeElement;
        panel.querySelector('.rpm-more-link')?.focus({ preventScroll: true });
      } else if (lastFocus && panel.contains(document.activeElement)) {
        more.focus({ preventScroll: true });
      }
    }
    more.addEventListener('click', () => setOpen(panel.hidden));
    shade.addEventListener('click', () => setOpen(false));
    panel.querySelector('.rpm-more-close')?.addEventListener('click', () => setOpen(false));
    panel.addEventListener('click', e => {
      if (e.target.closest('.rpm-more-link')) setOpen(false);
    });
    dock.querySelectorAll('.navbtn').forEach(el => el.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) setOpen(false);
    });
    window.addEventListener('resize', () => {
      if (!matchMedia('(max-width:920px)').matches) setOpen(false);
    }, { passive: true });
    function updateSelected() {
      const active = dock.querySelector('.navbtn.active')?.dataset.page;
      const isSecondary = secondary.includes(active);
      more.classList.toggle('active', isSecondary);
      more.setAttribute('aria-current', isSecondary ? 'page' : 'false');
      dock.querySelectorAll('.navbtn').forEach(el => el.setAttribute('aria-current', el.classList.contains('active') ? 'page' : 'false'));
      panel.querySelectorAll('.rpm-more-link').forEach(el => {
        const selected = el.dataset.page === active;
        el.classList.toggle('active', selected);
        el.setAttribute('aria-current', selected ? 'page' : 'false');
      });
    }
    const observer = new MutationObserver(updateSelected);
    dock.querySelectorAll('.navbtn').forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
    updateSelected();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
