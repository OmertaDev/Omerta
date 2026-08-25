function Test-HookPermissionBits {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Address,

        [Parameter(Mandatory)]
        [uint16]$ExpectedFlags
    )

    if ($Address -notmatch '^0x[0-9a-fA-F]{40}$') {
        throw "Invalid hook address: $Address"
    }

    [uint16]$lowBits = [Convert]::ToUInt16($Address.Substring(38, 4), 16)
    return (($lowBits -band 0x3fff) -eq $ExpectedFlags)
}

function Test-HookAvoidsRoutingReviewPrefix {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Address
    )

    if ($Address -notmatch '^0x[0-9a-fA-F]{40}$') {
        throw "Invalid hook address: $Address"
    }

    return ($Address.Substring(2, 2) -ine '91')
}
