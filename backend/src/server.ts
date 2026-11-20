import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3002)

createApp().listen(port, () => {
  console.log(`Adota-Pet backend escutando em http://localhost:${port}`)
})
