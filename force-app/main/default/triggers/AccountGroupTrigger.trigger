trigger AccountGroupTrigger on Account (after insert) {
    for (Account acc : Trigger.new) {
        if (acc.Group_name__c!= null) {
            System.debug('Group field value: ' + acc.Group_name__c);
        }
    }
}