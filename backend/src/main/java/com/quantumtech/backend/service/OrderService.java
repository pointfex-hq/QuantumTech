package com.quantumtech.backend.service;

import com.quantumtech.backend.dto.CreateOrderRequest;
import com.quantumtech.backend.dto.CampaignAnalyticsRequest;
import com.quantumtech.backend.dto.CouponValidationRequest;
import com.quantumtech.backend.dto.OrderStatusRequest;
import com.quantumtech.backend.dto.PaymentStatusRequest;
import com.quantumtech.backend.exception.ApiException;
import com.quantumtech.backend.model.*;
import com.quantumtech.backend.repository.OrderRepository;
import com.quantumtech.backend.repository.ProductRepository;
import com.quantumtech.backend.repository.SettingsRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OrderService {
    private final OrderRepository orders;
    private final ProductRepository products;
    private final SettingsRepository settings;
    private final NotificationService notificationService;
    private final PromotionService promotions;
    private final Map<String, Deque<Instant>> trackingAttempts = new ConcurrentHashMap<>();

    public OrderService(OrderRepository orders, ProductRepository products,
                        SettingsRepository settings, NotificationService notificationService,
                        PromotionService promotions) {
        this.orders = orders;
        this.products = products;
        this.settings = settings;
        this.notificationService = notificationService;
        this.promotions = promotions;
    }

    public List<Order> list(String status, String paymentMethod, String search) {
        return orders.findAll().stream()
                .filter(o -> status == null || status.isBlank() || status.equals(o.getStatus()))
                .filter(o -> paymentMethod == null || paymentMethod.isBlank()
                        || paymentMethod.equals(o.getPaymentMethod()))
                .filter(o -> search == null || search.isBlank()
                        || o.getOrderNumber().toLowerCase().contains(search.toLowerCase())
                        || o.getPhone().contains(search.replaceAll("[\\s-]", ""))
                        || o.getCustomerName().toLowerCase().contains(search.toLowerCase()))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
    }

    public Order getById(String id) {
        return orders.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    public Order getByNumber(String number) {
        return orders.findByOrderNumberIgnoreCase(number)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    @Transactional
    public synchronized Order create(CreateOrderRequest request, String idempotencyKey) {
        if (idempotencyKey != null) {
            Optional<Order> existing = orders.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) return existing.get();
        }
        if (!"COD".equals(request.paymentMethod())
                && !"bKash".equals(request.paymentMethod())
                && !"Nagad".equals(request.paymentMethod())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid payment method");
        }
        if (!"Inside Dhaka".equals(request.area()) && !"Outside Dhaka".equals(request.area())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid delivery area");
        }
        if ("bKash".equals(request.paymentMethod()) || "Nagad".equals(request.paymentMethod())) {
            if (request.trxId() == null || !request.trxId().matches("[A-Za-z0-9]{8,12}")
                    || request.senderNumber() == null
                    || !request.senderNumber().matches("01[3-9][0-9]{8}")) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Valid TrxID and sender number are required");
            }
            if (orders.findByTrxIdIgnoreCase(request.trxId()).isPresent()) {
                throw new ApiException(HttpStatus.CONFLICT, "This TrxID has already been used");
            }
        }

        Instant now = Instant.now();
        String date = DateTimeFormatter.ofPattern("yyMMdd").withLocale(Locale.ENGLISH)
                .format(LocalDate.now(ZoneOffset.UTC));
        long count = orders.count();
        String orderNumber = "QT-" + date + "-" + String.format(Locale.ENGLISH, "%04d", count + 1);

        StoreSettings store = settings.findById("store").orElse(new StoreSettings());
        int delivery = "Inside Dhaka".equals(request.area())
                ? store.getDeliveryChargeInsideDhaka()
                : store.getDeliveryChargeOutsideDhaka();
        int subtotal = 0;
        int promotionalSavings = 0;
        List<OrderItem> validatedItems = new ArrayList<>();
        List<CouponValidationRequest.CartLine> couponLines = new ArrayList<>();
        Map<String, Product> changedProducts = new LinkedHashMap<>();

        for (OrderItem incoming : request.items()) {
            if (incoming.getQuantity() < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be at least 1");
            }
            Product product = changedProducts.get(incoming.getProductId());
            if (product == null) {
                product = products.findById(incoming.getProductId())
                        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                                "Product not available: " + incoming.getProductId()));
                changedProducts.put(product.getId(), product);
            }
            if ("Deleted".equals(product.getStatus()) || "Hidden".equals(product.getStatus())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product is not available");
            }
            boolean hasVariants = product.getVariants() != null && !product.getVariants().isEmpty();
            if (hasVariants && (incoming.getVariantId() == null
                    || incoming.getVariantId().isBlank())) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "A variant must be selected for product " + product.getName());
            }
            PromotionService.PriceResult price = promotions.calculateProductPrice(
                    product, incoming.getVariantId());
            int unitPrice = (int) Math.round(price.finalPrice());
            if (incoming.getVariantId() != null && !incoming.getVariantId().isBlank()) {
                ProductVariant variant = Optional.ofNullable(product.getVariants()).orElse(List.of()).stream()
                        .filter(v -> incoming.getVariantId().equals(v.getId()))
                        .findFirst()
                        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Variant not found"));
                if (incoming.getQuantity() > variant.getStock()) {
                    throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock");
                }
                variant.setStock(variant.getStock() - incoming.getQuantity());
                incoming.setVariantName(variant.getValue());
                incoming.setImage(variant.getImage() != null ? variant.getImage()
                        : (product.getImages().isEmpty() ? null : product.getImages().get(0)));
                product.setStock(product.getVariants().stream()
                        .mapToInt(v -> Math.max(0, v.getStock())).sum());
            } else {
                if (incoming.getQuantity() > product.getStock()) {
                    throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock");
                }
                product.setStock(product.getStock() - incoming.getQuantity());
                incoming.setImage(product.getImages().isEmpty() ? null : product.getImages().get(0));
            }
            incoming.setId(UUID.randomUUID().toString());
            incoming.setOrderId("");
            incoming.setProductName(product.getName());
            incoming.setUnitPrice(unitPrice);
            incoming.setLineTotal(unitPrice * incoming.getQuantity());
            incoming.setOriginalPrice((int) Math.round(price.originalPrice()));
            incoming.setDiscountAmount((int) Math.round(price.discountAmount()));
            incoming.setAppliedDiscountId(price.discountId());
            subtotal += incoming.getLineTotal();
            promotionalSavings += incoming.getDiscountAmount() * incoming.getQuantity();
            couponLines.add(new CouponValidationRequest.CartLine(product.getId(),
                    product.getCategoryId(), incoming.getLineTotal()));
            validatedItems.add(incoming);
        }

        int couponDiscount = 0;
        String couponCode = request.couponCode();
        if (couponCode != null && !couponCode.isBlank()) {
            PromotionService.CouponValidationResult validation = promotions.validateCoupon(
                    new CouponValidationRequest(couponCode, request.phone(), couponLines));
            if (!validation.valid()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, validation.error());
            }
            couponDiscount = (int) Math.round(validation.discountAmount());
            couponCode = validation.coupon().getCode();
        } else {
            couponCode = null;
        }
        int total = Math.max(0, subtotal + delivery - couponDiscount);
        Order order = new Order();
        order.setId(UUID.randomUUID().toString());
        order.setOrderNumber(orderNumber);
        order.setCustomerName(request.customerName().trim());
        order.setPhone(request.phone().replaceAll("[\\s-]", ""));
        order.setArea(request.area());
        order.setAddress(request.address().trim());
        order.setNote(request.note());
        order.setSubtotal(subtotal);
        order.setPromotionalDiscount(promotionalSavings > 0 ? promotionalSavings : null);
        order.setCouponCode(couponCode);
        order.setCouponDiscount(couponDiscount > 0 ? couponDiscount : null);
        order.setDeliveryCharge(delivery);
        order.setTotal(total);
        order.setPaymentMethod(request.paymentMethod());
        order.setPaymentStatus("COD".equals(request.paymentMethod())
                ? "Pending collection" : "Verification pending");
        order.setTrxId("COD".equals(request.paymentMethod()) ? null
                : request.trxId().trim().toUpperCase());
        order.setSenderNumber("COD".equals(request.paymentMethod()) ? null
                : request.senderNumber().replaceAll("[\\s-]", ""));
        order.setPaymentTrxId(order.getTrxId());
        order.setPaymentSender(order.getSenderNumber());
        order.setStatus("Pending");
        order.setSource(request.source());
        order.setLanguage(request.language() == null ? "en" : request.language());
        order.setNotificationStatus("Pending");
        order.setIdempotencyKey(idempotencyKey);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        for (OrderItem item : validatedItems) item.setOrderId(order.getId());
        order.setItems(validatedItems);

        OrderStatusLog log = new OrderStatusLog();
        log.setId(UUID.randomUUID().toString());
        log.setOrderId(order.getId());
        log.setFromStatus("Pending");
        log.setToStatus("Pending");
        log.setChangedBy("System");
        log.setChangedAt(now);
        log.setNote("Order placed by customer via guest checkout.");
        order.setHistory(List.of(log));

        changedProducts.values().forEach(products::save);
        Order saved = orders.save(order);
        if (couponCode != null) {
            promotions.recordCouponUsage(couponCode, request.phone(), orderNumber, couponDiscount);
            promotions.track(new CampaignAnalyticsRequest(null, null, "coupon_applied",
                    null, couponCode, orderNumber, (double) couponDiscount, "/checkout"));
        }
        promotions.track(new CampaignAnalyticsRequest(null, null, "order_completed",
                null, couponCode, orderNumber, (double) saved.getTotal(), "/checkout"));
        notificationService.notifyOwner(saved);
        return saved;
    }

    public Order track(String orderNumber, String phone, String key) {
        Instant now = Instant.now();
        Deque<Instant> attempts = trackingAttempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (attempts) {
            while (!attempts.isEmpty() &&
                    attempts.peekFirst().isBefore(now.minusSeconds(15 * 60))) attempts.removeFirst();
            if (attempts.size() >= 10) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many lookup attempts. Please wait 15 minutes");
            }
            attempts.addLast(now);
        }
        String cleanPhone = phone.replaceAll("[\\s-]", "");
        return orders.findByOrderNumberIgnoreCase(orderNumber.trim())
                .filter(o -> o.getPhone().replaceAll("[\\s-]", "").equals(cleanPhone))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "No order found matching this order number and phone"));
    }

    public Order verifyPayment(String id, PaymentStatusRequest request) {
        Order order = getById(id);
        if (!"bKash".equals(order.getPaymentMethod()) && !"Nagad".equals(order.getPaymentMethod())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Payment verification is only for bKash or Nagad");
        }
        order.setPaymentStatus(request.status());
        order.setUpdatedAt(Instant.now());
        addHistory(order, order.getStatus(), order.getStatus(), "Admin",
                "Payment status updated to " + request.status(), request.note());
        return orders.save(order);
    }

    public Order updateStatus(String id, OrderStatusRequest request) {
        Order order = getById(id);
        String from = order.getStatus();
        String to = request.status();
        if ("Delivered".equals(from) || "Cancelled".equals(from)) {
            throw new ApiException(HttpStatus.CONFLICT, "A final order status cannot be changed");
        }
        boolean allowed = ("Pending".equals(from) && ("Confirmed".equals(to) || "Cancelled".equals(to)))
                || ("Confirmed".equals(from) && ("Shipped".equals(to) || "Cancelled".equals(to)))
                || ("Shipped".equals(from) && ("Delivered".equals(to) || "Cancelled".equals(to)));
        if (!allowed) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Invalid transition from " + from + " to " + to);
        }
        if ("Confirmed".equals(to) && ("bKash".equals(order.getPaymentMethod())
                || "Nagad".equals(order.getPaymentMethod()))
                && !"Verified".equals(order.getPaymentStatus())) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "bKash/Nagad payment must be Verified before confirmation");
        }
        if ("Delivered".equals(to) && "COD".equals(order.getPaymentMethod())) {
            order.setPaymentStatus("Pending collection");
        }
        if ("Cancelled".equals(to)) {
            String reason = request.reason();
            if (reason == null || reason.isBlank()) reason = request.note();
            if (reason == null || reason.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "A cancellation reason is required");
            }
            order.setCancellationReason(reason.trim());
            restoreStock(order);
        }
        order.setStatus(to);
        order.setUpdatedAt(Instant.now());
        addHistory(order, from, to, "Admin",
                request.note() == null ? "Status changed to " + to : request.note(),
                request.reason());
        return orders.save(order);
    }

    private void restoreStock(Order order) {
        for (OrderItem item : order.getItems()) {
            products.findById(item.getProductId()).ifPresent(product -> {
                if (item.getVariantId() != null) {
                    product.getVariants().stream()
                            .filter(v -> item.getVariantId().equals(v.getId()))
                            .findFirst().ifPresent(v -> v.setStock(v.getStock() + item.getQuantity()));
                    product.setStock(product.getVariants().stream()
                            .mapToInt(v -> Math.max(0, v.getStock())).sum());
                } else {
                    product.setStock(product.getStock() + item.getQuantity());
                }
                products.save(product);
            });
        }
    }

    private void addHistory(Order order, String from, String to, String changedBy,
                            String note, String reason) {
        if (order.getHistory() == null) order.setHistory(new ArrayList<>());
        OrderStatusLog entry = new OrderStatusLog();
        entry.setId(UUID.randomUUID().toString());
        entry.setOrderId(order.getId());
        entry.setFromStatus(from);
        entry.setToStatus(to);
        entry.setChangedBy(changedBy);
        entry.setChangedAt(Instant.now());
        entry.setNote(note != null ? note : reason);
        order.getHistory().add(entry);
    }

    public Map<String, Object> dashboard() {
        List<Order> all = orders.findAll();
        List<Product> productList = products.findAll();
        Map<String, Object> result = new HashMap<>();
        result.put("totalOrders", all.size());
        result.put("pendingOrders", all.stream().filter(o -> "Pending".equals(o.getStatus())).count());
        result.put("deliveredOrders", all.stream().filter(o -> "Delivered".equals(o.getStatus())).count());
        result.put("totalProducts", productList.stream().filter(p -> !"Deleted".equals(p.getStatus())).count());
        int lowStockThreshold = settings.findById("store")
                .map(StoreSettings::getLowStockThreshold)
                .orElseGet(() -> new StoreSettings().getLowStockThreshold());
        result.put("lowStockProducts", productList.stream()
                .filter(p -> !"Deleted".equals(p.getStatus())
                        && p.getStock() <= lowStockThreshold).count());
        result.put("notificationFailed", all.stream()
                .filter(o -> "Failed".equals(o.getNotificationStatus())).count());
        result.put("totalRevenue", all.stream()
                .filter(o -> !"Cancelled".equals(o.getStatus()))
                .mapToInt(Order::getTotal).sum());
        return result;
    }
}
