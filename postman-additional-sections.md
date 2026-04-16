# Celora Backend API - Additional Test Sections

## Batch 6: Payment and Order Management

```json
{
  "name": "💳 Payment & Orders",
  "description": "Payment processing, order management, and order status updates",
  "item": [
    {
      "name": "Create Payment Intent",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 200) {",
              "    const response = pm.response.json();",
              "    pm.test('Payment intent created successfully', function () {",
              "        pm.expect(response.clientSecret).to.exist;",
              "        pm.expect(response.clientSecret).to.include('pi_');",
              "    });",
              "}",
              "",
              "// Test amount validation",
              "if (pm.response.code === 400) {",
              "    pm.test('Amount validation working', function () {",
              "        const response = pm.response.json();",
              "        pm.expect(response.error).to.exist;",
              "    });",
              "}"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"amount\": 250000,\n  \"currency\": \"usd\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/payments/create-payment-intent",
          "host": ["{{api_base}}"],
          "path": ["payments", "create-payment-intent"]
        }
      }
    },
    {
      "name": "Complete Order",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 201) {",
              "    const response = pm.response.json();",
              "    pm.test('Order completed successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.order).to.have.property('orderId');",
              "        pm.expect(response.order).to.have.property('status');",
              "    });",
              "    ",
              "    if (response.order && response.order.orderId) {",
              "        pm.collectionVariables.set('test_order_id', response.order.orderId);",
              "    }",
              "}"
            ]
          }
        }
      ],
      "request": {
        "auth": {
          "type": "bearer",
          "bearer": [
            {
              "key": "token",
              "value": "{{user_token}}",
              "type": "string"
            }
          ]
        },
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"customer\": \"{{test_user_id}}\",\n  \"products\": [\n    {\n      \"productId\": \"{{test_product_id}}\",\n      \"quantity\": 1,\n      \"price\": 2500.00,\n      \"selectedVariant\": \"18K Yellow Gold\"\n    }\n  ],\n  \"paymentMethod\": \"stripe\",\n  \"paymentIntentId\": \"pi_test_123456\",\n  \"totalAmount\": 2575.00,\n  \"shippingAddress\": {\n    \"line1\": \"123 Test Street\",\n    \"city\": \"Test City\",\n    \"state\": \"CA\",\n    \"postal_code\": \"90210\",\n    \"country\": \"US\"\n  },\n  \"billingAddress\": {\n    \"line1\": \"123 Test Street\",\n    \"city\": \"Test City\",\n    \"state\": \"CA\",\n    \"postal_code\": \"90210\",\n    \"country\": \"US\"\n  },\n  \"status\": \"Pending\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/orders/complete-order",
          "host": ["{{api_base}}"],
          "path": ["orders", "complete-order"]
        }
      }
    },
    {
      "name": "Update Order Status",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 200) {",
              "    const response = pm.response.json();",
              "    pm.test('Order status updated successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.order.status).to.equal('Confirmed');",
              "    });",
              "}"
            ]
          }
        }
      ],
      "request": {
        "auth": {
          "type": "bearer",
          "bearer": [
            {
              "key": "token",
              "value": "{{admin_token}}",
              "type": "string"
            }
          ]
        },
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"status\": \"Confirmed\",\n  \"statusMessage\": \"Your order has been confirmed and is being processed\",\n  \"images\": [\n    {\n      \"filename\": \"confirmation-image.jpg\",\n      \"description\": \"Order confirmation image\"\n    }\n  ]\n}"
        },
        "url": {
          "raw": "{{api_base}}/orders/{{test_order_id}}/status",
          "host": ["{{api_base}}"],
          "path": ["orders", "{{test_order_id}}", "status"]
        }
      }
    }
  ]
}
```

## Batch 7: Diamond Management

```json
{
  "name": "💎 Diamond Management",
  "description": "Diamond inventory, shapes, and pricing management",
  "item": [
    {
      "name": "Create Diamond",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 201) {",
              "    const response = pm.response.json();",
              "    pm.test('Diamond created successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.data).to.have.property('diamondId');",
              "        pm.expect(response.data).to.have.property('stock_id');",
              "    });",
              "    ",
              "    if (response.data && response.data._id) {",
              "        pm.collectionVariables.set('test_diamond_id', response.data._id);",
              "    }",
              "}",
              "",
              "// Test required fields validation",
              "if (pm.response.code === 400) {",
              "    pm.test('Required fields validation working', function () {",
              "        const response = pm.response.json();",
              "        pm.expect(response.success).to.be.false;",
              "    });",
              "}"
            ]
          }
        }
      ],
      "request": {
        "auth": {
          "type": "bearer",
          "bearer": [
            {
              "key": "token",
              "value": "{{admin_token}}",
              "type": "string"
            }
          ]
        },
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"diamondId\": \"DIA001\",\n  \"stock_id\": \"STK001\",\n  \"ReportNo\": \"GIA123456\",\n  \"shape\": \"Round\",\n  \"carats\": 1.25,\n  \"col\": \"G\",\n  \"clar\": \"VS1\",\n  \"cut\": \"Excellent\",\n  \"pol\": \"Excellent\",\n  \"symm\": \"Excellent\",\n  \"flo\": \"None\",\n  \"length\": 6.85,\n  \"width\": 6.87,\n  \"height\": 4.25,\n  \"depth\": 62.0,\n  \"table\": 57.0,\n  \"lab\": \"GIA\",\n  \"eyeClean\": \"Yes\",\n  \"brown\": \"No\",\n  \"green\": \"No\",\n  \"milky\": \"No\",\n  \"price\": 8500.00,\n  \"price_per_carat\": 6800.00,\n  \"is_returnable\": \"Y\",\n  \"ReturnDays\": 30\n}"
        },
        "url": {
          "raw": "{{api_base}}/diamond",
          "host": ["{{api_base}}"],
          "path": ["diamond"]
        }
      }
    },
    {
      "name": "Search Diamonds",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Diamond search results returned', function () {",
              "    pm.response.to.have.status(200);",
              "    const response = pm.response.json();",
              "    pm.expect(response.success).to.be.true;",
              "    pm.expect(response.data).to.be.an('array');",
              "});",
              "",
              "// Test search filters",
              "pm.test('Search filters applied correctly', function () {",
              "    const response = pm.response.json();",
              "    if (response.data && response.data.length > 0) {",
              "        response.data.forEach(diamond => {",
              "            pm.expect(diamond.shape).to.equal('Round');",
              "            pm.expect(diamond.carats).to.be.within(1.0, 2.0);",
              "        });",
              "    }",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"shape\": \"Round\",\n  \"carats\": { \"min\": 1.0, \"max\": 2.0 },\n  \"col\": [\"G\", \"H\", \"I\"],\n  \"clar\": [\"VS1\", \"VS2\", \"SI1\"],\n  \"cut\": [\"Excellent\", \"Very Good\"],\n  \"priceRange\": { \"min\": 5000, \"max\": 15000 }\n}"
        },
        "url": {
          "raw": "{{api_base}}/diamond/search",
          "host": ["{{api_base}}"],
          "path": ["diamond", "search"]
        }
      }
    }
  ]
}
```

## Batch 8: Admin Functions and Content Management

```json
{
  "name": "⚙️ Admin & Content Management",
  "description": "Administrative functions, content management, and system configuration",
  "item": [
    {
      "name": "Create Blog Post",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 201) {",
              "    const response = pm.response.json();",
              "    pm.test('Blog post created successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.data).to.have.property('blogId');",
              "        pm.expect(response.data.title).to.equal('Test Blog Post');",
              "    });",
              "}"
            ]
          }
        }
      ],
      "request": {
        "auth": {
          "type": "bearer",
          "bearer": [
            {
              "key": "token",
              "value": "{{admin_token}}",
              "type": "string"
            }
          ]
        },
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"blogId\": \"BLOG001\",\n  \"title\": \"Test Blog Post\",\n  \"subtitle\": \"A comprehensive guide to diamonds\",\n  \"slug\": \"test-blog-post\",\n  \"category\": \"Joy\",\n  \"author\": \"Admin User\",\n  \"content\": \"This is a test blog post about diamonds and jewelry.\",\n  \"tags\": [\"diamonds\", \"jewelry\", \"guide\"],\n  \"metaTitle\": \"Test Blog Post - Celora Jewelry\",\n  \"metaDescription\": \"Learn about diamonds and jewelry in this comprehensive guide\",\n  \"isActive\": true\n}"
        },
        "url": {
          "raw": "{{api_base}}/blog",
          "host": ["{{api_base}}"],
          "path": ["blog"]
        }
      }
    },
    {
      "name": "Create Coupon",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 201) {",
              "    const response = pm.response.json();",
              "    pm.test('Coupon created successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.data).to.have.property('couponCode');",
              "        pm.expect(response.data.couponCode).to.equal('{{test_coupon_code}}');",
              "    });",
              "}"
            ]
          }
        }
      ],
      "request": {
        "auth": {
          "type": "bearer",
          "bearer": [
            {
              "key": "token",
              "value": "{{admin_token}}",
              "type": "string"
            }
          ]
        },
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"couponId\": \"CPN001\",\n  \"couponName\": \"Test Discount\",\n  \"couponCode\": \"{{test_coupon_code}}\",\n  \"minimumAmount\": 100,\n  \"dateRange\": {\n    \"start\": \"2025-01-01T00:00:00.000Z\",\n    \"end\": \"2025-12-31T23:59:59.999Z\"\n  },\n  \"discountType\": \"Percentage\",\n  \"discountValue\": 10,\n  \"categoryWise\": false,\n  \"productWise\": false,\n  \"isActive\": true\n}"
        },
        "url": {
          "raw": "{{api_base}}/coupon",
          "host": ["{{api_base}}"],
          "path": ["coupon"]
        }
      }
    }
  ]
}
```
