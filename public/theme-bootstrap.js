(() => {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
      document.documentElement.style.colorScheme = saved;
    }
  } catch {}
})();
