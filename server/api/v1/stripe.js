import express, { Router } from 'express';
import { config } from '../../../config/config.js';
import {
  getStripeWebhookClient,
  processStripeSupportEvent
} from '../../db/supportFundingService.js';

const router = Router();

const useStripeAPI = (app) => {
  app.use('/api/v1/stripe', router);

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripeWebhookClient();
    const signature = req.headers['stripe-signature'];

    if (!stripe || !config.stripeWebhookSecret) {
      return res.status(503).json({ error: 'Stripe webhook is not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
    } catch (error) {
      console.error('Stripe webhook signature verification failed:', error.message);
      return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
    }

    try {
      const result = await processStripeSupportEvent(event);
      return res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error(`Failed to process Stripe webhook ${event.id}:`, error);
      return res.status(500).json({ error: 'Failed to process Stripe webhook' });
    }
  });
};

export default useStripeAPI;
