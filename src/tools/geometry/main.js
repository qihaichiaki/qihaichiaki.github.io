import { initializeGeometryWorkspace } from "./workspace.js?v=20260820";

initializeGeometryWorkspace().catch((error) => {
  console.error(error);
  const root = document.querySelector("#app");
  if (root) {
    root.innerHTML = `
      <main class="geometry-fatal-error">
        <h1>几何作图工具未能启动</h1>
        <p>${String(error?.message || "未知错误")}</p>
        <a href="../../tools.html">返回工具页</a>
      </main>
    `;
  }
});
