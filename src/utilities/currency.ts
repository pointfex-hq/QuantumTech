import { Language } from '../types';

/**
 * Format currency in Bangladeshi Taka (whole BDT with no decimals, per DATA-02)
 */
export function formatCurrency(amount: number, lang: Language = 'en'): string {
  const rounded = Math.round(amount);
  
  if (lang === 'bn') {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const formattedNum = rounded.toLocaleString('en-IN');
    const bnFormatted = formattedNum.replace(/[0-9]/g, (d) => bengaliDigits[parseInt(d, 10)]);
    return `৳${bnFormatted}`;
  }

  return `৳${rounded.toLocaleString('en-IN')}`;
}

export function formatNumber(num: number, lang: Language = 'en'): string {
  if (lang === 'bn') {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/[0-9]/g, (d) => bengaliDigits[parseInt(d, 10)]);
  }
  return num.toString();
}
