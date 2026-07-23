'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createProduct } from '@/lib/inventory/api';
import { ProductForm } from '../product-form';

function NewProductContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New product</h1>
        <p className="text-muted-foreground">Add a product to your company catalog.</p>
      </div>

      <ProductForm
        submitLabel="Create product"
        onSubmit={async (input) => {
          const created = await createProduct(getAccessToken(), input);
          router.push(`/inventory/products/${created.id}`);
        }}
      />

      <Link href="/inventory/products" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.INVENTORY_PRODUCT_CREATE}>
      <NewProductContent />
    </RequirePermissionPage>
  );
}
