import Sidebar from '@/components/layout/Sidebar'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#080810',
    }}>
      <div style={{ flexShrink: 0, height: '100%', display: 'flex' }}>
        <Sidebar />
      </div>
      <main style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {children}
      </main>
    </div>
  )
}