import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Coins, HandCoins, ShieldCheck, Star } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';
import { useCommunity } from '../providers/CommunityProvider';
import { get, postIdempotent } from '../shared/api/http-client';
import { notify, openTelegramInvoice } from '../lib/telegram';
import type { DigitalProduct, PaymentStatus } from '../types/domain';

type StarsCheckout = {
  paymentIntentId: string;
  invoiceUrl: string;
  stars: number;
};

type PaymentView = {
  id: string;
  status: PaymentStatus;
};

async function waitForServerSettlement(paymentIntentId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const payment = await get<PaymentView>(`/api/v1/payments/${paymentIntentId}`);
    if (payment.status === 'PAID') return true;
    if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(payment.status)) return false;
    await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  }
  return false;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { mode, setMode } = useTheme();
  const { active } = useCommunity();
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const purchaseKey = useRef<string | null>(null);

  const products = useQuery({
    queryKey: ['digital-products', active?.id],
    queryFn: () =>
      get<DigitalProduct[]>(
        `/api/v1/payments/digital/products?communityId=${encodeURIComponent(active!.id)}`,
      ),
    enabled: Boolean(active?.id),
  });

  const supporterBadge = products.data?.find((product) => product.sku === 'SUPPORTER_BADGE');

  const buyStars = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error('Choose a community first.');
      if (!supporterBadge?.active) throw new Error('This digital product is not available.');
      if (supporterBadge.owned) throw new Error('You already own this supporter badge.');

      purchaseKey.current ??= crypto.randomUUID();
      const checkout = await postIdempotent<StarsCheckout>(
        '/api/v1/payments/digital/stars',
        { communityId: active.id, sku: 'SUPPORTER_BADGE' },
        purchaseKey.current,
      );

      const invoiceStatus = await openTelegramInvoice(checkout.invoiceUrl);
      if (invoiceStatus === 'cancelled') {
        return { settled: false, message: 'Stars checkout was cancelled.' };
      }
      if (invoiceStatus === 'failed') {
        return { settled: false, message: 'Telegram could not complete the Stars payment.' };
      }

      const settled = await waitForServerSettlement(checkout.paymentIntentId);
      return {
        settled,
        message: settled
          ? 'Supporter badge unlocked.'
          : 'Payment is still processing. HOOMA will recognize it from the Telegram webhook.',
      };
    },
    onSuccess: async (result) => {
      purchaseKey.current = null;
      setPurchaseMessage(result.message);
      notify(result.settled ? 'success' : 'warning');
      await queryClient.invalidateQueries({ queryKey: ['digital-products', active?.id] });
    },
    onError: (error) => {
      setPurchaseMessage(error instanceof Error ? error.message : 'Stars checkout failed.');
      notify('error');
    },
  });

  return (
    <div className="page-shell">
      <div className="section-kicker">Appearance</div>
      <h1 className="section-title">Settings</h1>

      <div className="mt-5 grid gap-3">
        {(
          [
            ['telegram', 'Telegram theme', null],
            ['dark', 'Pitch black / gold', null],
            ['light', 'White / orange', null],
            [
              'matchday-neon',
              'Matchday Neon',
              'Dark football-console inspired theme with neon match-night accents.',
            ],
          ] as const
        ).map(([value, label, description]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className="reference-row flex items-center px-5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-black">{label}</span>
              {description && (
                <span className="mt-1 block text-xs font-medium leading-5 muted">{description}</span>
              )}
              {value === 'matchday-neon' && (
                <span className="theme-palette-preview mt-2" aria-hidden="true">
                  <span style={{ background: '#070B12' }} />
                  <span style={{ background: '#2BFF88' }} />
                  <span style={{ background: '#41D9FF' }} />
                  <span style={{ background: '#7C6DFF' }} />
                </span>
              )}
            </span>
            {mode === value && <Check className="theme-option-check" />}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 muted">
        Telegram mode follows the host theme parameters. Manual overrides persist instantly on this
        device.
      </p>

      <section className="card mt-7 p-5">
        <div className="section-kicker">Payments</div>
        <h2 className="mt-1 text-lg font-black">Simple from day one</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3">
            <HandCoins size={19} style={{ color: 'var(--accent)' }} />
            <div>
              <strong>Cash</strong>
              <div className="muted">For real-world match, ride, and community costs.</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3">
            <Coins size={19} style={{ color: 'var(--accent)' }} />
            <div>
              <strong>Telegram Stars</strong>
              <div className="muted">Reserved for digital HOOMA goods and features.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-start gap-3">
          <Star size={21} style={{ color: 'var(--accent)' }} />
          <div className="min-w-0 flex-1">
            <div className="section-kicker">Digital supporter</div>
            <h2 className="mt-1 text-lg font-black">
              {supporterBadge?.title || 'HOOMA Supporter Badge'}
            </h2>
            <p className="mt-2 text-sm leading-6 muted">
              {supporterBadge?.description ||
                'Each community can optionally offer a digital supporter badge through Telegram Stars.'}
            </p>
          </div>
        </div>

        {!active && (
          <p className="mt-4 text-sm muted">Choose a community to see its digital goods.</p>
        )}

        {active && products.isLoading && (
          <p className="mt-4 text-sm muted">Loading Stars catalog…</p>
        )}

        {active && !products.isLoading && !supporterBadge && (
          <p className="mt-4 text-sm muted">
            This community has not enabled a Stars supporter badge yet.
          </p>
        )}

        {supporterBadge && (
          <button
            className={
              supporterBadge.owned ? 'ghost-button mt-4 w-full' : 'accent-button mt-4 w-full'
            }
            disabled={supporterBadge.owned || !supporterBadge.active || buyStars.isPending}
            onClick={() => buyStars.mutate()}
          >
            {supporterBadge.owned
              ? 'Supporter badge owned'
              : supporterBadge.active
                ? `${buyStars.isPending ? 'Opening Telegram…' : 'Buy with'} ${supporterBadge.starsAmount} Stars`
                : 'Supporter badge unavailable'}
          </button>
        )}

        {supporterBadge?.owned && (
          <div className="mt-3 flex items-center gap-2 text-sm font-bold">
            <ShieldCheck size={17} style={{ color: 'var(--accent)' }} />
            Verified by the server-side Telegram Stars settlement.
          </div>
        )}

        {purchaseMessage && <p className="mt-3 text-xs leading-5 muted">{purchaseMessage}</p>}
      </section>
    </div>
  );
}
