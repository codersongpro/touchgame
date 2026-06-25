$root = 'C:\Users\dungs\Desktop\vibecoding\moem'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Host "Serving $root on http://localhost:8765/"
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
        $req = $ctx.Request
        $res = $ctx.Response
        $res.KeepAlive = $false
        $path = $req.Url.LocalPath -replace '/', '\'
        $file = Join-Path $root $path
        if (Test-Path $file -PathType Leaf) {
            $ext = [IO.Path]::GetExtension($file)
            $mime = switch ($ext) {
                '.html'  { 'text/html; charset=utf-8' }
                '.css'   { 'text/css; charset=utf-8' }
                '.js'    { 'application/javascript; charset=utf-8' }
                '.json'  { 'application/json; charset=utf-8' }
                '.svg'   { 'image/svg+xml' }
                '.png'   { 'image/png' }
                '.woff2' { 'font/woff2' }
                default  { 'application/octet-stream' }
            }
            $bytes = [IO.File]::ReadAllBytes($file)
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } elseif (Test-Path $file -PathType Container) {
            $index = Join-Path $file 'index.html'
            if (Test-Path $index) {
                $bytes = [IO.File]::ReadAllBytes($index)
                $res.ContentType = 'text/html; charset=utf-8'
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        } else {
            $res.StatusCode = 404
        }
    } catch {
        Write-Host "Request error: $_"
    } finally {
        try { $ctx.Response.Close() } catch {}
    }
}
