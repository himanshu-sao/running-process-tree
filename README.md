Below is a complete **implementation** prompt you can paste into a coding agent. It includes the agreed requirements, proposed defaults, security boundaries, and acceptance criteria.

***

# Build a Lightweight Service Dashboard for a RHEL 9 Jump Server

Act as a senior full-stack engineer with strong Linux, container, security, and product-design experience.

Build a complete, production-minded MVP of a polished service-discovery dashboard for a single RHEL 9 jump server. Implement the application, tests, configuration, and deployment documentation—not just a design or prototype.

## 1. Product goal

Create a central dashboard that answers:

- What web apps and other services are running on this jump server?
- Which ports are they listening on?
- Which apps respond to HTTP or HTTPS?
- What processes or Docker containers are associated with them?
- Which previously discovered services are now offline?
- How can I assign friendly names, categories, and tags to these services?

The dashboard is an index and monitoring application. It must not manage or modify the underlying services.

The user accesses it at:

```text
http://<jump-server-hostname>:<dashboard-port>
```

## 2. Confirmed constraints

- Monitor only the local jump server.
- Target RHEL 9.
- Run under an unprivileged account.
- Never require `sudo`, root, or a privileged container.
- Docker is used, and the runtime account already has access to Docker without `sudo`.
- No authentication in the initial release.
- All users who can access the dashboard can edit dashboard metadata.
- No start, stop, restart, kill, exec, or other service-management controls.
- Automatic discovery is required.
- Manual entry creation and metadata editing are required.
- Each entry has exactly one category and zero or more tags.
- Newly discovered entries immediately appear in “Uncategorized.”
- Previously discovered entries remain visible when offline until explicitly removed.
- Ports are usually stable, but Docker port mappings may change.
- Display PID and container name when available.
- Prioritize web apps and infrastructure services in the default view.
- Provide an “All services” view that includes non-web listeners.
- Provide polished cards and a light/dark theme switch.
- No preferred technology stack; choose a modern, lightweight, maintainable solution.

## 3. Engineering approach

Before implementing:

1. Inspect the existing repository, if any.
2. Select a small, coherent technology stack.
3. Briefly explain the choice and deployment model.
4. List material assumptions.
5. Then proceed with implementation without asking about ordinary design details.

Choose supported stable dependencies available at implementation time. Avoid unnecessary microservices, message brokers, external databases, orchestration, or heavy UI frameworks.

Prefer:

- One application backend.
- A frontend served by that backend where practical.
- SQLite or an equivalently lightweight local persistence solution.
- Background discovery independent of page requests.
- Native execution as an unprivileged systemd user service as the primary deployment path.

Do not assume a containerized deployment provides the same visibility into host listeners and processes as native execution. Container packaging is optional, not a requirement.

The finished UI must work without internet access after installation. Bundle required fonts, icons, scripts, and styles locally; do not use runtime CDNs.

## 4. Separate discovery, health, and organization

Do not conflate these concepts:

### Discovery source

Where an entry came from:

- Host listener discovery.
- Docker discovery.
- Manual creation.
- Infrastructure collector.

An entry may have more than one discovery source.

### Service type

Determines what the entry represents and how it can be checked:

- Web application.
- TCP listener.
- UDP listener, if implemented.
- Docker container.
- Infrastructure service.
- Manually configured service.

### Category

A user-controlled organizational group.

- Every entry belongs to one category.
- Default category: “Uncategorized.”
- Users can create, rename, and delete categories.
- Deleting a category moves its entries to “Uncategorized.”
- “Uncategorized” cannot be deleted.
- Categories do not change discovery or health behavior.

### Tags

- Multiple tags per entry.
- Add/remove tags in the UI.
- Normalize whitespace and avoid duplicate tags.
- Tags support filtering and search.

## 5. Automatic discovery

### Host listener discovery

Discover local listening TCP sockets and collect, where permitted:

- Transport protocol.
- Bind address.
- Port.
- PID.
- Process name.
- Available process identity information.

Requirements:

- Support IPv4 and IPv6.
- Avoid duplicate cards caused only by equivalent bind-address representations.
- Do not assume a process owns only one port.
- Do not use PID alone as a persistent service identifier.
- Missing process metadata must not prevent a listener from appearing.
- Never escalate privileges.
- Use structured interfaces where practical.
- If invoking a local utility, use fixed executable paths or validated configuration, argument arrays, timeouts, and no shell interpolation.
- Do not expose raw command execution through the API.
- Exclude the dashboard itself by default, with a configurable option to include it.

TCP discovery is required. UDP discovery is optional; if implemented, show “Bound” rather than implying that a UDP socket proves application health.

### HTTP/HTTPS detection

For eligible local TCP endpoints, perform bounded HTTP/HTTPS probes.

- Distinguish “port listening” from “HTTP responding.”
- Do not assume that a common port guarantees HTTP.
- Use short connection and request timeouts.
- Limit concurrency.
- Avoid aggressive or continuous retries.
- Do not download large response bodies.
- Do not execute returned content.
- Do not render response HTML in the dashboard.
- Support configurable probe scheme and path.
- Do not follow redirects automatically in the MVP; show the redirect status as a response.
- Do not scan external hosts.

The default health check is whether an HTTP response is received, not whether the status is 2xx.

For example:

- A 200 response means HTTP is responding.
- A 401 or 403 response still means HTTP is responding.
- A 500 response means HTTP is responding but returning a server error.
- A timeout does not prove the process is stopped.

Record:

- Probe result.
- HTTP status code, when received.
- Response duration.
- Last check time.
- Concise failure reason.
- TLS verification state when applicable.

Do not silently disable TLS verification. If support for self-signed certificates is added, make it an explicit per-entry option and display a warning.

### Docker discovery

Use Docker access already available to the runtime account.

Collect read-only information such as:

- Docker daemon availability.
- Container ID.
- Container name.
- Image name.
- Container state.
- Published host ports and container ports.
- Docker health state, when available.
- Selected identity metadata needed for reconciliation.

Never expose or invoke:

- Container creation or deletion.
- Start, stop, restart, kill, pause, or unpause.
- Container exec.
- Image deletion or pulling.
- Volume or network mutation.
- Arbitrary Docker API forwarding.

Make the Docker collector narrowly scoped and read-only by application design. Do not claim that the underlying Docker credentials or socket are read-only.

Do not expose container environment variables, credentials, full inspection payloads, or mounted secret contents.

Show Docker daemon status as an infrastructure entry even though it may not have a TCP listener.

Show containers without published web ports in the “All services” view.

### Infrastructure discovery

Include Docker daemon monitoring in the MVP.

Design the collector interface so additional local infrastructure checks can be added later. Do not claim generic systemd-service discovery is implemented unless it is actually built and tested.

When Docker or another collector cannot be queried, display “Unknown” or “Not accessible,” not a false “Offline.”

## 6. Service identity and reconciliation

Preserve user metadata across scans and restarts.

Use stable internal IDs independent of friendly names.

Persist metadata separately from transient observations.

### Host entries

Use an explicit identity strategy based on available process identity and endpoint information.

- Never rely solely on PID.
- Never silently merge unrelated services.
- Document matching limitations for generic host processes.
- If a match is uncertain, create a new entry instead of overwriting an existing entry’s metadata.

### Docker entries

Use exact container identity for confident matches.

For container recreation, consider a documented combination of available stable metadata, such as container name and Compose project/service labels.

Do not merge containers based on image name alone.

### Port changes

When a container-backed entry is confidently matched, update its endpoint information while retaining:

- Friendly name.
- Category.
- Tags.
- Description.
- Hidden state.
- User URL override.

If a container has multiple published endpoints, retain the endpoint list rather than arbitrarily choosing one and discarding the others.

### Cross-source deduplication

When host listener discovery and Docker discovery confidently describe the same published endpoint, display one reconciled entry with both sources.

Ambiguous records may remain separate rather than being incorrectly merged.

## 7. Health-state model

Do not reduce all observations to one misleading boolean.

Track independent observations where applicable:

- Listener state.
- HTTP response state.
- Container state.
- Docker-provided health.
- Infrastructure collector availability.
- Last successful observation.
- Last successful collector run.

Provide a clear summary label with supporting details, for example:

| Summary | Meaning |
|---|---|
| HTTP responding | An HTTP response was received; show its status code |
| Listening | A TCP listener exists, but HTTP response is not confirmed |
| Running | Docker reports the container as running |
| Offline | A successful relevant discovery cycle confirms the previously known service is absent or stopped |
| Unknown | There is insufficient trustworthy information |
| Not accessible | Permissions or connection access prevent inspection |

If discovery fails, retain the last known observation and mark it stale. Do not mark every service offline because a collector failed.

Use a configurable grace period or consecutive successful missing observations before declaring a discovered entry offline, to avoid flicker during restarts.

Keep offline entries until explicitly removed.

## 8. Manual entries and metadata

Allow users to create entries with:

- Friendly name.
- Service type.
- Local check address and port, if applicable.
- HTTP/HTTPS scheme and probe path, if applicable.
- Optional clickable URL.
- Category.
- Tags.
- Optional description.

Allow editing of discovered entries without changing the underlying service.

Keep these concepts separate:

- Detected endpoint.
- Health-check target.
- Clickable URL.

For example, an app may be checked through loopback while its browser link uses the jump server hostname.

Manual monitoring targets must remain local to this jump server. Validate and resolve destinations before connecting; do not permit arbitrary remote-network probes, URL credentials, unsupported schemes, or redirect-based escapes.

A clickable URL is not permission for the backend to fetch that URL.

Manual entries are health-checked according to their configured type and are not deleted by discovery.

## 9. Hide and remove behavior

Implement persistent hiding separately from removal.

### Hide

- Exclude an entry from normal views.
- Preserve metadata and discovery.
- Provide a hidden-items view.
- Allow restoring the entry.

### Remove

- Remove the saved entry and its metadata after confirmation.
- Explain that an automatically discovered service may reappear on a later scan if it is still present.
- Do not stop or modify the service.

Use “Hide” when the user wants a currently running service to stay out of the dashboard.

## 10. User interface

Build a polished, responsive, card-based interface—not a plain diagnostic table.

### Page structure

- Header with product name, theme switch, refresh control, and “Add service.”
- Compact summary counts for web apps, infrastructure, other services, and offline entries.
- Search field.
- Category filter.
- Tag filter.
- Status filter.
- View controls for:
  - Apps & infrastructure.
  - All services.
  - Offline.
  - Hidden.
- Responsive card grid.

The default view prioritizes web applications and infrastructure. Other listeners remain discoverable through “All services.”

### Cards

Show:

- Friendly name, with a sensible discovered fallback.
- Service-type icon and label.
- Category.
- Tags.
- Status badge with text, not color alone.
- Port or endpoint list.
- PID, when available.
- Container name, when available.
- Last checked or last seen.
- Open-app action when a valid clickable URL exists.
- Metadata editing and hide/remove actions.

Use expandable details for less common technical information.

Clearly distinguish editable names from detected process/container names.

### Visual quality

- Consistent spacing, typography, and rounded cards.
- Restrained shadows and borders.
- Accessible light and dark themes.
- Respect system theme initially; persist user preference.
- Visible keyboard focus.
- Accessible dialogs and form labels.
- Responsive layout.
- Helpful empty, loading, error, and offline states.
- Avoid layout shifts and excessive animation.

Do not show fake telemetry, uptime percentages, CPU/memory charts, or historical trends unless actually implemented.

## 11. Backend architecture and persistence

Use clear modules for:

- Host listener collector.
- Docker collector.
- HTTP probe worker.
- Identity reconciliation.
- Health-state calculation.
- Metadata persistence.
- API.
- Background scheduling.

Persist:

- Stable entry IDs and identity keys.
- User metadata.
- Categories and tags.
- Hidden state.
- Manual entry configuration.
- Last known observations and timestamps.
- Relevant application settings.

Use schema migrations.

Ensure scans and UI edits do not overwrite each other.

Keep metadata updates independent from observed-field updates.

Use configurable scan intervals and bounded concurrency. Prevent overlapping scans; coalesce or reject duplicate refresh requests predictably.

“Refresh” should request a background scan rather than block a browser request while probing everything.

## 12. API and security boundaries

Provide a small, documented API for:

- Listing and retrieving entries.
- Creating manual entries.
- Updating dashboard metadata.
- Hiding/restoring entries.
- Removing saved entries.
- Category and tag management.
- Requesting a scan.
- Reading collector status.
- Dashboard readiness and health.

There must be no service-control endpoint.

Even without login:

- Validate all input.
- Escape user-controlled display text.
- Restrict URL schemes to HTTP/HTTPS for app links.
- Reject URLs containing embedded credentials.
- Use appropriate same-origin protections for mutation requests.
- Disable permissive CORS.
- Validate expected host/origin configuration.
- Avoid SSRF through health targets.
- Never execute user-provided shell commands.
- Bound request sizes, probe concurrency, and refresh frequency.
- Avoid logging secrets or full sensitive Docker payloads.
- Provide a configurable bind address and allowed hostnames.

Document that no-login mode provides no user-level access control. Do not describe metadata editing as restricted to the owner.

## 13. Configuration and deployment

Provide configuration for:

- Bind address and dashboard port.
- Expected hostname.
- Data directory.
- Scan interval.
- Probe timeout and concurrency.
- Offline grace period.
- Docker connection.
- Collector enablement.
- Dashboard self-exclusion.
- Log level.

Include:

- Local development instructions.
- Build and test commands.
- Dependency installation instructions.
- RHEL 9 deployment instructions.
- An unprivileged systemd user-service example.
- Persistence and restart behavior.
- Backup/restore guidance.
- Troubleshooting for inaccessible process metadata or Docker.
- Clear instructions for any administrator-managed firewall, SELinux, or boot-start configuration that may be needed.

Do not solve deployment problems by disabling SELinux, weakening Docker socket permissions, using `chmod 666`, or requiring privileged execution.

Do not perform host-level administrative changes automatically.

## 14. Tests

Use deterministic fixtures and mocked collectors so the main test suite does not require root, live Docker, or a specific host process layout.

Test at least:

1. Listener discovery and parsing.
2. Missing PID/process permissions.
3. IPv4/IPv6 duplicate handling.
4. HTTP success, authentication responses, server errors, timeouts, and TLS failures.
5. Docker daemon available, unavailable, and inaccessible.
6. Container port changes with retained metadata.
7. Container recreation with confident and ambiguous identities.
8. Host/Docker endpoint reconciliation.
9. New entries assigned to “Uncategorized.”
10. Offline retention.
11. Collector failure resulting in stale/unknown status rather than false offline.
12. Category deletion reassigning entries.
13. Tag normalization.
14. Manual entries surviving discovery.
15. Hidden entries staying hidden across scans and restarts.
16. Removed live entries being rediscovered.
17. Metadata persistence across application restart.
18. Input validation, XSS resistance, and probe-target restrictions.
19. Theme persistence and basic keyboard accessibility.
20. Absence of service-management routes and Docker mutation calls.

Include an optional real-host smoke test separately.

## 15. Acceptance criteria

The MVP is complete when:

- It runs on RHEL 9 as an unprivileged user.
- It is accessible through the configured hostname and port.
- Local TCP listeners appear automatically.
- HTTP-responsive apps are distinguishable from merely listening processes.
- Docker daemon and container information appear when accessible.
- Missing permissions are represented honestly.
- New services appear immediately in “Uncategorized.”
- Friendly names, categories, tags, descriptions, and hidden state persist.
- Offline entries remain until removed.
- Confidently matched Docker port changes preserve metadata.
- Web apps and infrastructure are prioritized, with all services accessible.
- Manual entries can be added and edited.
- Cards display PID/container name when available.
- Light and dark themes work.
- No action changes an underlying process, container, or infrastructure service.
- Tests, deployment instructions, and known limitations are included.

## 16. Delivery instructions

Implement in working vertical slices:

1. Repository setup, configuration, persistence, and API.
2. Host and Docker discovery.
3. HTTP probing, reconciliation, and state handling.
4. Card UI and metadata workflows.
5. Tests, security review, and deployment documentation.

### Working loop

Maintain a todo list of tasks derived from the vertical slices above, and complete them one at a time in a repeating loop:

1. Pick any of the todo tasks.
2. Make the changes.
3. Test the changes.
4. Mark the task as done.
5. Repeat until every task is done.

Do not batch multiple tasks into one untested change, and do not mark a task done without testing it.

Do not stop after scaffolding. Do not substitute mocked data for working collectors in the final application. Keep mock/demo mode explicitly separate.

At completion, provide:

- Architecture summary.
- Technology choices and rationale.
- Implemented feature checklist.
- Commands to build, test, and run.
- RHEL 9 deployment steps.
- Tests actually executed and their results.
- Known limitations and unverified host-dependent behavior.

If something cannot be verified in the development environment, state that explicitly rather than claiming it works.

Keep the MVP focused: no multi-host monitoring, service-control features, authentication system, external telemetry platform, or unnecessary infrastructure.

---
