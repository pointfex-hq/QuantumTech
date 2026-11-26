package com.quantumtech.backend.service;

import com.quantumtech.backend.dto.OrderStatusRequest;
import com.quantumtech.backend.dto.PaymentStatusRequest;
import com.quantumtech.backend.dto.CreateOrderRequest;
import com.quantumtech.backend.exception.ApiException;
import com.quantumtech.backend.model.Order;
import com.quantumtech.backend.model.OrderItem;
import com.quantumtech.backend.model.Product;
import com.quantumtech.backend.model.ProductVariant;
import com.quantumtech.backend.repository.OrderRepository;
import com.quantumtech.backend.repository.ProductRepository;
import com.quantumtech.backend.repository.SettingsRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrderServiceTest {
    @Test
    void blocksMobileMoneyConfirmationBeforePaymentVerification() {
        OrderRepository orders = mock(OrderRepository.class);
        Order order = new Order();
        order.setId("order-1");
        order.setStatus("Pending");
        order.setPaymentMethod("bKash");
        order.setPaymentStatus("Verification pending");
        when(orders.findById("order-1")).thenReturn(Optional.of(order));
        when(orders.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OrderService service = new OrderService(orders, mock(ProductRepository.class),
                mock(SettingsRepository.class), mock(NotificationService.class),
                mock(PromotionService.class));

        assertThrows(ApiException.class,
                () -> service.updateStatus("order-1",
                        new OrderStatusRequest("Confirmed", null, null)));
    }

    @Test
    void allowsConfirmedToShippedAndLogsHistory() {
        OrderRepository orders = mock(OrderRepository.class);
        Order order = new Order();
        order.setId("order-1");
        order.setStatus("Confirmed");
        order.setPaymentMethod("COD");
        order.setPaymentStatus("Pending collection");
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        when(orders.findById("order-1")).thenReturn(Optional.of(order));
        when(orders.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OrderService service = new OrderService(orders, mock(ProductRepository.class),
                mock(SettingsRepository.class), mock(NotificationService.class),
                mock(PromotionService.class));
        Order updated = service.updateStatus("order-1",
                new OrderStatusRequest("Shipped", "Courier handover", null));

        assertEquals("Shipped", updated.getStatus());
        assertEquals(1, updated.getHistory().size());
    }

    @Test
    void rejectsCancellationWithoutReason() {
        OrderRepository orders = mock(OrderRepository.class);
        Order order = new Order();
        order.setId("order-1");
        order.setStatus("Pending");
        order.setPaymentMethod("COD");
        when(orders.findById("order-1")).thenReturn(Optional.of(order));

        OrderService service = new OrderService(orders, mock(ProductRepository.class),
                mock(SettingsRepository.class), mock(NotificationService.class),
                mock(PromotionService.class));

        assertThrows(ApiException.class,
                () -> service.updateStatus("order-1",
                        new OrderStatusRequest("Cancelled", null, null)));
    }

    @Test
    void marksMobilePaymentVerified() {
        OrderRepository orders = mock(OrderRepository.class);
        Order order = new Order();
        order.setId("order-1");
        order.setStatus("Pending");
        order.setPaymentMethod("Nagad");
        order.setPaymentStatus("Verification pending");
        when(orders.findById("order-1")).thenReturn(Optional.of(order));
        when(orders.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OrderService service = new OrderService(orders, mock(ProductRepository.class),
                mock(SettingsRepository.class), mock(NotificationService.class),
                mock(PromotionService.class));
        Order updated = service.verifyPayment("order-1",
                new PaymentStatusRequest("Verified", "Statement matched"));

        assertEquals("Verified", updated.getPaymentStatus());
    }

    @Test
    void ignoresClientSuppliedCouponDiscountAndRecalculatesOrderTotal() {
        OrderRepository orders = mock(OrderRepository.class);
        ProductRepository products = mock(ProductRepository.class);
        Product product = new Product();
        product.setId("product-1");
        product.setName("Charger");
        product.setPrice(100);
        product.setStock(5);
        product.setImages(List.of("charger.jpg"));
        when(products.findById("product-1")).thenReturn(Optional.of(product));
        when(orders.count()).thenReturn(0L);
        when(orders.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        PromotionService promotions = mock(PromotionService.class);
        when(promotions.calculateProductPrice(product, null))
                .thenReturn(new PromotionService.PriceResult(100, 100, 0,
                        null, null, null, null));
        OrderService service = new OrderService(orders, products,
                mock(SettingsRepository.class), mock(NotificationService.class), promotions);
        OrderItem item = new OrderItem();
        item.setProductId("product-1");
        item.setQuantity(1);

        Order result = service.create(new CreateOrderRequest("Customer", "01712345678",
                "Inside Dhaka", "Dhaka", null, 1, 1, 1, "COD", null, null,
                null, 99, null, "en", List.of(item)), null);

        assertEquals(170, result.getTotal());
        assertNull(result.getCouponCode());
        assertEquals(4, product.getStock());
        verify(promotions, never()).recordCouponUsage(any(), any(), any(), anyDouble());
    }

    @Test
    void doesNotPersistStockWhenCouponValidationFails() {
        OrderRepository orders = mock(OrderRepository.class);
        ProductRepository products = mock(ProductRepository.class);
        Product product = new Product();
        product.setId("product-1");
        product.setName("Charger");
        product.setPrice(100);
        product.setStock(5);
        when(products.findById("product-1")).thenReturn(Optional.of(product));
        when(orders.count()).thenReturn(0L);
        PromotionService promotions = mock(PromotionService.class);
        when(promotions.calculateProductPrice(product, null))
                .thenReturn(new PromotionService.PriceResult(100, 100, 0,
                        null, null, null, null));
        when(promotions.validateCoupon(any())).thenReturn(
                new PromotionService.CouponValidationResult(false, 0, "Invalid coupon", null));
        OrderService service = new OrderService(orders, products,
                mock(SettingsRepository.class), mock(NotificationService.class), promotions);
        OrderItem item = new OrderItem();
        item.setProductId("product-1");
        item.setQuantity(1);

        assertThrows(ApiException.class, () -> service.create(new CreateOrderRequest(
                "Customer", "01712345678", "Inside Dhaka", "Dhaka", null,
                100, 70, 170, "COD", null, null, "INVALID", 0,
                null, "en", List.of(item)), null));

        verify(products, never()).save(any());
        verify(orders, never()).save(any());
    }

    @Test
    void requiresVariantSelectionForVariantProduct() {
        OrderRepository orders = mock(OrderRepository.class);
        ProductRepository products = mock(ProductRepository.class);
        Product product = new Product();
        product.setId("product-1");
        product.setName("Color charger");
        product.setPrice(100);
        ProductVariant variant = new ProductVariant();
        variant.setId("variant-1");
        variant.setStock(2);
        product.setVariants(List.of(variant));
        when(products.findById("product-1")).thenReturn(Optional.of(product));
        when(orders.count()).thenReturn(0L);
        OrderService service = new OrderService(orders, products,
                mock(SettingsRepository.class), mock(NotificationService.class),
                mock(PromotionService.class));
        OrderItem item = new OrderItem();
        item.setProductId("product-1");
        item.setQuantity(1);

        assertThrows(ApiException.class, () -> service.create(new CreateOrderRequest(
                "Customer", "01712345678", "Inside Dhaka", "Dhaka", null,
                100, 70, 170, "COD", null, null, null, null,
                null, "en", List.of(item)), null));

        verify(products, never()).save(any());
        verify(orders, never()).save(any());
    }
}
