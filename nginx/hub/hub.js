const probes = {
  hospital: ['/api/hospital/peer0/health'],
  patient: ['/api/hospital/patient/health'],
  dashboard: ['/dashboard/'],
  ipfs: ['/api/hospital/ipfs/health'],
  lab: ['/lab/health', '/lab/api/health'],
  pharmacy: ['/pharmacy/'],
  digilocker: ['/api/digilocker/health'],
};

function savedTheme() {
  const cookie = document.cookie.match(/(?:^|; )ehr_appearance=(light|dark)/)?.[1];
  try {
    return cookie || localStorage.getItem('ehr_appearance') || 'light';
  } catch {
    return cookie || 'light';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.cookie = `ehr_appearance=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem('ehr_appearance', theme);
  } catch {}

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const label = toggle.querySelector('.toggle-label');
    if (label) {
      label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}

function setStatus(key, state, text) {
  const node = document.querySelector(`[data-check="${key}"]`);
  if (!node) return;
  node.classList.remove('checking', 'offline', 'online');
  node.classList.add(state);
  const textEl = node.querySelector('span:not(.live-dot)') || node.querySelector('span');
  if (textEl) {
    textEl.textContent = text;
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2600);
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshStatuses() {
  const dot = document.getElementById('system-dot');
  if (dot) {
    dot.className = 'system-dot-live checking';
  }
  for (const key of Object.keys(probes)) {
    setStatus(key, 'checking', 'Checking');
  }

  const entries = await Promise.all(
    Object.entries(probes).map(async ([key, urls]) => {
      let online = false;
      for (const url of urls) {
        if (await probe(url)) {
          online = true;
          break;
        }
      }
      setStatus(key, online ? 'online' : 'offline', online ? 'Responding' : 'Unavailable');
      return online;
    })
  );

  const count = entries.filter(Boolean).length;
  const stateCount = document.getElementById('system-state-count');
  if (stateCount) {
    stateCount.textContent = `${count} of ${entries.length} services responding`;
  }

  if (dot) {
    dot.className = 'system-dot-live' + (count === entries.length ? '' : count === 0 ? ' offline' : ' checking');
  }
}

// Tab filtering interaction
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-pill');
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      const sections = document.querySelectorAll('.service-section-wrap');

      if (filter === 'all') {
        sections.forEach(s => (s.style.display = 'block'));
      } else {
        sections.forEach(s => {
          if (s.dataset.category === filter) {
            s.style.display = 'block';
            s.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            s.style.display = 'none';
          }
        });
      }
    });
  });
}

// Nav link scrolling
function setupNavLinks() {
  document.querySelectorAll('.topbar-nav .nav-link').forEach(link => {
    link.addEventListener('click', e => {
      document.querySelectorAll('.topbar-nav .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(savedTheme());

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  setupTabs();
  setupNavLinks();
  refreshStatuses();
});
