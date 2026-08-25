function Convert-CastUint([string]$Value) {
    $trimmed = $Value.Trim()
    if ($trimmed -notmatch '^([0-9]+)(?:\s+\[[^\]]+\])?$') {
        throw "Invalid cast uint output: $Value"
    }
    return [System.Numerics.BigInteger]::Parse($Matches[1]).ToString()
}
