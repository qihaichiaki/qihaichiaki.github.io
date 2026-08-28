param(
  [int]$Port = 4173,
  [switch]$Preview,
  [switch]$KeepServer
)

$ErrorActionPreference = "Stop"

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

Write-Host "[1/5] 检查关键文件..."
$required = @(
  "assets/SiteIcon.jpg",
  "assets/img",
  "index.html",
  "blog.html",
  "tasks.html",
  "admin.html",
  "src/main.js",
  "src/blog.js",
  "src/tasks.js",
  "src/admin.js",
  "src/components/hero.js",
  "src/components/blogPage.js",
  "src/components/tasksPage.js",
  "src/components/adminPage.js",
  "src/styles/main.css",
  "src/lib/markdown.js",
  "src/lib/heroCharacterGallery.js",
  "src/lib/postDraftsStore.js",
  "src/lib/postsApi.js",
  "src/lib/siteImagesApi.js",
  "src/lib/siteConfig.js",
  "src/lib/tasksApi.js",
  "src/lib/tasksModel.js",
  "src/lib/tasksStore.js",
  "src/vendor/marked.esm.js",
  "scripts/new-post.ps1",
  "content/posts/index.json",
  "content/site-config.json",
  "content/tasks/board.json",
  "worker/package.json",
  "worker/wrangler.jsonc",
  "worker/src/index.js"
)

foreach ($file in $required) {
  Assert-True (Test-Path $file) "缺少文件: $file"
}

$heroImages = @(
  Get-ChildItem -LiteralPath "assets/img" -File |
    Where-Object { $_.Extension -match '^\.(avif|gif|jpe?g|png|webp)$' }
)
Assert-True ($heroImages.Count -ge 1) "assets/img 至少需要一张可用于首页展示的图片"
$heroImageUrlPath = "assets/img/" + [Uri]::EscapeDataString($heroImages[0].Name)

$posts = Get-Content -Raw "content/posts/index.json" | ConvertFrom-Json
foreach ($post in $posts) {
  Assert-True ($post.file -ne $null -and $post.file -ne "") "文章索引中存在空 file 字段"
  Assert-True ($post.createdAt -ne $null -and $post.createdAt -ne "") ("文章缺少 createdAt: " + $post.file)
  Assert-True ($post.updatedAt -ne $null -and $post.updatedAt -ne "") ("文章缺少 updatedAt: " + $post.file)
  $parsedTimestamp = [DateTimeOffset]::MinValue
  Assert-True ([DateTimeOffset]::TryParse([string]$post.createdAt, [ref]$parsedTimestamp)) ("createdAt 格式错误: " + $post.file)
  Assert-True ([DateTimeOffset]::TryParse([string]$post.updatedAt, [ref]$parsedTimestamp)) ("updatedAt 格式错误: " + $post.file)
  Assert-True (Test-Path ("content/posts/" + $post.file)) ("索引引用的 md 不存在: " + $post.file)
}

Write-Host "[2/5] 检查页面资源引用..."
$index = Get-Content -Raw "index.html"
$blog = Get-Content -Raw "blog.html"
$tasks = Get-Content -Raw "tasks.html"
$admin = Get-Content -Raw "admin.html"
Assert-True ($index -match "src/styles/main.css") "index.html 未引用 src/styles/main.css"
Assert-True ($index -match "src/main.js") "index.html 未引用 src/main.js"
Assert-True ($blog -match "src/styles/main.css") "blog.html 未引用 src/styles/main.css"
Assert-True ($blog -match "src/blog.js") "blog.html 未引用 src/blog.js"
Assert-True ($tasks -match "src/styles/main.css") "tasks.html 未引用 src/styles/main.css"
Assert-True ($tasks -match "src/tasks.js") "tasks.html 未引用 src/tasks.js"
Assert-True ($admin -match "src/styles/main.css") "admin.html 未引用 src/styles/main.css"
Assert-True ($admin -match "src/admin.js") "admin.html 未引用 src/admin.js"
Assert-True ($index -match "assets/SiteIcon.jpg") "index.html 未引用网站图标"
Assert-True ($blog -match "assets/SiteIcon.jpg") "blog.html 未引用网站图标"
Assert-True ($tasks -match "assets/SiteIcon.jpg") "tasks.html 未引用网站图标"
Assert-True ($admin -match "assets/SiteIcon.jpg") "admin.html 未引用网站图标"

Write-Host "[3/5] 检查脚本语法..."
node --check "src/main.js" | Out-Null
node --check "src/blog.js" | Out-Null
node --check "src/tasks.js" | Out-Null
node --check "src/admin.js" | Out-Null
node --check "src/components/hero.js" | Out-Null
node --check "src/components/blogPage.js" | Out-Null
node --check "src/components/tasksPage.js" | Out-Null
node --check "src/components/adminPage.js" | Out-Null
node --check "src/lib/heroCharacterGallery.js" | Out-Null
node --check "src/lib/markdown.js" | Out-Null
node --check "src/lib/postDraftsStore.js" | Out-Null
node --check "src/lib/postsApi.js" | Out-Null
node --check "src/lib/siteImagesApi.js" | Out-Null
node --check "src/lib/siteConfig.js" | Out-Null
node --check "src/lib/tasksApi.js" | Out-Null
node --check "src/lib/tasksModel.js" | Out-Null
node --check "src/lib/tasksStore.js" | Out-Null
Push-Location "worker"
try {
  node --check "src/index.js" | Out-Null
}
finally {
  Pop-Location
}

Write-Host "[4/5] 启动本地静态服务并验证 HTTP 响应..."
$job = Start-Job -ScriptBlock {
  param($p)
  Set-Location $using:PWD
  python -m http.server $p
} -ArgumentList $Port

try {
  Start-Sleep -Seconds 2

  $base = "http://127.0.0.1:$Port"
  $indexResp = Invoke-WebRequest -Uri "$base/index.html" -UseBasicParsing
  $blogResp = Invoke-WebRequest -Uri "$base/blog.html" -UseBasicParsing
  $tasksResp = Invoke-WebRequest -Uri "$base/tasks.html" -UseBasicParsing
  $adminResp = Invoke-WebRequest -Uri "$base/admin.html" -UseBasicParsing
  $iconResp = Invoke-WebRequest -Uri "$base/assets/SiteIcon.jpg" -UseBasicParsing
  $heroImageResp = Invoke-WebRequest -Uri "$base/$heroImageUrlPath" -UseBasicParsing
  $cssResp = Invoke-WebRequest -Uri "$base/src/styles/main.css" -UseBasicParsing
  $mainResp = Invoke-WebRequest -Uri "$base/src/main.js" -UseBasicParsing
  $galleryJsResp = Invoke-WebRequest -Uri "$base/src/lib/heroCharacterGallery.js" -UseBasicParsing
  $blogJsResp = Invoke-WebRequest -Uri "$base/src/blog.js" -UseBasicParsing
  $postsApiResp = Invoke-WebRequest -Uri "$base/src/lib/postsApi.js" -UseBasicParsing
  $draftStoreResp = Invoke-WebRequest -Uri "$base/src/lib/postDraftsStore.js" -UseBasicParsing
  $tasksJsResp = Invoke-WebRequest -Uri "$base/src/tasks.js" -UseBasicParsing
  $adminJsResp = Invoke-WebRequest -Uri "$base/src/admin.js" -UseBasicParsing
  $siteImagesApiResp = Invoke-WebRequest -Uri "$base/src/lib/siteImagesApi.js" -UseBasicParsing
  $configResp = Invoke-WebRequest -Uri "$base/content/site-config.json" -UseBasicParsing
  $boardResp = Invoke-WebRequest -Uri "$base/content/tasks/board.json" -UseBasicParsing

  Assert-True ($indexResp.StatusCode -eq 200) "index.html 访问失败"
  Assert-True ($blogResp.StatusCode -eq 200) "blog.html 访问失败"
  Assert-True ($tasksResp.StatusCode -eq 200) "tasks.html 访问失败"
  Assert-True ($adminResp.StatusCode -eq 200) "admin.html 访问失败"
  Assert-True ($iconResp.StatusCode -eq 200) "网站图标访问失败"
  Assert-True ($iconResp.Headers["Content-Type"] -match "image/jpeg") "网站图标类型异常"
  Assert-True ($heroImageResp.StatusCode -eq 200) "首页角色图片访问失败"
  Assert-True ($heroImageResp.Headers["Content-Type"] -match "image/(avif|gif|jpeg|png|webp)") "首页角色图片类型异常"
  Assert-True ($cssResp.StatusCode -eq 200) "main.css 访问失败"
  Assert-True ($mainResp.StatusCode -eq 200) "main.js 访问失败"
  Assert-True ($galleryJsResp.StatusCode -eq 200) "heroCharacterGallery.js 访问失败"
  Assert-True ($blogJsResp.StatusCode -eq 200) "blog.js 访问失败"
  Assert-True ($postsApiResp.StatusCode -eq 200) "postsApi.js 访问失败"
  Assert-True ($draftStoreResp.StatusCode -eq 200) "postDraftsStore.js 访问失败"
  Assert-True ($tasksJsResp.StatusCode -eq 200) "tasks.js 访问失败"
  Assert-True ($adminJsResp.StatusCode -eq 200) "admin.js 访问失败"
  Assert-True ($siteImagesApiResp.StatusCode -eq 200) "siteImagesApi.js 访问失败"
  Assert-True ($configResp.StatusCode -eq 200) "site-config.json 访问失败"
  Assert-True ($boardResp.StatusCode -eq 200) "board.json 访问失败"

  Assert-True ($indexResp.Content -match '<div id="app"></div>') "index.html 页面骨架异常"
  Assert-True ($blogResp.Content -match '<div id="app"></div>') "blog.html 页面骨架异常"
  Assert-True ($tasksResp.Content -match '<div id="app"></div>') "tasks.html 页面骨架异常"
  Assert-True ($adminResp.Content -match '<div id="app"></div>') "admin.html 页面骨架异常"
  Assert-True ($cssResp.Content -match "site-header") "CSS 关键样式未找到"
  Assert-True ($cssResp.Content -match "post-image-list") "CSS 图片编辑样式未找到"
  Assert-True ($mainResp.Content -match "loadRecentCommits") "main.js 关键逻辑未找到"
  Assert-True ($mainResp.Content -match "initHeroCharacterGallery") "main.js 未初始化首页角色轮播"
  Assert-True ($galleryJsResp.Content -match "ROTATION_INTERVAL_MS = 30_000") "首页角色轮播间隔异常"
  Assert-True ($galleryJsResp.Content -match "TRANSITION_DURATION_MS = 3_200") "首页角色切换时长异常"
  Assert-True ($galleryJsResp.Content -match "GALLERY_STATE_KEY") "首页角色轮播未保存当前图片"
  Assert-True ($galleryJsResp.Content -match 'addEventListener\("pointerenter"') "首页角色轮播未启用悬浮暂停"
  Assert-True ($cssResp.Content -match "characterDaydreamFloat") "首页角色图片未启用静态推镜效果"
  Assert-True ($cssResp.Content -match '\.hero-character-layer \.hero-character-image\s*\{\s*animation:\s*characterDaydreamFloat') "首页角色前景动画未在轮播层间共享时间线"
  Assert-True ($cssResp.Content -match '\.hero-character-layer \.hero-character-backdrop\s*\{\s*animation:\s*characterBackdropBreath') "首页角色背景动画未在轮播层间共享时间线"
  Assert-True ($cssResp.Content -match "characterLightLeak") "首页角色图片未启用光漏效果"
  Assert-True ($cssResp.Content -match "characterBokehDrift") "首页角色图片未启用漂浮光点效果"
  Assert-True ($cssResp.Content -notmatch "characterHoverDust|characterHoverSmoke|characterDreamDust|characterTransitionLight") "首页角色切换后仍会重启高亮粒子或白光动画"
  Assert-True ($galleryJsResp.Content -match "discoverRepositoryImages") "首页角色轮播未启用仓库图片自动发现"
  Assert-True ($galleryJsResp.Content -match "IMAGE_PROFILES") "首页角色轮播未启用尺寸分档"
  Assert-True ($galleryJsResp.Content -match 'addEventListener\("click"') "首页角色轮播未启用点击切换"
  Assert-True ($blogJsResp.Content -match "loadBlogPage") "blog.js 关键逻辑未找到"
  Assert-True ($blogJsResp.Content -match "handlePostImageSelection") "blog.js 图片编辑逻辑未找到"
  Assert-True ($postsApiResp.Content -match "pushRemotePost") "postsApi.js 关键逻辑未找到"
  Assert-True ($postsApiResp.Content -match "POSTS_API_VERSION_MISMATCH") "postsApi.js 接口版本校验未找到"
  Assert-True ($draftStoreResp.Content -match "savePostDraft") "postDraftsStore.js 关键逻辑未找到"
  Assert-True ($tasksJsResp.Content -match "bootstrapBoard") "tasks.js 关键逻辑未找到"
  Assert-True ($adminJsResp.Content -match "isOwnerSession") "admin.js 未校验后台管理账号"
  Assert-True ($adminJsResp.Content -match "updateRemoteSiteImages") "admin.js 未启用展示图片同步"
  Assert-True ($siteImagesApiResp.Content -match "/api/site-images") "siteImagesApi.js 未配置展示图片接口"
  Assert-True ($galleryJsResp.Content -match "activeAsset") "首页轮播未处理已删除的当前图片"
  Assert-True ((Get-Content -Raw "src/components/siteHeader.js") -match "site-admin-link") "头像菜单未提供后台管理入口"
  Assert-True ((Get-Content -Raw "src/lib/siteHeaderAuth.js") -match "ownerVerified") "后台管理入口未要求在线 owner 校验"
  $workerSource = Get-Content -Raw "worker/src/index.js"
  Assert-True ($workerSource -match 'url\.pathname === "/api/site-images"') "Worker 未注册展示图片接口"
  Assert-True ($workerSource -match 'handleGetSiteImages[\s\S]*?requireOwnerSession') "Worker 读取展示图片前未校验 owner session"
  Assert-True ($workerSource -match 'handlePutSiteImages[\s\S]*?requireOwnerSession') "Worker 修改展示图片前未校验 owner session"
  Assert-True ($configResp.Content -match "apiBaseUrl") "site-config.json 结构异常"
  Assert-True ($boardResp.Content -match "columns") "board.json 结构异常"

  if ($Preview) {
    $url = "$base/index.html"
    Write-Host "已打开预览: $url"
    Start-Process $url
  }

  if ($KeepServer) {
    Write-Host "本地服务保持运行中，按 Enter 结束并退出。"
    [void][System.Console]::ReadLine()
  }
}
finally {
  Stop-Job $job -ErrorAction SilentlyContinue | Out-Null
  Remove-Job $job -ErrorAction SilentlyContinue | Out-Null
}

Write-Host "[5/5] 本地自检通过。"
