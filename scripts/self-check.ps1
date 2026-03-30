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

Write-Host "[1/4] 检查关键文件..."
$required = @(
  "index.html",
  "blog.html",
  "src/main.js",
  "src/blog.js",
  "src/components/hero.js",
  "src/components/blogPage.js",
  "src/styles/main.css",
  "src/lib/markdown.js",
  "content/posts/index.json"
)

foreach ($file in $required) {
  Assert-True (Test-Path $file) "缺少文件: $file"
}

$posts = Get-Content -Raw "content/posts/index.json" | ConvertFrom-Json
foreach ($post in $posts) {
  Assert-True ($post.file -ne $null -and $post.file -ne "") "文章索引中存在空 file 字段"
  Assert-True (Test-Path ("content/posts/" + $post.file)) ("索引引用的 md 不存在: " + $post.file)
}

Write-Host "[2/4] 检查页面资源引用..."
$index = Get-Content -Raw "index.html"
$blog = Get-Content -Raw "blog.html"
Assert-True ($index -match "src/styles/main.css") "index.html 未引用 src/styles/main.css"
Assert-True ($index -match "src/main.js") "index.html 未引用 src/main.js"
Assert-True ($blog -match "src/styles/main.css") "blog.html 未引用 src/styles/main.css"
Assert-True ($blog -match "src/blog.js") "blog.html 未引用 src/blog.js"

Write-Host "[3/4] 启动本地静态服务并验证 HTTP 响应..."
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
  $cssResp = Invoke-WebRequest -Uri "$base/src/styles/main.css" -UseBasicParsing
  $mainResp = Invoke-WebRequest -Uri "$base/src/main.js" -UseBasicParsing
  $blogJsResp = Invoke-WebRequest -Uri "$base/src/blog.js" -UseBasicParsing

  Assert-True ($indexResp.StatusCode -eq 200) "index.html 访问失败"
  Assert-True ($blogResp.StatusCode -eq 200) "blog.html 访问失败"
  Assert-True ($cssResp.StatusCode -eq 200) "main.css 访问失败"
  Assert-True ($mainResp.StatusCode -eq 200) "main.js 访问失败"
  Assert-True ($blogJsResp.StatusCode -eq 200) "blog.js 访问失败"

  Assert-True ($indexResp.Content -match '<div id="app"></div>') "index.html 页面骨架异常"
  Assert-True ($blogResp.Content -match '<div id="app"></div>') "blog.html 页面骨架异常"
  Assert-True ($cssResp.Content -match "site-header") "CSS 关键样式未找到"
  Assert-True ($mainResp.Content -match "loadRecentCommits") "main.js 关键逻辑未找到"
  Assert-True ($blogJsResp.Content -match "loadBlogPage") "blog.js 关键逻辑未找到"

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

Write-Host "[4/4] 本地自检通过。"
