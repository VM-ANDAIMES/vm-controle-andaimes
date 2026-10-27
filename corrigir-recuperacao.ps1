
$p = 'src\App.tsx'
$c = Get-Content -LiteralPath $p -Raw

if ($c.Contains('resetPasswordForEmail')) {
    Write-Host 'A funcao de recuperacao ja existe. Nenhuma alteracao feita.'
    exit
}

$old = "  async function logout() { await supabase?.auth.signOut(); setScaffolds([]); setInspections([]) }"

$new = @'
  async function recoverPassword(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoginError('')
    if (!email.trim()) {
      setLoginError('Digite seu e-mail para receber o link de recuperacao.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    })
    if (error) {
      setLoginError('Nao foi possivel enviar o link: ' + error.message)
    } else {
      setLoginError('Se o e-mail estiver cadastrado, voce recebera as instrucoes de recuperacao.')
    }
  }

  async function logout() { await supabase?.auth.signOut(); setScaffolds([]); setInspections([]) }
'@

if (-not $c.Contains($old)) {
    Write-Host 'Trecho de logout nao encontrado. Arquivo original preservado.'
    exit 1
}

$c = $c.Replace($old, $new.TrimStart([char[]]"`r`n"))
Set-Content -LiteralPath $p -Value $c -Encoding utf8
Write-Host 'Funcao adicionada com sucesso.'
