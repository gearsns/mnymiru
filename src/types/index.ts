export interface AppSettings {
    apiKey: string;
    model: string;
}

/** Raw shape returned by the Gemini structured-output call. */
export interface GeminiReceiptResult {
  store_name: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  note?: string;
}
