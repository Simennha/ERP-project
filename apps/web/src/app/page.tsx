import Link from 'next/link';
import { buttonVariants } from '@erp/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">ERP System</h1>
        <p className="text-muted-foreground">
          Unified finance, sales, inventory, HR, projects, and procurement on one platform.
          This build ships the foundation: authentication and role-based access control.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          Sign in
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Dashboard
        </Link>
      </div>
    </main>
  );
}
