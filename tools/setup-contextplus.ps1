param(
    [string]$EmbedModel = "nomic-embed-text",
    [string]$ChatModel = "llama3.2:1b"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$ollamaHost = if ($env:OLLAMA_HOST) { $env:OLLAMA_HOST.TrimEnd('/') } else { "http://127.0.0.1:11434" }

function Test-OllamaReady {
    try {
        $null = Invoke-RestMethod -Uri "$ollamaHost/api/tags" -TimeoutSec 2
        return $true
    }
    catch {
        return $false
    }
}

function Find-Ollama {
    $command = Get-Command "ollama.exe" -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
        (Join-Path $env:LOCALAPPDATA "Ollama\ollama.exe"),
        "C:\Program Files\Ollama\ollama.exe"
    )
    return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

$ollama = Find-Ollama
if (-not $ollama -and $ollamaHost -eq "http://127.0.0.1:11434") {
    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($null -eq $winget) {
        throw "Ollama is not installed and winget is unavailable. Install Ollama, then rerun this script."
    }
    & $winget.Source install --exact --id Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw "winget could not install Ollama (exit $LASTEXITCODE)." }
    $ollama = Find-Ollama
}

if (-not (Test-OllamaReady)) {
    if (-not $ollama) { throw "Ollama is unavailable at $ollamaHost and no local Ollama executable was found." }
    Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not (Test-OllamaReady) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-OllamaReady)) { throw "Ollama did not become ready at $ollamaHost within 30 seconds." }
}

if (-not $ollama) { throw "Ollama is reachable at $ollamaHost, but the CLI is unavailable for pulling required models." }

$env:OLLAMA_HOST = $ollamaHost
foreach ($model in @($EmbedModel, $ChatModel)) {
    & $ollama pull $model
    if ($LASTEXITCODE -ne 0) { throw "Failed to pull Ollama model $model (exit $LASTEXITCODE)." }
}

$env:OLLAMA_EMBED_MODEL = $EmbedModel
$env:OLLAMA_CHAT_MODEL = $ChatModel
& (Get-Command "node.exe").Source (Join-Path $projectRoot "tools\contextplus-health.js")
exit $LASTEXITCODE
