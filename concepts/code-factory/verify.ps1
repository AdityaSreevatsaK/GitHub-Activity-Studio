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
$accountFixture = Join-Path $factory 'fixtures\adityasreevatsak-public-activity.json'
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

function Invoke-AccountExport {
    param([string]$OutputDirectory)
    & node $renderer $accountFixture $OutputDirectory '--week-index' '51'
    if ($LASTEXITCODE -ne 0) { throw 'Account-specific renderer failed.' }
}

function Assert-SameContent {
    param([string]$ExpectedFile, [string]$ActualFile)
    if (-not (Test-Path -LiteralPath $ExpectedFile)) { throw "Missing committed asset: $ExpectedFile" }
    if (-not (Test-Path -LiteralPath $ActualFile)) { throw "Missing generated asset: $ActualFile" }
    # Windows Git can check out SVG text as CRLF; the exporter writes LF.
    # Normalise only newlines, preserving all other SVG content for comparison.
    $expected = [System.IO.File]::ReadAllText($ExpectedFile).Replace("`r`n", "`n")
    $actual = [System.IO.File]::ReadAllText($ActualFile).Replace("`r`n", "`n")
    if ($expected -cne $actual) { throw "Stale export: $ExpectedFile. Regenerate and inspect the diff." }
}

Push-Location $repo
try {
    if ($Regenerate) {
        Write-Host 'Regenerating all fourteen committed SVG exports...' -ForegroundColor Cyan
        & node $renderer
        if ($LASTEXITCODE -ne 0) { throw 'Primary SVG regeneration failed.' }
        New-Item -Path $temporary -ItemType Directory -Force | Out-Null
        $releaseSource = Join-Path $temporary 'refresh-release'
        Invoke-Export -OutputDirectory $releaseSource -Week 48
        Copy-Item -LiteralPath (Join-Path $releaseSource 'isometric-light-still.svg') -Destination (Join-Path $exports 'isometric-light-release-week-still.svg') -Force
        $inspectionSource = Join-Path $temporary 'refresh-inspection'
        Invoke-Export -OutputDirectory $inspectionSource -Week 45
        Copy-Item -LiteralPath (Join-Path $inspectionSource 'pixel-dark-still.svg') -Destination (Join-Path $exports 'pixel-dark-inspection-week-still.svg') -Force
        $accountSource = Join-Path $temporary 'refresh-account'
        Invoke-AccountExport -OutputDirectory $accountSource
        foreach ($layout in @('isometric','pixel')) {
            foreach ($theme in @('dark','light')) {
                $basename = "$layout-$theme-still.svg"
                Copy-Item -LiteralPath (Join-Path $accountSource $basename) -Destination (Join-Path $exports "account-$basename") -Force
            }
        }
    }

    Write-Host 'Running Node.js regression tests...' -ForegroundColor Cyan
    & node --test (Join-Path $tests 'test_calendar_factory.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js rendering regression tests failed.' }
    & node --test (Join-Path $tests 'test_public_refresh.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js public collector regression tests failed.' }

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
                Assert-SameContent -ExpectedFile (Join-Path $exports $name) -ActualFile (Join-Path $main $name)
            }
        }
    }

    $release = Join-Path $temporary 'release'
    Invoke-Export -OutputDirectory $release -Week 48
    Assert-SameContent -ExpectedFile (Join-Path $exports 'isometric-light-release-week-still.svg') -ActualFile (Join-Path $release 'isometric-light-still.svg')

    $inspection = Join-Path $temporary 'inspection'
    Invoke-Export -OutputDirectory $inspection -Week 45
    Assert-SameContent -ExpectedFile (Join-Path $exports 'pixel-dark-inspection-week-still.svg') -ActualFile (Join-Path $inspection 'pixel-dark-still.svg')

    $account = Join-Path $temporary 'account'
    Invoke-AccountExport -OutputDirectory $account
    foreach ($layout in @('isometric','pixel')) {
        foreach ($theme in @('dark','light')) {
            $basename = "$layout-$theme-still.svg"
            Assert-SameContent -ExpectedFile (Join-Path $exports "account-$basename") -ActualFile (Join-Path $account $basename)
        }
    }

    Write-Host 'Verified: native tests and all fourteen committed SVG exports match the renderer.' -ForegroundColor Green
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
