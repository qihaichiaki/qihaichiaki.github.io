param(
  [Parameter(Mandatory = $true)]
  [string]$Title,
  [string]$Summary = "",
  [string]$Slug = "",
  [switch]$Open
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$postsDir = Join-Path $root "content\posts"
$indexPath = Join-Path $postsDir "index.json"

function Convert-ToSlug {
  param([string]$Text)

  $value = $Text.ToLowerInvariant()
  $value = [regex]::Replace($value, "[^a-z0-9]+", "-")
  $value = $value.Trim("-")
  return $value
}

if (-not (Test-Path $postsDir)) {
  New-Item -ItemType Directory -Path $postsDir -Force | Out-Null
}

if (-not (Test-Path $indexPath)) {
  "[]" | Set-Content -Encoding UTF8 $indexPath
}

if (-not $Slug) {
  $Slug = Convert-ToSlug $Title
}

if ([string]::IsNullOrWhiteSpace($Slug)) {
  $Slug = "post-" + (Get-Date -Format "HHmmss")
}

$date = Get-Date -Format "yyyy-MM-dd"
$fileName = "$date-$Slug.md"
$filePath = Join-Path $postsDir $fileName

if (Test-Path $filePath) {
  throw "文章已存在: $fileName"
}

$template = @"
# $Title

发布时间：$date

## 摘要

$Summary

## 正文

在这里开始写作...
"@

$template | Set-Content -Encoding UTF8 $filePath

$raw = Get-Content -Raw $indexPath
$existing = @()
if ($raw.Trim()) {
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) {
    $existing = $parsed
  } elseif ($parsed -ne $null) {
    $existing = @($parsed)
  }
}

$newPost = [PSCustomObject]@{
  title = $Title
  date = $date
  file = $fileName
  summary = $Summary
}

$updated = @($newPost) + @($existing)
$updated | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $indexPath

Write-Host "已创建文章: $filePath"
Write-Host "已更新索引: $indexPath"

if ($Open) {
  Start-Process $filePath
}
