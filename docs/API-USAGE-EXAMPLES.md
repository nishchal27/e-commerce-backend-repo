# 📚 API Usage Examples

> **Complete API usage examples for the E-Commerce Backend**  
> Practical examples for all major endpoints

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Products](#products)
3. [Orders](#orders)
4. [Payments](#payments)
5. [Cart](#cart)
6. [Inventory](#inventory)
7. [Search](#search)
8. [Recommendations](#recommendations)
9. [Reviews](#reviews)
10. [Admin](#admin)
11. [Shipping](#shipping)

---

## Authentication

### Register User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "CUSTOMER"
    }
  }
}
```

### Get Current User

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Refresh Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

---

## Products

### List Products

```bash
curl -X GET "http://localhost:3000/products?page=1&limit=20"
```

**Response:**
```json
{
  "data": [
    {
      "id": "product-uuid",
      "slug": "product-slug",
      "title": "Product Name",
      "description": "Product description",
      "variants": [
        {
          "id": "variant-uuid",
          "sku": "SKU-001",
          "price": "29.99",
          "stock": 100
        }
      ]
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### Get Product by ID

```bash
curl -X GET http://localhost:3000/products/product-uuid
```

### Create Product (Admin)

```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "new-product",
    "title": "New Product",
    "description": "Product description",
    "variants": [
      {
        "sku": "SKU-001",
        "price": 29.99,
        "stock": 100,
        "attributes": {
          "size": "M",
          "color": "Blue"
        }
      }
    ]
  }'
```

---

## Orders

### Create Order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "items": [
      {
        "sku": "SKU-001",
        "quantity": 2
      }
    ],
    "idempotencyKey": "unique-key-123"
  }'
```

**Response:**
```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "totalAmount": "59.98",
  "status": "CREATED",
  "createdAt": "2025-11-17T10:00:00Z"
}
```

### Get User Orders

```bash
curl -X GET http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Order by ID

```bash
curl -X GET http://localhost:3000/orders/order-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Payments

### Create Payment Intent

```bash
curl -X POST http://localhost:3000/payments/intent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "amount": 59.98,
    "currency": "USD"
  }'
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### Confirm Payment

```bash
curl -X POST http://localhost:3000/payments/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_xxx",
    "orderId": "order-uuid"
  }'
```

### Get Payment Status

```bash
curl -X GET http://localhost:3000/payments/payment-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Cart

### Add Item to Cart

```bash
curl -X POST http://localhost:3000/cart/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-001",
    "quantity": 2
  }'
```

### Get Cart

```bash
curl -X GET http://localhost:3000/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "items": [
    {
      "sku": "SKU-001",
      "quantity": 2,
      "unitPrice": 29.99,
      "totalPrice": 59.98
    }
  ],
  "total": 59.98
}
```

### Update Cart Item

```bash
curl -X PATCH http://localhost:3000/cart/items/SKU-001 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3
  }'
```

### Remove Item from Cart

```bash
curl -X DELETE http://localhost:3000/cart/items/SKU-001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Clear Cart

```bash
curl -X DELETE http://localhost:3000/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Inventory

### Reserve Inventory

```bash
curl -X POST http://localhost:3000/inventory/reserve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "sku": "SKU-001",
        "quantity": 2
      }
    ],
    "reservedBy": "order-uuid",
    "expiresIn": 3600
  }'
```

### Release Reservation

```bash
curl -X POST http://localhost:3000/inventory/release \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationIds": ["reservation-uuid"]
  }'
```

### Get Inventory Status

```bash
curl -X GET http://localhost:3000/inventory/SKU-001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Search

### Search Products

```bash
curl -X GET "http://localhost:3000/search?q=laptop&page=1&limit=20"
```

**Response:**
```json
{
  "data": [
    {
      "id": "product-uuid",
      "title": "Laptop Computer",
      "description": "...",
      "variants": [...]
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

### Search with Filters

```bash
curl -X GET "http://localhost:3000/search?q=laptop&minPrice=500&maxPrice=1000&page=1"
```

---

## Recommendations

### Get Product Recommendations

```bash
curl -X GET "http://localhost:3000/recommendations/product/product-uuid?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "recommendations": [
    {
      "productId": "product-uuid-2",
      "score": 0.85,
      "strategy": "co-occurrence"
    }
  ],
  "strategy": "co-occurrence"
}
```

### Track Recommendation Click

```bash
curl -X POST http://localhost:3000/recommendations/track \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendedProductId": "product-uuid",
    "sourceProductId": "source-uuid",
    "strategy": "co-occurrence"
  }'
```

---

## Reviews

### Create Review

```bash
curl -X POST http://localhost:3000/reviews \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-uuid",
    "rating": 5,
    "comment": "Great product!"
  }'
```

### Get Product Reviews

```bash
curl -X GET "http://localhost:3000/reviews/product/product-uuid?page=1&limit=20"
```

### Get Product Rating Stats

```bash
curl -X GET http://localhost:3000/reviews/product/product-uuid/stats
```

**Response:**
```json
{
  "averageRating": 4.5,
  "totalReviews": 100,
  "distribution": {
    "1": 5,
    "2": 10,
    "3": 15,
    "4": 30,
    "5": 40
  }
}
```

---

## Admin

### Get System Statistics

```bash
curl -X GET http://localhost:3000/admin/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "users": {
    "total": 1000,
    "active": 800,
    "byRole": {
      "CUSTOMER": 950,
      "ADMIN": 5,
      "MANAGER": 45
    }
  },
  "orders": {
    "total": 5000,
    "byStatus": {
      "CREATED": 100,
      "PAID": 4500,
      "SHIPPED": 300,
      "DELIVERED": 100
    },
    "revenue": 150000.00
  },
  "products": {
    "total": 500,
    "lowStock": 25
  }
}
```

### List Users

```bash
curl -X GET "http://localhost:3000/admin/users?page=1&limit=20&role=ADMIN" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Update User Role

```bash
curl -X PATCH http://localhost:3000/admin/users/user-uuid/role \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "MANAGER"
  }'
```

### List Orders (Admin)

```bash
curl -X GET "http://localhost:3000/admin/orders?page=1&limit=20&status=PAID" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Shipping

### Get Shipping Rates

```bash
curl -X GET http://localhost:3000/shipping/orders/order-uuid/rates \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "rates": [
    {
      "carrier": "Mock Carrier",
      "service": "Standard",
      "cost": 10.99,
      "estimatedDays": 5,
      "currency": "USD"
    },
    {
      "carrier": "Mock Carrier",
      "service": "Express",
      "cost": 24.99,
      "estimatedDays": 2,
      "currency": "USD"
    }
  ]
}
```

### Create Shipment (Admin/Manager)

```bash
curl -X POST http://localhost:3000/shipping/orders/order-uuid/shipments \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "Standard"
  }'
```

### Track Shipment

```bash
curl -X GET http://localhost:3000/shipping/track/TRACK123456
```

---

## Health & Metrics

### Health Check

```bash
curl -X GET http://localhost:3000/health
```

### Detailed Health Check

```bash
curl -X GET http://localhost:3000/health/detailed
```

### Prometheus Metrics

```bash
curl -X GET http://localhost:3000/metrics
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Product with ID xxx not found"
}
```

**429 Too Many Requests:**
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## JavaScript/TypeScript Examples

### Using Fetch API

```javascript
// Register user
const response = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    name: 'John Doe',
  }),
});

const data = await response.json();
const accessToken = data.data.accessToken;

// Use token for authenticated requests
const productsResponse = await fetch('http://localhost:3000/products', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Set token after login
api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

// Make requests
const products = await api.get('/products');
const order = await api.post('/orders', {
  userId: 'user-uuid',
  items: [{ sku: 'SKU-001', quantity: 2 }],
});
```

---

## Postman Collection

See `docs/postman/e-commerce-backend.postman_collection.json` for a complete Postman collection with all endpoints pre-configured.

---

**Last Updated:** 2025-11-17  
**Version:** 1.0

