// Runs before paint (inlined in <head>) so there's no flash of the wrong
// theme -- layout.tsx is a server component and can't read localStorage
// itself, so this tiny script does it client-side ahead of hydration.
export const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("studia-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;
