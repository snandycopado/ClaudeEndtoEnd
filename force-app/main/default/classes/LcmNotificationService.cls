/**
 * LCM (Lifecycle Management): notify Internal (vendor) accounts about a new or changed account.
 *
 * One email per selected vendor, sent to the vendor's Account.Email__c, containing the account's
 * details from the LCM_Notification_Fields field set. Every outcome (Sent / Skipped / Failed) is
 * recorded in LCM_Notification__c.
 *
 * Runs with sharing and in user mode for reads: the sender can only notify about, and only
 * notify, accounts they can see. The audit insert runs in system mode so history is always kept.
 */
public with sharing class LcmNotificationService {
    public static final String INTERNAL_RECORD_TYPE = 'Internal';
    public static final String TYPE_NEW_ACCOUNT = 'New Account';
    public static final String TYPE_ACCOUNT_UPDATE = 'Account Update';
    public static final String STATUS_SENT = 'Sent';
    public static final String STATUS_SKIPPED = 'Skipped';
    public static final String STATUS_FAILED = 'Failed';
    public static final String FIELD_SET = 'LCM_Notification_Fields';
    public static final Integer MAX_VENDORS = 100;
    public static final Integer MAX_COMMENTS = 1000;

    private static final Set<String> NOTIFICATION_TYPES = new Set<String>{ TYPE_NEW_ACCOUNT, TYPE_ACCOUNT_UPDATE };
    private static final String CLASS_NAME = 'LcmNotificationService';

    public class SendResult {
        @AuraEnabled
        public Integer sent = 0;
        @AuraEnabled
        public Integer skipped = 0;
        @AuraEnabled
        public Integer failed = 0;
        @AuraEnabled
        public List<String> problems = new List<String>();
    }

    // ------------------------------------------------------------------ queries

    /** Internal (vendor) accounts the user can see, excluding the account being viewed. */
    public static List<Account> getInternalAccounts(Id excludeAccountId) {
        return [
            SELECT Id, Name, Email__c, Industry, Phone, BillingCity, BillingCountry
            FROM Account
            WHERE RecordType.DeveloperName = :INTERNAL_RECORD_TYPE AND Id != :excludeAccountId
            WITH USER_MODE
            ORDER BY Name
            LIMIT 2000
        ];
    }

    // ------------------------------------------------------------------ send

    public static SendResult send(Id accountId, List<Id> vendorIds, String notificationType, String comments) {
        validate(accountId, vendorIds, notificationType, comments);

        Account subject = loadAccount(accountId);
        Set<Id> requested = new Set<Id>(vendorIds);
        List<Account> vendors = [
            SELECT Id, Name, Email__c
            FROM Account
            WHERE Id IN :requested AND Id != :accountId AND RecordType.DeveloperName = :INTERNAL_RECORD_TYPE
            WITH USER_MODE
            ORDER BY Name
        ];

        SendResult result = new SendResult();
        Integer notEligible = requested.size() - vendors.size();
        if (notEligible > 0) {
            result.skipped += notEligible;
            result.problems.add(notEligible + ' selected account(s) are not accessible Internal vendor accounts.');
        }

        List<LCM_Notification__c> audit = new List<LCM_Notification__c>();
        List<Account> sendable = new List<Account>();
        for (Account vendor : vendors) {
            if (String.isBlank(vendor.Email__c)) {
                audit.add(auditRecord(subject, vendor, notificationType, comments, STATUS_SKIPPED, 'Vendor has no email address'));
                result.skipped++;
                result.problems.add(vendor.Name + ': no email address.');
            } else {
                sendable.add(vendor);
            }
        }

        if (!sendable.isEmpty()) {
            List<String> sendErrors = deliver(subject, sendable, notificationType, comments);
            for (Integer i = 0; i < sendable.size(); i++) {
                Account vendor = sendable[i];
                String error = sendErrors[i];
                if (error == null) {
                    audit.add(auditRecord(subject, vendor, notificationType, comments, STATUS_SENT, null));
                    result.sent++;
                } else {
                    audit.add(auditRecord(subject, vendor, notificationType, comments, STATUS_FAILED, error));
                    result.failed++;
                    result.problems.add(vendor.Name + ': ' + error);
                }
            }
        }

        Database.insert(audit, AccessLevel.SYSTEM_MODE);
        if (result.failed > 0) {
            AppLogger.log(
                AppLogger.Severity.ERROR,
                result.failed + ' LCM notification(s) failed: ' + String.join(result.problems, ' | '),
                CLASS_NAME,
                'send',
                accountId
            );
            AppLogger.save();
        }
        return result;
    }

    /** Sends one email per vendor. Returns an error message per vendor (null = sent), same order. */
    private static List<String> deliver(Account subject, List<Account> vendors, String notificationType, String comments) {
        List<String> errors = new List<String>();
        try {
            Messaging.reserveSingleEmailCapacity(vendors.size());
        } catch (Exception ex) {
            return repeat('Daily email limit reached: ' + ex.getMessage(), vendors.size());
        }

        List<FieldRow> rows = detailRows(subject);
        String subjectLine = '[' + notificationType + '] ' + subject.Name;
        String htmlBody = buildHtmlBody(subject, rows, notificationType, comments);
        String textBody = buildTextBody(subject, rows, notificationType, comments);

        List<Messaging.SingleEmailMessage> messages = new List<Messaging.SingleEmailMessage>();
        for (Account vendor : vendors) {
            Messaging.SingleEmailMessage message = new Messaging.SingleEmailMessage();
            message.setToAddresses(new List<String>{ vendor.Email__c });
            message.setSubject(subjectLine);
            message.setHtmlBody(htmlBody);
            message.setPlainTextBody(textBody);
            message.setReplyTo(UserInfo.getUserEmail());
            message.setSenderDisplayName(UserInfo.getName());
            message.setSaveAsActivity(false);
            messages.add(message);
        }

        try {
            for (Messaging.SendEmailResult sendResult : Messaging.sendEmail(messages, false)) {
                if (sendResult.isSuccess()) {
                    errors.add(null);
                } else {
                    List<String> messagesForVendor = new List<String>();
                    for (Messaging.SendEmailError err : sendResult.getErrors()) {
                        messagesForVendor.add(err.getMessage());
                    }
                    errors.add(String.join(messagesForVendor, '; ').abbreviate(255));
                }
            }
        } catch (Exception ex) {
            // e.g. email deliverability switched off in the org
            return repeat(ex.getMessage().abbreviate(255), vendors.size());
        }
        return errors;
    }

    // ------------------------------------------------------------------ validation & loading

    private static void validate(Id accountId, List<Id> vendorIds, String notificationType, String comments) {
        if (accountId == null) {
            throw new ValidationException('An account is required.');
        }
        if (vendorIds == null || vendorIds.isEmpty()) {
            throw new ValidationException('Select at least one vendor account.');
        }
        if (vendorIds.size() > MAX_VENDORS) {
            throw new ValidationException('You can notify at most ' + MAX_VENDORS + ' vendors at a time.');
        }
        if (!NOTIFICATION_TYPES.contains(notificationType)) {
            throw new ValidationException('Notification type must be "' + TYPE_NEW_ACCOUNT + '" or "' + TYPE_ACCOUNT_UPDATE + '".');
        }
        if (comments != null && comments.length() > MAX_COMMENTS) {
            throw new ValidationException('Comments can be at most ' + MAX_COMMENTS + ' characters.');
        }
    }

    /** Field set fields the user can read (unreadable ones are left out instead of failing the send). */
    @TestVisible
    private static List<Schema.FieldSetMember> notificationFields() {
        List<Schema.FieldSetMember> readable = new List<Schema.FieldSetMember>();
        Schema.FieldSet fieldSet = Schema.SObjectType.Account.fieldSets.getMap().get(FIELD_SET);
        if (fieldSet == null) {
            return readable;
        }
        Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Account.fields.getMap();
        for (Schema.FieldSetMember member : fieldSet.getFields()) {
            Schema.SObjectField field = fieldMap.get(member.getFieldPath());
            if (field != null && field.getDescribe().isAccessible()) {
                readable.add(member);
            }
        }
        return readable;
    }

    @TestVisible
    private static Account loadAccount(Id accountId) {
        Set<String> fields = new Set<String>{ 'Id', 'Name', 'Owner.Name', 'RecordType.Name' };
        for (Schema.FieldSetMember member : notificationFields()) {
            fields.add(member.getFieldPath());
        }
        List<Account> found = Database.queryWithBinds(
            'SELECT ' + String.join(new List<String>(fields), ', ') + ' FROM Account WHERE Id = :accountId',
            new Map<String, Object>{ 'accountId' => accountId },
            AccessLevel.USER_MODE
        );
        if (found.isEmpty()) {
            throw new ValidationException('Account not found or not accessible.');
        }
        return found[0];
    }

    // ------------------------------------------------------------------ email content

    @TestVisible
    private class FieldRow {
        public String label;
        public String value;
        FieldRow(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    @TestVisible
    private static List<FieldRow> detailRows(Account subject) {
        List<FieldRow> rows = new List<FieldRow>();
        for (Schema.FieldSetMember member : notificationFields()) {
            rows.add(new FieldRow(member.getLabel(), format(subject.get(member.getFieldPath()))));
        }
        rows.add(new FieldRow('Record Type', subject.RecordType?.Name));
        rows.add(new FieldRow('Account Owner', subject.Owner?.Name));
        return rows;
    }

    private static String format(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean) {
            return (Boolean) value ? 'Yes' : 'No';
        }
        if (value instanceof Datetime) {
            return ((Datetime) value).format();
        }
        if (value instanceof Date) {
            return ((Date) value).format();
        }
        return String.valueOf(value);
    }

    @TestVisible
    private static String buildHtmlBody(Account subject, List<FieldRow> rows, String notificationType, String comments) {
        String intro = notificationType == TYPE_NEW_ACCOUNT
            ? 'A new account has been created in Salesforce.'
            : 'An account has been updated in Salesforce.';
        String html =
            '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#181818;">' +
            '<p>Hello,</p><p>' + intro + ' Please review the details below and update your records.</p>';
        if (String.isNotBlank(comments)) {
            html += '<p><strong>Message from ' + UserInfo.getName().escapeHtml4() + ':</strong><br/>' +
                comments.escapeHtml4().replace('\n', '<br/>') + '</p>';
        }
        html += '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #d8dde6;">' +
            '<tr><th colspan="2" style="background:#f3f3f3;text-align:left;border:1px solid #d8dde6;">' +
            subject.Name.escapeHtml4() + '</th></tr>';
        for (FieldRow row : rows) {
            html += '<tr><td style="border:1px solid #d8dde6;color:#444;"><strong>' + row.label.escapeHtml4() +
                '</strong></td><td style="border:1px solid #d8dde6;">' +
                (row.value == null ? '&mdash;' : row.value.escapeHtml4().replace('\n', '<br/>')) + '</td></tr>';
        }
        html += '</table><p style="color:#706e6b;font-size:12px;">Sent by ' + UserInfo.getName().escapeHtml4() +
            ' via Salesforce Lifecycle Management. Reply to this email to contact the sender.</p></div>';
        return html;
    }

    @TestVisible
    private static String buildTextBody(Account subject, List<FieldRow> rows, String notificationType, String comments) {
        List<String> lines = new List<String>{
            'Hello,',
            '',
            (notificationType == TYPE_NEW_ACCOUNT ? 'A new account has been created in Salesforce.' : 'An account has been updated in Salesforce.') +
            ' Please review the details below and update your records.',
            ''
        };
        if (String.isNotBlank(comments)) {
            lines.add('Message from ' + UserInfo.getName() + ':');
            lines.add(comments);
            lines.add('');
        }
        lines.add(subject.Name);
        for (FieldRow row : rows) {
            lines.add('  ' + row.label + ': ' + (row.value == null ? '-' : row.value));
        }
        lines.add('');
        lines.add('Sent by ' + UserInfo.getName() + ' via Salesforce Lifecycle Management.');
        return String.join(lines, '\n');
    }

    // ------------------------------------------------------------------ helpers

    private static LCM_Notification__c auditRecord(
        Account subject,
        Account vendor,
        String notificationType,
        String comments,
        String status,
        String error
    ) {
        return new LCM_Notification__c(
            Account__c = subject.Id,
            Vendor_Account__c = vendor.Id,
            Email__c = vendor.Email__c,
            Notification_Type__c = notificationType,
            Comments__c = comments,
            Status__c = status,
            Error_Message__c = error?.abbreviate(255)
        );
    }

    private static List<String> repeat(String value, Integer count) {
        List<String> values = new List<String>();
        for (Integer i = 0; i < count; i++) {
            values.add(value);
        }
        return values;
    }
}
