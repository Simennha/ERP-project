'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@erp/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, buttonVariants } from '@erp/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { deleteProduct, getProduct, updateProduct, type ProductDto } from '@/lib/inventory/api';
import { ProductForm, type ProductFormValues } from '../product-form';

function toFormValues(product: ProductDto): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    uom: product.uom,
    costPrice: product.costPrice,
    salePrice: product.salePrice,
    category: product.category ?? '',
    isActive: product.isActive,
  };
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { getAccessToken, hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.INVENTORY_PRODUCT_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.INVENTORY_PRODUCT_DELETE);

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProduct(await getProduct(getAccessToken(), id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!window.confirm('Delete this product? This also removes its stock and movement history.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteProduct(getAccessToken(), id);
      router.push('/inventory/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error && !product) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
        <Link href="/inventory/products" className={buttonVariants({ variant: 'outline' })}>
          Back to products
        </Link>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">
            SKU <code>{product.sku}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/inventory/stock/${product.id}/movements`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Movement history
          </Link>
          {canDelete ? (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      {canUpdate ? (
        <ProductForm
          key={product.updatedAt}
          initial={toFormValues(product)}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            const updated = await updateProduct(getAccessToken(), id, input);
            setProduct(updated);
            setNotice('Changes saved.');
          }}
        />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Detail label="Description" value={product.description ?? '—'} />
            <Detail label="Unit of measure" value={product.uom} />
            <Detail label="Cost price" value={product.costPrice} />
            <Detail label="Sale price" value={product.salePrice} />
            <Detail label="Category" value={product.category ?? '—'} />
            <Detail label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}
