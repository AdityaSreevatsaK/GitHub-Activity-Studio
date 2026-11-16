<#
.SYNOPSIS
  Run the native Code Factory test suites on Windows.
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
$renderer = Join-Path $repo 'concepts\code-factory\calendar-factory.mjs'
$tests = Join-Path $repo 'concepts\code-factory\tests'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20+ must be installed and available on PATH.'
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'Python 3.11+ must be installed and available on PATH.'
}

Push-Location $repo
try {
    if ($Regenerate) {
        Write-Host 'Generating deterministic SVG exports...' -ForegroundColor Cyan
        & node $renderer
        if ($LASTEXITCODE -ne 0) { throw 'Calendar export generation failed.' }
    }

    Write-Host 'Running calendar data and SVG regression tests...' -ForegroundColor Cyan
    & node --test (Join-Path $tests 'test_calendar_factory.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js regression tests failed.' }

    Write-Host 'Running legacy and calendar SVG integrity tests...' -ForegroundColor Cyan
    & python -m unittest discover -s $tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Python unittest suite failed.' }

    Write-Host 'Code Factory verification completed successfully.' -ForegroundColor Green
}
finally {
    Pop-Location
}
