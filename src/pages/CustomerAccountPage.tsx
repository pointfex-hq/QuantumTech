import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icons } from '../utilities/icons';
import { useLanguage } from '../context/LanguageContext';
import { customerAccountService, CustomerProfile } from '../services/customerAccountService';
import { orderService } from '../services/orderService';
import { DeliveryArea, Order } from '../types';
import { formatCurrency } from '../utilities/currency';
import { Coupon } from '../types/promotions';
import { promotionService } from '../services/promotionService';

export const CustomerAccountPage: React.FC = () => {
  const { language } = useLanguage();
  const [session, setSession] = useState<CustomerProfile | null>(() => customerAccountService.getSession());
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState<DeliveryArea>('Inside Dhaka');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Coupon[]>([]);

  useEffect(() => {
    const sync = () => setSession(customerAccountService.getSession());
    window.addEventListener('quantum_customer_updated', sync);
    return () => window.removeEventListener('quantum_customer_updated', sync);
  }, []);

  useEffect(() => {
    if (!session) {
      setOrders([]);
      setOffers([]);
      return;
    }
    setName(session.name);
    setEmail(session.email);
    setPhone(session.phone);
    setAddress(session.address || '');
    setArea(session.area || 'Inside Dhaka');
    const cleanPhone = session.phone.replace(/[\s-]/g, '');
    setOrders(orderService.getOrders().filter((order) =>
      order.phone.replace(/[\s-]/g, '') === cleanPhone ||
      order.customerName.toLowerCase() === session.name.toLowerCase()
    ));
    setOffers(promotionService.getEligibleCustomerOffers(session.phone));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const syncOffers = () => setOffers(promotionService.getEligibleCustomerOffers(session.phone));
    window.addEventListener('quantum_coupons_updated', syncOffers);
    window.addEventListener('quantum_orders_updated', syncOffers);
    return () => {
      window.removeEventListener('quantum_coupons_updated', syncOffers);
      window.removeEventListener('quantum_orders_updated', syncOffers);
    };
  }, [session]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!email.includes('@') || password.length < 6) {
      setError(language === 'bn'
        ? 'সঠিক ইমেল এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।'
        : 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    if (mode === 'register' && (
      !name.trim() ||
      !/^01\d{9}$/.test(phone.replace(/[\s-]/g, '')) ||
      address.trim().length < 8
    )) {
      setError(language === 'bn'
        ? 'নাম, বৈধ মোবাইল নম্বর এবং সম্পূর্ণ ডেলিভারি ঠিকানা দিন।'
        : 'Enter your name, a valid 11-digit mobile number, and a complete delivery address.');
      return;
    }

    setSubmitting(true);
    const result = mode === 'register'
      ? await customerAccountService.register({ name: name.trim(), email, phone, address: address.trim(), area }, password)
      : await customerAccountService.login(email, password);
    setSubmitting(false);

    if (result.success) {
      setPassword('');
      setSession(customerAccountService.getSession());
    } else {
      setError(result.error || 'Unable to continue.');
    }
  };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !email.includes('@') || !/^01\d{9}$/.test(phone.replace(/[\s-]/g, '')) || address.trim().length < 8) {
      setError(language === 'bn'
        ? 'বৈধ নাম, ইমেল, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা দিন।'
        : 'Enter a valid name, email, mobile number, and complete delivery address.');
      return;
    }
    customerAccountService.updateProfile({ name: name.trim(), email, phone, address: address.trim(), area });
    setSession(customerAccountService.getSession());
    setSuccess(language === 'bn' ? 'প্রোফাইল সংরক্ষণ হয়েছে।' : 'Profile saved successfully.');
  };

  const logout = () => {
    customerAccountService.logout();
    setSession(null);
    setEmail('');
    setPassword('');
  };

  if (!session) {
    return (
      <div className="min-h-[60vh] bg-surface-alt px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-quantum-soft text-quantum">
            <FontAwesomeIcon icon={Icons.user} className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-ink">
            {mode === 'login'
              ? (language === 'bn' ? 'অ্যাকাউন্টে লগইন' : 'Login to Your Account')
              : (language === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Create an Account')}
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="caption-3 mb-1 block font-semibold text-ink">
                  {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                </label>
                <input autoComplete="name" placeholder={language === 'bn' ? 'আপনার পূর্ণ নাম লিখুন' : 'Enter your full name'} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted" />
              </div>
            )}
            <div>
              <label className="caption-3 mb-1 block font-semibold text-ink">
                {language === 'bn' ? 'ইমেল' : 'Email'}
              </label>
              <input type="email" autoComplete="email" placeholder={language === 'bn' ? 'আপনার ইমেল লিখুন' : 'you@example.com'} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted" />
            </div>
            {mode === 'register' && (
              <div>
                <label className="caption-3 mb-1 block font-semibold text-ink">
                  {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                </label>
                <input type="tel" autoComplete="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted" />
              </div>
            )}
            {mode === 'register' && (
              <>
                <div>
                  <label className="caption-3 mb-1 block font-semibold text-ink">
                    {language === 'bn' ? 'ডেলিভারি এলাকা' : 'Delivery Area'}
                  </label>
                  <select value={area} onChange={(event) => setArea(event.target.value as DeliveryArea)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink">
                    <option value="Inside Dhaka">{language === 'bn' ? 'ঢাকার ভিতরে' : 'Inside Dhaka'}</option>
                    <option value="Outside Dhaka">{language === 'bn' ? 'ঢাকার বাইরে' : 'Outside Dhaka'}</option>
                  </select>
                </div>
                <div>
                  <label className="caption-3 mb-1 block font-semibold text-ink">
                    {language === 'bn' ? 'সম্পূর্ণ ডেলিভারি ঠিকানা' : 'Full Delivery Address'}
                  </label>
                  <textarea rows={3} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={language === 'bn' ? 'বাসা, রোড, এলাকা, জেলা বা পরিচিত স্থান লিখুন' : 'House, road, area, district, or nearby landmark'} className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted" />
                </div>
              </>
            )}
            <div>
              <label className="caption-3 mb-1 block font-semibold text-ink">
                {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? (language === 'bn' ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter your password') : (language === 'bn' ? 'কমপক্ষে ৬ অক্ষর' : 'At least 6 characters')} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted" />
            </div>
            {error && <p className="rounded-lg bg-error-soft/40 px-3 py-2 text-xs text-error">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-quantum px-4 py-3 text-sm font-semibold text-white hover:bg-quantum-hover disabled:opacity-60">
              {submitting
                ? (language === 'bn' ? 'অপেক্ষা করুন...' : 'Please wait...')
                : mode === 'login'
                  ? (language === 'bn' ? 'লগইন' : 'Login')
                  : (language === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Account')}
            </button>
          </form>

          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="mt-4 w-full text-center text-sm font-semibold text-quantum">
            {mode === 'login'
              ? (language === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'Create a new account')
              : (language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন' : 'Already have an account? Login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-surface-alt px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="caption-3 text-muted">{language === 'bn' ? 'স্বাগতম' : 'Welcome back'}</p>
            <h1 className="text-2xl font-bold text-ink">{session.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/track-order" className="flex items-center gap-2 rounded-xl bg-quantum px-4 py-2.5 text-sm font-semibold text-white hover:bg-quantum-hover">
              <FontAwesomeIcon icon={Icons.delivery} className="h-4 w-4" />
              {language === 'bn' ? 'অর্ডার ট্র্যাক করুন' : 'Track an Order'}
            </Link>
            <button type="button" onClick={logout} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:text-error">
              <FontAwesomeIcon icon={Icons.logout} className="h-4 w-4" />
              {language === 'bn' ? 'লগআউট' : 'Logout'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border">
          <button type="button" onClick={() => setActiveTab('profile')} className={`px-4 py-3 text-sm font-semibold ${activeTab === 'profile' ? 'border-b-2 border-quantum text-quantum' : 'text-muted'}`}>
            {language === 'bn' ? 'প্রোফাইল' : 'Profile'}
          </button>
          <button type="button" onClick={() => setActiveTab('orders')} className={`px-4 py-3 text-sm font-semibold ${activeTab === 'orders' ? 'border-b-2 border-quantum text-quantum' : 'text-muted'}`}>
            {language === 'bn' ? 'পূর্বের অর্ডার' : 'Purchase History'}
          </button>
        </div>

        {offers.length > 0 && (
          <section className="mt-6 rounded-2xl border border-quantum/25 bg-quantum-soft/40 p-5">
            <div className="mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={Icons.gift} className="h-4 w-4 text-quantum" />
              <h2 className="font-bold text-ink">{language === 'bn' ? 'আপনার বিশেষ অফার' : 'Offers unlocked for you'}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {offers.map((offer) => (
                <div key={offer.id} className="rounded-xl border border-border bg-surface p-4">
                  <p className="font-semibold text-ink">{offer.offerTitle || (language === 'bn' ? 'বিশেষ গ্রাহক অফার' : 'Loyal customer offer')}</p>
                  <p className="mt-1 text-sm text-muted">
                    {offer.discountType === 'percentage'
                      ? `${offer.discountValue}% ${language === 'bn' ? 'ছাড়' : 'off'}`
                      : `${formatCurrency(offer.discountValue, language)} ${language === 'bn' ? 'ছাড়' : 'off'}`}
                    {offer.minimumOrderValue ? ` · ${language === 'bn' ? 'ন্যূনতম অর্ডার' : 'Min. order'} ${formatCurrency(offer.minimumOrderValue, language)}` : ''}
                  </p>
                  <p className="mt-3 inline-flex rounded-lg bg-quantum-soft px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-quantum">
                    {offer.code}
                  </p>
                  <Link to="/shop" className="mt-3 block text-sm font-semibold text-quantum hover:underline">
                    {language === 'bn' ? 'কেনাকাটা করুন এবং চেকআউটে কোড ব্যবহার করুন' : 'Shop and apply this code at checkout'}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'profile' ? (
          <form onSubmit={saveProfile} className="mt-6 max-w-xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="caption-3 font-semibold text-ink">
                {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                <input autoComplete="name" placeholder={language === 'bn' ? 'আপনার পূর্ণ নাম লিখুন' : 'Enter your full name'} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted" />
              </label>
              <label className="caption-3 font-semibold text-ink">
                {language === 'bn' ? 'ইমেল' : 'Email'}
                <input type="email" autoComplete="email" placeholder={language === 'bn' ? 'আপনার ইমেল লিখুন' : 'you@example.com'} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted" />
              </label>
              <label className="caption-3 font-semibold text-ink sm:col-span-2">
                {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                <input type="tel" autoComplete="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted" />
              </label>
              <label className="caption-3 font-semibold text-ink">
                {language === 'bn' ? 'ডেলিভারি এলাকা' : 'Delivery Area'}
                <select value={area} onChange={(event) => setArea(event.target.value as DeliveryArea)} className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink">
                  <option value="Inside Dhaka">{language === 'bn' ? 'ঢাকার ভিতরে' : 'Inside Dhaka'}</option>
                  <option value="Outside Dhaka">{language === 'bn' ? 'ঢাকার বাইরে' : 'Outside Dhaka'}</option>
                </select>
              </label>
              <label className="caption-3 font-semibold text-ink sm:col-span-2">
                {language === 'bn' ? 'সম্পূর্ণ ডেলিভারি ঠিকানা' : 'Full Delivery Address'}
                <textarea rows={3} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={language === 'bn' ? 'বাসা, রোড, এলাকা, জেলা বা পরিচিত স্থান লিখুন' : 'House, road, area, district, or nearby landmark'} className="mt-1 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted" />
              </label>
            </div>
            {error && <p className="mt-4 rounded-lg bg-error-soft/40 px-3 py-2 text-xs text-error">{error}</p>}
            {success && <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{success}</p>}
            <button type="submit" className="mt-5 rounded-xl bg-quantum px-5 py-3 text-sm font-semibold text-white hover:bg-quantum-hover">
              {language === 'bn' ? 'প্রোফাইল সংরক্ষণ' : 'Save Profile'}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                <FontAwesomeIcon icon={Icons.order} className="mx-auto mb-3 h-6 w-6 text-muted" />
                <p className="text-sm font-semibold text-ink">{language === 'bn' ? 'কোনো অর্ডার নেই' : 'No purchase history yet'}</p>
                <Link to="/shop" className="mt-3 inline-block text-sm font-semibold text-quantum">{language === 'bn' ? 'কেনাকাটা শুরু করুন' : 'Start shopping'}</Link>
              </div>
            ) : orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-muted">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="rounded-full bg-quantum-soft px-3 py-1 text-xs font-semibold text-quantum">{order.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(order.total, language)}</p>
                  <Link to={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:text-quantum">
                    <FontAwesomeIcon icon={Icons.delivery} className="h-3.5 w-3.5" />
                    {language === 'bn' ? 'অর্ডার ট্র্যাক করুন' : 'Track Order'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
