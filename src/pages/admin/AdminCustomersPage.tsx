import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Coupon } from '../../types/promotions';
import { CustomerStatus, ManagedCustomer, customerAccountService } from '../../services/customerAccountService';
import { orderService } from '../../services/orderService';
import { promotionService } from '../../services/promotionService';
import { DeliveryArea, Order } from '../../types';
import { formatCurrency } from '../../utilities/currency';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../utilities/icons';

const toLocalDateTimeInput = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const cleanPhone = (phone: string) => phone.replace(/[\s-]/g, '');
const offerFieldClass = 'mt-1 w-full min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-normal text-ink placeholder:text-muted focus:border-quantum focus:outline-none focus:ring-2 focus:ring-quantum/20';
const filterFieldClass = 'min-h-11 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-quantum focus:outline-none focus:ring-2 focus:ring-quantum/20';

export const AdminCustomersPage: React.FC = () => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<ManagedCustomer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Coupon[]>([]);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<'All' | DeliveryArea>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | CustomerStatus>('All');
  const [sortBy, setSortBy] = useState<'items' | 'spend' | 'orders' | 'name'>('items');
  const [selectedCustomer, setSelectedCustomer] = useState<ManagedCustomer | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [minimumItems, setMinimumItems] = useState(5);
  const [minimumOrderValue, setMinimumOrderValue] = useState(0);
  const [startDate, setStartDate] = useState(() => toLocalDateTimeInput(new Date()));
  const [endDate, setEndDate] = useState(() => toLocalDateTimeInput(new Date(Date.now() + 30 * 86400000)));

  const loadData = () => {
    setCustomers(customerAccountService.getCustomers());
    setOrders(orderService.getOrders());
    setOffers(promotionService.getCoupons().filter((coupon) => coupon.minLifetimeDeliveredItems !== undefined));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('quantum_customer_updated', loadData);
    window.addEventListener('quantum_orders_updated', loadData);
    window.addEventListener('quantum_coupons_updated', loadData);
    return () => {
      window.removeEventListener('quantum_customer_updated', loadData);
      window.removeEventListener('quantum_orders_updated', loadData);
      window.removeEventListener('quantum_coupons_updated', loadData);
    };
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCustomer(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedCustomer]);

  const getCustomerOrders = (customer: ManagedCustomer) =>
    orders.filter((order) => cleanPhone(order.phone) === cleanPhone(customer.phone));

  const getDeliveredOrders = (customer: ManagedCustomer) =>
    getCustomerOrders(customer).filter((order) => order.status === 'Delivered');

  const getDeliveredItems = (customer: ManagedCustomer) =>
    getDeliveredOrders(customer)
      .reduce((count, order) => count + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  const getDeliveredSpend = (customer: ManagedCustomer) =>
    getDeliveredOrders(customer).reduce((total, order) => total + order.total, 0);

  const getCustomerArea = (customer: ManagedCustomer): DeliveryArea | undefined => {
    if (customer.area) return customer.area;
    return getCustomerOrders(customer)
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))[0]?.area;
  };

  const filteredCustomers = customers
    .filter((customer) => {
      const matchesSearch = `${customer.name} ${customer.email} ${customer.phone} ${customer.address || ''} ${getCustomerArea(customer) || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesArea = areaFilter === 'All' || getCustomerArea(customer) === areaFilter;
      const matchesStatus = statusFilter === 'All' || customer.status === statusFilter;
      return matchesSearch && matchesArea && matchesStatus;
    })
    .sort((first, second) => {
      if (sortBy === 'name') return first.name.localeCompare(second.name);
      if (sortBy === 'spend') return getDeliveredSpend(second) - getDeliveredSpend(first);
      if (sortBy === 'orders') return getDeliveredOrders(second).length - getDeliveredOrders(first).length;
      return getDeliveredItems(second) - getDeliveredItems(first);
    });

  const deliveredOrders = orders.filter((order) => order.status === 'Delivered');
  const areaPerformance = (area: DeliveryArea) => {
    const areaOrders = deliveredOrders.filter((order) => order.area === area);
    return {
      orderCount: areaOrders.length,
      customerCount: new Set(areaOrders.map((order) => cleanPhone(order.phone))).size,
      itemCount: areaOrders.reduce((count, order) =>
        count + order.items.reduce((sum, item) => sum + item.quantity, 0), 0),
      revenue: areaOrders.reduce((total, order) => total + order.total, 0),
    };
  };
  const areaStats = [
    { area: 'Inside Dhaka' as const, stats: areaPerformance('Inside Dhaka') },
    { area: 'Outside Dhaka' as const, stats: areaPerformance('Outside Dhaka') },
  ];
  const topSellingArea = areaStats[0].stats.itemCount === areaStats[1].stats.itemCount
    ? null
    : areaStats[0].stats.itemCount > areaStats[1].stats.itemCount
      ? areaStats[0].area
      : areaStats[1].area;

  const selectedCustomerOrders = selectedCustomer
    ? getCustomerOrders(selectedCustomer).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    : [];

  const handleCreateOffer = (event: React.FormEvent) => {
    event.preventDefault();
    const code = offerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!offerTitle.trim() || !code) {
      showToast('Offer title and coupon code are required.', 'error');
      return;
    }
    if (promotionService.getCouponByCode(code)) {
      showToast('That coupon code already exists. Choose a different code.', 'error');
      return;
    }
    if (
      discountValue <= 0 ||
      (discountType === 'percentage' && discountValue > 100) ||
      minimumItems < 1 ||
      !startDate ||
      !endDate ||
      new Date(endDate) <= new Date(startDate)
    ) {
      showToast('Check the discount, delivered-item threshold, and validity dates.', 'error');
      return;
    }

    promotionService.createCoupon({
      offerTitle: offerTitle.trim(),
      code,
      minLifetimeDeliveredItems: minimumItems,
      discountType,
      discountValue,
      minimumOrderValue: minimumOrderValue > 0 ? minimumOrderValue : undefined,
      usageLimit: 1000,
      perCustomerLimit: 1,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      isActive: true,
    });
    setOfferTitle('');
    setOfferCode('');
    setDiscountValue(10);
    setMinimumItems(5);
    setMinimumOrderValue(0);
    loadData();
    showToast('Purchase-volume offer created.', 'success');
  };

  const handleToggleOffer = (offer: Coupon) => {
    promotionService.updateCoupon(offer.id, { isActive: !offer.isActive });
    loadData();
    showToast(`Offer ${offer.isActive ? 'paused' : 'activated'}.`, 'success');
  };

  const handleDeleteOffer = (offer: Coupon) => {
    if (!window.confirm(`Delete offer "${offer.offerTitle || offer.code}"?`)) return;
    promotionService.deleteCoupon(offer.id);
    loadData();
    showToast('Offer deleted.', 'info');
  };

  const activeOfferCount = offers.filter((offer) => offer.isActive).length;
  const eligibleCustomerCount = offers
    .filter((offer) => offer.isActive)
    .reduce((count, offer) => count + customers.filter(
      (customer) => getDeliveredItems(customer) >= (offer.minLifetimeDeliveredItems || 0)
    ).length, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Customer Management</h1>
        <p className="mt-1 text-sm text-muted">
          Review customer accounts and reward groups based on delivered purchase volume.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-800 dark:border-sky-900 dark:bg-slate-900 dark:text-slate-100">
          <FontAwesomeIcon icon={Icons.info} className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-sky-300" />
          <span>Frontend-only preview: customer accounts, statuses, and offers are stored in this browser and are not shared across devices.</span>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Registered customers</p>
          <p className="mt-1 text-2xl font-bold text-ink">{customers.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Active purchase-volume offers</p>
          <p className="mt-1 text-2xl font-bold text-ink">{activeOfferCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Eligible customer-offer matches</p>
          <p className="mt-1 text-2xl font-bold text-ink">{eligibleCustomerCount}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Delivered sales by area</h2>
          <p className="mt-1 text-sm text-muted">Revenue and item totals include delivered orders only.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {areaStats.map(({ area, stats }) => {
            return (
              <article key={area} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-ink">{area}</h3>
                  {topSellingArea === area && (
                    <span className="rounded-full bg-quantum-soft px-2.5 py-1 text-xs font-semibold text-quantum">Most items sold</span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted">Delivered revenue</p>
                    <p className="mt-1 text-lg font-bold text-ink">{formatCurrency(stats.revenue, language)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Items sold</p>
                    <p className="mt-1 text-lg font-bold text-ink">{stats.itemCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Delivered orders</p>
                    <p className="mt-1 font-semibold text-ink">{stats.orderCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Customers</p>
                    <p className="mt-1 font-semibold text-ink">{stats.customerCount}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={Icons.discount} className="h-4 w-4 text-quantum" />
          <h2 className="text-lg font-bold text-ink">Create a purchase-volume offer</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Customers qualify after this many items have been delivered to their registered phone number. Qualifying customers can redeem the code at checkout.
        </p>
        <form onSubmit={handleCreateOffer} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Offer title
            <input required value={offerTitle} onChange={(event) => setOfferTitle(event.target.value)} placeholder="Loyal customer reward" className={offerFieldClass} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Coupon code
            <input required value={offerCode} onChange={(event) => setOfferCode(event.target.value)} placeholder="LOYAL10" className={`${offerFieldClass} font-mono`} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Minimum delivered items
            <input required min="1" type="number" value={minimumItems} onChange={(event) => setMinimumItems(Number(event.target.value))} className={offerFieldClass} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Discount type
            <select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'percentage' | 'fixed')} className={offerFieldClass}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount (৳)</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Discount value
            <input required min="1" max={discountType === 'percentage' ? 100 : undefined} type="number" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className={offerFieldClass} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Minimum order value (৳)
            <input min="0" type="number" value={minimumOrderValue} onChange={(event) => setMinimumOrderValue(Number(event.target.value))} className={offerFieldClass} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Starts
            <input required type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={offerFieldClass} />
          </label>
          <label className="text-sm font-semibold text-ink">
            Ends
            <input required type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={offerFieldClass} />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-quantum px-5 py-2.5 text-sm font-semibold text-white hover:bg-quantum-hover">
              <FontAwesomeIcon icon={Icons.plus} className="h-3.5 w-3.5" />
              Create offer
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="space-y-4 border-b border-border p-4">
          <div>
            <h2 className="font-bold text-ink">Customer accounts</h2>
            <p className="mt-1 text-xs text-muted">Purchase counts and spend are based on delivered orders. Select a customer for their order history.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_160px_190px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, or address..."
              aria-label="Search customers"
              className={`${filterFieldClass} w-full`}
            />
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as 'All' | DeliveryArea)} aria-label="Filter customers by delivery area" className={filterFieldClass}>
              <option value="All">All delivery areas</option>
              <option value="Inside Dhaka">Inside Dhaka</option>
              <option value="Outside Dhaka">Outside Dhaka</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | CustomerStatus)} aria-label="Filter customers by account status" className={filterFieldClass}>
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Blocked">Blocked</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort customers" className={filterFieldClass}>
              <option value="items">Sort: Most items bought</option>
              <option value="spend">Sort: Highest spend</option>
              <option value="orders">Sort: Most delivered orders</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {customers.length === 0 ? 'No customer accounts have been registered in this browser yet.' : 'No customers match the selected search and filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-surface-alt text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Delivery address</th>
                  <th className="px-4 py-3">Delivered items</th>
                  <th className="px-4 py-3">Delivered orders</th>
                  <th className="px-4 py-3">Delivered spend</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => {
                  const customerDeliveredOrders = getDeliveredOrders(customer);
                  const deliveredItems = getDeliveredItems(customer);
                  return (
                    <tr key={customer.email}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSelectedCustomer(customer)} className="text-left hover:text-quantum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quantum">
                          <span className="block font-semibold">{customer.name}</span>
                          <span className="block text-xs text-muted">{customer.email}</span>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-quantum">
                            View details <FontAwesomeIcon icon={Icons.chevronRight} className="h-2.5 w-2.5" />
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-ink">{customer.phone}</td>
                      <td className="max-w-xs px-4 py-3 text-ink">
                        <p className="line-clamp-2">{customer.address || '—'}</p>
                        {getCustomerArea(customer) && <p className="mt-1 text-xs text-muted">{getCustomerArea(customer)}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{deliveredItems}</td>
                      <td className="px-4 py-3 text-ink">{customerDeliveredOrders.length}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{formatCurrency(getDeliveredSpend(customer), language)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customer.status === 'Active' ? 'bg-success-soft text-success-dark' : 'bg-error-soft text-error'}`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => customerAccountService.setCustomerStatus(customer.email, customer.status === 'Active' ? 'Blocked' : 'Active')}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${customer.status === 'Active' ? 'border-error/30 text-error hover:bg-error-soft/30' : 'border-success/30 text-success-dark hover:bg-success-soft'}`}
                        >
                          {customer.status === 'Active' ? 'Block' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedCustomer(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface p-5">
              <div>
                <h2 id="customer-detail-title" className="text-xl font-bold text-ink">{selectedCustomer.name}</h2>
                <p className="mt-1 text-sm text-muted">{selectedCustomer.email} · {selectedCustomer.phone}</p>
              </div>
              <button
                type="button"
                aria-label="Close customer details"
                onClick={() => setSelectedCustomer(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-alt hover:text-ink"
              >
                <FontAwesomeIcon icon={Icons.close} className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface-alt p-4">
                  <p className="text-xs text-muted">Total orders</p>
                  <p className="mt-1 text-xl font-bold text-ink">{selectedCustomerOrders.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-4">
                  <p className="text-xs text-muted">Delivered orders</p>
                  <p className="mt-1 text-xl font-bold text-ink">{getDeliveredOrders(selectedCustomer).length}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-4">
                  <p className="text-xs text-muted">Items purchased</p>
                  <p className="mt-1 text-xl font-bold text-ink">{getDeliveredItems(selectedCustomer)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-alt p-4">
                  <p className="text-xs text-muted">Delivered spend</p>
                  <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(getDeliveredSpend(selectedCustomer), language)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="font-semibold text-ink">Customer and delivery details</h3>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <p><span className="text-muted">Account status:</span> <span className="font-semibold text-ink">{selectedCustomer.status}</span></p>
                  <p><span className="text-muted">Delivery area:</span> <span className="font-semibold text-ink">{getCustomerArea(selectedCustomer) || 'Not set'}</span></p>
                  <p className="sm:col-span-2"><span className="text-muted">Saved address:</span> <span className="text-ink">{selectedCustomer.address || 'No saved address'}</span></p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-ink">Order history</h3>
                {selectedCustomerOrders.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-border p-4 text-sm text-muted">No orders found for this customer.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedCustomerOrders.slice(0, 8).map((order) => (
                      <article key={order.id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{order.orderNumber}</p>
                            <p className="mt-1 text-xs text-muted">
                              {new Date(order.createdAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')} · {order.area}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-ink">{formatCurrency(order.total, language)}</p>
                            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === 'Delivered' ? 'bg-success-soft text-success-dark' : order.status === 'Cancelled' ? 'bg-error-soft text-error' : 'bg-quantum-soft text-quantum'}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-muted">
                          {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="font-bold text-ink">Purchase-volume offers</h2>
        </div>
        {offers.length === 0 ? (
          <p className="p-6 text-sm text-muted">No group offers created yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {offers.map((offer) => {
              const eligibleCount = customers.filter(
                (customer) => getDeliveredItems(customer) >= (offer.minLifetimeDeliveredItems || 0)
              ).length;
              return (
                <div key={offer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{offer.offerTitle || offer.code}</p>
                    <p className="mt-1 text-xs text-muted">
                      Code <span className="font-mono font-bold text-quantum">{offer.code}</span>
                      {' · '}
                      {offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${formatCurrency(offer.discountValue, language)} off`}
                      {' · '}
                      {offer.minLifetimeDeliveredItems} delivered items required
                      {' · '}
                      {eligibleCount} eligible customers
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleToggleOffer(offer)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-alt">
                      {offer.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => handleDeleteOffer(offer)} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error hover:bg-error-soft/30">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
