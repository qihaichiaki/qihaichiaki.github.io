export function adminPage() {
  return `
    <main id="top" class="admin-page-main">
      <section class="admin-workspace">
        <div class="admin-shell">
          <header class="admin-shell-head">
            <div>
              <p class="section-tag">SITE ADMIN</p>
              <h1 class="admin-page-title">展示图片</h1>
              <p class="admin-page-lead">管理首页轮播使用的 <code>assets/img</code> 图片。</p>
            </div>
            <span id="admin-owner-badge" class="admin-owner-badge">校验中</span>
          </header>

          <div id="admin-access-status" class="admin-access-status" role="status" aria-live="polite">
            正在校验 GitHub 管理权限...
          </div>

          <div id="admin-image-manager" class="admin-image-manager is-hidden">
            <div class="admin-image-toolbar">
              <div>
                <h2>站点图片</h2>
                <p id="admin-image-summary">正在读取仓库图片...</p>
              </div>
              <div class="admin-upload-action">
                <input
                  id="admin-image-input"
                  class="sr-only"
                  type="file"
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  multiple
                />
                <button id="admin-upload-button" class="btn btn-main" type="button">选择并上传</button>
              </div>
            </div>

            <div id="admin-image-list" class="admin-image-list">
              <p class="loading">正在读取展示图片...</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}
