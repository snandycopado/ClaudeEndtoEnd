/**
 * Root of the application exception hierarchy. Throw a subclass (or this) instead of
 * System exceptions for business failures, so callers can catch ApplicationException
 * and handle all app errors in one place.
 *
 *     throw new ValidationException('Start date must be in the future');
 *     throw new IntegrationException('SSO provider returned 503', calloutEx);
 */
public virtual class ApplicationException extends Exception {
}
