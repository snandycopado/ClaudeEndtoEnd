/** TEMPLATE — HttpCalloutMock for <System>Client tests: success, client error, server error, timeout. */
@IsTest
public class SystemClientMock implements HttpCalloutMock {
    public Integer statusCode = 200;
    public String body = '{"id":"EXT-1","status":"ACTIVE"}';
    public Boolean throwTimeout = false;

    public HttpResponse respond(HttpRequest req) {
        if (throwTimeout) {
            throw new CalloutException('Read timed out');
        }
        Assert.isTrue(req.getEndpoint().startsWith('callout:System_API'), 'must use the Named Credential');
        HttpResponse res = new HttpResponse();
        res.setStatusCode(statusCode);
        res.setHeader('Content-Type', 'application/json');
        res.setBody(body);
        return res;
    }

    public static SystemClientMock success() {
        return new SystemClientMock();
    }

    public static SystemClientMock failure(Integer statusCode) {
        SystemClientMock mock = new SystemClientMock();
        mock.statusCode = statusCode;
        mock.body = '{"error":"failure"}';
        return mock;
    }
}
