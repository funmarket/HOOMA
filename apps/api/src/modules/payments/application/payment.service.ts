import type { TransactionHandle, UnitOfWork } from '../../../application/unit-of-work.js';
import type { TelegramBotApi } from './telegram-bot-api.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { CommunityService } from '../../communities/application/community.service.js';
import type { RsvpRepository } from '../../events/application/event-repository.js';
import type { FundraiserRepository } from '../../fundraising/application/fundraiser-repository.js';
import type { RideRepository } from '../../rides/application/ride-repository.js';
import { assertMethodAllowedForPurpose } from '../domain/payment-policy.js';
import { PaymentDomainError } from '../domain/payment-domain-error.js';
import type {
  PaymentRepository,
  PaymentSettlementTarget,
  SuccessfulStarsPayment,
} from './payment-repository.js';

export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly communities: CommunityService,
    private readonly telegram: TelegramBotApi,
    private readonly uow: UnitOfWork,
    private readonly rsvps: RsvpRepository,
    private readonly rides: RideRepository,
    private readonly fundraising: FundraiserRepository,
  ) {}

  private assertMethodAllowed(
    purpose: 'EVENT_FEE' | 'RIDE_SHARE' | 'FUND_CONTRIBUTION' | 'DIGITAL_PRODUCT',
    method: 'CASH' | 'TELEGRAM_STARS',
  ) {
    try {
      assertMethodAllowedForPurpose(purpose, method);
    } catch (error) {
      if (error instanceof PaymentDomainError) {
        throw new AppError(400, error.code, error.message);
      }
      throw error;
    }
  }

  private async applySettlementTarget(
    target: PaymentSettlementTarget,
    action: 'SETTLE' | 'REFUND' | 'CANCEL',
    tx: TransactionHandle,
  ) {
    if (target.kind === 'EVENT_RSVP') {
      if (action === 'SETTLE') await this.rsvps.markPaymentSettled(target.id, tx);
      else if (action === 'REFUND') await this.rsvps.markPaymentRefunded(target.id, tx);
      else await this.rsvps.markPaymentCancelled(target.id, tx);
      return;
    }

    if (target.kind === 'RIDE_MATCH') {
      if (action === 'SETTLE') await this.rides.markPaymentSettled(target.id, tx);
      else if (action === 'REFUND') await this.rides.markPaymentRefunded(target.id, tx);
      else await this.rides.markPaymentCancelled(target.id, tx);
      return;
    }

    if (target.kind === 'FUND_CONTRIBUTION') {
      if (action === 'SETTLE') await this.fundraising.markContributionPaid(target.id, tx);
      else if (action === 'REFUND') await this.fundraising.markContributionRefunded(target.id, tx);
      else await this.fundraising.markContributionCancelled(target.id, tx);
    }
  }

  async confirmCash(input: {
    paymentIntentId: string;
    actorUserId: string;
    note?: string;
    requestId: string;
  }) {
    const context = await this.repo.getCashConfirmationContext(input.paymentIntentId);
    if (!context) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');

    this.assertMethodAllowed(context.purpose, 'CASH');
    if (context.payerUserId === input.actorUserId) {
      throw new AppError(
        403,
        'CASH_SELF_CONFIRM_FORBIDDEN',
        'The payer cannot confirm their own cash payment.',
      );
    }

    const isOrganizer = context.organizerUserId === input.actorUserId;
    if (!isOrganizer) {
      if (!context.communityId) {
        throw new AppError(
          403,
          'CASH_CONFIRM_FORBIDDEN',
          'Cash confirmation is not available for this payment.',
        );
      }
      await this.communities.requireManager(input.actorUserId, context.communityId);
    }

    await this.uow.run(async (tx) => {
      const result = await this.repo.recordCashSettlement(input, tx);
      await this.applySettlementTarget(result.target, 'SETTLE', tx);
    });
    return this.repo.getPaymentWithCashSettlement(input.paymentIntentId);
  }

  async voidCash(input: {
    paymentIntentId: string;
    actorUserId: string;
    reason: string;
    requestId: string;
  }) {
    const context = await this.repo.getCashConfirmationContext(input.paymentIntentId);
    if (!context) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
    if (!context.communityId) {
      throw new AppError(
        403,
        'CASH_VOID_FORBIDDEN',
        'Cash void is not available for this payment.',
      );
    }
    await this.communities.requireManager(input.actorUserId, context.communityId);

    await this.uow.run(async (tx) => {
      const result = await this.repo.voidCashSettlement(input, tx);
      await this.applySettlementTarget(result.target, 'REFUND', tx);
    });
    return this.repo.getPaymentWithCashSettlement(input.paymentIntentId);
  }

  async listDigitalProducts(userId: string, communityId: string) {
    await this.communities.requireMembership(userId, communityId);
    return this.repo.listDigitalProducts(userId, communityId);
  }

  async configureSupporterBadge(input: {
    actorUserId: string;
    communityId: string;
    starsAmount: number;
    active: boolean;
  }) {
    await this.communities.requireManager(input.actorUserId, input.communityId);
    return this.repo.upsertSupporterBadge({
      communityId: input.communityId,
      starsAmount: input.starsAmount,
      active: input.active,
    });
  }

  async createStarsInvoice(input: {
    userId: string;
    communityId: string;
    sku: 'SUPPORTER_BADGE';
    idempotencyKey: string;
  }) {
    this.assertMethodAllowed('DIGITAL_PRODUCT', 'TELEGRAM_STARS');
    await this.communities.requireMembership(input.userId, input.communityId);
    const checkout = await this.repo.createStarsCheckout(input);
    const invoiceUrl = await this.telegram.createStarsInvoiceLink({
      title: checkout.title,
      description: checkout.description,
      payload: checkout.payload,
      stars: checkout.stars,
    });
    return {
      paymentIntentId: checkout.paymentIntentId,
      invoiceUrl,
      stars: checkout.stars,
    };
  }

  validateStarsPreCheckout(input: {
    payload: string;
    totalAmount: number;
    telegramUserId: string;
  }) {
    return this.repo.validateStarsPreCheckout(input);
  }

  settleStars(input: SuccessfulStarsPayment) {
    return this.repo.settleStars(input);
  }

  async refundStars(input: {
    paymentIntentId: string;
    actorUserId: string;
    reason: string;
    requestId: string;
  }) {
    const context = await this.repo.getStarsRefundContext(input.paymentIntentId);
    if (!context) {
      throw new AppError(404, 'STARS_PAYMENT_NOT_FOUND', 'Telegram Stars payment not found.');
    }
    await this.communities.requireManager(input.actorUserId, context.communityId);

    if (!context.alreadyRefunded) {
      if (!context.telegramUserId) {
        throw new AppError(
          409,
          'STARS_TELEGRAM_IDENTITY_REQUIRED',
          'Telegram identity is required to refund this Stars payment.',
        );
      }
      await this.telegram.refundStarPayment(
        context.telegramUserId,
        context.telegramPaymentChargeId,
      );
    }

    return this.uow.run((tx) => this.repo.recordStarsRefund(input, tx));
  }

  async cancelForUser(paymentIntentId: string, userId: string, requestId: string) {
    return this.uow.run(async (tx) => {
      const result = await this.repo.cancelForUser(paymentIntentId, userId, requestId, tx);
      await this.applySettlementTarget(result.target, 'CANCEL', tx);
      return { paymentIntentId: result.paymentIntentId, status: result.status };
    });
  }

  getForUser(paymentIntentId: string, userId: string) {
    return this.repo.getForUser(paymentIntentId, userId);
  }
}
