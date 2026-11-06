@IsTest
private class TriggerHandlerTest {
    /** Records which context methods ran; optionally throws to exercise error handling. */
    private class TestHandler extends TriggerHandler {
        public List<String> calls = new List<String>();
        public Boolean shouldThrow = false;

        protected override void beforeInsert() {
            record('beforeInsert');
        }
        protected override void beforeUpdate() {
            record('beforeUpdate');
        }
        protected override void beforeDelete() {
            record('beforeDelete');
        }
        protected override void afterInsert() {
            record('afterInsert');
        }
        protected override void afterUpdate() {
            record('afterUpdate');
        }
        protected override void afterDelete() {
            record('afterDelete');
        }
        protected override void afterUndelete() {
            record('afterUndelete');
        }

        private void record(String name) {
            if (shouldThrow) {
                throw new ValidationException('boom in ' + name);
            }
            calls.add(name);
        }
    }

    private static TestHandler newHandler(System.TriggerOperation op) {
        TestHandler handler = new TestHandler();
        handler.isTriggerExecuting = true;
        handler.context = op;
        TriggerHandler.bypassAllOverride = false;
        return handler;
    }

    @IsTest
    static void dispatchesEveryContext() {
        Map<System.TriggerOperation, String> expected = new Map<System.TriggerOperation, String>{
            System.TriggerOperation.BEFORE_INSERT => 'beforeInsert',
            System.TriggerOperation.BEFORE_UPDATE => 'beforeUpdate',
            System.TriggerOperation.BEFORE_DELETE => 'beforeDelete',
            System.TriggerOperation.AFTER_INSERT => 'afterInsert',
            System.TriggerOperation.AFTER_UPDATE => 'afterUpdate',
            System.TriggerOperation.AFTER_DELETE => 'afterDelete',
            System.TriggerOperation.AFTER_UNDELETE => 'afterUndelete'
        };
        for (System.TriggerOperation op : expected.keySet()) {
            TestHandler handler = newHandler(op);
            handler.run();
            Assert.areEqual(new List<String>{ expected.get(op) }, handler.calls, 'Wrong method for ' + op);
        }
    }

    @IsTest
    static void baseClassMethodsAreNoOps() {
        // A handler that overrides nothing must run cleanly in every context.
        for (System.TriggerOperation op : System.TriggerOperation.values()) {
            TriggerHandler handler = new TriggerHandler();
            handler.isTriggerExecuting = true;
            handler.context = op;
            TriggerHandler.bypassAllOverride = false;
            handler.run();
        }
        Assert.isTrue(true, 'No exception expected');
    }

    @IsTest
    static void bypassSkipsHandlerUntilCleared() {
        TestHandler handler = newHandler(System.TriggerOperation.BEFORE_INSERT);
        String name = handler.getHandlerName();

        TriggerHandler.bypass(name);
        Assert.isTrue(TriggerHandler.isBypassed(name), 'Handler should be bypassed');
        handler.run();
        Assert.isTrue(handler.calls.isEmpty(), 'Bypassed handler must not run');

        TriggerHandler.clearBypass(name);
        Assert.isFalse(TriggerHandler.isBypassed(name), 'Bypass should be cleared');
        handler.run();
        Assert.areEqual(1, handler.calls.size(), 'Handler should run after clearBypass');
    }

    @IsTest
    static void clearAllBypassesResetsEverything() {
        TriggerHandler.bypass('A');
        TriggerHandler.bypass('B');
        TriggerHandler.clearAllBypasses();
        Assert.isFalse(TriggerHandler.isBypassed('A'), 'A should be cleared');
        Assert.isFalse(TriggerHandler.isBypassed('B'), 'B should be cleared');
    }

    @IsTest
    static void bypassAllPermissionSkipsHandler() {
        TestHandler handler = newHandler(System.TriggerOperation.AFTER_UPDATE);
        TriggerHandler.bypassAllOverride = true;
        handler.run();
        Assert.isTrue(handler.calls.isEmpty(), 'Users with Bypass_All_Triggers must skip handlers');
    }

    @IsTest
    static void realPermissionCheckIsUsedWithoutOverride() {
        TestHandler handler = newHandler(System.TriggerOperation.AFTER_INSERT);
        TriggerHandler.bypassAllOverride = null; // fall through to FeatureManagement
        handler.run();
        Assert.areEqual(
            FeatureManagement.checkPermission(TriggerHandler.BYPASS_ALL_PERMISSION) ? 0 : 1,
            handler.calls.size(),
            'Run should follow the running user\'s custom permission'
        );
    }

    @IsTest
    static void inactiveSettingSkipsHandler() {
        TestHandler handler = newHandler(System.TriggerOperation.BEFORE_UPDATE);
        TriggerHandler.activeOverrides.put(handler.getHandlerName(), false);
        handler.run();
        Assert.isTrue(handler.calls.isEmpty(), 'Inactive Trigger_Setting__mdt must skip the handler');
    }

    @IsTest
    static void missingSettingMeansActive() {
        // No Trigger_Setting__mdt record exists for the test handler.
        TestHandler handler = newHandler(System.TriggerOperation.BEFORE_UPDATE);
        handler.run();
        Assert.areEqual(1, handler.calls.size(), 'Handler without a setting record should run');
    }

    @IsTest
    static void maxLoopCountStopsRecursion() {
        TestHandler handler = newHandler(System.TriggerOperation.AFTER_UPDATE);
        handler.setMaxLoopCount(1);
        handler.run();

        try {
            handler.run();
            Assert.fail('Second run should exceed the loop count');
        } catch (TriggerHandler.TriggerHandlerException ex) {
            Assert.isTrue(ex.getMessage().contains('Maximum loop count'), ex.getMessage());
        }
        Assert.areEqual(1, handler.calls.size(), 'Handler body should only run once');
    }

    @IsTest
    static void loopCountIsPerContext() {
        TestHandler beforeHandler = newHandler(System.TriggerOperation.BEFORE_INSERT);
        beforeHandler.setMaxLoopCount(1);
        beforeHandler.run();

        TestHandler afterHandler = newHandler(System.TriggerOperation.AFTER_INSERT);
        afterHandler.run();
        Assert.areEqual(1, afterHandler.calls.size(), 'After context has its own counter');
    }

    @IsTest
    static void clearMaxLoopCountRemovesLimit() {
        TestHandler handler = newHandler(System.TriggerOperation.AFTER_UPDATE);
        handler.setMaxLoopCount(1);
        handler.clearMaxLoopCount();
        handler.run();
        handler.run();
        Assert.areEqual(2, handler.calls.size(), 'No limit after clearMaxLoopCount');
    }

    @IsTest
    static void runOutsideTriggerThrows() {
        TriggerHandler handler = new TriggerHandler();
        try {
            handler.run();
            Assert.fail('run() outside a trigger must throw');
        } catch (TriggerHandler.TriggerHandlerException ex) {
            Assert.isTrue(ex.getMessage().contains('only be called from a trigger'), ex.getMessage());
        }
    }

    @IsTest
    static void unhandledExceptionIsLoggedAndRethrown() {
        TestHandler handler = newHandler(System.TriggerOperation.BEFORE_INSERT);
        handler.shouldThrow = true;

        Test.startTest();
        try {
            handler.run();
            Assert.fail('Exception should be re-thrown');
        } catch (ValidationException ex) {
            Assert.areEqual('boom in beforeInsert', ex.getMessage(), 'Original exception expected');
        }
        Test.stopTest(); // delivers the published Error_Log_Event__e

        List<Error_Log__c> logs = [
            SELECT Severity__c, Source_Class__c, Source_Method__c, Exception_Type__c, Message__c
            FROM Error_Log__c
            WITH SYSTEM_MODE
        ];
        Assert.areEqual(1, logs.size(), 'One log expected');
        Assert.areEqual('ERROR', logs[0].Severity__c, 'Severity');
        Assert.areEqual(handler.getHandlerName(), logs[0].Source_Class__c, 'Source class');
        Assert.areEqual('BEFORE_INSERT', logs[0].Source_Method__c, 'Source method');
        Assert.areEqual('ValidationException', logs[0].Exception_Type__c, 'Exception type');
        Assert.areEqual('boom in beforeInsert', logs[0].Message__c, 'Message');
    }

    @IsTest
    static void constructorReadsEmptyContextOutsideTrigger() {
        TriggerHandler handler = new TriggerHandler();
        Assert.isNull(handler.context, 'No trigger context outside a trigger');
        Assert.isFalse(handler.isTriggerExecuting, 'Not executing in a trigger');
    }
}
