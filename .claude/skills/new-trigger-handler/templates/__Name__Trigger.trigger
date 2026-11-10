trigger __Name__Trigger on __Object__(
    before insert,
    before update,
    before delete,
    after insert,
    after update,
    after delete,
    after undelete
) {
    new __Name__TriggerHandler().run();
}
