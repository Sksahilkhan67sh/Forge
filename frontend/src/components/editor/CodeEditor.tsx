'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Play, Copy, Check, Loader2 } from 'lucide-react'
import { execute } from '@/lib/api'
import { toast } from 'sonner'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#111] text-zinc-600 text-sm">
      <Loader2 size={16} className="animate-spin mr-2" />
      Loading editor…
    </div>
  ),
})

interface Props {
  code: string
  language?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string
  showRunButton?: boolean
}

export default function CodeEditor({
  code,
  language = 'python',
  onChange,
  readOnly = false,
  height = '400px',
  showRunButton = true,
}: Props) {
  const [value, setValue] = useState(code)
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<{ stdout: string; stderr: string; error: string | null } | null>(null)

  const handleChange = (v: string | undefined) => {
    const newVal = v || ''
    setValue(newVal)
    onChange?.(newVal)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = async () => {
    if (running) return
    setRunning(true)
    setOutput(null)
    try {
      const result = await execute.run(value, language as any)
      setOutput({ stdout: result.stdout, stderr: result.stderr, error: result.error })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col border border-surface-200 rounded-xl overflow-hidden bg-[#111]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100 border-b border-surface-200">
        <span className="text-xs text-zinc-500 font-mono uppercase tracking-wide">{language}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-zinc-600 hover:text-zinc-300 text-xs flex items-center gap-1 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {showRunButton && ['python', 'javascript', 'typescript', 'bash'].includes(language) && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-forge-500 hover:bg-forge-400 disabled:opacity-60 text-white text-xs rounded-md transition-colors"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Run
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div style={{ height }}>
        <MonacoEditor
          value={value}
          language={normalizeLanguage(language)}
          onChange={handleChange}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: '"Geist Mono", "Fira Code", monospace',
            fontLigatures: true,
            lineHeight: 22,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: 'auto', horizontal: 'auto' },
            theme: 'vs-dark',
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
          theme="vs-dark"
        />
      </div>

      {/* Output */}
      {output && (
        <div className="border-t border-surface-200 bg-[#0a0a0a]">
          <div className="px-4 py-2.5 border-b border-surface-200">
            <span className="text-xs text-zinc-500 font-mono">Output</span>
          </div>
          <pre className="px-4 py-3 text-xs font-mono overflow-auto max-h-48">
            {output.error ? (
              <span className="text-red-400">{output.error}</span>
            ) : (
              <>
                {output.stdout && <span className="text-zinc-200">{output.stdout}</span>}
                {output.stderr && <span className="text-yellow-500">{output.stderr}</span>}
                {!output.stdout && !output.stderr && (
                  <span className="text-zinc-600">(no output)</span>
                )}
              </>
            )}
          </pre>
        </div>
      )}
    </div>
  )
}

function normalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', sh: 'shell', bash: 'shell',
    yml: 'yaml', md: 'markdown',
  }
  return map[lang] || lang
}
