// Seed do banco (decisão #21: Prisma com migrations versionadas e seed).
// Execute com `npm run db:seed` (em backend/) depois de `npm run db:migrate`.
// Preencha com os dados iniciais quando os models existirem no schema.

async function main() {
  console.log('Seed: sem models no schema ainda — adicione models e escreva o seed aqui.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
