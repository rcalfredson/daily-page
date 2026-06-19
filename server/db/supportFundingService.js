import Stripe from 'stripe';
import { config } from '../../config/config.js';
import SupportSubscription from './models/SupportSubscription.js';
import StripeWebhookEvent from './models/StripeWebhookEvent.js';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'];
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

function toDateFromSeconds(value) {
  return value ? new Date(value * 1000) : null;
}

function objectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function getInvoiceSubscriptionId(invoice) {
  return objectId(invoice?.subscription) ||
    objectId(invoice?.parent?.subscription_details?.subscription);
}

function getSubscriptionItem(subscription, monthlyPriceId = config.stripeSupportMonthlyPriceId) {
  const items = subscription?.items?.data || [];
  return items.find((item) => item?.price?.id === monthlyPriceId) || null;
}

function getMonthlyAmountUsd(subscription, item) {
  if (!item) return 0;

  const unitAmount = item.price?.unit_amount || 0;
  const quantity = item.quantity || 1;
  const interval = item.price?.recurring?.interval || 'month';
  const intervalCount = item.price?.recurring?.interval_count || 1;
  const amount = (unitAmount * quantity) / 100;

  if (interval === 'year') return amount / (12 * intervalCount);
  if (interval === 'week') return amount * (52 / 12) / intervalCount;
  if (interval === 'day') return amount * (365 / 12) / intervalCount;
  return amount / intervalCount;
}

async function retrieveSubscription(subscriptionId) {
  if (!stripe || !subscriptionId) return null;

  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price']
  });
}

async function upsertSupportSubscription(subscription, eventId = null) {
  if (!subscription?.id || !config.stripeSupportMonthlyPriceId) return { counted: false };

  const item = getSubscriptionItem(subscription);
  if (!item) return { counted: false };

  const amountUsdMonthly = getMonthlyAmountUsd(subscription, item);

  await SupportSubscription.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: objectId(subscription.customer),
      stripePriceId: item.price.id,
      status: subscription.status,
      currency: item.price?.currency || 'usd',
      amountUsdMonthly,
      quantity: item.quantity || 1,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodStart: toDateFromSeconds(subscription.current_period_start),
      currentPeriodEnd: toDateFromSeconds(subscription.current_period_end),
      latestInvoiceId: objectId(subscription.latest_invoice),
      lastStripeEventId: eventId,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  return { counted: true };
}

async function removeSupportSubscription(subscriptionId) {
  if (!subscriptionId) return;
  await SupportSubscription.findOneAndUpdate(
    { stripeSubscriptionId: subscriptionId },
    { status: 'canceled' },
    { new: true }
  ).exec();
}

async function hasProcessedEvent(event) {
  return Boolean(await StripeWebhookEvent.exists({ _id: event.id }));
}

async function markEventProcessed(event) {
  try {
    await StripeWebhookEvent.create({
      _id: event.id,
      type: event.type,
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

export async function processStripeSupportEvent(event) {
  if (await hasProcessedEvent(event)) return { duplicate: true };

  const object = event.data?.object;
  let result;

  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = objectId(object?.subscription);
      if (!subscriptionId) {
        result = { handled: true, counted: false };
        break;
      }
      const subscription = await retrieveSubscription(subscriptionId);
      result = await upsertSupportSubscription(subscription, event.id);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      result = await upsertSupportSubscription(object, event.id);
      break;
    }
    case 'customer.subscription.deleted': {
      await removeSupportSubscription(object?.id);
      result = { handled: true };
      break;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subscriptionId = getInvoiceSubscriptionId(object);
      if (!subscriptionId) {
        result = { handled: true, counted: false };
        break;
      }
      const subscription = await retrieveSubscription(subscriptionId);
      result = await upsertSupportSubscription(subscription, event.id);
      break;
    }
    default:
      result = { handled: false };
  }

  await markEventProcessed(event);
  return result;
}

export async function getRecurringSupportMonthlyTotalUsd() {
  if (!config.stripeSupportMonthlyPriceId) return null;

  const rows = await SupportSubscription.aggregate([
    {
      $match: {
        stripePriceId: config.stripeSupportMonthlyPriceId,
        status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountUsdMonthly' },
      }
    }
  ]).exec();

  return rows[0]?.total || 0;
}

export function getStripeWebhookClient() {
  return stripe;
}
