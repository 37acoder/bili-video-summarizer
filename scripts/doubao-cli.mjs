import { dirname, resolve } from 'node:path'
import { main, Failure } from './doubao-transcribe.mjs'

main(process.argv.slice(2), dirname(resolve(process.argv[1]))).catch(error => {
  console.error(JSON.stringify({ error: error instanceof Failure ? error.message : 'DOUBAO_OPERATION_FAILED' }))
  process.exitCode = /CANCELLED/.test(error.message) ? 130 : 1
})
