/** __Object__ trigger logic. Delegates to the module service; override only the contexts you need. */
public with sharing class __Name__TriggerHandler extends TriggerHandler {
    protected override void beforeInsert() {
        // __Name__Service.setDefaults((List<__Object__>) newList);
    }

    protected override void afterUpdate() {
        // __Name__Service.handleChanges((List<__Object__>) newList, (Map<Id, __Object__>) oldMap);
    }
}
