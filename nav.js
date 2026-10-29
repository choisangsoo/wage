(function () {
  const menuBtn = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("drawer-close");
  const drawer = document.getElementById("site-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  if (!menuBtn || !closeBtn || !drawer || !backdrop) return;

  function isOpen() {
    return drawer.classList.contains("is-open");
  }

  function alignDrawer() {
    const rect = menuBtn.getBoundingClientRect();
    drawer.style.right = `${Math.max(0, window.innerWidth - rect.right)}px`;
  }

  function openDrawer() {
    alignDrawer();
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    closeBtn.focus();
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    menuBtn.focus();
  }

  menuBtn.addEventListener("click", () => {
    if (isOpen()) closeDrawer();
    else openDrawer();
  });
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeDrawer();
  });
  backdrop.addEventListener("click", closeDrawer);
  window.addEventListener("resize", () => {
    if (isOpen()) alignDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) closeDrawer();
  });
})();
