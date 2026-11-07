# MCP Test Workflow

## Purpose

Hướng dẫn AI Agent / MCP Browser tự động login và test toàn bộ hệ thống.

---

# Environment

Base URL:

http://localhost:3000

Fallback ports:

3001~3006

---

# Login Credentials

Email:

admin@edu.local

Password:

password

---

# Login Flow

1. Open /login

2. Wait login form render

3. Input email

4. Input password

5. Click submit

6. Wait redirect

7. Verify dashboard loaded

---

# Login Selectors Priority

Prefer:

- label Email
- label Password

Fallback:

input[name="email"]

input[name="password"]

button[type="submit"]

---

# Protected Routes

Bot must login before testing:

- /teachers
- /students
- /classes
- /schedules
- /student-fees
- /payments
- /receipts

---

# Test Checklist Per Module

Check:

- Page loads correctly
- API returns valid data
- Table renders correctly
- Search works
- Pagination works
- Create works
- Edit works
- Delete works
- Validation errors display correctly
- No severe console error

---

# Authentication Failure Rule

If redirected to /login:

1. Stop current test

2. Login again

3. Return to previous page

4. Continue testing

---

# API Validation Rules

Bot should verify all API responses follow format:

{
success: boolean,
data?: unknown,
error?: {
code: string,
message: string
}
}

---

# MCP Browser Prompt

Before testing:

1. Login first

2. Test module sequentially

3. Capture UI errors

4. Capture console errors

5. Validate API contract

6. Generate audit report
