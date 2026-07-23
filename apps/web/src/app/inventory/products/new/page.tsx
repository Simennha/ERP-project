'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { createProduct } from '@/lib/inventory/api';
import { ProductForm } from '../product-form';

export default function NewProductPage() {
  const router = useRouter();
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.INVENTORY_PRODUCT_CREATE);

  // Bounce out if the user lacks create permission (the API would 403 anyway).
  useEffect(() => {
    if (!canCreate) {
      router.replace('/inventory/products');
    }
  }, [canCreate, router]);

  if (!canCreate) {
    return null;
  }

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
