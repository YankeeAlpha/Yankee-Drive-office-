# Yankee Office - maly lokalny webovy server (len pre tento pocitac, http://localhost:8765)
# Spusta sa cez Spustit-Windows.bat. Zatvorenim okna sa server ukonci.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\') + '\'
$port = 8765
$url = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try { $listener.Start() } catch {
  # server uz bezi (napr. v inom okne) - len otvorime prehliadac
  Start-Process ($url + 'index.html'); exit 0
}
Start-Process ($url + 'index.html')
Write-Host "Yankee Office bezi na $url"
Write-Host "Toto okno nechajte otvorene. Zatvorenim okna sa Yankee Office ukonci."
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.md' = 'text/plain; charset=utf-8'; '.ico' = 'image/x-icon'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
    } else {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch { $res.StatusCode = 500 }
  finally { $res.Close() }
}
