'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { createPurchaseOrder } from '@/lib/procurement/api';
import { PurchaseOrderForm } from '../purchase-order-form';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { getAccessToken, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE);

  // Bounce out if the user lacks create permission (the API would 403 anyway).
  useEffect(() => {
    if (!canCreate) {
      router.replace('/procurement/purchase-orders');
    }
  }, [canCreate, router]);

  if (!canCreate) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New purchase order</h1>
        <p className="text-muted-foreground">Create a purchase order for a vendor.</p>
      </div>

      <PurchaseOrderForm
        submitLabel="Create purchase order"
        onSubmit={async (input) => {
          const created = await createPurchaseOrder(getAccessToken(), input);
          router.push(`/procurement/purchase-orders/${created.id}`);
        }}
      />

      <Link href="/procurement/purchase-orders" className={buttonVariants({ variant: 'ghost' })}>
        Cancel
      </Link>
    </div>
  );
}
