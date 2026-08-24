export function money(amount: number | string, currency = "BWP") {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-BW", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(n || 0);
}

export function dateTime(value: string | Date) {
  return new Date(value).toLocaleString();
}
