
$p = 'src\App.tsx'
$c = Get-Content -LiteralPath $p -Raw

if ($c.Contains('async function saveNewPassword')) {
    Write-Host 'A funcao ja existe. Nenhuma alteracao feita.'
    exit
}

$stateNeedle = "  const [loginError, setLoginError] = useState('')"
$authNeedle = 'supabase.auth.onAuthStateChange((_event, next) => setSession(next))'
$logoutNeedle = '  async function logout() { await supabase?.auth.signOut(); setScaffolds([]); setInspections([]) }'
$loginNeedle = '  if (!session) return <div className="login-page">'

if (-not $c.Contains($stateNeedle) -or
    -not $c.Contains($authNeedle) -or
    -not $c.Contains($logoutNeedle) -or
    -not $c.Contains($loginNeedle)) {
    Write-Host 'Trecho esperado nao encontrado. Arquivo preservado.'
    exit 1
}

Copy-Item $p 'Backup-VM-Antes-Correcao\App-antes-tela-nova-senha.tsx' -Force

$states = @'
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
'@
$c = $c.Replace($stateNeedle, $stateNeedle + "`r`n" + $states.TrimEnd())

$auth = @'
supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true)
        setLoginError('')
      }
    })
'@
$c = $c.Replace($authNeedle, $auth.Trim())

$handler = @'
  async function saveNewPassword(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return

    if (newPassword.length < 8) {
      setLoginError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setLoginError('As senhas nao conferem.')
      return
    }

    setLoginError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setLoginError('Nao foi possivel alterar a senha: ' + error.message)
      return
    }

    await supabase.auth.signOut()
    setSession(null)
    setRecoveringPassword(false)
    setNewPassword('')
    setConfirmNewPassword('')
    setLoginError('Senha alterada com sucesso. Entre com sua nova senha.')
  }

'@
$c = $c.Replace($logoutNeedle, $handler + $logoutNeedle)

$screen = @'
  if (recoveringPassword) return <div className="login-page"><div className="login-card"><div className="brand-mark"><Construction size={30}/></div><p className="eyebrow">VM ANDAIMES</p><h1>Nova <span>senha</span></h1><p className="muted">Cadastre sua nova senha para acessar o sistema.</p><form onSubmit={saveNewPassword} className="stack"><label>Nova senha<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Minimo de 8 caracteres"/></label><label>Confirmar nova senha<input type="password" required minLength={8} autoComplete="new-password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Digite a senha novamente"/></label>{loginError && <p className="error">{loginError}</p>}<button className="btn primary full" type="submit">Salvar nova senha</button></form></div></div>
'@
$c = $c.Replace($loginNeedle, $screen.Trim() + "`r`n" + $loginNeedle)

Set-Content -LiteralPath $p -Value $c -Encoding utf8
Write-Host 'Tela de nova senha adicionada.'
