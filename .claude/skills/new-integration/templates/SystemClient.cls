/**
 * TEMPLATE — <System> API client. Requires the Integration framework (IntegrationClient) to exist.
 * Endpoint and auth come only from the Named Credential `<System>_API`.
 */
public with sharing class SystemClient {
    private static final String NAMED_CREDENTIAL = 'callout:System_API';
    private static final String CLASS_NAME = 'SystemClient';

    public class SystemResponse {
        public String id;
        public String status;
    }

    public static SystemResponse getStatus(String externalId, Id recordId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NAMED_CREDENTIAL + '/v1/items/' + EncodingUtil.urlEncode(externalId, 'UTF-8'));
        req.setMethod('GET');
        req.setTimeout(20000);
        try {
            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() >= 300) {
                throw new IntegrationException('System returned ' + res.getStatusCode() + ': ' + res.getBody().abbreviate(500));
            }
            return (SystemResponse) JSON.deserialize(res.getBody(), SystemResponse.class);
        } catch (IntegrationException ex) {
            AppLogger.error(ex, CLASS_NAME, 'getStatus', recordId);
            throw ex;
        } catch (Exception ex) {
            AppLogger.error(ex, CLASS_NAME, 'getStatus', recordId);
            throw new IntegrationException('System callout failed: ' + ex.getMessage(), ex);
        }
    }
}
