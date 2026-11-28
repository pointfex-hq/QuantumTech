/**
 * Validate Bangladeshi phone number: 11 digits starting with 01[3-9]
 */
export function isValidBangladeshPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^01[3-9]\d{8}$/.test(cleaned);
}

/**
 * Validate bKash / Nagad TrxID: 8 to 12 alphanumeric characters (letters and digits)
 */
export function isValidTrxId(trxId: string): boolean {
  if (!trxId) return false;
  const cleaned = trxId.trim();
  return /^[A-Za-z0-9]{8,12}$/.test(cleaned);
}

/**
 * Validate customer name
 */
export function isValidName(name: string): boolean {
  return name.trim().length >= 2;
}

/**
 * Validate delivery address
 */
export function isValidAddress(address: string): boolean {
  return address.trim().length >= 5;
}
