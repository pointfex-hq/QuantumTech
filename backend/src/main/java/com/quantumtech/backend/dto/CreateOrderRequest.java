package com.quantumtech.backend.dto;

import com.quantumtech.backend.model.OrderItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record CreateOrderRequest(
        @NotBlank String customerName,
        @NotBlank
        @Pattern(regexp = "01[3-9][0-9]{8}", message = "Phone must be 11 digits and start with 01[3-9]")
        String phone,
        @Pattern(regexp = "Inside Dhaka|Outside Dhaka", message = "Area must be Inside Dhaka or Outside Dhaka")
        String area,
        @NotBlank String address,
        String note,
        Integer subtotal,
        Integer deliveryCharge,
        Integer total,
        @NotBlank String paymentMethod,
        String trxId,
        String senderNumber,
        String couponCode,
        Integer couponDiscount,
        String source,
        String language,
        @NotEmpty List<OrderItem> items
) {}
