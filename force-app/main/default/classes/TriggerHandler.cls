/**
 * Base class for every trigger handler in the org.
 *
 * Usage — one trigger per object, containing a single line:
 *
 *     trigger AccountTrigger on Account (before insert, before update, before delete,
 *                                         after insert, after update, after delete, after undelete) {
 *         new AccountTriggerHandler().run();
 *     }
 *
 *     public with sharing class AccountTriggerHandler extends TriggerHandler {
 *         protected override void beforeInsert() {
 *             AccountService.setDefaults((List<Account>) newList);
 *         }
 *     }
 *
 * Features
 *  - Dispatches to the matching context method (override only what you need).
 *  - Programmatic bypass:  TriggerHandler.bypass('AccountTriggerHandler'); ... clearBypass(...)
 *  - Org-level switch:     Trigger_Setting__mdt record with DeveloperName = handler name, Is_Active__c = false
 *  - User-level switch:    Bypass_All_Triggers custom permission (data loads / integration users)
 *  - Recursion guard:      setMaxLoopCount(n) per handler and context
 *  - Unhandled exceptions are logged through AppLogger (survives rollback) and re-thrown.
 */
public virtual class TriggerHandler {
    @TestVisible
    private static final String BYPASS_ALL_PERMISSION = 'Bypass_All_Triggers';

    private static Set<String> bypassedHandlers = new Set<String>();
    private static Map<String, Integer> loopCounts = new Map<String, Integer>();
    private static Map<String, Integer> maxLoopCounts = new Map<String, Integer>();

    /** Test seams: Custom Metadata and custom permissions cannot be created in Apex tests. */
    @TestVisible
    private static Map<String, Boolean> activeOverrides = new Map<String, Boolean>();
    @TestVisible
    private static Boolean bypassAllOverride;

    @TestVisible
    private Boolean isTriggerExecuting;
    @TestVisible
    private System.TriggerOperation context;

    protected List<SObject> newList;
    protected Map<Id, SObject> newMap;
    protected List<SObject> oldList;
    protected Map<Id, SObject> oldMap;

    private final String handlerName;

    public TriggerHandler() {
        // Resolved before the record collections are assigned, so String.valueOf stays cheap.
        this.handlerName = String.valueOf(this).substringBefore(':');
        this.isTriggerExecuting = Trigger.isExecuting;
        this.context = Trigger.operationType;
        this.newList = Trigger.new;
        this.newMap = Trigger.newMap;
        this.oldList = Trigger.old;
        this.oldMap = Trigger.oldMap;
    }

    // ------------------------------------------------------------------ entry point

    public void run() {
        if (!isTriggerExecuting || context == null) {
            throw new TriggerHandlerException('TriggerHandler.run() may only be called from a trigger.');
        }
        if (!shouldRun()) {
            return;
        }
        incrementLoopCount();

        try {
            dispatch();
        } catch (Exception ex) {
            AppLogger.error(ex, handlerName, String.valueOf(context));
            AppLogger.save();
            throw ex;
        }
    }

    private void dispatch() {
        switch on context {
            when BEFORE_INSERT {
                beforeInsert();
            }
            when BEFORE_UPDATE {
                beforeUpdate();
            }
            when BEFORE_DELETE {
                beforeDelete();
            }
            when AFTER_INSERT {
                afterInsert();
            }
            when AFTER_UPDATE {
                afterUpdate();
            }
            when AFTER_DELETE {
                afterDelete();
            }
            when AFTER_UNDELETE {
                afterUndelete();
            }
        }
    }

    // ------------------------------------------------------------------ context methods (override as needed)

    protected virtual void beforeInsert() {
    }
    protected virtual void beforeUpdate() {
    }
    protected virtual void beforeDelete() {
    }
    protected virtual void afterInsert() {
    }
    protected virtual void afterUpdate() {
    }
    protected virtual void afterDelete() {
    }
    protected virtual void afterUndelete() {
    }

    // ------------------------------------------------------------------ recursion guard

    /** Limits how many times this handler may run per context in one transaction. */
    public void setMaxLoopCount(Integer max) {
        maxLoopCounts.put(handlerName, max);
    }

    public void clearMaxLoopCount() {
        maxLoopCounts.remove(handlerName);
    }

    private void incrementLoopCount() {
        String key = handlerName + ':' + String.valueOf(context);
        Integer count = (loopCounts.containsKey(key) ? loopCounts.get(key) : 0) + 1;
        loopCounts.put(key, count);

        Integer max = maxLoopCounts.get(handlerName);
        if (max != null && count > max) {
            throw new TriggerHandlerException(
                'Maximum loop count of ' + max + ' reached in ' + handlerName + ' (' + context + ').'
            );
        }
    }

    // ------------------------------------------------------------------ bypass API

    public static void bypass(String name) {
        bypassedHandlers.add(name);
    }

    public static void clearBypass(String name) {
        bypassedHandlers.remove(name);
    }

    public static Boolean isBypassed(String name) {
        return bypassedHandlers.contains(name);
    }

    public static void clearAllBypasses() {
        bypassedHandlers.clear();
    }

    public String getHandlerName() {
        return handlerName;
    }

    private Boolean shouldRun() {
        return !isBypassed(handlerName) && !userBypassesAll() && isActiveInSettings();
    }

    private static Boolean userBypassesAll() {
        if (bypassAllOverride != null) {
            return bypassAllOverride;
        }
        return FeatureManagement.checkPermission(BYPASS_ALL_PERMISSION);
    }

    private Boolean isActiveInSettings() {
        if (activeOverrides.containsKey(handlerName)) {
            return activeOverrides.get(handlerName);
        }
        Trigger_Setting__mdt setting = Trigger_Setting__mdt.getInstance(handlerName);
        return setting == null || setting.Is_Active__c;
    }

    public class TriggerHandlerException extends Exception {
    }
}
