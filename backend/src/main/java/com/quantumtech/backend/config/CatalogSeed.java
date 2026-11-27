package com.quantumtech.backend.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quantumtech.backend.model.Category;
import com.quantumtech.backend.model.Product;
import com.quantumtech.backend.model.StoreSettings;
import com.quantumtech.backend.repository.CategoryRepository;
import com.quantumtech.backend.repository.ProductRepository;
import com.quantumtech.backend.repository.SettingsRepository;
import com.quantumtech.backend.service.ProductService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Loads the storefront catalog into MongoDB the first time the database is empty.
 */
@Component
@Order(20)
public class CatalogSeed implements CommandLineRunner {
    private final ProductRepository products;
    private final CategoryRepository categories;
    private final SettingsRepository settings;
    private final ProductService productService;
    private final ObjectMapper mapper;

    public CatalogSeed(ProductRepository products, CategoryRepository categories,
                       SettingsRepository settings, ProductService productService,
                       ObjectMapper mapper) {
        this.products = products;
        this.categories = categories;
        this.settings = settings;
        this.productService = productService;
        this.mapper = mapper;
    }

    @Override
    public void run(String... args) throws Exception {
        if (products.count() > 0) return;
        try (var in = getClass().getResourceAsStream("/seed/catalog.json")) {
            if (in == null) return;
            JsonNode root = mapper.readTree(in);
            if (categories.count() == 0 && root.has("categories")) {
                for (JsonNode node : root.get("categories")) {
                    categories.save(mapper.treeToValue(node, Category.class));
                }
            }
            for (JsonNode node : root.get("products")) {
                productService.save(mapper.treeToValue(node, Product.class));
            }
            if (settings.count() == 0 && root.has("settings")) {
                StoreSettings store = mapper.treeToValue(root.get("settings"), StoreSettings.class);
                store.setId("store");
                settings.save(store);
            }
        }
    }
}
