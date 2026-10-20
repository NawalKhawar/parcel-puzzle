# Zips the CONTENTS of dist/ (so index.html sits at the top level of the archive, as CrazyGames
# expects) into cozy-couriers-preview.zip in the project root.
#
# Usage (from the project root, after `npm run build`):
#   powershell -ExecutionPolicy Bypass -File scripts/zip-dist.ps1
#
# Entries are added one by one with forward-slash names (assets/foo.png). Windows PowerShell's
# built-in zipping (Compress-Archive / ZipFile.CreateFromDirectory) writes backslashes, which
# some web portals and unzip tools mishandle.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = (Resolve-Path (Join-Path $root 'dist')).Path
$zipPath = Join-Path $root 'cozy-couriers-preview.zip'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "dist/index.html not found - run 'npm run build' first."
}

# Start from a clean archive so stale files from an older build can't sneak in.
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $dist -Recurse -File | ForEach-Object {
        # Path relative to dist/, with / separators - this is what puts index.html at the top level.
        $entryName = $_.FullName.Substring($dist.Length + 1).Replace('\', '/')
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    }
}
finally {
    $archive.Dispose()
}

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Output "Created $zipPath ($size MB)"
