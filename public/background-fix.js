(() => {
  const style = document.createElement("style");
  style.textContent = `
    body[data-start-art="true"] main {
      background-image: linear-gradient(rgba(2, 132, 199, 0.08), rgba(15, 23, 42, 0.18)), url('./assets/bg.webp?v=bgwebp1') !important;
    }
  `;
  document.head.append(style);
})();
