
$p = 'src\App.tsx'
$c = Get-Content -LiteralPath $p -Raw

if (-not $c.Contains('async function recoverPassword')) {
    Write-Host 'A funcao de recuperacao nao foi encontrada. Arquivo preservado.'
    exit 1
}

if ($c.Contains('Esqueci minha senha')) {
    Write-Host 'O link ja existe. Nenhuma alteracao feita.'
    exit
}

$needle = '{loginError && <p className="error">{loginError}</p>}'

$insert = @'
<button type="button" onClick={recoverPassword} style={{ background: 'none', border: 0, color: '#f57c00', cursor: 'pointer', padding: 0, textAlign: 'left' }}>Esqueci minha senha</button>
'@

if (-not $c.Contains($needle)) {
    Write-Host 'Trecho do login nao encontrado. Arquivo preservado.'
    exit 1
}

$c = $c.Replace($needle, $insert + $needle)
Set-Content -LiteralPath $p -Value $c -Encoding utf8
Write-Host 'Link de recuperacao adicionado com sucesso.'
