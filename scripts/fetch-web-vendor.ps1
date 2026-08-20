param(
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

$dependencies = @(
  @{
    Name = "Fabric.js"
    Version = "7.4.0"
    Url = "https://registry.npmjs.org/fabric/-/fabric-7.4.0.tgz"
    Sha256 = "47B563847544C80A23F7A37DE6788E78667A385BFDE932706834BBAB076C0C3F"
    ArchivePath = "package/dist/index.min.mjs"
    Target = "src/vendor/fabric-7.4.0.min.js"
    FileSha256 = "EC0F61439BE4C27722F9857033B3ED5D3BAD8A96A1F4285A78525B3D6047F252"
    LicensePath = "package/LICENSE"
    LicenseTarget = "src/vendor/Fabric-7.4.0.LICENSE.txt"
  },
  @{
    Name = "kld-intersections"
    Version = "0.7.0"
    Url = "https://registry.npmjs.org/kld-intersections/-/kld-intersections-0.7.0.tgz"
    Sha256 = "CEB76BDEDD9D2E81BAE4EDCDDE980F09C23010AC73970383E791C8CBD4D43DF3"
    ArchivePath = "package/dist/index-umd.js"
    Target = "src/vendor/kld-intersections-0.7.0.umd.js"
    FileSha256 = "A07ACBF8E20369E39AF7A08A5C7ACE9C186B66C0AE8A8B499E3826D5E1215D85"
    LicensePath = "package/LICENSE"
    LicenseTarget = "src/vendor/kld-intersections-0.7.0.LICENSE.txt"
  }
)

foreach ($dependency in $dependencies) {
  if ($VerifyOnly) {
    if (-not (Test-Path -LiteralPath $dependency.Target)) {
      throw "缺少 $($dependency.Name) $($dependency.Version): $($dependency.Target)"
    }
    if (-not (Test-Path -LiteralPath $dependency.LicenseTarget)) {
      throw "缺少 $($dependency.Name) 许可证: $($dependency.LicenseTarget)"
    }

    $localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dependency.Target).Hash
    if ($localHash -ne $dependency.FileSha256) {
      throw "$($dependency.Name) 本地文件校验失败：$localHash"
    }

    Write-Host "已验证 $($dependency.Name) $($dependency.Version): $($dependency.Target)"
    continue
  }

  $tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("qihai-vendor-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempDirectory | Out-Null
  $archive = Join-Path $tempDirectory "package.tgz"
  $extractDirectory = Join-Path $tempDirectory "extract"
  New-Item -ItemType Directory -Path $extractDirectory | Out-Null

  try {
    Write-Host "正在获取 $($dependency.Name) $($dependency.Version)..."
    Invoke-WebRequest -Uri $dependency.Url -OutFile $archive
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
    if ($actualHash -ne $dependency.Sha256) {
      throw "$($dependency.Name) 压缩包校验失败：$actualHash"
    }

    tar -xf $archive -C $extractDirectory
    $source = Join-Path $extractDirectory $dependency.ArchivePath
    if (-not (Test-Path -LiteralPath $source)) {
      throw "$($dependency.Name) 压缩包中缺少 $($dependency.ArchivePath)"
    }

    $targetDirectory = Split-Path -Parent $dependency.Target
    New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
    Copy-Item -LiteralPath $source -Destination $dependency.Target -Force
    $licenseSource = Join-Path $extractDirectory $dependency.LicensePath
    if (-not (Test-Path -LiteralPath $licenseSource)) {
      throw "$($dependency.Name) 压缩包中缺少许可证 $($dependency.LicensePath)"
    }
    Copy-Item -LiteralPath $licenseSource -Destination $dependency.LicenseTarget -Force
    Write-Host "已写入 $($dependency.Target)"
  }
  finally {
    if (Test-Path -LiteralPath $tempDirectory) {
      Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
  }
}
