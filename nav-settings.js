/* RPM Area V40 — pilihan 11 gaya navigasi untuk setiap tema warna.
 * Data NAV disimpan lokal per browser, tidak menyentuh data penjualan maupun Supabase.
 * Default setiap tema berbeda, pilihan manual dapat diubah kembali kapan saja. */
(() => {
  'use strict';
  const styles = [
    ['minimal',   '01', 'Minimal Clean',       'Bersih · indikator titik'],
    ['glass',     '02', 'Glassmorphism',       'Kaca buram · transparan'],
    ['floating',  '03', 'Floating Detached',   'Melayang · tombol Input'],
    ['neumorph',  '04', 'Neumorphism',          'Relief lembut · soft shadow'],
    ['pill',      '05', 'Pill Highlight',       'Menu aktif berkapsul'],
    ['fab',       '06', 'Center FAB',           'Input besar di tengah'],
    ['gradient',  '07', 'Gradient Bold',        'Gradasi ungu · merah muda'],
    ['outline',   '08', 'Outline Icons',       'Ikon tipis · minimalis'],
    ['indicator', '09', 'Tab with Indicator',  'Garis aktif di atas'],
    ['curved',    '10', 'Curved Background',    'Latar melengkung ungu'],
    ['dock',      '11', 'Dock Style (iOS)',    'Dock kaca lembut']
  ];
  const defaults = {
    neon:'pill',violet:'glass',coral:'gradient',cyber:'fab',
    aurora:'floating',midnight:'dock',ocean:'curved',sunset:'indicator',forest:'neumorph'
  };
  const themeNames = {
    neon:'Neon Lime',violet:'Electric Violet',coral:'Coral Night',cyber:'Cyber Blue',
    aurora:'Aurora',midnight:'Midnight',ocean:'Ocean',sunset:'Sunset',forest:'Forest'
  };
  const storageKey = 'rpmarea_v40_nav_preferences_' + (window.RPM_AREA_SUPABASE?.workspaceId || 'rpm-area-12');
  let saved = {};
  try {
    const found = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (found && typeof found === 'object' && !Array.isArray(found)) {
      saved = Object.fromEntries(Object.entries(found).filter(([t,s])=>defaults[t] && styles.some(x=>x[0]===s)));
    }
  } catch(e) { console.warn('[RPM V40] Preferensi nav belum bisa dibaca',e); }
  const findStyle = id => styles.find(x=>x[0]===id);
  const currentTheme = () => defaults[document.body.dataset.theme] ? document.body.dataset.theme : 'neon';
  let draft = null;
  let lastTheme = null;
  let panel = null;
  function activeFor(theme) { return saved[theme] || defaults[theme] || 'pill'; }
  function setStyle(id) {
    if (!findStyle(id)) return;
    document.body.dataset.rpmNav = id;
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch(e) { console.warn('[RPM V40] Preferensi hanya berlaku sampai halaman ditutup',e); }
  }
  function updateCards() {
    if (!panel) return;
    const theme = currentTheme();
    const isOverride = !!saved[theme];
    const selected = draft || activeFor(theme);
    panel.querySelector('#rpm-nav-current-theme').textContent = themeNames[theme];
    panel.querySelector('#rpm-nav-current-name').textContent = (findStyle(selected) || [,'',''])[2];
    panel.querySelector('#rpm-nav-current-status').textContent = (draft && selected!==activeFor(theme)) ? 'Pratinjau (belum diterapkan)' : isOverride ? 'Pilihan manual tema ini' : 'Rekomendasi otomatis tema';
    panel.querySelectorAll('[data-rpm-nav-choice]').forEach(el => {
      const id = el.dataset.rpmNavChoice;
      const isSelected = id === selected;
      el.classList.toggle('selected', isSelected);
      el.classList.toggle('applied', id === activeFor(theme));
      el.setAttribute('aria-pressed', String(isSelected));
      el.querySelector('.rpm-nav-card-status').textContent = isSelected ? '✓ Dipilih' : (id === defaults[theme] ? 'Rekomendasi' : 'Pratinjau');
    });
    panel.querySelector('#rpm-nav-apply').disabled = !draft || draft === activeFor(theme);
    panel.querySelector('#rpm-nav-reset').disabled = !saved[theme] && !draft;
  }
  function onThemeChange(force = false) {
    const theme=currentTheme();
    if (force || theme !== lastTheme) {
      lastTheme = theme;
      draft = null;
      setStyle(activeFor(theme));
      updateCards();
    }
  }
  function miniPreview(id) {
    const icons = ['⌂','◎','▣','▢','☷'];
    const labels = ['fab','floating'].includes(id) ? ['Home','Target','Input','Toko','Lain'] : ['Home','Input','Target','Toko','Lain'];
    return `<span class="rpm-nav-mini rpm-nav-mini-${id}" aria-hidden="true"><span class="rpm-mini-inner">${icons.map((ico,i)=>`<i class="rpm-mini-tab ${i === (['fab','floating'].includes(id) ? 2 : 0) ? 'is-on' : ''}"><b>${ico}</b><em>${labels[i]}</em></i>`).join('')}</span></span>`;
  }
  function mount() {
    panel = document.getElementById('rpm-nav-v40-panel');
    if (!panel) return;
    const list = panel.querySelector('#rpm-nav-v40-grid');
    list.innerHTML = styles.map(([id,no,name,detail])=>`<button type="button" class="rpm-nav-choice" data-rpm-nav-choice="${id}" aria-pressed="false">${miniPreview(id)}<span class="rpm-nav-card-detail"><span class="rpm-nav-card-number">${no}</span><span><strong>${name}</strong><small>${detail}</small></span><span class="rpm-nav-card-status">Pratinjau</span></span></button>`).join('');
    panel.addEventListener('click', e => {
      const choice = e.target.closest('[data-rpm-nav-choice]');
      if (choice) {
        draft = choice.dataset.rpmNavChoice;
        setStyle(draft);
        updateCards();
        return;
      }
      if (e.target.closest('#rpm-nav-apply')) {
        if (!draft || !findStyle(draft)) return;
        saved[currentTheme()] = draft;
        persist();
        draft = null;
        onThemeChange(true);
        return;
      }
      if (e.target.closest('#rpm-nav-reset')) {
        delete saved[currentTheme()];
        persist();
        draft = null;
        onThemeChange(true);
        return;
      }
      if (e.target.closest('#rpm-nav-reset-all')) {
        if (!confirm('Kembalikan navigasi semua tema ke rekomendasi awal? Data RPM tidak terpengaruh.')) return;
        saved = {};
        persist();
        draft = null;
        onThemeChange(true);
      }
    });
    const observer = new MutationObserver(() => onThemeChange());
    observer.observe(document.body, { attributes:true, attributeFilter:['data-theme'] });
    onThemeChange(true);
    window.addEventListener('pageshow', () => onThemeChange(true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
