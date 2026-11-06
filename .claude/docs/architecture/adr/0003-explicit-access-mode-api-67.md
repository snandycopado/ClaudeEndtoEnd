# ADR-0003: Always state the access mode in Apex (API 67)

- Status: Accepted (2026-11-06)
- Context: In this org at API 67, SOQL and DML in tests and triggers failed with "No such column" and
  "fields being inaccessible" for fields the running user could not see, and platform-event publishing
  failed with "Access to entity denied" for users without Create on the event.
- Decision: Every SOQL/DML states its mode — WITH USER_MODE / `as user` for user actions,
  WITH SYSTEM_MODE / AccessLevel.SYSTEM_MODE for automation, logs and audit. Every new field/object/class
  goes into a permission set in the same change. Tests run as a Standard User with the module permission set.
- Consequences: Security intent is explicit and reviewable; tests reflect real users. Updates must use fresh
  sObjects containing only editable fields.
