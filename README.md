# Controle de Andaimes VM

Projeto independente do aplicativo de RH. React + TypeScript + Vite + Supabase.

## 1. Requisitos
- Node.js 22.12+ recomendado
- Git (opcional, para publicar)
- Conta Supabase e Vercel

## 2. Rodar no Windows (CMD)
Abra o CMD e entre na pasta onde extraiu o ZIP. Exemplo:
```cmd
cd %USERPROFILE%\Documents\Controle Andaimes VM
npm install
copy .env.example .env
```
Abra o arquivo `.env` no Bloco de Notas e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do Supabase. Não coloque a chave `service_role` no site.

Depois:
```cmd
npm run dev
```
Abra o endereço local mostrado no CMD, geralmente http://localhost:5173.

## 3. Configurar banco de dados
No Supabase, crie um projeto separado (recomendado para isolamento) ou confirme cuidadosamente que o projeto existente pode ser reutilizado. Em SQL Editor, execute o arquivo `supabase/schema.sql` completo.

Para criar usuários: Supabase > Authentication > Users > Add user. Crie os usuários e compartilhe as credenciais de forma segura. Este starter permite que usuários autenticados utilizem o sistema; as políticas SQL exigem login. Para restringir ainda mais por função/obra, implemente uma tabela de perfis e políticas específicas antes de uso em produção.

## 4. Publicar na Vercel
1. Crie um repositório GitHub NOVO para este projeto.
2. No CMD, dentro da pasta do projeto:
```cmd
git init
git add .
git commit -m "Criar Controle de Andaimes VM"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/controle-andaimes-vm.git
git push -u origin main
```
3. Na Vercel, importe somente esse repositório novo.
4. Em Project Settings > Environment Variables, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Faça Deploy.

## Observações
- Nunca publique a chave `service_role`.
- A configuração do Supabase e o deploy ainda precisam ser feitos na sua conta.
- O sistema calcula dias desde a montagem e mantém histórico quando o registro é marcado como retirado.
- Este modelo não substitui procedimentos técnicos, inspeções ou critérios de segurança do local de trabalho.
