// apps/web/src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            PERN Shop – clean, fast, predictable.
          </h1>
          <p className="text-sm opacity-80 md:text-base">
            Minimalistischer Demo-Shop mit Sessions/Cookies, Admin-Backoffice, Cart & Orders. Als
            nächstes: Checkout + Payment.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/products">
              <Button>Browse Products</Button>
            </Link>
            <Link to="/register">
              <Button variant="ghost">Create Account</Button>
            </Link>
          </div>

          <div className="pt-2 text-xs opacity-70">
            Tipp: Admin-Features erscheinen automatisch, sobald du als Admin eingeloggt bist.
          </div>
        </div>

        <Card className="p-5">
          <div className="space-y-3">
            <div className="text-sm font-semibold">What you can do</div>
            <ul className="list-disc space-y-2 pl-5 text-sm opacity-90">
              <li>Products ansehen und in den Cart legen</li>
              <li>Checkout (Order aus Cart) und Order-History</li>
              <li>Admin: Products verwalten, Orders einsehen und Status wechseln</li>
            </ul>

            <div className="pt-2 text-xs opacity-70">
              Roadmap: Product Details → Checkout → Stripe Payment → Webhooks → Marketing Pages.
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm font-semibold">Sessions / Cookies</div>
          <div className="mt-1 text-sm opacity-80">
            Auth basiert auf serverseitigen Sessions (credentials include).
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">Admin Backoffice</div>
          <div className="mt-1 text-sm opacity-80">
            Products CRUD-light + Orders Status Lifecycle.
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">Tests</div>
          <div className="mt-1 text-sm opacity-80">
            API-Tests via Vitest/Supertest; Ziel: kontinuierlich grün.
          </div>
        </Card>
      </section>
    </div>
  );
}
