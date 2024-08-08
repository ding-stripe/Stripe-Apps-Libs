import React, { useState, useEffect } from "react";
import { Box, ContextView, TextField, Checkbox, Spinner, Button, Inline, Select, Link } from "@stripe/ui-extension-sdk/ui";
import type { ExtensionContextValue } from "@stripe/ui-extension-sdk/context";
import { createHttpClient, STRIPE_API_KEY } from '@stripe/ui-extension-sdk/http_client';
import { getDashboardUserEmail } from '@stripe/ui-extension-sdk/utils';
import Stripe from 'stripe';

import BrandIcon from "./brand_icon.svg";

const stripe = new Stripe(STRIPE_API_KEY, {
  httpClient: createHttpClient(),
  apiVersion: '2024-06-20',
});

interface TransferParams {
  account_id: string;
  amount: number;
  currency: string;
  checked: boolean;
}

const currencyOptions = [
  { value: 'jpy', label: 'JPY' },
  { value: 'usd', label: 'USD' },
  // ... (other currency options)
];

const App: React.FC<ExtensionContextValue> = ({ environment }) => {
  const [email, setEmail] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [transferData, setTransferData] = useState<TransferParams>({
    account_id: "",
    amount: 0,
    currency: "",
    checked: false
  });
  const [message, setMessage] = useState<{ status: string, message: string }>();

  const dashboardUrl = `https://dashboard.stripe.com/${environment.mode === 'live' ? '' : 'test/'}`;
  const fetchEmail = async () => {
    try {
      const { email } = await getDashboardUserEmail();
      setEmail(email);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmail();
  }, []);


  const handleAccountDebit = async () => {
    setRequestLoading(true);
    try {
      const charge = await stripe.charges.create({
        amount: transferData.amount,
        currency: transferData.currency,
        source: transferData.account_id,
        metadata: {
          stripe_apps: 'dashboard-account-debit',
          email: email
        }
      });

      if (charge.status === "succeeded") {
        setMessage({ status: "info", message: charge.id });
        setTransferData({
          account_id: "",
          amount: 0,
          currency: "",
          checked: false
        });
      } else {
        throw new Error("Charge failed");
      }
    } catch (error) {
      console.error(error);
      setMessage({ status: "attention", message: (error as Error).message });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleInputChange = (field: keyof TransferParams, value: string | number | boolean) => {
    setTransferData(prev => ({ ...prev, [field]: value }));
  };


  const isFormValid = transferData.account_id && transferData.amount && transferData.currency && transferData.checked;

  return (
    <ContextView
      title="Account Debit"
      description="Use charge type account debits in your dashboard"
      brandColor="#F6F8FA"
      brandIcon={BrandIcon}
      externalLink={{
        label: "View docs",
        href: "https://docs.stripe.com/connect/account-debits"
      }}
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
            name="account_id"
            label="Source Account"
            type="text"
            placeholder="Source Account ID"
            value={transferData.account_id}
            onChange={(e) => handleInputChange('account_id', e.target.value)}
          />
          <TextField
            name="amount"
            label="Transfer Amount"
            type="number"
            placeholder="Transfer Amount"
            value={transferData.amount.toString()}
            onChange={(e) => handleInputChange('amount', Number(e.target.value))}
          />
          <Select
            name="currency"
            label="Currency"
            onChange={(e) => handleInputChange('currency', e.target.value)}
            value={transferData.currency}
          >
            <option value="">set the currency</option>
            {currencyOptions.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </Select>
          <Checkbox
            label="This action will incur account debit fees in live mode"
            checked={transferData.checked}
            onChange={(e) => handleInputChange('checked', e.target.checked)}
          />

          <Box css={{ stack: "y", gapY: "small" }}>
            <Button
              css={{ width: "fill" }}
              onPress={handleAccountDebit}
              type="primary"
              disabled={requestLoading || !isFormValid}
            >
              {requestLoading ? <Spinner /> : 'Create Account Debit'}
            </Button>
            {message && (
              <Inline css={{
                font: 'body',
                color: message.status === "attention" ? "attention" : "secondary"
              }}>
                {message.status === "attention" ? message.message : (
                  <Inline css={{ font: 'body' }}>
                    created <Link href={`${dashboardUrl}payments/${message.message}`} type="primary">{message.message}</Link>
                  </Inline>
                )}
              </Inline>
            )}
          </Box>
        </Box>

        <Box css={{ marginBottom: "medium" }}>
          <Inline css={{ font: 'caption' }}>
            Want to use transfer type account debits?
            Unfortunately, it is not possible due to technical restrictions from Stripe Apps. Please fill out the <Link href="https://forms.gle/kshU5FtJWs5eCDTm7"
              target="_blank"
              type="primary">feedback</Link> so we can use your voice to request this feature.
          </Inline>
        </Box>
      </Box>
    </ContextView>
  );
};

export default App;