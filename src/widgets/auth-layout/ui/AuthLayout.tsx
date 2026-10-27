import type { ReactNode } from 'react'
import { SignHeader } from '../../../features/auth/ui/SignHeader'
import { AuthTopBar } from './AuthTopBar'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-stage flex min-h-screen flex-col">
      <AuthTopBar />
      <div
        className="flex min-h-0 flex-1 flex-col bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/laboratory.jpg')" }}
      >
      <SignHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-border/50">
          {children}
        </div>
      </main>
      </div>
    </div>
  )
}