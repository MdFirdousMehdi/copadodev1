public with sharing class GroupController {
    
    @AuraEnabled(cacheable=true)
    public static List<Account> getGroups() {
            return [SELECT Id, Group_name__c 
                    FROM Account 
                    ORDER BY CreatedDate DESC
                    LIMIT 50];
    
    }


}
