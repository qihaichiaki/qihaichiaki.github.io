const THEME_KEY = "qihai_theme_mode";
const DAY_THEME = "day";
const NIGHT_THEME = "night";
const LABEL_DAY = "\u767d\u5929";
const LABEL_NIGHT = "\u591c\u665a";
const LABEL_PREFIX = "\u5207\u6362\u5230";
const LABEL_SUFFIX = "\u4e3b\u9898";

const isThemeValue = (value) => value === DAY_THEME || value === NIGHT_THEME;
const themeLabel = (theme) => (theme === NIGHT_THEME ? LABEL_NIGHT : LABEL_DAY);

const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return "";
  }
};

const writeTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore storage errors
  }
};

const getPreferredTheme = () => {
  const stored = readTheme();
  if (isThemeValue(stored)) {
    return stored;
  }

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? NIGHT_THEME : DAY_THEME;
};

const setToggleState = (toggle, theme) => {
  if (!toggle) return;

  const nextTheme = theme === NIGHT_THEME ? DAY_THEME : NIGHT_THEME;
  const nextLabel = themeLabel(nextTheme);
  const nextAria = `${LABEL_PREFIX}${themeLabel(nextTheme)}${LABEL_SUFFIX}`;

  toggle.textContent = nextLabel;
  toggle.setAttribute("aria-label", nextAria);
  toggle.dataset.nextTheme = nextTheme;
};

const applyTheme = (theme, toggle) => {
  const finalTheme = isThemeValue(theme) ? theme : DAY_THEME;
  document.documentElement.setAttribute("data-theme", finalTheme);
  writeTheme(finalTheme);
  setToggleState(toggle, finalTheme);
};

export const setupThemeToggle = (selector = "#theme-toggle") => {
  const toggle = document.querySelector(selector);
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme, toggle);

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === NIGHT_THEME ? DAY_THEME : NIGHT_THEME;
    applyTheme(next, toggle);
  });
};
