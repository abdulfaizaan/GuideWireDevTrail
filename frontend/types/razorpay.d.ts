export {};

declare global {
  interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => Promise<void>;
    prefill?: {
      contact: string;
    };
    theme?: {
      color: string;
    };
  }

  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}
