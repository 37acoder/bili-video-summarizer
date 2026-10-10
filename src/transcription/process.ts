import { spawn } from 'node:child_process'
import { SummarizeError } from '../errors'

/** No shell, bounded output, and no raw command/response in public errors. */
export function runTool(command: string, args: string[], stage: string, signal?: AbortSignal, timeout = 120_000): Promise<string> {
  if (signal?.aborted) return Promise.reject(new SummarizeError(499, 'ASR_CANCELLED', 'Local transcription cancelled'))
  return new Promise((done, reject) => {
    let output = '', cancelled = false, timedOut = false
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    // Whisper's transcript is written to files; retain only bounded stdout for probes.
    child.stdout.on('data', (data: Buffer) => { output = (output + data.toString()).slice(-1024 * 1024) })
    child.stderr.on('data', () => {})
    let killTimer: ReturnType<typeof setTimeout> | undefined
    const stop = () => { child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 3000); killTimer.unref() }
    const abort = () => { cancelled = true; stop() }
    const timer = setTimeout(() => { timedOut = true; stop() }, timeout)
    const clean = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort) }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    child.on('error', () => { clean(); reject(new SummarizeError(500, 'ASR_TOOL_FAILED', `${stage}: tool could not start`)) })
    child.on('close', code => {
      clean()
      if (cancelled) reject(new SummarizeError(499, 'ASR_CANCELLED', 'Local transcription cancelled'))
      else if (timedOut) reject(new SummarizeError(504, 'ASR_TIMEOUT', `${stage}: timed out`))
      else if (code !== 0) reject(new SummarizeError(502, 'ASR_TOOL_FAILED', `${stage}: tool failed (exit ${code})`))
      else done(output)
    })
  })
}
