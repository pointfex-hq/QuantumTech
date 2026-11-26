package com.quantumtech.backend.controller;

import com.quantumtech.backend.dto.CreateOrderRequest;
import com.quantumtech.backend.dto.OrderStatusRequest;
import com.quantumtech.backend.dto.PaymentStatusRequest;
import com.quantumtech.backend.model.Order;
import com.quantumtech.backend.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrderController {
    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public Order create(@Valid @RequestBody CreateOrderRequest request,
                        @RequestHeader(value = "X-Idempotency-Key", required = false) String key) {
        return orders.create(request, key);
    }

    @GetMapping("/orders/track")
    public Order track(@RequestParam String orderNumber,
                       @RequestParam String phone,
                       HttpServletRequest request) {
        String key = request.getRemoteAddr();
        return orders.track(orderNumber, phone, key);
    }

    @GetMapping("/admin/orders")
    public List<Order> list(@RequestParam(required = false) String status,
                            @RequestParam(required = false) String paymentMethod,
                            @RequestParam(required = false) String search) {
        return orders.list(status, paymentMethod, search);
    }

    @GetMapping("/admin/orders/{id}")
    public Order get(@PathVariable String id) {
        return orders.getById(id);
    }

    @PatchMapping("/admin/orders/{id}/status")
    public Order updateStatus(@PathVariable String id,
                              @Valid @RequestBody OrderStatusRequest request) {
        return orders.updateStatus(id, request);
    }

    @PatchMapping("/admin/orders/{id}/payment")
    public Order verifyPayment(@PathVariable String id,
                               @Valid @RequestBody PaymentStatusRequest request) {
        return orders.verifyPayment(id, request);
    }

    @GetMapping("/admin/dashboard")
    public Map<String, Object> dashboard() {
        return orders.dashboard();
    }
}
