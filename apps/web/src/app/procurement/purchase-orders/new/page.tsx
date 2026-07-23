'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createPurchaseOrder } from '@/lib/procurement/api';
import { PurchaseOrderForm } from '../purchase-order-form';

function NewPurchaseOrderContent() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

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

export default function NewPurchaseOrderPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.PROCUREMENT_PURCHASE_ORDER_CREATE}>
      <NewPurchaseOrderContent />
    </RequirePermissionPage>
  );
}
