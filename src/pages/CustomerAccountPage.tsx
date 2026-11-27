import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLanguage } from '../context/LanguageContext';
import { Icons } from '../utilities/icons';

export const CustomerAccountPage: React.FC = () => {
  const { language } = useLanguage();
  const isBangla = language === 'bn';

  return (
    <section className="min-h-[60vh] bg-surface-alt px-4 py-12 sm:px-6 lg:px-8">
      <div
        aria-labelledby="customer-account-title"
        className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center shadow-float sm:p-8"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-quantum-soft text-quantum">
          <FontAwesomeIcon icon={Icons.user} className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 id="customer-account-title" className="text-2xl font-bold text-ink">
          {isBangla ? 'লগইন / আমার অ্যাকাউন্ট' : 'Login / My Account'}
        </h1>
        <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-muted">
          {isBangla
            ? 'গ্রাহক অ্যাকাউন্টে লগইন এখনো চালু হয়নি। এখানে কোনো অ্যাকাউন্ট তৈরি বা পাসওয়ার্ড সংরক্ষণ করা হবে না।'
            : 'Customer sign-in is not available yet. No account will be created and no password will be stored here.'}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isBangla
            ? 'অ্যাকাউন্ট ছাড়াই আপনার অর্ডার ট্র্যাক করতে পারেন, অথবা সহায়তার জন্য আমাদের সঙ্গে যোগাযোগ করুন।'
            : 'You can track an order without an account, or contact us if you need help.'}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/track-order"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-quantum px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-quantum-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum focus-visible:ring-offset-2"
          >
            <FontAwesomeIcon icon={Icons.delivery} className="h-4 w-4" aria-hidden="true" />
            {isBangla ? 'অর্ডার ট্র্যাক করুন' : 'Track an Order'}
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-quantum/40 hover:text-quantum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum focus-visible:ring-offset-2"
          >
            {isBangla ? 'সহায়তা নিন' : 'Contact Support'}
          </Link>
        </div>
      </div>
    </section>
  );
};
