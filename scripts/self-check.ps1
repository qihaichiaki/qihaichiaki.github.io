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
  "src/main.js",
  "src/components/hero.js",
  "src/styles/main.css"
)

foreach ($file in $required) {
  Assert-True (Test-Path $file) "缺少文件: $file"
}

Write-Host "[2/4] 检查 index.html 资源引用..."
$index = Get-Content -Raw "index.html"
Assert-True ($index -match "src/styles/main.css") "index.html 未引用 src/styles/main.css"
Assert-True ($index -match "src/main.js") "index.html 未引用 src/main.js"

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
  $cssResp = Invoke-WebRequest -Uri "$base/src/styles/main.css" -UseBasicParsing
  $jsResp = Invoke-WebRequest -Uri "$base/src/main.js" -UseBasicParsing

  Assert-True ($indexResp.StatusCode -eq 200) "index.html 访问失败"
  Assert-True ($cssResp.StatusCode -eq 200) "main.css 访问失败"
  Assert-True ($jsResp.StatusCode -eq 200) "main.js 访问失败"

  Assert-True ($indexResp.Content -match '<div id="app"></div>') "index.html 页面骨架异常"
  Assert-True ($cssResp.Content -match "site-header") "CSS 关键样式未找到"
  Assert-True ($jsResp.Content -match "IntersectionObserver") "JS 关键逻辑未找到"

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
