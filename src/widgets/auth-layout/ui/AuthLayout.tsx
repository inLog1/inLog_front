import type { ReactNode } from 'react'
import { SignHeader } from '../../../features/auth/ui/SignHeader';

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/laboratory.jpg')" }}
    >
      <SignHeader />

      <main className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:py-12">
        <div className="m-auto w-full max-w-md rounded-2xl border border-border/50 bg-card/80 p-5 shadow-2xl backdrop-blur-md sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}