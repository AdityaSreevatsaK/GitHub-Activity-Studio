<#
.SYNOPSIS
  Validate Code Factory rendering, exact committed SVG exports and test suites.
.DESCRIPTION
  Requires Node.js 20+ and Python 3.11+. No npm, tokens or network.
  Leaves committed assets unchanged unless -Regenerate is explicitly supplied.
.EXAMPLE
  .\concepts\code-factory\verify.ps1
.EXAMPLE
  .\concepts\code-factory\verify.ps1 -Regenerate
#>
[CmdletBinding()]
param([switch]$Regenerate)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$factory = Join-Path $repo 'concepts\code-factory'
$renderer = Join-Path $factory 'calendar-factory.mjs'
$fixture = Join-Path $repo 'shared\fixtures\demo-activity.json'
$tests = Join-Path $factory 'tests'
$exports = Join-Path $factory 'exports'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ is required on PATH.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.11+ is required on PATH.' }
$nodeVersion = [version]((& node --version).Trim().TrimStart('v'))
if ($nodeVersion.Major -lt 20) { throw "Node.js 20+ required, found $nodeVersion" }
$pythonText = (& python -c 'import sys; print(".".join(map(str, sys.version_info[:3])))').Trim()
$pythonVersion = [version]$pythonText
if ($pythonVersion -lt [version]'3.11') { throw "Python 3.11+ required, found $pythonVersion" }

$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("code-factory-" + [guid]::NewGuid().ToString('N'))

function Invoke-Export {
    param([string]$OutputDirectory, [int]$Week = -1)
    $arguments = @($renderer, $fixture, $OutputDirectory)
    if ($Week -ge 0) { $arguments += @('--week-index', [string]$Week) }
    & node @arguments
    if ($LASTEXITCODE -ne 0) { throw "Renderer failed for week $Week" }
}

function Assert-SameHash {
    param([string]$ExpectedFile, [string]$ActualFile)
    if (-not (Test-Path -LiteralPath $ExpectedFile)) { throw "Missing committed asset: $ExpectedFile" }
    if (-not (Test-Path -LiteralPath $ActualFile)) { throw "Missing generated asset: $ActualFile" }
    $expected = (Get-FileHash -LiteralPath $ExpectedFile -Algorithm SHA256).Hash
    $actual = (Get-FileHash -LiteralPath $ActualFile -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw "Stale export: $ExpectedFile. Regenerate and inspect the diff." }
}

Push-Location $repo
try {
    if ($Regenerate) {
        Write-Host 'Regenerating all ten committed SVG exports...' -ForegroundColor Cyan
        & node $renderer
        if ($LASTEXITCODE -ne 0) { throw 'Primary SVG regeneration failed.' }
        New-Item -Path $temporary -ItemType Directory -Force | Out-Null
        $releaseSource = Join-Path $temporary 'refresh-release'
        Invoke-Export -OutputDirectory $releaseSource -Week 48
        Copy-Item -LiteralPath (Join-Path $releaseSource 'isometric-light-still.svg') -Destination (Join-Path $exports 'isometric-light-release-week-still.svg') -Force
        $inspectionSource = Join-Path $temporary 'refresh-inspection'
        Invoke-Export -OutputDirectory $inspectionSource -Week 45
        Copy-Item -LiteralPath (Join-Path $inspectionSource 'pixel-dark-still.svg') -Destination (Join-Path $exports 'pixel-dark-inspection-week-still.svg') -Force
    }

    Write-Host 'Running Node.js regression tests...' -ForegroundColor Cyan
    & node --test (Join-Path $tests 'test_calendar_factory.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js regression tests failed.' }

    Write-Host 'Running Python SVG integrity tests...' -ForegroundColor Cyan
    & python -m unittest discover -s $tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Python regression tests failed.' }

    Write-Host 'Regenerating into a temporary directory to check committed files...' -ForegroundColor Cyan
    New-Item -Path $temporary -ItemType Directory -Force | Out-Null
    $main = Join-Path $temporary 'main'
    Invoke-Export -OutputDirectory $main
    foreach ($layout in @('isometric','pixel')) {
        foreach ($theme in @('dark','light')) {
            foreach ($suffix in @('', '-still')) {
                $name = "$layout-$theme$suffix.svg"
                Assert-SameHash -ExpectedFile (Join-Path $exports $name) -ActualFile (Join-Path $main $name)
            }
        }
    }

    $release = Join-Path $temporary 'release'
    Invoke-Export -OutputDirectory $release -Week 48
    Assert-SameHash -ExpectedFile (Join-Path $exports 'isometric-light-release-week-still.svg') -ActualFile (Join-Path $release 'isometric-light-still.svg')

    $inspection = Join-Path $temporary 'inspection'
    Invoke-Export -OutputDirectory $inspection -Week 45
    Assert-SameHash -ExpectedFile (Join-Path $exports 'pixel-dark-inspection-week-still.svg') -ActualFile (Join-Path $inspection 'pixel-dark-still.svg')

    Write-Host 'Verified: native tests and all ten committed SVG exports match the renderer.' -ForegroundColor Green
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
