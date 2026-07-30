
## Error Format

```json
{
    "success": false,
    "error": {
        "code": "",
        "message": ""
    }
}
```

---

# HTTP Status Codes

## 200 OK

Successful GET or PATCH request.

---

## 201 Created

Resource successfully created.

---

## 204 No Content

Successful DELETE request.

---

## 400 Bad Request

Validation failed.

---

## 401 Unauthorized

Missing or invalid authentication.

---

## 403 Forbidden

Authenticated but lacks permission.

---

## 404 Not Found

Requested resource does not exist.

---

## 409 Conflict

Resource conflict.

Examples:

- Duplicate email
- Duplicate organization slug

---

## 429 Too Many Requests

Request rate limit exceeded.

---

## 422 Unprocessable Entity (Optional)

Semantically invalid input.

May be replaced with HTTP 400 for simplicity.

---

## 500 Internal Server Error

Unexpected server error.

---

## 503 Service Unavailable

An upstream service is temporarily unavailable.
