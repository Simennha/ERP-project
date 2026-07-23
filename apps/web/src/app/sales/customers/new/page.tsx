'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@erp/ui';
import { PERMISSIONS } from '@erp/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { RequirePermissionPage } from '@/lib/auth/require-permission-page';
import { createCustomer, type CustomerInput } from '@/lib/sales/api-client';

function NewCustomerForm() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    // Only send optional fields when non-empty (the API validates email format).
    const input: CustomerInput = { name: name.trim() };
    if (email.trim()) input.email = email.trim();
    if (phone.trim()) input.phone = phone.trim();
    if (billingAddress.trim()) input.billingAddress = billingAddress.trim();
    try {
      await createCustomer(getAccessToken(), input);
      router.push('/sales/customers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New customer</h1>
        <p className="text-muted-foreground">Add a customer to sell to.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingAddress">Billing address</Label>
              <Input
                id="billingAddress"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="optional"
              />
            </div>
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting ? 'Saving…' : 'Create customer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/sales/customers')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewCustomerPage() {
  return (
    <RequirePermissionPage permission={PERMISSIONS.SALES_CUSTOMER_CREATE}>
      <NewCustomerForm />
    </RequirePermissionPage>
  );
}
