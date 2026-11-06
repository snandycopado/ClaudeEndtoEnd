/** Apex controller for the lcmVendorNotifier LWC (LCM tab on the Account record page). */
public with sharing class LcmNotificationController {
    private static final String CLASS_NAME = 'LcmNotificationController';

    @AuraEnabled(cacheable=true)
    public static List<Account> getInternalAccounts(Id accountId) {
        try {
            return LcmNotificationService.getInternalAccounts(accountId);
        } catch (Exception ex) {
            throw toAuraException(ex, 'getInternalAccounts', accountId);
        }
    }

    @AuraEnabled
    public static LcmNotificationService.SendResult sendNotification(
        Id accountId,
        List<Id> vendorIds,
        String notificationType,
        String comments
    ) {
        try {
            return LcmNotificationService.send(accountId, vendorIds, notificationType, comments);
        } catch (Exception ex) {
            throw toAuraException(ex, 'sendNotification', accountId);
        }
    }

    /** Validation messages go to the user as-is; anything unexpected is logged first. */
    private static AuraHandledException toAuraException(Exception ex, String method, Id recordId) {
        String message = ex.getMessage();
        if (!(ex instanceof ValidationException)) {
            AppLogger.error(ex, CLASS_NAME, method, recordId);
            AppLogger.save();
            message = 'Something went wrong: ' + message;
        }
        AuraHandledException auraEx = new AuraHandledException(message);
        auraEx.setMessage(message);
        return auraEx;
    }
}
