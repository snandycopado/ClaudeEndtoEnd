/**
 * Emails the Account Owner for each newly created onboarding task that names an email template.
 * Runs asynchronously so a missing template or email failure never blocks onboarding;
 * every problem is written to Error_Log__c instead.
 */
public without sharing class OnboardingEmailQueueable implements Queueable {
    private static final String CLASS_NAME = 'OnboardingEmailQueueable';

    private final Set<Id> taskIds;

    @TestVisible
    private OnboardingEmailQueueable(Set<Id> taskIds) {
        this.taskIds = taskIds;
    }

    public static void enqueue(List<Onboarding_Task__c> tasks) {
        Set<Id> ids = new Set<Id>();
        for (Onboarding_Task__c task : tasks) {
            if (String.isNotBlank(task.Email_Template_Name__c)) {
                ids.add(task.Id);
            }
        }
        if (ids.isEmpty()) {
            return;
        }
        if (Limits.getQueueableJobs() >= Limits.getLimitQueueableJobs()) {
            AppLogger.warn('Queueable limit reached; onboarding emails skipped for ' + ids.size() + ' tasks', CLASS_NAME, 'enqueue');
            return;
        }
        System.enqueueJob(new OnboardingEmailQueueable(ids));
    }

    public void execute(QueueableContext context) {
        List<Onboarding_Task__c> tasks = [
            SELECT Id, Email_Template_Name__c, Account__r.OwnerId
            FROM Onboarding_Task__c
            WHERE Id IN :taskIds
            WITH SYSTEM_MODE
        ];

        Set<String> templateNames = new Set<String>();
        for (Onboarding_Task__c task : tasks) {
            templateNames.add(task.Email_Template_Name__c);
        }
        Map<String, Id> templateIdByName = new Map<String, Id>();
        for (EmailTemplate template : [
            SELECT Id, DeveloperName
            FROM EmailTemplate
            WHERE DeveloperName IN :templateNames AND IsActive = TRUE
            WITH SYSTEM_MODE
        ]) {
            templateIdByName.put(template.DeveloperName, template.Id);
        }

        List<Messaging.SingleEmailMessage> messages = new List<Messaging.SingleEmailMessage>();
        for (Onboarding_Task__c task : tasks) {
            Id templateId = templateIdByName.get(task.Email_Template_Name__c);
            if (templateId == null) {
                AppLogger.log(
                    AppLogger.Severity.WARN,
                    'Email template not found or inactive: ' + task.Email_Template_Name__c,
                    CLASS_NAME,
                    'execute',
                    task.Id
                );
                continue;
            }
            try {
                messages.add(buildMessage(templateId, task.Account__r.OwnerId, task.Id));
            } catch (Exception ex) {
                AppLogger.error(ex, CLASS_NAME, 'buildMessage', task.Id);
            }
        }

        if (!messages.isEmpty()) {
            try {
                for (Messaging.SendEmailResult result : Messaging.sendEmail(messages, false)) {
                    if (!result.isSuccess()) {
                        for (Messaging.SendEmailError err : result.getErrors()) {
                            AppLogger.log(AppLogger.Severity.ERROR, 'Email failed: ' + err.getMessage(), CLASS_NAME, 'execute', err.getTargetObjectId());
                        }
                    }
                }
            } catch (Exception ex) {
                // e.g. email deliverability switched off in the org
                AppLogger.error(ex, CLASS_NAME, 'execute');
            }
        }
        AppLogger.save();
    }

    /** Renders the template against the task (merge fields) and addresses it to the owner. */
    private static Messaging.SingleEmailMessage buildMessage(Id templateId, Id ownerId, Id taskId) {
        Messaging.SingleEmailMessage rendered = Messaging.renderStoredEmailTemplate(templateId, ownerId, taskId);
        Messaging.SingleEmailMessage message = new Messaging.SingleEmailMessage();
        message.setTargetObjectId(ownerId);
        message.setSubject(rendered.getSubject());
        message.setPlainTextBody(rendered.getPlainTextBody());
        if (String.isNotBlank(rendered.getHtmlBody())) {
            message.setHtmlBody(rendered.getHtmlBody());
        }
        message.setSaveAsActivity(false);
        return message;
    }
}
