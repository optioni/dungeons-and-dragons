## ADDED Requirements

### Requirement: Auth page with login and registration forms
The system SHALL provide a `/auth` route in the Nuxt web app that displays both a login form and a registration form. The page SHALL be accessible without authentication.

#### Scenario: Page loads without authentication
- **WHEN** an unauthenticated user navigates to `/auth`
- **THEN** the page renders without redirecting, showing both login and registration forms

#### Scenario: Forms are visually distinct and labeled
- **WHEN** the `/auth` page is rendered
- **THEN** the login and registration forms are clearly separated with distinct headings ("Log in" and "Create account")

### Requirement: Registration form submission
The system SHALL allow users to submit the registration form to create an account. On success, the JWT SHALL be stored in an httpOnly cookie and the user SHALL be redirected to the dashboard.

#### Scenario: Successful registration via form
- **WHEN** a user fills in a valid email and password (confirmed) and submits the registration form
- **THEN** the `register` mutation is called, the returned JWT is stored in an httpOnly cookie, and the user is redirected to `/`

#### Scenario: Registration validation error displayed
- **WHEN** the `register` mutation returns a GraphQL error (e.g., duplicate email, weak password)
- **THEN** the form displays the error message inline; no redirect occurs

#### Scenario: Password confirmation mismatch
- **WHEN** the user submits the registration form with mismatched password and confirmation fields
- **THEN** a client-side validation error is shown and the mutation is NOT called

### Requirement: Login form submission
The system SHALL allow users to submit the login form to authenticate. On success, the JWT SHALL be stored in an httpOnly cookie and the user SHALL be redirected to the dashboard.

#### Scenario: Successful login via form
- **WHEN** a user fills in a valid email and correct password and submits the login form
- **THEN** the `login` mutation is called, the returned JWT is stored in an httpOnly cookie, and the user is redirected to `/`

#### Scenario: Login error displayed
- **WHEN** the `login` mutation returns a GraphQL error (e.g., invalid credentials)
- **THEN** the form displays an "Invalid email or password" error message; no redirect occurs

#### Scenario: Authenticated user redirected away from auth page
- **WHEN** a user with a valid JWT navigates to `/auth`
- **THEN** the Nuxt middleware redirects them to `/` without showing the auth page

### Requirement: JWT storage in httpOnly cookie
The system SHALL store the JWT in an httpOnly, SameSite=Strict cookie. The cookie SHALL be set by the API on auth mutation success and SHALL NOT be readable by JavaScript.

#### Scenario: Cookie set on successful auth
- **WHEN** a `register` or `login` mutation succeeds
- **THEN** the API response includes a `Set-Cookie` header with the JWT in an httpOnly, SameSite=Strict cookie

#### Scenario: Cookie not accessible via JavaScript
- **WHEN** the JWT cookie is present in the browser
- **THEN** `document.cookie` does NOT include the JWT value

### Requirement: urql client sends JWT with every request
The urql client SHALL be configured with `credentials: 'include'` so that the httpOnly cookie is attached to every GraphQL request automatically. The auth exchange SHALL detect `UNAUTHORIZED` errors and redirect the user to `/auth`.

#### Scenario: Authenticated request attaches cookie automatically
- **WHEN** urql makes a GraphQL request while the JWT cookie is present
- **THEN** the browser includes the cookie in the request without any manual header manipulation

#### Scenario: UNAUTHORIZED error triggers redirect
- **WHEN** any GraphQL response contains an error with `extensions.code: 'UNAUTHORIZED'`
- **THEN** the urql auth exchange redirects the user to `/auth`
