## 🏗️ Enterprise Tech Stack & Architecture

This platform is architected for high availability, zero-trust security, and massive data throughput to handle millions of component SKUs seamlessly.



### 1. Frontend: High-Performance Single Page Application (SPA)
*Optimized for rapid DOM rendering of massive data tables and complex state management without server bottlenecks.*
* **Core Framework:** React 18+ via Vite (Strict Mode enabled).
* **Language:** TypeScript (Mandatory for strict type-safety across millions of component parameters).
* **Server State & Caching:** TanStack Query (React Query) with persistent caching to ensure instant UI updates and minimal database hits.
* **Client State:** Zustand (for lightweight, scalable cross-component state).
* **UI/UX:** Tailwind CSS & shadcn/ui (Accessible, high-contrast, enterprise design language).

### 2. Edge Security & Delivery Network (WAF/CDN)
*The first line of defense against attacks and latency.*
* **Provider:** Cloudflare.
* **Security:** Enterprise Web Application Firewall (WAF) to block SQL injection, cross-site scripting (XSS), and DDoS attacks before they reach the React app.
* **Performance:** Global CDN caching for the static React assets, ensuring sub-100ms load times worldwide.
* **Rate Limiting:** Protects the backend APIs from bot scraping and brute-force login attempts.

### 3. Backend & Core Database: Massively Scalable PostgreSQL
*The engine driving real-time collaboration and AI vector searches.*
* **Platform:** Supabase (Enterprise Tier Architecture).
* **Database:** PostgreSQL 15+ with **Supavisor Connection Pooling** (Ensures the database doesn't crash when thousands of concurrent enterprise users upload BOMs simultaneously).
* **AI Vector Search:** `pgvector` indexed with HNSW (Hierarchical Navigable Small World) algorithms to search through millions of AI part embeddings in milliseconds.
* **High Availability:** Automated Point-in-Time Recovery (PITR) and daily encrypted backups.

### 4. Zero-Trust Security & Authentication
*Ensuring strict data isolation for proprietary corporate IP.*
* **Authentication:** Supabase Auth via PKCE (Proof Key for Code Exchange) flows for secure SPA session management.
* **Authorization (RLS):** Strict PostgreSQL Row Level Security (RLS). Every single database query is mathematically cryptographically bound to the user's session token. Cross-tenant data leakage is structurally impossible.
* **Secret Management:** Supabase Vault. API keys (Nexar, OpenAI, Stripe) are encrypted at rest inside the database and never exposed to the frontend.

### 5. Serverless Compute & Integrations (The Sourcing Engine)
*Executing heavy API sourcing and AI logic securely off-client.*
* **Compute:** Supabase Edge Functions (Deno/TypeScript) globally distributed to run nearest to the user.
* **Sourcing Data:** Nexar API (GraphQL) for real-time global inventory and pricing.
* **Intelligence:** OpenAI API (GPT-4o) for BOM parsing, risk forecasting, and alternative part generation.
* **Finance:** Stripe B2B API (Invoicing, ACH, Wire Transfers, automated tax calculation).
* **Logistics:** EasyPost API for real-time global freight tracking.

### 6. Enterprise Observability & Compliance
*Proactive monitoring for 99.99% uptime.*
* **Application Monitoring:** Sentry (Catches and alerts the engineering team of any React rendering errors or Edge Function failures in real-time).
* **Audit Logging:** Supabase pgAudit (Logs every database transaction for enterprise compliance and SOC2 requirements).
