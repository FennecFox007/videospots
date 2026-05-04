// Apply the dark-mode class to <html> before first paint, based on either
// the user's saved preference (localStorage) or the OS color-scheme. Loaded
// from app/layout.tsx as <script src="/theme-init.js"> in <head>; running
// here is what prevents the page from flashing light → dark on cold load.
//
// Lives as an external file (rather than an inline <script>) because React
// 19 warns about <script> tags inside the React render tree. Browsers fetch
// external scripts in <head> with high priority and execute them before
// continuing with body parsing, so the FOUC story is identical.
(function () {
  try {
    var t = localStorage.getItem("theme");
    var d =
      t === "dark" ||
      (!t && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (d) document.documentElement.classList.add("dark");
  } catch (e) {
    // localStorage / matchMedia can throw in restricted contexts (e.g.
    // file://). Silently ignore — the page just stays in light mode.
  }
})();
