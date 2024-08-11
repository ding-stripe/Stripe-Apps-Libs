import React, { useState, useEffect, useCallback } from "react";
import { Box, ContextView, TextField, Checkbox, Spinner, Button, Inline, Tooltip } from "@stripe/ui-extension-sdk/ui";
import type { ExtensionContextValue } from "@stripe/ui-extension-sdk/context";
import { createHttpClient, STRIPE_API_KEY } from '@stripe/ui-extension-sdk/http_client';
import { getDashboardUserEmail } from '@stripe/ui-extension-sdk/utils';
import { useRefreshDashboardData } from '@stripe/ui-extension-sdk/context';
import Stripe from 'stripe';

import BrandIcon from "./brand_icon.svg";

const stripe = new Stripe(STRIPE_API_KEY, {
  httpClient: createHttpClient(),
  apiVersion: '2024-06-20',
});

interface PaymentIntentParams {
  paymentIntent_id: string;
  checked: boolean;
  status: string;
}

interface Message {
  status: 'info' | 'attention';
  message: string;
}

const App: React.FC<ExtensionContextValue> = ({ environment }) => {
  const [email, setEmail] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [paymentIntentData, setPaymentIntentData] = useState<PaymentIntentParams>({
    paymentIntent_id: environment?.objectContext?.id || "",
    checked: false,
    status: "",
  });
  const [message, setMessage] = useState<Message>();
  const refreshDashboardData = useRefreshDashboardData();

  const fetchEmail = useCallback(async () => {
    try {
      const { email } = await getDashboardUserEmail();
      setEmail(email);
    } catch (error) {
      console.error('Failed to fetch email:', error);
    }
  }, []);

  const fetchPaymentIntent = useCallback(async () => {
    try {
      const id = environment?.objectContext?.id;
      if (!id) {
        throw new Error("Payment Intent ID is undefined");
      }

      const response = await stripe.paymentIntents.retrieve(id);
      setPaymentIntentData(prev => ({ ...prev, status: response.status }));
    } catch (error) {
      console.error('Failed to fetch PaymentIntent:', error);
    }
  }, [environment?.objectContext?.id]);

  useEffect(() => {
    fetchPaymentIntent();
    fetchEmail();
  }, [fetchPaymentIntent, fetchEmail]);

  const handleCancellation = async () => {
    setRequestLoading(true);
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentData.paymentIntent_id);
      await stripe.paymentIntents.update(paymentIntentData.paymentIntent_id, {
        metadata: {
          stripe_apps: 'dashboard-cancellation',
          email: email ?? null
        },
      });

      if (paymentIntent.status === "canceled") {
        setMessage({ status: "info", message: paymentIntent.id });
        setPaymentIntentData(prev => ({
          ...prev,
          status: paymentIntent.status,
          checked: false,
        }));
        refreshDashboardData();
      } else {
        throw new Error("Failed to cancel the PaymentIntent");
      }
    } catch (error) {
      console.error('Cancellation failed:', error);
      setPaymentIntentData(prev => ({ ...prev, checked: false }));
      setMessage({ status: "attention", message: (error as Error).message });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleInputChange = (field: keyof PaymentIntentParams, value: string | boolean) => {
    setPaymentIntentData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = paymentIntentData.paymentIntent_id && paymentIntentData.checked;
  const isCancellable = ["requires_payment_method", "requires_capture", "requires_confirmation", "requires_action", "processing"].includes(paymentIntentData.status);

  return (
    <ContextView
      title="Cancel PaymentIntent"
      description="Cancel a PaymentIntent for non-card payments"
      brandColor="#F6F8FA"
      brandIcon={BrandIcon}
    >
      <Box css={{ height: "fill", stack: "y", distribute: "space-between" }}>
        <Box css={{
          background: "container",
          borderRadius: "medium",
          marginTop: "small",
          padding: "large",
          stack: "y",
          gapY: "medium",
        }}>
          <TextField
            name="paymentIntent ID"
            label="PaymentIntent ID"
            type="text"
            disabled
            placeholder="PaymentIntent ID"
            value={environment?.objectContext?.id}
          />
          <Checkbox
            label="This action is not reversible"
            disabled={!isCancellable}
            checked={paymentIntentData.checked}
            onChange={(e) => handleInputChange('checked', e.target.checked)}
          />

          <Box css={{ stack: "y", gapY: "small" }}>
            {isCancellable ? (
              <Button
                css={{ width: "fill" }}
                onPress={handleCancellation}
                type="primary"
                disabled={requestLoading || !isFormValid}
              >
                {requestLoading ? <Spinner /> : 'Cancel the PaymentIntent'}
              </Button>
            ) : (
              <Tooltip
                type="description"
                trigger={
                  <Button
                    css={{ width: "fill" }}
                    type="primary"
                    disabled
                  >
                    Cancel the PaymentIntent
                  </Button>
                }
              >
                You can only cancel a PaymentIntent object when it&apos;s in one of these statuses: requires_payment_method, requires_capture, requires_confirmation, requires_action or, in rare cases, processing.
              </Tooltip>
            )}
            {message && (
              <Inline css={{
                font: 'body',
                color: message.status === "attention" ? "attention" : "secondary"
              }}>
                {message.status === "attention" ? message.message : (
                  <Inline css={{ font: 'body' }}>
                    canceled successfully!
                  </Inline>
                )}
              </Inline>
            )}
          </Box>
        </Box>
      </Box>
    </ContextView>
  );
};

export default App;