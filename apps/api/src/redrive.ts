import 'dotenv/config'
import { redriveDeadLetter } from './jobs.js'

/** CLI para reprocessar falhas da dead letter: `npm run jobs:redrive`. */
redriveDeadLetter()
  .then((count) => console.log(`[jobs] ${count} job(s) reprocessado(s) da dead letter`))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
