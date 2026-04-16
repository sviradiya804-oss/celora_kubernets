# Security Testing and Email System - Complete Test Coverage

## Batch 9: Email Testing System

```json
{
  "name": "📧 Email Testing System",
  "description": "Comprehensive email testing including all order status emails and templates",
  "item": [
    {
      "name": "Test Unified Email Template",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 200) {",
              "    const response = pm.response.json();",
              "    pm.test('Unified email sent successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.message).to.include('Test email sent successfully');",
              "        pm.expect(response.data.messageId).to.exist;",
              "    });",
              "}",
              "",
              "// Test email validation",
              "if (pm.response.code === 400) {",
              "    pm.test('Email validation working', function () {",
              "        const response = pm.response.json();",
              "        pm.expect(response.success).to.be.false;",
              "        pm.expect(response.message).to.include('Email address is required');",
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
          "raw": "{\n  \"email\": \"test@celora.com\",\n  \"customerName\": \"Test Customer\",\n  \"orderId\": \"{{test_order_id}}\",\n  \"status\": \"Confirmed\",\n  \"includeImages\": true,\n  \"includeProducts\": true,\n  \"includeTracking\": false\n}"
        },
        "url": {
          "raw": "{{api_base}}/test-email/unified",
          "host": ["{{api_base}}"],
          "path": ["test-email", "unified"]
        }
      }
    },
    {
      "name": "Test All Order Status Emails",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 200) {",
              "    const response = pm.response.json();",
              "    pm.test('All status emails sent successfully', function () {",
              "        pm.expect(response.success).to.be.true;",
              "        pm.expect(response.results).to.be.an('array');",
              "        pm.expect(response.results.length).to.equal(5);",
              "    });",
              "    ",
              "    // Test each email status",
              "    pm.test('All email statuses sent', function () {",
              "        const statuses = response.results.map(r => r.status);",
              "        pm.expect(statuses).to.include.members([",
              "            'Confirmed', 'Manufacturing', 'Quality Assurance', ",
              "            'Out for Delivery', 'Delivered'",
              "        ]);",
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
          "raw": "{\n  \"email\": \"test@celora.com\",\n  \"customerName\": \"Test Customer\",\n  \"orderId\": \"{{test_order_id}}\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/test-email/all-statuses",
          "host": ["{{api_base}}"],
          "path": ["test-email", "all-statuses"]
        }
      }
    }
  ]
}
```

## Batch 10: Advanced Security Testing

```json
{
  "name": "🔒 Advanced Security Testing",
  "description": "Comprehensive security testing including XSS, CSRF, injection attacks, and authorization bypass",
  "item": [
    {
      "name": "XSS Test - Product Creation",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "// Security Test: XSS Prevention in Product Fields",
              "pm.test('XSS payload should be sanitized or rejected', function () {",
              "    if (pm.response.code === 400 || pm.response.code === 422) {",
              "        // Request rejected - good security",
              "        const response = pm.response.json();",
              "        pm.expect(response.success).to.be.false;",
              "    } else if (pm.response.code === 201) {",
              "        // Request accepted - check sanitization",
              "        const response = pm.response.json();",
              "        pm.expect(response.data.title).to.not.include('<script>');",
              "        pm.expect(response.data.description).to.not.include('alert(');",
              "    }",
              "});",
              "",
              "pm.test('Response contains no executable scripts', function () {",
              "    pm.expect(pm.response.text()).to.not.include('<script>alert');",
              "    pm.expect(pm.response.text()).to.not.include('javascript:');",
              "});"
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
          "raw": "{\n  \"jewelryId\": \"XSS001\",\n  \"title\": \"<script>alert('XSS')</script>Malicious Product\",\n  \"description\": \"<img src=x onerror=alert('XSS')>Product description\",\n  \"slug\": \"javascript:alert('XSS')\",\n  \"jewelryType\": \"<iframe src=javascript:alert('XSS')></iframe>\",\n  \"status\": \"active\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/jewelry",
          "host": ["{{api_base}}"],
          "path": ["jewelry"]
        }
      }
    },
    {
      "name": "NoSQL Injection Test",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "// Security Test: NoSQL Injection Prevention",
              "pm.test('NoSQL injection should be prevented', function () {",
              "    // Should not return success with injection payload",
              "    pm.expect(pm.response.code).to.not.equal(200);",
              "    ",
              "    if (pm.response.code === 400 || pm.response.code === 401) {",
              "        const response = pm.response.json();",
              "        pm.expect(response.success).to.be.false;",
              "    }",
              "});",
              "",
              "pm.test('No database errors exposed', function () {",
              "    const responseText = pm.response.text().toLowerCase();",
              "    pm.expect(responseText).to.not.include('mongodb');",
              "    pm.expect(responseText).to.not.include('$where');",
              "    pm.expect(responseText).to.not.include('$ne');",
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
          "raw": "{\n  \"email\": { \"$ne\": null },\n  \"password\": { \"$regex\": \".*\" }\n}"
        },
        "url": {
          "raw": "{{api_base}}/v1/auth/login",
          "host": ["{{api_base}}"],
          "path": ["v1", "auth", "login"]
        }
      }
    },
    {
      "name": "Authorization Bypass Test",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "// Security Test: Authorization Check",
              "pm.test('Unauthorized access should be blocked', function () {",
              "    pm.expect(pm.response.code).to.equal(401);",
              "    const response = pm.response.json();",
              "    pm.expect(response.success).to.be.false;",
              "    pm.expect(response.message).to.include('unauthorized');",
              "});",
              "",
              "pm.test('No sensitive data leaked in unauthorized response', function () {",
              "    const responseText = pm.response.text().toLowerCase();",
              "    pm.expect(responseText).to.not.include('password');",
              "    pm.expect(responseText).to.not.include('token');",
              "    pm.expect(responseText).to.not.include('secret');",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{api_base}}/orders",
          "host": ["{{api_base}}"],
          "path": ["orders"]
        }
      }
    },
    {
      "name": "Rate Limiting Test",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "// Security Test: Rate Limiting",
              "if (pm.response.code === 429) {",
              "    pm.test('Rate limiting is working', function () {",
              "        pm.expect(pm.response.headers.get('Retry-After')).to.exist;",
              "        pm.expect(pm.response.headers.get('X-RateLimit-Limit')).to.exist;",
              "    });",
              "} else {",
              "    pm.test('Request within rate limit', function () {",
              "        pm.expect(pm.response.code).to.be.below(429);",
              "    });",
              "}",
              "",
              "pm.test('Rate limit headers present', function () {",
              "    pm.expect(pm.response.headers.get('X-RateLimit-Remaining')).to.exist;",
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
          "raw": "{\n  \"email\": \"test@celora.com\",\n  \"password\": \"wrongpassword\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/v1/auth/login",
          "host": ["{{api_base}}"],
          "path": ["v1", "auth", "login"]
        }
      }
    }
  ]
}
```

## Batch 11: Multi-User Role Testing

```json
{
  "name": "👥 Multi-User Role Testing",
  "description": "Testing different user roles, permissions, and access control scenarios",
  "item": [
    {
      "name": "Admin Access Test - Create Product",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Admin can create products', function () {",
              "    pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
              "    const response = pm.response.json();",
              "    pm.expect(response.success).to.be.true;",
              "});"
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
          "raw": "{\n  \"jewelryId\": \"ADMIN001\",\n  \"title\": \"Admin Created Product\",\n  \"description\": \"Product created by admin user\",\n  \"status\": \"active\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/jewelry",
          "host": ["{{api_base}}"],
          "path": ["jewelry"]
        }
      }
    },
    {
      "name": "Regular User Access Test - Create Product",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Regular user cannot create products', function () {",
              "    pm.expect(pm.response.code).to.be.oneOf([401, 403]);",
              "    const response = pm.response.json();",
              "    pm.expect(response.success).to.be.false;",
              "});"
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
          "raw": "{\n  \"jewelryId\": \"USER001\",\n  \"title\": \"User Attempted Product\",\n  \"description\": \"Product creation attempt by regular user\",\n  \"status\": \"active\"\n}"
        },
        "url": {
          "raw": "{{api_base}}/jewelry",
          "host": ["{{api_base}}"],
          "path": ["jewelry"]
        }
      }
    },
    {
      "name": "Cross-User Data Access Test",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('User cannot access other user data', function () {",
              "    if (pm.response.code === 200) {",
              "        const response = pm.response.json();",
              "        // Should not return other user's orders",
              "        pm.expect(response.orders).to.be.an('array');",
              "        if (response.orders.length > 0) {",
              "            response.orders.forEach(order => {",
              "                pm.expect(order.customer).to.equal('{{test_user_id}}');",
              "            });",
              "        }",
              "    } else {",
              "        pm.expect(pm.response.code).to.be.oneOf([401, 403]);",
              "    }",
              "});"
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
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{api_base}}/orders/user/{{admin_user_id}}",
          "host": ["{{api_base}}"],
          "path": ["orders", "user", "{{admin_user_id}}"]
        }
      }
    }
  ]
}
```
