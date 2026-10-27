$ports = @(5173, 8000, 8081, 5432)
foreach ($port in $ports) {
    $t = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    [PSCustomObject]@{
        Port = $port
        IsOpen = $t.TcpTestSucceeded
    }
}
