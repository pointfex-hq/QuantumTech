package com.quantumtech.backend.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Document("products")
public class Product {
    @Id private String id;
    private String name;
    private String nameBn;
    private String slug;
    private String categoryId;
    private String categoryName;
    private String categoryNameBn;
    private String description;
    private String descriptionBn;
    private int price;
    private Integer oldPrice;
    private int stock;
    private List<String> images = new ArrayList<>();
    private List<ProductVariant> variants = new ArrayList<>();
    private Map<String, String> specifications = new HashMap<>();
    private Map<String, String> specificationsBn = new HashMap<>();
    private double rating;
    private int reviewsCount;

    // Storefront JSON uses isFeatured / isNew. Lombok's boolean accessors would
    // otherwise publish these as "featured" and "new".
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private boolean featured;

    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private boolean isNew;

    private String status = "Active";
    private List<String> tags = new ArrayList<>();

    @JsonProperty("isFeatured")
    public boolean isFeatured() {
        return featured;
    }

    @JsonProperty("isFeatured")
    @JsonAlias("featured")
    public void setFeatured(boolean featured) {
        this.featured = featured;
    }

    @JsonProperty("isNew")
    public boolean getIsNew() {
        return isNew;
    }

    @JsonProperty("isNew")
    public void setIsNew(boolean isNew) {
        this.isNew = isNew;
    }
}
